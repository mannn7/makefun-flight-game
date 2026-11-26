// Skylark Ridge — terrain: the valley itself, its runways, rings, spires and
// decoration. One job: answer "how high is the ground here?" and lay out the
// course. Everything is a pure function of x, so the ground never changes
// between loads and the flight model can trust it.

'use strict';

// Smoothstep between 0 and 1 for blending terrain features.
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// One mountain ridge: a gaussian bump centred at c, width w, height h.
function ridgeBump(x, c, w, h) {
  const d = (x - c) / w;
  return h * Math.exp(-d * d);
}

// The ridges that shape the valley, in order along the course.
const RIDGES = [
  { c: 1800, w: 260, h: 260 },
  { c: 2900, w: 330, h: 420 },
  { c: 5600, w: 390, h: 460 },
  { c: 7100, w: 290, h: 320 },
  { c: 8950, w: 430, h: 780 }, // the end wall: the valley closes here
];

// The lake dip: the ground sags a little between these x marks and water sits in it.
const LAKE = { x0: 3300, x1: 3850, depth: 42, waterY: 1108 };

// The ground height at world x, in canvas pixels (y grows down).
// Valley floor is near RUNWAY_Y; ridges pull it up; runways flatten it.
function terrainHeightAt(x) {
  const clamped = Math.max(0, Math.min(WORLD_LENGTH, x));
  let y = RUNWAY_Y;
  y += 55 * Math.sin(clamped / 420 + 1.3);
  y += 30 * Math.sin(clamped / 173 + 4.1);
  y += 14 * Math.sin(clamped / 61 + 0.7);
  for (const r of RIDGES) y -= ridgeBump(clamped, r.c, r.w, r.h);
  // The lake: a gentle sag the water fills.
  const lakeIn = smoothstep(LAKE.x0 - 120, LAKE.x0 + 120, clamped) * (1 - smoothstep(LAKE.x1 - 120, LAKE.x1 + 120, clamped));
  y += LAKE.depth * lakeIn;
  // Runways are flat: blend the ground toward RUNWAY_Y near each strip.
  for (const rw of COURSE.runways) {
    const margin = 170;
    const near = smoothstep(rw.x0 - margin, rw.x0 + 60, clamped) * (1 - smoothstep(rw.x1 - 60, rw.x1 + margin, clamped));
    y = y + (RUNWAY_Y - y) * near;
  }
  return y;
}

// The runway the plane is over, or null. The strip is flat and safe to land on.
function runwayAt(x) {
  for (const rw of COURSE.runways) {
    if (x >= rw.x0 && x <= rw.x1) return rw;
  }
  return null;
}

// Whether world x is on the lake's water.
function isLakeAt(x) {
  return x >= LAKE.x0 && x <= LAKE.x1;
}

// The target rings, placed from the course table: each one hangs a set
// clearance above the ground at its x, so every ring is reachable.
const RINGS = COURSE.ringXs.map((x, i) => ({
  x,
  y: terrainHeightAt(x) - COURSE.ringClearances[i],
  r: COURSE.ringRadii[i],
  index: i,
  passed: false,
  flash: 0, // 1 just after a pass, decays to 0; the renderer glows while it lasts
}));

// The rock spires, with their tops computed from the ground beneath them.
const SPIRES = COURSE.spires.map((s) => ({
  x: s.x,
  topY: terrainHeightAt(s.x) - s.height,
  baseY: terrainHeightAt(s.x),
  width: 26,
}));

// Decoration, generated once from a fixed seed: trees, houses, clouds and birds.
// Cosmetic only; nothing here affects flight or collision.
const Decor = {
  trees: [],
  houses: [],
  clouds: [],
  birds: [],
};

function initDecor() {
  const rng = mulberry32(20261126);
  // Trees on gentle ground, never on a runway or in the lake.
  for (let x = 120; x < WORLD_LENGTH - 120; x += 46) {
    if (runwayAt(x) || isLakeAt(x)) continue;
    if (rng() < 0.62) {
      const scale = 0.7 + rng() * 0.9;
      Decor.trees.push({ x: x + rng() * 30, y: terrainHeightAt(x), scale, tint: rng() });
    }
  }
  // Little houses with lit windows beside each runway.
  for (const rw of COURSE.runways) {
    const n = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const x = rw.x0 - 260 + i * 90 + rng() * 40;
      if (x < 60) continue;
      Decor.houses.push({ x, y: terrainHeightAt(x), w: 34 + rng() * 22, h: 22 + rng() * 10, lit: rng() < 0.75 });
    }
  }
  // Clouds drift far above the valley, in three parallax layers.
  for (let i = 0; i < 26; i++) {
    Decor.clouds.push({
      x: rng() * WORLD_LENGTH,
      y: 60 + rng() * 330,
      scale: 0.6 + rng() * 1.6,
      layer: i % 3,
      speed: 4 + rng() * 9,
    });
  }
  // Birds cruise the valley in loose flocks.
  for (let i = 0; i < 9; i++) {
    Decor.birds.push({
      x: rng() * WORLD_LENGTH,
      y: 260 + rng() * 420,
      speed: 18 + rng() * 22,
      phase: rng() * Math.PI * 2,
    });
  }
}

// The terrain module's public surface.
const Terrain = {
  heightAt: terrainHeightAt,
  runwayAt,
  isLakeAt,
  rings: RINGS,
  spires: SPIRES,
  lake: LAKE,
  decor: Decor,
  initDecor,
};
