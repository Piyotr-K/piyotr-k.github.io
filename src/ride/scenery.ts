import * as THREE from 'three';

/**
 * The space around the track: stars, nebula clouds, a handful of planets and
 * the light they are lit by. Purely decorative - nothing here is on the ride's
 * critical path, so it is all static geometry built once.
 */
export interface Scenery {
  update: (elapsed: number) => void;
  dispose: () => void;
}

const SUN_DIRECTION = new THREE.Vector3(-0.45, 0.55, -0.7).normalize();

export function buildScenery(scene: THREE.Scene): Scenery {
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  scene.fog = new THREE.FogExp2(0x05040f, 0.00035);

  // -------------------------------------------------------------- lighting
  scene.add(new THREE.AmbientLight(0x2a2f55, 1.1));

  const sunLight = new THREE.DirectionalLight(0xfff0d8, 2.2);
  sunLight.position.copy(SUN_DIRECTION).multiplyScalar(1000);
  scene.add(sunLight);

  const rimLight = new THREE.DirectionalLight(0x4f7cff, 0.7);
  rimLight.position.set(600, -400, 500);
  scene.add(rimLight);

  // ---------------------------------------------------------------- stars
  const starCount = 9000;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const starColor = new THREE.Color();
  for (let i = 0; i < starCount; i++) {
    const radius = 2200 + Math.random() * 3200;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = radius * Math.cos(phi);
    starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

    const warm = Math.random();
    starColor.setHSL(warm > 0.85 ? 0.08 : 0.55 + Math.random() * 0.12, 0.55, 0.6 + Math.random() * 0.4);
    starColors[i * 3] = starColor.r;
    starColors[i * 3 + 1] = starColor.g;
    starColors[i * 3 + 2] = starColor.b;
  }
  const starGeometry = track(new THREE.BufferGeometry());
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  const starMaterial = track(
    new THREE.PointsMaterial({
      size: 1.9,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      fog: false,
    }),
  );
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.frustumCulled = false;
  scene.add(stars);

  // --------------------------------------------------------------- nebulae
  const nebulaTexture = track(createGlowTexture());
  const nebulaSpecs: { position: [number, number, number]; size: number; color: number; opacity: number }[] = [
    { position: [-1800, 700, -2400], size: 3200, color: 0x5c3aff, opacity: 0.16 },
    { position: [2400, -500, -1800], size: 2600, color: 0xff3d8b, opacity: 0.12 },
    { position: [600, 1400, 2600], size: 3000, color: 0x00d1ff, opacity: 0.1 },
    { position: [-2600, -900, 1400], size: 2200, color: 0x8a2be2, opacity: 0.11 },
  ];
  for (const spec of nebulaSpecs) {
    const material = track(
      new THREE.SpriteMaterial({
        map: nebulaTexture,
        color: spec.color,
        transparent: true,
        opacity: spec.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    const sprite = new THREE.Sprite(material);
    sprite.position.set(...spec.position);
    sprite.scale.setScalar(spec.size);
    scene.add(sprite);
  }

  // ----------------------------------------------------------------- sun
  const sunGeometry = track(new THREE.SphereGeometry(120, 32, 24));
  const sunMaterial = track(new THREE.MeshBasicMaterial({ color: 0xfff4d0, fog: false }));
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  sun.position.copy(SUN_DIRECTION).multiplyScalar(3600);
  scene.add(sun);

  const sunGlowMaterial = track(
    new THREE.SpriteMaterial({
      map: nebulaTexture,
      color: 0xffd9a0,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  const sunGlow = new THREE.Sprite(sunGlowMaterial);
  sunGlow.position.copy(sun.position);
  sunGlow.scale.setScalar(1400);
  scene.add(sunGlow);

  // -------------------------------------------------------------- planets
  const planets: THREE.Object3D[] = [];
  const planetSpecs: {
    position: [number, number, number];
    radius: number;
    color: number;
    accent: number;
    ring?: boolean;
    spin: number;
  }[] = [
    { position: [-1400, -260, -1500], radius: 420, color: 0x2f4bff, accent: 0x9fd8ff, spin: 0.012 },
    { position: [1900, 520, 1200], radius: 300, color: 0xd2632f, accent: 0xffd9a8, ring: true, spin: -0.02 },
    { position: [900, -820, -2200], radius: 220, color: 0x3fbf9a, accent: 0xd9fff2, spin: 0.03 },
  ];
  for (const spec of planetSpecs) {
    const texture = track(createPlanetTexture(spec.color, spec.accent));
    const geometry = track(new THREE.SphereGeometry(spec.radius, 48, 32));
    const material = track(new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, metalness: 0, fog: false }));
    const planet = new THREE.Mesh(geometry, material);
    planet.position.set(...spec.position);
    planet.userData.spin = spec.spin;
    scene.add(planet);
    planets.push(planet);

    if (spec.ring) {
      const ringGeometry = track(new THREE.RingGeometry(spec.radius * 1.4, spec.radius * 2.1, 96));
      const ringMaterial = track(
        new THREE.MeshBasicMaterial({
          color: spec.accent,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.35,
          fog: false,
        }),
      );
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.copy(planet.position);
      ring.rotation.set(Math.PI / 2.4, 0.4, 0);
      scene.add(ring);
    }
  }

  return {
    update: (elapsed: number) => {
      for (const planet of planets) {
        planet.rotation.y = elapsed * (planet.userData.spin as number);
      }
    },
    dispose: () => {
      for (const item of disposables) item.dispose();
    },
  };
}

/** Soft radial falloff, reused for nebulae and the sun's glow. */
function createGlowTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/** Cheap banded gas-giant surface so the planets are not flat discs. */
function createPlanetTexture(base: number, accent: number): THREE.Texture {
  const width = 512;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const baseColor = new THREE.Color(base);
  const accentColor = new THREE.Color(accent);
  ctx.fillStyle = `#${baseColor.getHexString()}`;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 26; i++) {
    const y = Math.random() * height;
    const thickness = 3 + Math.random() * 22;
    const mix = baseColor.clone().lerp(accentColor, 0.15 + Math.random() * 0.5);
    ctx.fillStyle = `rgba(${Math.round(mix.r * 255)},${Math.round(mix.g * 255)},${Math.round(mix.b * 255)},${
      0.15 + Math.random() * 0.35
    })`;
    ctx.fillRect(0, y, width, thickness);
  }

  // A couple of storms for scale.
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * width,
      height * (0.25 + Math.random() * 0.5),
      12 + Math.random() * 26,
      6 + Math.random() * 12,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = `rgba(${Math.round(accentColor.r * 255)},${Math.round(accentColor.g * 255)},${Math.round(
      accentColor.b * 255,
    )},0.4)`;
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}
