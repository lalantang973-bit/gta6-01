// The wanted system and the Solmarina PD. Crimes raise stars; police cars and foot cops
// spawn at the edge of view and chase the player; the heat fades after quiet seconds out of
// sight. A cop that holds the player (or boxes the car in) busts them: a fine, a trip to the
// hospital, and the wanted level clears.
import * as THREE from 'three';
import { CITY, WANTED } from './config.js';
import { createVehicle, driveVehicle } from './vehicles.js';
import { clamp, dist2D } from './utils.js';

export function createPolice(scene, city) {
  const police = {
    scene,
    city,
    stars: 0,
    quietTime: 0,
    bustTimer: 0,
    cars: [],
    cops: [],
    sirenOn: false,
    /** Put a police car at an exact spot (a roadblock for a screenshot, a scripted chase). */
    placeCar(x, z, heading = 0) {
      const car = createVehicle(x, z, heading, '#f2f2f2', 'police');
      car.speed = 0;
      car.targetSpeed = 26;
      // A scripted car drives straight at its set speed and never chases: it stays where a
      // screenshot needs it instead of ramming the player and pinning them.
      car.scripted = true;
      car.scriptSpeed = 22;
      scene.add(car.mesh);
      police.cars.push(car);
      return car;
    },
  };
  return police;
}

export function addWanted(police, n, reason) {
  const before = police.stars;
  police.stars = clamp(police.stars + n, 0, WANTED.maxStars);
  police.quietTime = 0;
  if (police.stars > before) police.sirenOn = true;
  return { before, after: police.stars, reason };
}

export function clearWanted(police) {
  police.stars = 0;
  police.quietTime = 0;
  police.bustTimer = 0;
  police.sirenOn = false;
  for (const car of police.cars) police.scene.remove(car.mesh);
  for (const cop of police.cops) police.scene.remove(cop.mesh);
  police.cars = [];
  police.cops = [];
}

function spawnPointNear(player, city, rng, minDist = 45, maxDist = 80) {
  for (let tries = 0; tries < 12; tries += 1) {
    const a = rng.next() * Math.PI * 2;
    const d = rng.range(minDist, maxDist);
    const x = clamp(player.x + Math.sin(a) * d, -CITY.half + 10, CITY.half - 10);
    const z = clamp(player.z + Math.cos(a) * d, -CITY.half + 10, CITY.half - 10);
    if (!city.onRoad(x, z)) continue;
    return { x, z };
  }
  const road = city.nearestRoadPoint(player.x + 50, player.z);
  return road;
}

function spawnPoliceCar(police, player, rng) {
  const spot = spawnPointNear(player, police.city, rng);
  const car = createVehicle(spot.x, spot.z, 0, '#f2f2f2', 'police');
  car.speed = 0;
  car.targetSpeed = 26;
  police.scene.add(car.mesh);
  police.cars.push(car);
  return car;
}

function spawnCop(police, player, rng) {
  const spot = spawnPointNear(player, police.city, rng, 30, 60);
  const mesh = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: '#1c3faa', roughness: 0.85 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.34), navy);
  torso.position.y = 1.05;
  torso.castShadow = true;
  mesh.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), new THREE.MeshStandardMaterial({ color: '#e8b88a' }));
  head.position.y = 1.62;
  mesh.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.12, 10), navy);
  cap.position.y = 1.8;
  mesh.add(cap);
  mesh.position.set(spot.x, 0, spot.z);
  police.scene.add(mesh);
  const cop = { mesh, x: spot.x, z: spot.z, heading: 0, speed: 0, shootTimer: 0, health: 80, maxHealth: 80, alive: true, bar: null, kind: 'cop' };
  mesh.userData.enemyRef = cop;
  police.cops.push(cop);
  return cop;
}

/**
 * Chase step. Police cars drive at the player (arcade steering toward them, ramming to slow
 * them); foot cops run at the player and shoot when close. Returns 'busted' when the player
 * is caught, else null.
 */
export function updatePolice(police, dt, player, rng, onBusted) {
  const city = police.city;
  // Spawn up to the level's quota.
  const wantCars = WANTED.policeCars[police.stars] || 0;
  const wantCops = WANTED.copFoot[police.stars] || 0;
  while (police.cars.length < wantCars) spawnPoliceCar(police, player, rng);
  while (police.cops.length < wantCops) spawnCop(police, player, rng);
  // Extra units leave when the heat drops.
  while (police.cars.length > wantCars) {
    const car = police.cars.pop();
    police.scene.remove(car.mesh);
  }
  while (police.cops.length > wantCops) {
    const cop = police.cops.pop();
    police.scene.remove(cop.mesh);
  }
  if (police.stars === 0) {
    police.sirenOn = false;
    return null;
  }
  // Heat fades after quiet seconds with no crime and no cop nearby.
  const nearestCop = Math.min(
    ...police.cars.map((c) => dist2D(c, player)),
    ...police.cops.map((c) => dist2D(c, player)),
    Infinity,
  );
  if (nearestCop > 55) {
    police.quietTime += dt;
    if (police.quietTime > WANTED.decaySeconds) {
      police.stars = Math.max(0, police.stars - 1);
      police.quietTime = 0;
      if (police.stars === 0) police.sirenOn = false;
    }
  } else {
    police.quietTime = 0;
  }
  // Police cars chase and ram.
  for (const car of police.cars) {
    if (car.scripted) {
      // A scripted car just drives straight at its set speed (a screenshot chase).
      driveVehicle(car, dt, { throttle: car.speed < car.scriptSpeed ? 1 : 0, steer: 0, handbrake: false }, city);
      const bar = car.mesh.userData.lightBar;
      if (bar) {
        const phase = Math.floor(performance.now() / 280) % 2 === 0;
        bar.red.material.emissiveIntensity = phase ? 2.2 : 0.2;
        bar.blue.material.emissiveIntensity = phase ? 0.2 : 2.2;
      }
      continue;
    }
    const dx = player.x - car.x;
    const dz = player.z - car.z;
    const wantHeading = Math.atan2(dx, dz);
    let d = wantHeading - car.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const steer = clamp(d * 1.4, -1, 1);
    const dist = Math.hypot(dx, dz);
    driveVehicle(car, dt, { throttle: dist > 4 ? 1 : 0.4, steer, handbrake: false }, city);
    // Flash the light bar.
    const bar = car.mesh.userData.lightBar;
    if (bar) {
      const phase = Math.floor(performance.now() / 280) % 2 === 0;
      bar.red.material.emissiveIntensity = phase ? 2.2 : 0.2;
      bar.blue.material.emissiveIntensity = phase ? 0.2 : 2.2;
    }
  }
  // Foot cops run at the player and grab them.
  let touching = false;
  for (const cop of police.cops) {
    const dx = player.x - cop.x;
    const dz = player.z - cop.z;
    const d = Math.hypot(dx, dz);
    cop.heading = Math.atan2(dx, dz);
    const speed = d > 2 ? 6.5 : 0;
    cop.x += Math.sin(cop.heading) * speed * dt;
    cop.z += Math.cos(cop.heading) * speed * dt;
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.heading;
    if (d < 1.6) touching = true;
  }
  // A police car pinning the player's car counts as a bust too.
  const playerCar = player.onFoot ? null : player.vehicle;
  if (playerCar) {
    let pinned = 0;
    for (const car of police.cars) {
      if (dist2D(car, playerCar) < 4.5) pinned += 1;
    }
    if (pinned >= 2 && Math.abs(playerCar.speed) < 1) touching = true;
  }
  if (touching) {
    police.bustTimer += dt;
    if (police.bustTimer > WANTED.bustSeconds) {
      police.bustTimer = 0;
      onBusted();
      return 'busted';
    }
  } else {
    police.bustTimer = Math.max(0, police.bustTimer - dt * 2);
  }
  return null;
}

export function policeCarCount(police) {
  return police.cars.length;
}
