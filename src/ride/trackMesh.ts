import * as THREE from 'three';
import { Track, TrackStation } from './track';

/** Half the distance between the two rails. */
const GAUGE = 1.4;
/** How far the rails sit above the spine the car rides. */
const RAIL_HEIGHT = 0.55;
/** Spacing of the cross ties, in world units. */
const TIE_SPACING = 3.2;
const RAIL_SAMPLES = 1200;

export interface TrackVisuals {
  group: THREE.Group;
  update: (elapsed: number, carU: number) => void;
  dispose: () => void;
}

/**
 * Rails, ties and the station furniture. Built once from the Track, using the
 * same orientation frames the car rides, so the rails corkscrew correctly
 * through the barrel rolls.
 */
export function buildTrackVisuals(track: Track): TrackVisuals {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const position = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();

  // ----------------------------------------------------------------- rails
  const leftPoints: THREE.Vector3[] = [];
  const rightPoints: THREE.Vector3[] = [];
  const spinePoints: THREE.Vector3[] = [];
  for (let i = 0; i < RAIL_SAMPLES; i++) {
    const u = i / RAIL_SAMPLES;
    track.positionAt(u, position);
    track.axisAt(u, 'right', right);
    track.axisAt(u, 'up', up);
    leftPoints.push(position.clone().addScaledVector(right, -GAUGE).addScaledVector(up, RAIL_HEIGHT));
    rightPoints.push(position.clone().addScaledVector(right, GAUGE).addScaledVector(up, RAIL_HEIGHT));
    spinePoints.push(position.clone().addScaledVector(up, -0.7));
  }

  const railMaterial = keep(
    new THREE.MeshStandardMaterial({
      color: 0x8fd7ff,
      emissive: 0x1d6ea8,
      emissiveIntensity: 0.85,
      roughness: 0.35,
      metalness: 0.6,
    }),
  );
  const spineMaterial = keep(
    new THREE.MeshStandardMaterial({
      color: 0x2b3358,
      emissive: 0x101a3a,
      emissiveIntensity: 0.6,
      roughness: 0.7,
      metalness: 0.4,
    }),
  );

  for (const points of [leftPoints, rightPoints]) {
    const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
    const geometry = keep(new THREE.TubeGeometry(curve, RAIL_SAMPLES, 0.18, 6, true));
    group.add(new THREE.Mesh(geometry, railMaterial));
  }
  {
    const curve = new THREE.CatmullRomCurve3(spinePoints, true, 'catmullrom', 0.5);
    const geometry = keep(new THREE.TubeGeometry(curve, RAIL_SAMPLES, 0.5, 8, true));
    group.add(new THREE.Mesh(geometry, spineMaterial));
  }

  // ------------------------------------------------------------------ ties
  const tieCount = Math.floor(track.length / TIE_SPACING);
  const tieGeometry = keep(new THREE.BoxGeometry(GAUGE * 2 + 0.5, 0.16, 0.42));
  const tieMaterial = keep(
    new THREE.MeshStandardMaterial({
      color: 0x39406e,
      emissive: 0x121a3c,
      emissiveIntensity: 0.8,
      roughness: 0.6,
      metalness: 0.5,
    }),
  );
  const ties = new THREE.InstancedMesh(tieGeometry, tieMaterial, tieCount);
  const matrix = new THREE.Matrix4();
  const orientation = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < tieCount; i++) {
    const u = (i * TIE_SPACING) / track.length;
    track.positionAt(u, position);
    track.axisAt(u, 'up', up);
    track.orientationAt(u, orientation);
    position.addScaledVector(up, RAIL_HEIGHT * 0.4);
    matrix.compose(position, orientation, scale);
    ties.setMatrixAt(i, matrix);
  }
  ties.instanceMatrix.needsUpdate = true;
  group.add(ties);

  // -------------------------------------------------------------- stations
  const pulsing: { material: THREE.MeshStandardMaterial; base: number; offset: number }[] = [];
  const beacons: { sprite: THREE.Sprite; station: TrackStation }[] = [];

  track.stations.forEach((station, i) => {
    const stationGroup = new THREE.Group();
    stationGroup.position.copy(station.position);
    stationGroup.quaternion.copy(station.quaternion);
    group.add(stationGroup);

    const color = new THREE.Color(station.spec.color);

    // Gate rings the car passes through on the way in and out.
    const ringGeometry = keep(new THREE.TorusGeometry(6.5, 0.35, 8, 48));
    const ringMaterial = keep(
      new THREE.MeshStandardMaterial({
        color: color.clone().multiplyScalar(0.6),
        emissive: color,
        emissiveIntensity: 1.1,
        roughness: 0.4,
        metalness: 0.5,
      }),
    );
    pulsing.push({ material: ringMaterial, base: 1.1, offset: i * 0.8 });
    for (const offset of [-16, -8, 8, 16]) {
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      // Ring offsets are along the track, so they follow its curve.
      const u = track.wrapU((station.s + offset) / track.length);
      track.positionAt(u, position);
      track.orientationAt(u, orientation);
      ring.position.copy(position);
      ring.quaternion.copy(orientation);
      // A torus lies in its XY plane, so its axis already points along -Z.
      group.add(ring);
    }

    // Platform slung under the rail.
    const platformGeometry = keep(new THREE.CylinderGeometry(7.5, 9, 0.9, 8));
    const platformMaterial = keep(
      new THREE.MeshStandardMaterial({
        color: 0x1b2145,
        emissive: color.clone().multiplyScalar(0.18),
        emissiveIntensity: 1,
        roughness: 0.75,
        metalness: 0.4,
      }),
    );
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.set(0, -7.6, 0);
    stationGroup.add(platform);

    const trimGeometry = keep(new THREE.TorusGeometry(7.9, 0.22, 6, 48));
    const trimMaterial = keep(
      new THREE.MeshStandardMaterial({
        color: color.clone().multiplyScalar(0.5),
        emissive: color,
        emissiveIntensity: 1.4,
        roughness: 0.3,
        metalness: 0.2,
      }),
    );
    pulsing.push({ material: trimMaterial, base: 1.4, offset: i * 0.8 + 0.4 });
    const trim = new THREE.Mesh(trimGeometry, trimMaterial);
    trim.position.set(0, -7.1, 0);
    trim.rotation.x = Math.PI / 2;
    stationGroup.add(trim);

    // Support struts between platform and rail.
    const strutGeometry = keep(new THREE.CylinderGeometry(0.22, 0.22, 6.8, 6));
    for (const x of [-2.6, 2.6]) {
      const strut = new THREE.Mesh(strutGeometry, platformMaterial);
      strut.position.set(x, -3.8, 0);
      stationGroup.add(strut);
    }

    // Beacon board with the station's name on it.
    const labelTexture = keep(createLabelTexture(station.spec.name, station.spec.role ?? station.spec.blurb, station.spec.period, station.spec.color));
    const labelMaterial = keep(
      new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthWrite: false, fog: false }),
    );
    const sprite = new THREE.Sprite(labelMaterial);
    sprite.scale.set(23, 11.5, 1);
    sprite.position.copy(station.position);
    // Hang the board off to one side of the rail, above the platform.
    track.axisAt(station.u, 'right', right);
    track.axisAt(station.u, 'up', up);
    sprite.position.addScaledVector(right, 18).addScaledVector(up, 8.5);
    group.add(sprite);
    beacons.push({ sprite, station });

    // Marker mast from the platform up to the board.
    const mastGeometry = keep(new THREE.CylinderGeometry(0.18, 0.18, 12, 6));
    const mast = new THREE.Mesh(mastGeometry, trimMaterial);
    mast.position.set(6.6, -1.6, 0);
    stationGroup.add(mast);
  });

  return {
    group,
    update: (elapsed: number, carU: number) => {
      for (const item of pulsing) {
        item.material.emissiveIntensity = item.base * (0.75 + 0.25 * Math.sin(elapsed * 2 + item.offset));
      }
      // Fade the boards in as the car gets close, so distant text is not noise.
      for (const beacon of beacons) {
        const distance = Math.abs(track.signedDistance(carU * track.length, beacon.station.s));
        const material = beacon.sprite.material as THREE.SpriteMaterial;
        material.opacity = THREE.MathUtils.clamp(1 - (distance - 90) / 160, 0.05, 1);
      }
    },
    dispose: () => {
      for (const item of disposables) item.dispose();
    },
  };
}

/** Station name board, drawn to a canvas and used as a sprite texture. */
function createLabelTexture(title: string, subtitle: string, period: string | undefined, color: number): THREE.Texture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const accent = `#${new THREE.Color(color).getHexString()}`;

  ctx.fillStyle = 'rgba(6, 10, 28, 0.72)';
  roundedRect(ctx, 24, 24, width - 48, height - 48, 36);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.fillRect(72, 128, 120, 8);

  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 84px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(fit(ctx, title, width - 160), 72, 168);

  ctx.fillStyle = 'rgba(226, 232, 255, 0.78)';
  ctx.font = '46px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(fit(ctx, subtitle, width - 160), 72, 282);

  if (period) {
    ctx.fillStyle = accent;
    ctx.font = '40px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(period, 72, 356);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Trim a string until it fits the given pixel width. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 4 && ctx.measureText(`${trimmed}...`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
}
