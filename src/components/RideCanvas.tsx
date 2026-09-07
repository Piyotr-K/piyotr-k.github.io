import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RideEngine } from '../ride/rideEngine';
import { RideSnapshot } from '../ride/rideController';
import { StationSpec } from '../ride/stations';
import Hud from './Hud';
import './ride.css';

/**
 * Hosts the WebGL canvas and bridges it to the DOM HUD: three.js owns the
 * animation loop, and pushes a snapshot of the ride state into React ten times
 * a second so the overlay stays in sync without re-rendering every frame.
 */
function RideCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RideEngine | null>(null);
  const [snapshot, setSnapshot] = useState<RideSnapshot | null>(null);
  const [stations, setStations] = useState<StationSpec[]>([]);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: RideEngine;
    try {
      engine = new RideEngine(canvas, { onState: setSnapshot });
    } catch (error) {
      setFailed(error instanceof Error ? error.message : 'WebGL is not available in this browser.');
      return;
    }

    engineRef.current = engine;
    setStations(engine.track.stations.map((station) => station.spec));
    engine.start();

    const onResize = () => engine.resize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', onResize);
    onResize();

    return () => {
      window.removeEventListener('resize', onResize);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const withEngine = useCallback((fn: (engine: RideEngine) => void) => {
    const engine = engineRef.current;
    if (engine) fn(engine);
  }, []);

  const handleStart = useCallback(() => {
    setStarted(true);
    withEngine((engine) => {
      // Roll out on the auto tour; W / S take over the moment they are pressed.
      engine.setAutoRide(true);
      engine.depart(1);
    });
  }, [withEngine]);

  if (failed) {
    return (
      <div className="ride-fallback">
        <h1>This ride needs WebGL</h1>
        <p>{failed}</p>
      </div>
    );
  }

  return (
    <div className="ride-root">
      <canvas ref={canvasRef} className="ride-canvas" />
      <Hud
        snapshot={snapshot}
        stations={stations}
        started={started}
        onStart={handleStart}
        onDrive={(direction) => withEngine((engine) => engine.setVirtualDrive(direction))}
        onThrottle={(value) => withEngine((engine) => engine.setThrottle(value))}
        onToggleAutoRide={() => withEngine((engine) => engine.setAutoRide(!(snapshot?.autoRide ?? false)))}
        onToggleAutoStop={() => withEngine((engine) => engine.setAutoStop(!(snapshot?.autoStop ?? true)))}
        onReverse={() => withEngine((engine) => engine.reverse())}
        onRecentre={() => withEngine((engine) => engine.recentreView())}
        onJump={(index) => withEngine((engine) => engine.jumpTo(index))}
      />
    </div>
  );
}

export default RideCanvas;
