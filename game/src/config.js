// Skylark Ridge — game configuration: world size, physics tuning, course layout and palette.
// One job: every number the rest of the game reads. Nothing here touches the DOM.

'use strict';

// Canvas the game draws into (internal pixels; CSS scales it to the window).
const VIEW_W = 1280;
const VIEW_H = 720;
// Instrument panel height at the bottom of the canvas.
const PANEL_H = 104;

// The valley the course runs through, in world pixels. x grows east, y grows down.
const WORLD_LENGTH = 9200;
const WORLD_HEIGHT = 1600;
// Flat valley floor the runways sit on.
const RUNWAY_Y = 1080;

// Flight model tuning (arcade: forgiving, fun first).
const FLIGHT = {
  maxSpeed: 320, // px/s at full throttle
  minSpeed: 55, // px/s at idle (still flying, barely)
  stallSpeed: 95, // below this the wing stops lifting and the plane sinks
  accel: 55, // px/s^2 spooling toward the throttle's target speed
  decel: 34, // px/s^2 when the throttle is pulled back
  maxPitch: 0.62, // radians, about 35 degrees up or down
  pitchRate: 2.4, // radians/s the nose moves toward the commanded pitch
  climbAuthority: 1.0,
  boostSpeed: 65, // extra px/s while Space is held
  fuelDrainBase: 0.35, // fuel units/s at idle
  fuelDrainThrottle: 0.85, // extra fuel units/s at full throttle
  fuelCapacity: 100,
  takeoffSpeed: 115, // the wing lifts the plane off the runway above this
  landingMaxSpeed: 270, // faster than this and a touchdown is a crash
  landingMaxSink: 120, // px/s of descent a landing can absorb
  groundClearance: 14, // px between the wheels and the terrain when flying
};

// Scoring.
const SCORE = {
  ring: 100,
  ringPerfect: 25, // through the middle third of a ring
  landing: 250,
  winBonus: 500,
  timeBonusRate: 2, // per second under the par time
  timePar: 300, // seconds
  ringsToWin: 8, // land on the final runway with this many rings for a win
};

// Sunset valley palette, one style for sky, terrain and the plane.
const PALETTE = {
  skyTop: '#1c2340',
  skyMid: '#7a4a6d',
  skyLow: '#e8804a',
  horizon: '#f7b267',
  sunCore: '#ffe9a8',
  sunGlow: '#ff9d4d',
  farMountain: '#5a4a7a',
  midHill: '#4a3f63',
  terrainGrass: '#5d7a45',
  terrainGrassLight: '#7da05a',
  terrainRock: '#6e5646',
  terrainRockDark: '#54402f',
  terrainSnow: '#e8eef7',
  treeDark: '#2f4a2a',
  treeLight: '#4a6b35',
  water: '#4a7fa5',
  waterShine: '#8fc3dd',
  runway: '#33333a',
  runwayLine: '#f2ead8',
  ringGold: '#ffd94d',
  ringGlow: '#ff9d2e',
  planeCream: '#f7ead0',
  planeOrange: '#e86a2c',
  planeDark: '#3a2e28',
  glass: '#9fd8ef',
  panel: '#1d1a24',
  panelEdge: '#3a3247',
  dialFace: '#101820',
  dialAmber: '#ffb347',
  dialGreen: '#7dff9a',
  dialRed: '#ff5a4a',
  dialWhite: '#f2f0e8',
  hudText: '#fff3d6',
};

// A tiny deterministic RNG so the course never changes between loads.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function nextRandom() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The course: runways, target rings, rock spires and wind, all hand placed.
// Ring heights are computed from the terrain at load time (see terrain.js),
// so every ring sits a fair, flyable distance above the ground.
const COURSE = {
  runways: [
    { name: 'SKYLARK FIELD', x0: 150, x1: 750 },
    { name: 'LAKESIDE STRIP', x0: 4050, x1: 4650 },
    { name: 'RIDGE END', x0: 8550, x1: 9150 },
  ],
  // Ring clearances above the terrain, in order along the course.
  ringClearances: [300, 220, 340, 240, 300, 200, 320, 240, 360, 220, 300, 260],
  ringXs: [1100, 1650, 2200, 2750, 3300, 3900, 4600, 5200, 5800, 6500, 7300, 8100],
  ringRadii: [62, 68, 74, 62, 68, 74, 62, 68, 74, 62, 68, 74],
  // Rock spires that rise out of the terrain: hit one and the sortie ends.
  spires: [
    { x: 2450, height: 240 },
    { x: 5050, height: 265 },
    { x: 6450, height: 220 },
    { x: 7750, height: 285 },
  ],
  // Gentle crosswind along the course, -1..1; it crabs the heading a few degrees.
  windAt: function courseWindAt(x) {
    return 0.55 * Math.sin(x / 1500 + 0.5) + 0.25 * Math.sin(x / 430 + 2.0);
  },
};
