import * as THREE from 'three';
import { ROLLS, STATIONS, StationSpec, TRACK_POINTS } from './stations';

/** Number of pre-computed orientation frames around the loop. */
const FRAME_COUNT = 1024;

export interface TrackStation {
  index: number;
  spec: StationSpec;
  /** Normalised arc-length position on the loop, in [0, 1). */
  u: number;
  /** Arc-length position on the loop, in world units. */
  s: number;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

interface RollSegment {
  startU: number;
  /** Length of the segment in u, always positive. */
  spanU: number;
  radians: number;
}

const UP = new THREE.Vector3(0, 1, 0);
const LOCAL_FORWARD = new THREE.Vector3(0, 0, -1);
const LOCAL_UP = new THREE.Vector3(0, 1, 0);
const LOCAL_RIGHT = new THREE.Vector3(1, 0, 0);
const LOCAL_ROLL_AXIS = new THREE.Vector3(0, 0, 1);

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Positive fractional distance from `a` to `b` around a loop of length 1. */
const forwardDeltaU = (a: number, b: number) => {
  const d = (b - a) % 1;
  return d < 0 ? d + 1 : d;
};

/**
 * The ride's rail: a closed Catmull-Rom loop through the control points in
 * `stations.ts`, plus everything the rest of the app needs to sit on it -
 * arc-length parameterisation, twist-free orientation frames, barrel rolls and
 * the arc-length position of every stop.
 */
export class Track {
  readonly curve: THREE.CatmullRomCurve3;
  readonly length: number;
  readonly stations: TrackStation[] = [];

  private readonly frames: THREE.Quaternion[] = [];
  private readonly rolls: RollSegment[] = [];

  // Scratch objects so the per-frame path stays allocation free.
  private readonly scratchQuatA = new THREE.Quaternion();
  private readonly scratchQuatB = new THREE.Quaternion();
  private readonly scratchVecA = new THREE.Vector3();
  private readonly scratchVecB = new THREE.Vector3();
  private readonly scratchVecC = new THREE.Vector3();

  constructor() {
    const controlPoints = TRACK_POINTS.map((p) => {
      const rad = (p.a * Math.PI) / 180;
      return new THREE.Vector3(Math.cos(rad) * p.r, p.y, Math.sin(rad) * p.r);
    });

    this.curve = new THREE.CatmullRomCurve3(controlPoints, true, 'catmullrom', 0.5);
    // A multiple of the control point count, so every control point lands
    // exactly on an entry of the arc-length table (see buildStations).
    this.curve.arcLengthDivisions = controlPoints.length * 100;
    this.curve.updateArcLengths();
    this.length = this.curve.getLength();

    this.buildFrames();
    this.buildStations();
    this.buildRolls();
  }

  // ---------------------------------------------------------------- sampling

  /** World position at normalised arc-length `u`. */
  positionAt(u: number, target: THREE.Vector3): THREE.Vector3 {
    return this.curve.getPointAt(this.wrapU(u), target);
  }

  /** Unit tangent (direction of travel) at `u`. */
  tangentAt(u: number, target: THREE.Vector3): THREE.Vector3 {
    return this.curve.getTangentAt(this.wrapU(u), target).normalize();
  }

  /**
   * Orientation of a car sitting at `u`: -Z points along the track and +Y is
   * the rail's "up", including any barrel roll declared for this stretch.
   */
  orientationAt(u: number, target: THREE.Quaternion): THREE.Quaternion {
    const f = this.wrapU(u) * FRAME_COUNT;
    const i0 = Math.floor(f) % FRAME_COUNT;
    const i1 = (i0 + 1) % FRAME_COUNT;
    target.copy(this.frames[i0]).slerp(this.frames[i1], f - Math.floor(f));

    const roll = this.rollAt(u);
    if (roll !== 0) {
      target.multiply(this.scratchQuatB.setFromAxisAngle(LOCAL_ROLL_AXIS, roll));
    }
    return target;
  }

  /** A local axis of the track at `u`, expressed in world space. */
  axisAt(u: number, axis: 'forward' | 'up' | 'right', target: THREE.Vector3): THREE.Vector3 {
    this.orientationAt(u, this.scratchQuatA);
    const local = axis === 'forward' ? LOCAL_FORWARD : axis === 'up' ? LOCAL_UP : LOCAL_RIGHT;
    return target.copy(local).applyQuaternion(this.scratchQuatA);
  }

  /**
   * Signed curvature about the car's up axis at `u` - how hard the rail is
   * turning left or right. Used to bank the car into corners.
   */
  lateralCurvatureAt(u: number): number {
    const du = 1 / FRAME_COUNT;
    const before = this.tangentAt(u - du, this.scratchVecA).clone();
    const after = this.tangentAt(u + du, this.scratchVecB);
    // dT/ds, projected onto the car's right axis.
    const dT = after.sub(before).divideScalar(2 * du * this.length);
    const right = this.axisAt(u, 'right', this.scratchVecC);
    return dT.dot(right);
  }

  // ---------------------------------------------------------------- stations

  wrapU(u: number): number {
    const w = u % 1;
    return w < 0 ? w + 1 : w;
  }

  wrapS(s: number): number {
    const w = s % this.length;
    return w < 0 ? w + this.length : w;
  }

  /** Shortest signed distance from `from` to `to` along the loop. */
  signedDistance(from: number, to: number): number {
    let d = this.wrapS(to - from);
    if (d > this.length / 2) d -= this.length;
    return d;
  }

  /**
   * The next stop reached travelling from `s` in `direction`, skipping the
   * station the car has just left (`ignore`) so it does not instantly re-dock.
   */
  stationAhead(
    s: number,
    direction: number,
    ignore = -1,
  ): { station: TrackStation; distance: number } {
    let best: TrackStation = this.stations[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const station of this.stations) {
      if (station.index === ignore) continue;
      const distance = direction >= 0 ? this.wrapS(station.s - s) : this.wrapS(s - station.s);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = station;
      }
    }
    return { station: best, distance: bestDistance };
  }

  /** Nearest stop to `s`, in either direction. */
  nearestStation(s: number): { station: TrackStation; distance: number } {
    let best: TrackStation = this.stations[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const station of this.stations) {
      const distance = Math.abs(this.signedDistance(s, station.s));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = station;
      }
    }
    return { station: best, distance: bestDistance };
  }

  // ----------------------------------------------------------------- private

  /**
   * Orientation frames sampled evenly in arc length.
   *
   * The car's up is world up projected onto the plane perpendicular to the
   * track. That keeps the horizon where a rider expects it, leaves every
   * platform level, and - because the frame is a pure function of the tangent -
   * joins back onto itself at the seam with nothing left over. All the
   * upside-down drama comes from the declared barrel rolls instead.
   *
   * Where the track pitches towards vertical the projection collapses, so those
   * stretches fall back to parallel transport from the previous frame, blended
   * in so the handover is not visible. Nothing in the current layout gets near
   * that (the steepest pitch is about 46 degrees), but a future edit might.
   */
  private buildFrames(): void {
    const tangents: THREE.Vector3[] = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
      tangents.push(this.curve.getTangentAt(i / FRAME_COUNT, new THREE.Vector3()).normalize());
    }

    const projected = new THREE.Vector3();
    const transported = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const normals: THREE.Vector3[] = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
      const tangent = tangents[i];
      projected.copy(UP).addScaledVector(tangent, -UP.dot(tangent));
      const strength = projected.length();

      if (i > 0) {
        rotation.setFromUnitVectors(tangents[i - 1], tangent);
        transported.copy(normals[i - 1]).applyQuaternion(rotation);
        transported.addScaledVector(tangent, -transported.dot(tangent));
      } else {
        transported.copy(projected);
      }

      // 1 while the track is comfortably off vertical, 0 once world up is no
      // use at all; smoothstepped so the two sources cross over gently.
      const blend = smoothstep(Math.min(Math.max((strength - 0.2) / 0.25, 0), 1));
      const up = transported
        .normalize()
        .multiplyScalar(1 - blend)
        .addScaledVector(projected.normalize(), blend);
      normals.push(up.normalize().clone());
    }

    const matrix = new THREE.Matrix4();
    const right = new THREE.Vector3();
    const backward = new THREE.Vector3();
    for (let i = 0; i < FRAME_COUNT; i++) {
      const up = normals[i];
      backward.copy(tangents[i]).negate();
      right.crossVectors(up, backward).normalize();
      up.crossVectors(backward, right).normalize();
      matrix.makeBasis(right, up, backward);
      this.frames.push(new THREE.Quaternion().setFromRotationMatrix(matrix));
    }
  }

  private buildStations(): void {
    const divisions = this.curve.arcLengthDivisions;
    const lengths = this.curve.getLengths(divisions);
    const controlCount = TRACK_POINTS.length;

    TRACK_POINTS.forEach((point, i) => {
      if (point.station === undefined) return;
      const spec = STATIONS[point.station];
      if (!spec) return;
      // A closed Catmull-Rom curve passes through control point i at t = i / n.
      const s = lengths[Math.round((i / controlCount) * divisions)];
      const u = s / this.length;
      this.stations.push({
        index: point.station,
        spec,
        u,
        s,
        position: this.curve.getPointAt(u, new THREE.Vector3()),
        quaternion: new THREE.Quaternion(),
      });
    });

    this.stations.sort((a, b) => a.index - b.index);
    // Orientation needs the frames, which are built before this runs.
    for (const station of this.stations) {
      this.orientationAt(station.u, station.quaternion);
    }
  }

  private buildRolls(): void {
    for (const roll of ROLLS) {
      const from = this.stations.find((s) => s.index === roll.fromStation);
      const to = this.stations.find((s) => s.index === roll.toStation);
      if (!from || !to) continue;
      const span = forwardDeltaU(from.u, to.u);
      // Keep the roll clear of the platforms at either end.
      this.rolls.push({
        startU: this.wrapU(from.u + span * 0.18),
        spanU: span * 0.64,
        radians: roll.turns * Math.PI * 2,
      });
    }
  }

  /** Extra roll (radians) applied on top of the transported frame at `u`. */
  private rollAt(u: number): number {
    let total = 0;
    for (const roll of this.rolls) {
      const local = forwardDeltaU(roll.startU, u);
      if (local > roll.spanU) continue;
      total += smoothstep(local / roll.spanU) * roll.radians;
    }
    return total;
  }
}
