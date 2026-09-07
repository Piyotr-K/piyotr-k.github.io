import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { RideInput } from './input';
import { RideController, RideSnapshot } from './rideController';
import { buildScenery, Scenery } from './scenery';
import { Track } from './track';
import { buildTrackVisuals, TrackVisuals } from './trackMesh';

const LOCAL_ROLL_AXIS = new THREE.Vector3(0, 0, 1);
/** How much the car leans into a corner. Bigger = flatter. */
const BANK_STIFFNESS = 34;
const MAX_BANK = 0.55;
const DUST_COUNT = 420;
const DUST_RANGE = 110;

export interface RideEngineOptions {
  onState: (snapshot: RideSnapshot) => void;
}

/**
 * Owns the three.js side of the ride: the scene, the car's camera rig and the
 * animation loop. The car's position comes from RideController, its orientation
 * from the Track's frames, and the rider's free-look is layered on top of both
 * so you can stare wherever you like while the ride carries you along.
 */
export class RideEngine {
  readonly track = new Track();

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly clock = new THREE.Clock();

  private readonly controller: RideController;
  private readonly input: RideInput;
  private readonly scenery: Scenery;
  private readonly visuals: TrackVisuals;

  /** Rides the rail; the camera hangs off it. */
  private readonly car = new THREE.Group();
  private readonly dust: THREE.LineSegments;
  private readonly dustPositions: Float32Array;
  private readonly dustSeeds: Float32Array;

  private readonly onState: (snapshot: RideSnapshot) => void;
  private readonly disposables: { dispose: () => void }[] = [];

  private readonly tmpPosition = new THREE.Vector3();
  private readonly tmpQuaternion = new THREE.Quaternion();
  private readonly bankQuaternion = new THREE.Quaternion();

  private bank = 0;
  private frameHandle = 0;
  private stateTimer = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement, options: RideEngineOptions) {
    this.onState = options.onState;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.setClearColor(0x03030c, 1);

    this.camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 9000);
    this.camera.rotation.order = 'YXZ';

    this.controller = new RideController(this.track, 0);
    this.scenery = buildScenery(this.scene);
    this.visuals = buildTrackVisuals(this.track);
    this.scene.add(this.visuals.group);

    this.buildCar();
    const dust = this.buildDust();
    this.dust = dust.lines;
    this.dustPositions = dust.positions;
    this.dustSeeds = dust.seeds;
    this.car.add(this.dust);
    this.scene.add(this.car);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.42,
      0.55,
      0.78,
    );
    this.composer.addPass(this.bloom);

    this.input = new RideInput(canvas, {
      onThrottleDelta: (delta) => this.controller.nudgeThrottle(delta),
      onToggleAutoRide: () => this.controller.setAutoRide(!this.controller.autoRide),
      onToggleAutoStop: () => this.controller.setAutoStop(!this.controller.autoStop),
      onReverse: () => this.reverse(),
    });

    // Sit the car on the first stop before the first frame is drawn.
    this.placeCar(true);
    this.publishState();
  }

  // ------------------------------------------------------------- lifecycle

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      this.frameHandle = requestAnimationFrame(loop);
      this.frame();
    };
    this.frameHandle = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameHandle);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.bloom.setSize(width, height);
  }

  dispose(): void {
    this.stop();
    this.input.dispose();
    this.visuals.dispose();
    this.scenery.dispose();
    (this.composer as unknown as { dispose?: () => void }).dispose?.();
    for (const item of this.disposables) item.dispose();
    this.renderer.dispose();
  }

  // ---------------------------------------------------------------- driving

  setThrottle(value: number): void {
    this.controller.setThrottle(value);
    this.publishState();
  }

  setAutoRide(on: boolean): void {
    this.controller.setAutoRide(on);
    this.publishState();
  }

  setAutoStop(on: boolean): void {
    this.controller.setAutoStop(on);
    this.publishState();
  }

  /** Drive from the on-screen controls: 1 forward, -1 back, 0 released. */
  setVirtualDrive(direction: 0 | 1 | -1): void {
    this.input.setVirtualDrive(direction);
  }

  depart(direction: 1 | -1): void {
    this.controller.depart(direction);
    this.publishState();
  }

  reverse(): void {
    const next: 1 | -1 = this.controller.direction === 1 ? -1 : 1;
    if (this.controller.isDocked) {
      this.controller.depart(next);
    } else {
      this.controller.direction = next;
    }
    this.publishState();
  }

  jumpTo(stationIndex: number): void {
    this.controller.jumpTo(stationIndex);
    this.placeCar(true);
    this.publishState();
  }

  recentreView(): void {
    this.input.recentre();
  }

  // ----------------------------------------------------------------- private

  private frame(): void {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;

    this.controller.update(dt, this.input.state);
    this.input.update(dt);
    this.placeCar(false, dt);
    this.updateDust(dt);

    this.scenery.update(elapsed);
    this.visuals.update(elapsed, this.controller.u);

    this.composer.render();

    this.stateTimer += dt;
    if (this.stateTimer > 0.1) {
      this.stateTimer = 0;
      this.publishState();
    }
  }

  /**
   * Puts the car on the rail: exact position from the controller, orientation
   * from the track frame plus a little banking into corners, then the rider's
   * free-look on top as a purely local camera rotation.
   */
  private placeCar(immediate: boolean, dt = 0): void {
    const u = this.controller.u;
    this.track.positionAt(u, this.tmpPosition);
    this.car.position.copy(this.tmpPosition);

    this.track.orientationAt(u, this.tmpQuaternion);

    const velocity = this.controller.velocity;
    const curvature = this.track.lateralCurvatureAt(u);
    const targetBank = THREE.MathUtils.clamp(
      (-curvature * velocity * velocity) / BANK_STIFFNESS,
      -MAX_BANK,
      MAX_BANK,
    );
    this.bank = immediate ? targetBank : this.bank + (targetBank - this.bank) * (1 - Math.exp(-dt * 3));
    this.tmpQuaternion.multiply(this.bankQuaternion.setFromAxisAngle(LOCAL_ROLL_AXIS, this.bank));

    if (immediate) {
      this.car.quaternion.copy(this.tmpQuaternion);
    } else {
      // Softening the rotation only (never the position) keeps the ride glued
      // to the rail while taking the edge off tight corners.
      this.car.quaternion.slerp(this.tmpQuaternion, 1 - Math.exp(-dt * 16));
    }

    const speed = Math.abs(velocity);
    const shake = Math.min(speed / 90, 1) * 0.035;
    this.camera.position.set(
      (Math.random() - 0.5) * shake,
      0.62 + (Math.random() - 0.5) * shake,
      0.45,
    );
    this.camera.rotation.set(this.input.pitch, this.input.yaw, 0);
    // A hint of extra field of view at speed.
    const targetFov = 74 + Math.min(speed / 90, 1) * 12;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * (immediate ? 1 : 1 - Math.exp(-dt * 4));
      this.camera.updateProjectionMatrix();
    }
  }

  private buildCar(): void {
    const keep = <T extends { dispose: () => void }>(item: T): T => {
      this.disposables.push(item);
      return item;
    };

    const shell = keep(
      new THREE.MeshStandardMaterial({ color: 0x1a1f3d, roughness: 0.55, metalness: 0.7 }),
    );
    const trim = keep(
      new THREE.MeshStandardMaterial({
        color: 0x0d1330,
        emissive: 0x39d2ff,
        emissiveIntensity: 1.8,
        roughness: 0.4,
        metalness: 0.4,
      }),
    );

    const floor = new THREE.Mesh(keep(new THREE.BoxGeometry(2.4, 0.16, 3.6)), shell);
    floor.position.set(0, -0.42, 0.3);
    this.car.add(floor);

    const nose = new THREE.Mesh(keep(new THREE.ConeGeometry(0.62, 1.9, 6)), shell);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, -0.34, -2.6);
    this.car.add(nose);

    const dash = new THREE.Mesh(keep(new THREE.BoxGeometry(1.9, 0.38, 0.16)), trim);
    dash.position.set(0, -0.16, -1.55);
    dash.rotation.x = -0.25;
    this.car.add(dash);

    const sideGeometry = keep(new THREE.BoxGeometry(0.16, 0.6, 3.2));
    for (const x of [-1.15, 1.15]) {
      const side = new THREE.Mesh(sideGeometry, shell);
      side.position.set(x, -0.1, 0.3);
      this.car.add(side);
      const rail = new THREE.Mesh(keep(new THREE.BoxGeometry(0.1, 0.08, 3.2)), trim);
      rail.position.set(x, 0.22, 0.3);
      this.car.add(rail);
    }

    // Headlights, so there is something lighting the rail ahead.
    const headlight = new THREE.SpotLight(0xbfe4ff, 3.2, 260, 0.5, 0.5, 1.2);
    headlight.position.set(0, 0.2, -1.6);
    headlight.target.position.set(0, -0.2, -40);
    this.car.add(headlight);
    this.car.add(headlight.target);

    this.car.add(this.camera);
  }

  /**
   * Streaks of dust in the car's local space. They drift past at the car's own
   * speed and stretch as it goes faster, which is what actually sells the
   * sensation of movement between stations.
   */
  private buildDust(): { lines: THREE.LineSegments; positions: Float32Array; seeds: Float32Array } {
    const positions = new Float32Array(DUST_COUNT * 6);
    const seeds = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 6 + Math.random() * 42;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 0.7;
      const z = (Math.random() * 2 - 1) * DUST_RANGE;
      seeds[i * 3] = x;
      seeds[i * 3 + 1] = y;
      seeds[i * 3 + 2] = z;
      positions[i * 6] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = x;
      positions[i * 6 + 4] = y;
      positions[i * 6 + 5] = z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: 0xa8dcff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.disposables.push(geometry, material);

    const lines = new THREE.LineSegments(geometry, material);
    lines.frustumCulled = false;
    return { lines, positions, seeds };
  }

  private updateDust(dt: number): void {
    const velocity = this.controller.velocity;
    const speed = Math.abs(velocity);
    const material = this.dust.material as THREE.LineBasicMaterial;
    material.opacity = Math.min(speed / 55, 1) * 0.55;
    if (material.opacity <= 0.001) return;

    const streak = THREE.MathUtils.clamp(speed * 0.32, 0.5, 22) * Math.sign(velocity || 1);
    for (let i = 0; i < DUST_COUNT; i++) {
      let z = this.seedZ(i) + velocity * dt;
      if (z > DUST_RANGE) z -= DUST_RANGE * 2;
      else if (z < -DUST_RANGE) z += DUST_RANGE * 2;
      this.dustSeeds[i * 3 + 2] = z;

      const x = this.dustSeeds[i * 3];
      const y = this.dustSeeds[i * 3 + 1];
      const o = i * 6;
      this.dustPositions[o] = x;
      this.dustPositions[o + 1] = y;
      this.dustPositions[o + 2] = z;
      this.dustPositions[o + 3] = x;
      this.dustPositions[o + 4] = y;
      this.dustPositions[o + 5] = z + streak;
    }
    (this.dust.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  private seedZ(i: number): number {
    return this.dustSeeds[i * 3 + 2];
  }

  private publishState(): void {
    this.onState(this.controller.snapshot());
  }
}
