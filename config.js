// Every tuning number, colour and name in one place. The city is a grid of square blocks
// separated by roads; the world is centred on (0, 0) and the sea runs along its south edge.
// Names are all original: the city is Solmarina, the player is Rico Vega, his fixer is Mara Quinn.
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmarina.save.v1';

export const CITY = {
  blocks: 9, // blocks per side
  block: 46, // block edge, in world units
  road: 14, // road width
  // World half-extent: blocks*block + (blocks+1)*road, halved.
  get size() {
    return this.blocks * this.block + (this.blocks + 1) * this.road;
  },
  get half() {
    return this.size / 2;
  },
  // Road centre lines sit at these coordinates (one per gap between blocks).
  roadCentres() {
    const centres = [];
    const pitch = this.block + this.road;
    const start = -this.half + this.road / 2;
    for (let i = 0; i <= this.blocks; i += 1) centres.push(start + i * pitch);
    return centres;
  },
};

export const PLAYER = {
  walkSpeed: 7,
  runSpeed: 11,
  radius: 0.7,
  health: 100,
  turnSpeed: 9,
};

export const CAR = {
  accel: 16,
  brake: 30,
  reverseAccel: 10,
  maxSpeed: 34,
  maxReverse: 10,
  steer: 1.9,
  grip: 6,
  radius: 1.6,
  handbrakeTurn: 2.6,
};

export const TRAFFIC = {
  cars: 9,
  speed: 9,
  speedJitter: 3,
  peds: 14,
  pedSpeed: 1.6,
};

export const WANTED = {
  maxStars: 5,
  decaySeconds: 22, // quiet seconds before one star fades
  policeCars: [0, 1, 2, 3, 4, 5], // police cars per star level (index = stars)
  copFoot: [0, 0, 1, 2, 3, 4], // foot cops per star level
  bustSeconds: 1.6, // a cop touching the player this long busts them
  finePerStar: 150,
};

export const COMBAT = {
  pistolDamage: 34,
  pistolRange: 60,
  magSize: 12,
  reloadSeconds: 1.4,
  fireSeconds: 0.22,
  guardHealth: 100,
  copHealth: 80,
  enemyDamage: 8,
  enemyRange: 34,
  enemyFireSeconds: 1.1,
};

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    brief:
      'Mara needs a driver. Steal any car (walk up and press E) and bring it to her garage, the yellow marker.',
    reward: 250,
  },
  {
    id: 'the-pickup',
    title: 'The Pickup',
    brief:
      'A package is waiting at the docks. Drive there, grab it on foot, then deliver it to the drop-off across town.',
    reward: 450,
  },
  {
    id: 'hot-pursuit',
    title: 'Hot Pursuit',
    brief:
      'The pickup was a setup — the Solmarina PD is on you. Lose the heat: reach the hideout with no cops in sight.',
    reward: 600,
  },
  {
    id: 'the-last-job',
    title: 'The Last Job',
    brief:
      'One warehouse, four guards, one strongbox. Get in, take them down, grab the cash and get out clean.',
    reward: 1200,
  },
];

export const SIDE = {
  taxiFare: 120,
  packageValue: 60,
  packageCount: 8,
};

export const PLACES = {
  // Mission places sit on road intersections, so the beacon is always reachable on foot or
  // by car — never inside a building lot.
  garage: { x: -150, z: -150, label: "Mara's Garage" },
  docks: { x: 150, z: 150, label: 'Solmarina Docks' },
  dropoff: { x: -150, z: 150, label: 'Drop-off' },
  hideout: { x: 150, z: -150, label: 'Hideout' },
  warehouse: { x: 30, z: 150, label: 'Warehouse' },
  hospital: { x: -150, z: 30, label: 'Hospital' },
};

export const PALETTE = {
  sky: '#7ec8ee',
  sun: '#fff2d8',
  ground: '#3a3f46',
  sidewalk: '#9aa0a8',
  building: ['#e8dcc8', '#d9c2a3', '#c9b8a6', '#b8c4cc', '#e3b7a0', '#a8b8a0', '#d8cfa8'],
  glass: '#5f8fa8',
  car: ['#c0392b', '#2e6fb0', '#e8b73a', '#3fae6a', '#7a4a9e', '#e8e8e8', '#2b2b2b', '#d97b2f'],
  police: '#f2f2f2',
  player: '#d97b2f',
  marker: '#ffd23e',
  water: '#2e7fa8',
  grass: '#7da65c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
