// The city's life: traffic cars that drive the road grid (right-hand lanes, turning at
// intersections, stopping for the car ahead) and pedestrians who stroll the sidewalks and flee
// when a car bears down on them or a gun goes off. Both are cheap: a handful of meshes each.
import * as THREE from 'three';
import { CITY, TRAFFIC } from './config.js';
import { carColor, createVehicle } from './vehicles.js';
import { clamp, dist2D, makeRng, pushCircleOutOfBox } from './utils.js';

const PED_COLORS = ['#4a7a9e', '#9e4a4a', '#5a9e4a', '#c9a13a', '#7a4a9e', '#3a3a3a', '#e8e8e8', '#d97b2f'];

/** A pedestrian: a small figure walking a sidewalk line. */
function createPed(scene, x, z, heading, color) {
  const g = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: '#e8b88a', roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), jacket);
  torso.position.y = 0.95;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), skin);
  head.position.y = 1.45;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), new THREE.MeshStandardMaterial({ color: '#2b3440' }));
  legL.geometry.translate(0, -0.3, 0);
  legL.position.set(-0.13, 0.6, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.13;
  g.add(legR);
  g.position.set(x, 0, z);
  g.rotation.y = heading;
  scene.add(g);
  return { mesh: g, legL, legR, x, z, heading, speed: TRAFFIC.pedSpeed, phase: 0, flee: 0, down: 0 };
}

export function createTraffic(scene, city, seed, parkedSpots) {
  const rng = makeRng(seed + 77);
  const cars = [];
  const centres = city.centres;
  for (let i = 0; i < TRAFFIC.cars; i += 1) {
    const line = rng.pick(centres);
    const along = rng.range(-CITY.half + 20, CITY.half - 20);
    const vertical = rng.chance(0.5);
    const dir = rng.chance(0.5) ? 1 : -1;
    const lane = CITY.road / 4;
    const x = vertical ? line - lane * dir : along;
    const z = vertical ? along : line + lane * dir;
    const heading = vertical ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    const v = createVehicle(x, z, heading, carColor(rng), rng.chance(0.15) ? 'taxi' : 'civilian');
    v.speed = TRAFFIC.speed + rng.range(-TRAFFIC.speedJitter, TRAFFIC.speedJitter);
    v.vertical = vertical;
    v.dir = dir;
    v.targetSpeed = v.speed;
    scene.add(v.mesh);
    cars.push(v);
  }
  // Parked cars along the roads: the ones the player steals.
  const parked = [];
  for (let i = 0; i < 8; i += 1) {
    const spot = parkedSpots[i % parkedSpots.length];
    const v = createVehicle(spot.x, spot.z, spot.heading, carColor(rng));
    v.speed = 0;
    v.parked = true;
    scene.add(v.mesh);
    parked.push(v);
  }
  const peds = [];
  for (let i = 0; i < TRAFFIC.peds; i += 1) {
    const line = rng.pick(centres);
    const along = rng.range(-CITY.half + 20, CITY.half - 20);
    const side = rng.chance(0.5) ? 1 : -1;
    const vertical = rng.chance(0.5);
    const off = CITY.road / 2 + 2.5;
    const x = vertical ? line + off * side : along;
    const z = vertical ? along : line + off * side;
    const heading = vertical ? (rng.chance(0.5) ? 0 : Math.PI) : rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    peds.push(createPed(scene, x, z, heading, rng.pick(PED_COLORS)));
  }
  return { cars, parked, peds, rng };
}

/** Drive one traffic car along its road; at an intersection it may turn. */
function updateTrafficCar(v, dt, city, others) {
  // Slow for the car ahead.
  let target = v.targetSpeed;
  for (const o of others) {
    if (o === v || o.parked) continue;
    const dx = o.x - v.x;
    const dz = o.z - v.z;
    const ahead = dx * Math.sin(v.heading) + dz * Math.cos(v.heading);
    const side = Math.abs(dx * Math.cos(v.heading) - dz * Math.sin(v.heading));
    if (ahead > 0 && ahead < 9 && side < 2.4) {
      target = 0;
      break;
    }
  }
  v.speed += (target - v.speed) * Math.min(1, 3 * dt);
  v.x += Math.sin(v.heading) * v.speed * dt;
  v.z += Math.cos(v.heading) * v.speed * dt;
  // At an intersection, sometimes turn onto the crossing road.
  const centres = city.centres;
  const nearX = centres.find((c) => Math.abs(v.x - c) < 1.2);
  const nearZ = centres.find((c) => Math.abs(v.z - c) < 1.2);
  if ((nearX !== undefined || nearZ !== undefined) && Math.random() < 0.012) {
    const vertical = Math.abs(Math.sin(v.heading)) < 0.5;
    if (vertical && nearZ !== undefined) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      v.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      v.z = nearZ + (CITY.road / 4) * dir;
      v.x = nearX !== undefined ? nearX : v.x;
    } else if (!vertical && nearX !== undefined) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      v.heading = dir > 0 ? 0 : Math.PI;
      v.x = nearX - (CITY.road / 4) * dir;
      v.z = nearZ !== undefined ? nearZ : v.z;
    }
  }
  // Wrap around the far edge so traffic never runs out.
  if (v.x > CITY.half + 30) v.x = -CITY.half - 30;
  if (v.x < -CITY.half - 30) v.x = CITY.half + 30;
  if (v.z > CITY.half + 30) v.z = -CITY.half - 30;
  if (v.z < -CITY.half - 30) v.z = CITY.half + 30;
  v.mesh.position.set(v.x, 0, v.z);
  v.mesh.rotation.y = v.heading;
}

function updatePed(p, dt, city, danger) {
  // Knocked down: lie flat for a while, then get up and walk off.
  if (p.down > 0) {
    p.down -= dt;
    p.mesh.rotation.x = -Math.PI / 2;
    p.mesh.position.y = 0.3;
    if (p.down <= 0) {
      p.mesh.rotation.x = 0;
      p.mesh.position.y = 0;
    }
    return;
  }
  // Flee from danger (a speeding car, a gunshot): run away from it for a few seconds.
  if (danger) {
    const d = dist2D(p, danger);
    if (d < 14) {
      p.flee = 2.5;
      p.heading = Math.atan2(p.x - danger.x, p.z - danger.z);
    }
  }
  if (p.flee > 0) {
    p.flee -= dt;
    p.speed = 5;
  } else {
    p.speed = TRAFFIC.pedSpeed;
  }
  p.x += Math.sin(p.heading) * p.speed * dt;
  p.z += Math.cos(p.heading) * p.speed * dt;
  // Stay out of buildings (a sidewalk line can clip a lot's corner).
  const circle = { x: p.x, z: p.z, radius: 0.5 };
  for (const box of city.colliders) {
    if (pushCircleOutOfBox(circle, box)) {
      p.x = circle.x;
      p.z = circle.z;
    }
  }
  // At an intersection, sometimes turn; stay inside the world.
  const centres = city.centres;
  const nearX = centres.find((c) => Math.abs(p.x - c) < 1);
  const nearZ = centres.find((c) => Math.abs(p.z - c) < 1);
  if ((nearX !== undefined || nearZ !== undefined) && Math.random() < 0.01) {
    p.heading += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
  }
  if (Math.abs(p.x) > CITY.half - 6) p.heading = Math.atan2(-p.x, p.z);
  if (Math.abs(p.z) > CITY.half - 6) p.heading = Math.atan2(p.x, -p.z);
  p.phase += p.speed * dt * 2.2;
  const swing = Math.sin(p.phase) * 0.5;
  p.legL.rotation.x = swing;
  p.legR.rotation.x = -swing;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
}

export function updateTraffic(traffic, dt, city, danger) {
  for (const car of traffic.cars) updateTrafficCar(car, dt, city, traffic.cars);
  for (const ped of traffic.peds) updatePed(ped, dt, city, danger);
}

/** Parked-car spots along the roads, for the player to steal from. */
export function parkedSpots(city, rng) {
  const spots = [];
  const centres = city.centres;
  for (let i = 0; i < 8; i += 1) {
    const line = centres[1 + rng.int(0, centres.length - 3)];
    const along = rng.range(-CITY.half + 30, CITY.half - 30);
    const vertical = rng.chance(0.5);
    const side = rng.chance(0.5) ? 1 : -1;
    const off = CITY.road / 2 - 1.6;
    spots.push({
      x: vertical ? line + off * side : along,
      z: vertical ? along : line + off * side,
      heading: vertical ? (side > 0 ? 0 : Math.PI) : side > 0 ? Math.PI / 2 : -Math.PI / 2,
    });
  }
  return spots;
}

export function nearestParkedCar(traffic, x, z, maxDist = 4) {
  let best = null;
  let bestD = maxDist;
  for (const car of traffic.parked) {
    if (car.occupied) continue;
    const d = dist2D(car, { x, z });
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
