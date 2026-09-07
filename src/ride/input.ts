import { RideInputs } from './rideController';

const MAX_PITCH = (78 * Math.PI) / 180;
const MAX_YAW = Math.PI;
/** Radians of look per pixel dragged. */
const LOOK_SENSITIVITY = 0.0032;

export interface InputEvents {
  onThrottleDelta: (delta: number) => void;
  onToggleAutoRide: () => void;
  onToggleAutoStop: () => void;
  onReverse: () => void;
}

/**
 * Keyboard / mouse / touch plumbing for the ride: hold to drive, drag to look
 * around, wheel to change the throttle. The look offset is kept here and read
 * by the renderer every frame, so looking around never touches React state.
 */
export class RideInput {
  readonly state: RideInputs = { forward: false, backward: false, brake: false };

  /** Free-look offsets, in radians, relative to the direction of travel. */
  yaw = 0;
  pitch = 0;
  /** True while the rider is actively dragging the view around. */
  looking = false;

  private readonly element: HTMLElement;
  private readonly events: InputEvents;
  private pointerId: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private recentring = false;

  constructor(element: HTMLElement, events: InputEvents) {
    this.element = element;
    this.events = events;

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    element.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    element.addEventListener('wheel', this.onWheel, { passive: false });
    element.addEventListener('contextmenu', this.onContextMenu);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.element.removeEventListener('wheel', this.onWheel);
    this.element.removeEventListener('contextmenu', this.onContextMenu);
  }

  /** Set the drive keys from the on-screen buttons. */
  setVirtualDrive(direction: 0 | 1 | -1): void {
    this.state.forward = direction === 1;
    this.state.backward = direction === -1;
  }

  recentre(): void {
    this.recentring = true;
  }

  /** Eases the view back to straight ahead after a recentre request. */
  update(dt: number): void {
    if (!this.recentring) return;
    const k = 1 - Math.exp(-dt * 6);
    this.yaw += (0 - this.yaw) * k;
    this.pitch += (0 - this.pitch) * k;
    if (Math.abs(this.yaw) < 0.002 && Math.abs(this.pitch) < 0.002) {
      this.yaw = 0;
      this.pitch = 0;
      this.recentring = false;
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) {
      // Still swallow the page-scrolling keys while held.
      if (isDriveKey(e.code)) e.preventDefault();
      return;
    }
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.state.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.state.backward = true;
        break;
      case 'Space':
        this.state.brake = true;
        break;
      case 'BracketRight':
      case 'Equal':
        this.events.onThrottleDelta(5);
        break;
      case 'BracketLeft':
      case 'Minus':
        this.events.onThrottleDelta(-5);
        break;
      case 'KeyR':
        this.events.onToggleAutoRide();
        break;
      case 'KeyE':
        this.events.onToggleAutoStop();
        break;
      case 'KeyQ':
        this.events.onReverse();
        break;
      case 'KeyC':
        this.recentre();
        break;
      default:
        return;
    }
    if (isDriveKey(e.code)) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.state.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.state.backward = false;
        break;
      case 'Space':
        this.state.brake = false;
        break;
      default:
        break;
    }
  };

  private onBlur = () => {
    this.state.forward = false;
    this.state.backward = false;
    this.state.brake = false;
    this.looking = false;
    this.pointerId = null;
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.looking = true;
    this.recentring = false;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.pointerId !== e.pointerId) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.yaw = clamp(this.yaw - dx * LOOK_SENSITIVITY, -MAX_YAW, MAX_YAW);
    this.pitch = clamp(this.pitch - dy * LOOK_SENSITIVITY, -MAX_PITCH, MAX_PITCH);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.pointerId !== e.pointerId) return;
    this.pointerId = null;
    this.looking = false;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.events.onThrottleDelta(e.deltaY > 0 ? -3 : 3);
  };

  private onContextMenu = (e: Event) => e.preventDefault();
}

function isDriveKey(code: string): boolean {
  return code === 'Space' || code === 'ArrowUp' || code === 'ArrowDown';
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
