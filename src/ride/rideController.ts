import { Track, TrackStation } from './track';

export const MIN_SPEED = 6;
/**
 * Top of the throttle range. The shortest gap between two stops is about 155
 * units, and the approach profile below needs v^2 / (2 * APPROACH_DECEL) of it
 * to brake in, so this has to stay under ~78 for the car to always make its
 * stop. Widen the gaps in stations.ts before raising it.
 */
export const MAX_SPEED = 70;
export const DEFAULT_SPEED = 30;

/** How hard the car can pull itself up to the throttle setting. */
const ACCELERATION = 26;
/** Braking the car actually has available. */
const BRAKING = 40;
/**
 * Deceleration the station approach is planned around. Deliberately gentler
 * than BRAKING: the profile is a function of distance, so if the car is above
 * it the profile falls away faster than the car does. Leaving the brakes some
 * headroom is what lets the car catch back down onto it and stop on the mark.
 */
const APPROACH_DECEL = 22;
/** Drag applied when nothing is holding the throttle. */
const COAST_DRAG = 9;
/** Distance the car has to clear before a station can capture it again. */
const RELEASE_DISTANCE = 24;
/** Capture window for docking. */
const DOCK_DISTANCE = 2.5;
const DOCK_SPEED = 4;
/** Seconds spent at a stop before the auto tour moves on. */
const AUTO_DWELL = 7;

export interface RideInputs {
  forward: boolean;
  backward: boolean;
  brake: boolean;
}

export interface RideSnapshot {
  /** Signed speed in units/second: positive is forward along the loop. */
  velocity: number;
  speed: number;
  throttle: number;
  direction: 1 | -1;
  docked: boolean;
  dockedStation: number | null;
  nextStation: number;
  distanceToNext: number;
  /** Position around the loop in [0, 1). */
  progress: number;
  autoRide: boolean;
  autoStop: boolean;
  dwellRemaining: number;
}

/**
 * Everything about how the car moves: throttle, direction, coasting, automatic
 * braking into the next stop and the auto tour. Knows about the track but
 * nothing about three.js or React.
 */
export class RideController {
  private readonly track: Track;

  /** Arc-length position of the car on the loop. */
  s = 0;
  /** Signed speed along the loop. */
  velocity = 0;
  throttle = DEFAULT_SPEED;
  direction: 1 | -1 = 1;
  autoRide = false;
  autoStop = true;

  private docked = true;
  private dockedStation: number | null = null;
  private ignoredStation = -1;
  private dwell = 0;

  constructor(track: Track, startStation = 0) {
    this.track = track;
    const start = track.stations.find((st) => st.index === startStation) ?? track.stations[0];
    this.s = start.s;
    this.dockedStation = start.index;
  }

  get isDocked(): boolean {
    return this.docked;
  }

  get u(): number {
    return this.track.wrapU(this.s / this.track.length);
  }

  setThrottle(value: number): void {
    this.throttle = Math.min(MAX_SPEED, Math.max(MIN_SPEED, value));
  }

  nudgeThrottle(delta: number): void {
    this.setThrottle(this.throttle + delta);
  }

  setAutoRide(on: boolean): void {
    this.autoRide = on;
    if (on) this.dwell = 0;
  }

  setAutoStop(on: boolean): void {
    this.autoStop = on;
    if (!on && this.docked) this.depart(this.direction);
  }

  /** Leave the current stop under power in `direction`. */
  depart(direction: 1 | -1): void {
    this.direction = direction;
    if (this.docked) {
      this.ignoredStation = this.dockedStation ?? -1;
      this.docked = false;
      this.dockedStation = null;
      this.dwell = 0;
    }
  }

  /** Drop the car straight onto a stop (used by the route map). */
  jumpTo(stationIndex: number): void {
    const station = this.track.stations.find((st) => st.index === stationIndex);
    if (!station) return;
    this.s = station.s;
    this.velocity = 0;
    this.docked = true;
    this.dockedStation = station.index;
    this.ignoredStation = -1;
    this.dwell = 0;
  }

  update(dt: number, input: RideInputs): void {
    if (this.docked) {
      this.updateDocked(dt, input);
      return;
    }

    const requested = this.requestedVelocity(input);
    const limited = this.autoStop ? this.applyStationBraking(requested) : requested;

    // Pulling towards a faster target is engine work; anything that slows the
    // car down is the brakes, and coasting to a stop is just drag.
    const closing = Math.abs(limited) > Math.abs(this.velocity) && Math.sign(limited) === Math.sign(this.velocity || limited);
    const rate = input.brake ? BRAKING : limited === 0 ? COAST_DRAG : closing ? ACCELERATION : BRAKING;
    this.velocity = approach(this.velocity, limited, rate * dt);

    this.s = this.track.wrapS(this.s + this.velocity * dt);

    if (this.ignoredStation >= 0) {
      const ignored = this.track.stations.find((st) => st.index === this.ignoredStation);
      if (!ignored || Math.abs(this.track.signedDistance(this.s, ignored.s)) > RELEASE_DISTANCE) {
        this.ignoredStation = -1;
      }
    }

    if (this.autoStop) this.tryDock();
  }

  snapshot(): RideSnapshot {
    const ahead = this.track.stationAhead(this.s, this.velocity < 0 ? -1 : this.direction, this.ignoredStation);
    return {
      velocity: this.velocity,
      speed: Math.abs(this.velocity),
      throttle: this.throttle,
      direction: this.direction,
      docked: this.docked,
      dockedStation: this.dockedStation,
      nextStation: this.docked ? (this.dockedStation ?? ahead.station.index) : ahead.station.index,
      distanceToNext: this.docked ? 0 : ahead.distance,
      progress: this.u,
      autoRide: this.autoRide,
      autoStop: this.autoStop,
      dwellRemaining: this.docked && this.autoRide ? Math.max(0, AUTO_DWELL - this.dwell) : 0,
    };
  }

  // ----------------------------------------------------------------- private

  private updateDocked(dt: number, input: RideInputs): void {
    this.velocity = approach(this.velocity, 0, BRAKING * dt);
    // Slide the last centimetres onto the mark instead of snapping there.
    const station = this.track.stations.find((st) => st.index === this.dockedStation);
    if (station) {
      const offset = this.track.signedDistance(this.s, station.s);
      if (Math.abs(offset) > 0.001) {
        this.s = this.track.wrapS(this.s + offset * (1 - Math.exp(-dt * 7)));
      }
    }
    if (input.forward) {
      this.depart(1);
      return;
    }
    if (input.backward) {
      this.depart(-1);
      return;
    }
    if (this.autoRide) {
      this.dwell += dt;
      if (this.dwell >= AUTO_DWELL) this.depart(this.direction);
    }
  }

  private requestedVelocity(input: RideInputs): number {
    if (input.brake) return 0;
    if (input.forward && !input.backward) {
      this.direction = 1;
      return this.throttle;
    }
    if (input.backward && !input.forward) {
      this.direction = -1;
      return -this.throttle;
    }
    if (this.autoRide) return this.throttle * this.direction;
    return 0;
  }

  /**
   * Clamp the requested speed to whatever still lets the car stop on the next
   * platform: v = sqrt(2 * a * d) is the fastest it can be going at distance d
   * and still shed all of it by the time it arrives.
   */
  private applyStationBraking(requested: number): number {
    if (requested === 0) return 0;
    const dir = requested > 0 ? 1 : -1;
    const { distance } = this.track.stationAhead(this.s, dir, this.ignoredStation);
    const stoppable = Math.sqrt(2 * APPROACH_DECEL * Math.max(distance - DOCK_DISTANCE * 0.4, 0));
    return dir * Math.min(Math.abs(requested), stoppable);
  }

  private tryDock(): void {
    if (Math.abs(this.velocity) > DOCK_SPEED) return;
    const { station, distance } = this.nearestDockable();
    if (!station || distance > DOCK_DISTANCE) return;
    // The last of the position is eased away in updateDocked.
    this.velocity = 0;
    this.docked = true;
    this.dockedStation = station.index;
    this.dwell = 0;
  }

  private nearestDockable(): { station: TrackStation | null; distance: number } {
    let best: TrackStation | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const station of this.track.stations) {
      if (station.index === this.ignoredStation) continue;
      const distance = Math.abs(this.track.signedDistance(this.s, station.s));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = station;
      }
    }
    return { station: best, distance: bestDistance };
  }
}

function approach(current: number, target: number, maxDelta: number): number {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}
