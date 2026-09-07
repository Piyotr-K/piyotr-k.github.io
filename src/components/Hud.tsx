import React from 'react';
import { MAX_SPEED, MIN_SPEED, RideSnapshot } from '../ride/rideController';
import { StationSpec } from '../ride/stations';

interface HudProps {
  snapshot: RideSnapshot | null;
  stations: StationSpec[];
  started: boolean;
  onStart: () => void;
  onDrive: (direction: 0 | 1 | -1) => void;
  onThrottle: (value: number) => void;
  onToggleAutoRide: () => void;
  onToggleAutoStop: () => void;
  onReverse: () => void;
  onRecentre: () => void;
  onJump: (stationIndex: number) => void;
}

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

const KIND_LABEL: Record<StationSpec['kind'], string> = {
  origin: 'Start',
  work: 'Experience',
  project: 'Project',
  contact: 'Contact',
};

/** Everything drawn in DOM on top of the canvas. */
function Hud(props: HudProps) {
  const { snapshot, stations, started } = props;
  const docked = snapshot?.docked ?? true;
  const dockedIndex = docked ? snapshot?.dockedStation ?? 0 : null;
  const activeIndex = dockedIndex ?? snapshot?.nextStation ?? 0;
  const activeStation: StationSpec | undefined = stations[activeIndex];
  const dockedStation: StationSpec | undefined = dockedIndex === null ? undefined : stations[dockedIndex];
  const accent = activeStation ? hex(activeStation.color) : '#62e8ff';

  const hold = (direction: 1 | -1) => ({
    onPointerDown: (event: React.PointerEvent) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      props.onDrive(direction);
    },
    onPointerUp: (event: React.PointerEvent) => {
      props.onDrive(0);
      // Keeps Space (brake) from re-triggering this button afterwards.
      (event.currentTarget as HTMLElement).blur();
    },
    onPointerLeave: () => props.onDrive(0),
    onPointerCancel: () => props.onDrive(0),
  });

  return (
    <div className="hud" style={{ '--accent': accent } as React.CSSProperties}>
      <header className="hud-bar hud-top">
        <div className="hud-brand">
          <span className="hud-brand-name">Piyotr Kao</span>
          <span className="hud-brand-sub">Orbital Portfolio Line</span>
        </div>
        <div className="hud-toggles">
          <button
            type="button"
            className={`hud-toggle ${snapshot?.autoRide ? 'is-on' : ''}`}
            onClick={props.onToggleAutoRide}
          >
            Auto tour <kbd>R</kbd>
          </button>
          <button
            type="button"
            className={`hud-toggle ${snapshot?.autoStop ? 'is-on' : ''}`}
            onClick={props.onToggleAutoStop}
          >
            Stop at stations <kbd>E</kbd>
          </button>
          <button type="button" className="hud-toggle" onClick={props.onRecentre}>
            Recentre view <kbd>C</kbd>
          </button>
        </div>
      </header>

      <nav className="hud-map" aria-label="Route">
        <span className="hud-map-title">Line stops</span>
        <ol>
          {stations.map((station, index) => {
            const isActive = index === activeIndex;
            return (
              <li key={station.id}>
                <button
                  type="button"
                  className={`hud-stop ${isActive ? 'is-active' : ''} ${
                    dockedIndex === index ? 'is-docked' : ''
                  }`}
                  style={{ '--stop-color': hex(station.color) } as React.CSSProperties}
                  onClick={() => props.onJump(index)}
                  title={`Jump to ${station.name}`}
                >
                  <span className="hud-stop-dot" />
                  <span className="hud-stop-text">
                    <span className="hud-stop-name">{station.name}</span>
                    <span className="hud-stop-kind">{KIND_LABEL[station.kind]}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {dockedStation && (
        <section className="hud-panel" key={dockedStation.id}>
          <span className="hud-panel-kind">{KIND_LABEL[dockedStation.kind]}</span>
          <h1>{dockedStation.name}</h1>
          {(dockedStation.role || dockedStation.period) && (
            <p className="hud-panel-meta">
              {dockedStation.role}
              {dockedStation.role && dockedStation.period ? ' · ' : ''}
              {dockedStation.period}
            </p>
          )}
          {dockedStation.details.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
          {dockedStation.tags.length > 0 && (
            <ul className="hud-tags">
              {dockedStation.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          )}
          {dockedStation.links && (
            <div className="hud-links">
              {dockedStation.links.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              ))}
            </div>
          )}
          <p className="hud-panel-hint">
            Hold <kbd>W</kbd> to carry on, <kbd>S</kbd> to go back the way you came.
          </p>
        </section>
      )}

      <footer className="hud-bar hud-bottom">
        <div className="hud-readout">
          <div className="hud-speed">
            <strong>{Math.round(snapshot?.speed ?? 0)}</strong>
            <span>u/s</span>
          </div>
          <div className="hud-status">
            <span className="hud-status-line">
              {docked
                ? `Docked · ${activeStation?.name ?? ''}`
                : `${snapshot && snapshot.direction === 1 ? 'Forward' : 'Reverse'} to ${
                    activeStation?.name ?? ''
                  } · ${Math.round(snapshot?.distanceToNext ?? 0)} u`}
            </span>
            <span className="hud-progress">
              <span
                className="hud-progress-fill"
                style={{ width: `${Math.round((snapshot?.progress ?? 0) * 100)}%` }}
              />
            </span>
          </div>
        </div>

        <div className="hud-drive">
          <button type="button" className="hud-drive-button" {...hold(-1)}>
            <span>Reverse</span>
            <kbd>S</kbd>
          </button>
          <button type="button" className="hud-drive-button is-primary" {...hold(1)}>
            <span>Forward</span>
            <kbd>W</kbd>
          </button>
          <button type="button" className="hud-drive-button" onClick={props.onReverse}>
            <span>Flip</span>
            <kbd>Q</kbd>
          </button>
        </div>

        <label className="hud-throttle">
          <span className="hud-throttle-label">
            Throttle <strong>{Math.round(snapshot?.throttle ?? 0)}</strong>
          </span>
          <input
            type="range"
            min={MIN_SPEED}
            max={MAX_SPEED}
            step={1}
            value={Math.round(snapshot?.throttle ?? MIN_SPEED)}
            onChange={(event) => props.onThrottle(Number(event.target.value))}
          />
          <span className="hud-throttle-hint">Wheel or [ ] to trim</span>
        </label>
      </footer>

      {!started && (
        <div className="hud-intro">
          <div className="hud-intro-card">
            <span className="hud-intro-kicker">Orbital Portfolio Line</span>
            <h1>Ride the loop</h1>
            <p>
              Every stop on this track is a job or a project. Drive the car yourself, look wherever you
              like on the way, and the line will always bring you back to where you started.
            </p>
            <ul className="hud-intro-keys">
              <li>
                <kbd>W</kbd> / <kbd>S</kbd> drive forward or back
              </li>
              <li>
                <kbd>drag</kbd> look around while you move
              </li>
              <li>
                <kbd>wheel</kbd> or the throttle slider set your speed
              </li>
              <li>
                <kbd>Space</kbd> brake · <kbd>R</kbd> auto tour · <kbd>C</kbd> recentre
              </li>
            </ul>
            <button type="button" className="hud-intro-start" onClick={props.onStart}>
              Launch
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Hud;
