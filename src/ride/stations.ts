/**
 * Content + track layout for the ride.
 *
 * TODO(portfolio): replace the placeholder copy below with real work history /
 * project write-ups. Nothing else needs to change - the track, the stops and the
 * HUD are all generated from this file.
 */

export type StationKind = 'origin' | 'work' | 'project' | 'contact';

export interface StationSpec {
  id: string;
  /** Short name shown on the 3D beacon and in the route map. */
  name: string;
  kind: StationKind;
  org?: string;
  role?: string;
  period?: string;
  /** One-line summary shown on the 3D beacon. */
  blurb: string;
  /** Paragraphs shown in the docked panel. */
  details: string[];
  tags: string[];
  links?: { label: string; url: string }[];
  /** Accent colour for the platform, gate rings and HUD. */
  color: number;
}

export const STATIONS: StationSpec[] = [
  {
    id: 'mission-control',
    name: 'Mission Control',
    kind: 'origin',
    role: 'Software Engineer',
    blurb: 'Start of the line - who is driving this thing',
    details: [
      'Welcome aboard. This is a portfolio built as a rollercoaster: every stop on the loop is a job or a project.',
      'Drive it yourself with W / S, look around by dragging the mouse, and change the throttle with the slider or the mouse wheel. The line is a closed loop, so you always come back here.',
    ],
    tags: ['TypeScript', 'React', 'three.js', 'Node'],
    links: [
      { label: 'GitHub', url: 'https://github.com/Piyotr-K' },
      { label: 'Email', url: 'mailto:piyotr.kao@gmail.com' },
    ],
    color: 0x62e8ff,
  },
  {
    id: 'work-one',
    name: 'Nebula Systems',
    kind: 'work',
    org: 'Nebula Systems',
    role: 'Software Engineer',
    period: '2022 - present',
    blurb: 'Platform work on a high traffic service',
    details: [
      'Placeholder: describe the team, the systems you owned, and the measurable outcome of the work.',
      'Placeholder: one concrete story - a migration, an incident, a performance win - with the numbers that made it matter.',
    ],
    tags: ['TypeScript', 'AWS', 'PostgreSQL', 'CI/CD'],
    color: 0x9d7bff,
  },
  {
    id: 'project-one',
    name: 'Stellar Cartographer',
    kind: 'project',
    period: '2023',
    blurb: 'Interactive star map, WebGL + workers',
    details: [
      'Placeholder: what the project does, why you built it, and the interesting technical constraint you had to design around.',
      'Placeholder: the part you are proudest of.',
    ],
    tags: ['three.js', 'Web Workers', 'GLSL'],
    links: [{ label: 'Source', url: 'https://github.com/Piyotr-K' }],
    color: 0xff7ac6,
  },
  {
    id: 'work-two',
    name: 'Orbital Labs',
    kind: 'work',
    org: 'Orbital Labs',
    role: 'Full Stack Developer',
    period: '2020 - 2022',
    blurb: 'End to end product delivery',
    details: [
      'Placeholder: scope of ownership, the stack, and how the product changed while you were on it.',
      'Placeholder: collaboration - who you worked with and what you shipped together.',
    ],
    tags: ['React', 'C#', '.NET', 'SQL Server'],
    color: 0x6cff9e,
  },
  {
    id: 'project-two',
    name: 'Pulsar Engine',
    kind: 'project',
    period: '2021',
    blurb: 'Small game engine, ECS + custom renderer',
    details: [
      'Placeholder: the architecture in two sentences, and the thing that turned out much harder than expected.',
      'Placeholder: what you would do differently now.',
    ],
    tags: ['C++', 'OpenGL', 'ECS'],
    links: [{ label: 'Source', url: 'https://github.com/Piyotr-K' }],
    color: 0xffc85e,
  },
  {
    id: 'signal-relay',
    name: 'Signal Relay',
    kind: 'contact',
    blurb: 'End of the line - say hello',
    details: [
      'Thanks for riding. The loop closes back at Mission Control from here.',
      'Placeholder: what you are looking for next, and the best way to reach you.',
    ],
    tags: ['Open to work'],
    links: [
      { label: 'GitHub', url: 'https://github.com/Piyotr-K' },
      { label: 'Email', url: 'mailto:piyotr.kao@gmail.com' },
    ],
    color: 0xff6b6b,
  },
];

/**
 * Control points of the closed loop, in polar-ish form so the shape is easy to
 * tweak by hand: `a` = angle around the loop in degrees, `r` = radius from the
 * centre, `y` = height. `station` indexes into STATIONS.
 */
export interface TrackPointSpec {
  a: number;
  r: number;
  y: number;
  station?: number;
}

export const TRACK_POINTS: TrackPointSpec[] = [
  { a: 0, r: 210, y: 0, station: 0 },
  { a: 8, r: 208, y: 2 },
  { a: 20, r: 198, y: 24 },
  { a: 34, r: 180, y: 58 },
  { a: 46, r: 162, y: 74 },
  { a: 58, r: 150, y: 46 },
  { a: 70, r: 144, y: 30, station: 1 },
  { a: 80, r: 146, y: 28 },
  { a: 92, r: 156, y: 34 },
  { a: 106, r: 174, y: 54 },
  { a: 120, r: 194, y: 72 },
  { a: 132, r: 212, y: 80 },
  { a: 144, r: 226, y: 78, station: 2 },
  { a: 156, r: 234, y: 70 },
  { a: 168, r: 240, y: 46 },
  { a: 180, r: 240, y: 14 },
  { a: 194, r: 230, y: -18 },
  { a: 206, r: 212, y: -34, station: 3 },
  { a: 218, r: 194, y: -38 },
  { a: 230, r: 174, y: -30 },
  { a: 242, r: 158, y: -12 },
  { a: 254, r: 150, y: 4 },
  { a: 266, r: 152, y: 12, station: 4 },
  { a: 278, r: 160, y: 14 },
  { a: 290, r: 174, y: 26 },
  { a: 302, r: 190, y: 40 },
  { a: 312, r: 204, y: 52 },
  { a: 322, r: 214, y: 54, station: 5 },
  { a: 330, r: 218, y: 50 },
  { a: 338, r: 218, y: 42 },
  { a: 346, r: 216, y: 26 },
  { a: 353, r: 213, y: 10 },
];

/**
 * Barrel rolls, declared between two stations so they survive edits to the
 * layout above. `turns` is signed (negative rolls the other way).
 */
export interface RollSpec {
  fromStation: number;
  toStation: number;
  turns: number;
}

export const ROLLS: RollSpec[] = [
  { fromStation: 1, toStation: 2, turns: 1 },
  { fromStation: 3, toStation: 4, turns: -1 },
];
