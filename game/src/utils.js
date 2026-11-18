// Small helpers shared by every system: a seeded RNG (so a seed always builds the same
// city), angle and vector math, and the circle-vs-box collision the whole game uses.
export function createRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const rand = createRandom(seed);
  return {
    next: rand,
    range: (min, max) => min + rand() * (max - min),
    int: (min, max) => Math.floor(min + rand() * (max - min + 1)),
    pick: (list) => list[Math.floor(rand() * list.length)],
    chance: (p) => rand() < p,
  };
}

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** Shortest signed turn from angle `a` to angle `b`, in radians. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function angleLerp(a, b, t) {
  return a + angleDelta(a, b) * clamp(t, 0, 1);
}
/** Distance in the XZ plane between two {x, z} points. */
export function dist2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Push a circle (x, z, radius) out of an axis-aligned box {minX, maxX, minZ, maxZ}.
 * Returns true when a push happened. The circle's x/z are moved in place.
 */
export function pushCircleOutOfBox(circle, box) {
  const cx = clamp(circle.x, box.minX, box.maxX);
  const cz = clamp(circle.z, box.minZ, box.maxZ);
  let dx = circle.x - cx;
  let dz = circle.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= circle.radius * circle.radius) return false;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    const push = (circle.radius - d) / d;
    circle.x += dx * push;
    circle.z += dz * push;
  } else {
    // Centre inside the box: push out along the smallest penetration axis.
    const left = circle.x - box.minX;
    const right = box.maxX - circle.x;
    const top = circle.z - box.minZ;
    const bottom = box.maxZ - circle.z;
    const m = Math.min(left, right, top, bottom);
    if (m === left) circle.x = box.minX - circle.radius;
    else if (m === right) circle.x = box.maxX + circle.radius;
    else if (m === top) circle.z = box.minZ - circle.radius;
    else circle.z = box.maxZ + circle.radius;
  }
  return true;
}

/** True when a circle overlaps an axis-aligned box. */
export function circleHitsBox(circle, box) {
  const cx = clamp(circle.x, box.minX, box.maxX);
  const cz = clamp(circle.z, box.minZ, box.maxZ);
  const dx = circle.x - cx;
  const dz = circle.z - cz;
  return dx * dx + dz * dz < circle.radius * circle.radius;
}

/** Format a money amount as $1,234. */
export function money(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}

/** Format seconds as M:SS. */
export function clockText(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
