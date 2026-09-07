# Personal Website / Portfolio

A portfolio you ride. The site is a rollercoaster in space: a single closed loop
of track with a stop at every job and project. You drive the car yourself, and
the line always brings you back to where you started.

Built with React + TypeScript (create-react-app) and three.js. No other
rendering libraries - the ride is hand-rolled so the motion can be tuned
directly.

## Running it

```bash
npm install
npm start
```

Then open http://localhost:3000.

## Controls

| Input | What it does |
| --- | --- |
| `W` / `Up`, `S` / `Down` | Drive forward or backwards along the track (hold) |
| Drag the mouse (or a finger) | Look around while the ride carries you |
| Mouse wheel, `[` / `]`, or the throttle slider | Set the speed the car drives at |
| `Space` | Brake |
| `R` | Auto tour - the car drives itself and waits at each stop |
| `E` | Toggle stopping at stations (off = express, straight past them) |
| `Q` | Flip direction |
| `C` | Recentre the view |
| Route map (top left) | Jump straight to a stop |

## How it is put together

```
src/ride/
  stations.ts       content of every stop + the control points of the track
  track.ts          the closed curve: arc length, orientation frames, barrel rolls
  rideController.ts how the car moves - throttle, coasting, braking into a stop
  input.ts          keyboard / mouse / touch, including the free-look offsets
  rideEngine.ts     three.js scene, camera rig and the animation loop
  trackMesh.ts      rails, ties and the station furniture
  scenery.ts        stars, nebulae, planets, lighting
src/components/
  RideCanvas.tsx    hosts the canvas, bridges the engine to the HUD
  Hud.tsx, ride.css the DOM overlay
```

A few things worth knowing if you come back to this later:

- **The car's position is a single number.** `RideController.s` is the distance
  along the loop; everything else (which stop is next, whether it can still
  brake in time, where the camera is) is derived from it. Wrapping it modulo the
  track length is what makes the line a loop.
- **Orientation comes from pre-computed frames.** `Track.orientationAt(u)` is
  world up projected perpendicular to the track, so the horizon stays put and
  the platforms sit level. Barrel rolls are declared separately in `ROLLS` and
  layered on top, which is why the car can go upside down without the rest of
  the ride drifting.
- **Free-look is layered on the rig, not on the ride.** The car is an
  `Object3D` on the rail and the camera is its child; looking around only
  rotates the camera locally, so it can never fight the track.
- **Braking into a stop is planned, not reactive.** The controller clamps the
  requested speed to `sqrt(2 * a * d)` for the distance `d` left to the next
  platform. The planned deceleration is deliberately gentler than the brakes
  actually available, so the car can always catch back down onto the profile and
  stop on the mark. `MAX_SPEED` is capped for the same reason - see the comment
  on it before raising it.

## Editing the content

Everything a visitor reads lives in `src/ride/stations.ts`: the six entries in
`STATIONS` (name, role, period, paragraphs, tags, links, accent colour). Add or
remove entries there and point a control point at the new index.

The shape of the ride is the `TRACK_POINTS` array in the same file - each point
is an angle around the loop, a radius and a height, and any point can be marked
as a station. `ROLLS` declares which stretches barrel roll. Keep at least ~160
units of track between stops so the car can always brake in time.
