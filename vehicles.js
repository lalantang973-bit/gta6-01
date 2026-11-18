// Cars: a box-built mesh (body, cabin, wheels, lights) and arcade driving physics —
// accelerate, brake, reverse, steer with speed-sensitive grip, handbrake slides, and simple
// circle collisions against buildings and other cars. No physics engine: the numbers are tuned
// to feel like a city arcade driver.
import * as THREE from 'three';
import { CAR, PALETTE } from './config.js';
import { clamp, pushCircleOutOfBox } from './utils.js';

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });

/** Build a car mesh. kind is 'civilian' | 'police' | 'taxi'. Returns a Group. */
export function createCarMesh(color, kind = 'civilian') {
  const car = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#24343f', roughness: 0.15, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.1), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  car.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.55, 2.1), glassMat);
  cabin.position.set(0, 1.1, -0.25);
  cabin.castShadow = true;
  car.add(cabin);
  const lightMat = new THREE.MeshStandardMaterial({ color: '#fff8d0', emissive: '#fff2a0', emissiveIntensity: 0.7 });
  for (const x of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), lightMat);
    head.position.set(x, 0.55, 2.06);
    car.add(head);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.16, 0.08),
      new THREE.MeshStandardMaterial({ color: '#c02020', emissive: '#a01010', emissiveIntensity: 0.7 }),
    );
    tail.position.set(x, 0.55, -2.06);
    car.add(tail);
  }
  const wheels = [];
  for (const [x, z] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(x, 0.36, z);
    wheel.castShadow = true;
    car.add(wheel);
    wheels.push(wheel);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), new THREE.MeshStandardMaterial({ color: '#222222' }));
    bar.position.set(0, 1.45, -0.25);
    car.add(bar);
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.14, 0.42),
      new THREE.MeshStandardMaterial({ color: '#ff2020', emissive: '#ff2020', emissiveIntensity: 1.4 }),
    );
    red.position.set(-0.28, 1.52, -0.25);
    car.add(red);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.14, 0.42),
      new THREE.MeshStandardMaterial({ color: '#2040ff', emissive: '#2040ff', emissiveIntensity: 1.4 }),
    );
    blue.position.set(0.28, 1.52, -0.25);
    car.add(blue);
    car.userData.lightBar = { red, blue };
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.2, 4.12), new THREE.MeshStandardMaterial({ color: '#1c3faa' }));
    stripe.position.y = 0.62;
    car.add(stripe);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshStandardMaterial({ color: '#ffd23e', emissive: '#cc9a00', emissiveIntensity: 0.5 }),
    );
    sign.position.set(0, 1.5, -0.25);
    car.add(sign);
  }
  car.userData.wheels = wheels;
  return car;
}

/** A drivable car: mesh, position, heading, speed and health. */
export function createVehicle(x, z, heading, color, kind = 'civilian') {
  const mesh = createCarMesh(color, kind);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  return {
    mesh,
    kind,
    x,
    z,
    heading,
    speed: 0,
    steerAngle: 0,
    health: 100,
    radius: CAR.radius,
    occupied: false,
  };
}

/**
 * Arcade drive step. `drive` is {throttle (-1..1), steer (-1..1), handbrake}. The car turns
 * more at low speed, grips the road, and slides when the handbrake is held. Returns distance moved.
 */
export function driveVehicle(v, dt, drive, city) {
  const forward = v.speed >= 0 ? 1 : -1;
  if (drive.throttle > 0) v.speed += CAR.accel * drive.throttle * dt;
  else if (drive.throttle < 0) {
    v.speed += (v.speed > 0.5 ? -CAR.brake : CAR.reverseAccel * drive.throttle) * dt;
  } else {
    v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 8 * dt);
  }
  v.speed = clamp(v.speed, -CAR.maxReverse, CAR.maxSpeed);
  const steerTarget = drive.steer * CAR.steer * clamp(Math.abs(v.speed) / 8, 0, 1);
  const grip = drive.handbrake ? CAR.handbrakeTurn : CAR.grip;
  v.steerAngle += (steerTarget - v.steerAngle) * Math.min(1, grip * dt);
  v.heading += v.steerAngle * (v.speed / CAR.maxSpeed) * 2.4 * dt * forward;
  if (drive.handbrake) v.speed *= Math.max(0, 1 - 0.9 * dt);
  const nx = v.x + Math.sin(v.heading) * v.speed * dt;
  const nz = v.z + Math.cos(v.heading) * v.speed * dt;
  const circle = { x: nx, z: nz, radius: v.radius };
  let hit = false;
  for (const box of city.colliders) {
    if (pushCircleOutOfBox(circle, box)) hit = true;
  }
  if (hit) v.speed *= 0.45;
  v.x = circle.x;
  v.z = circle.z;
  city.clampToWorld(v, 3);
  v.mesh.position.set(v.x, 0, v.z);
  v.mesh.rotation.y = v.heading;
  // Spin the wheels and lean the body a touch into turns.
  const spin = (v.speed * dt) / 0.36;
  for (const wheel of v.mesh.userData.wheels) wheel.rotation.x += spin;
  v.mesh.rotation.z = -v.steerAngle * 0.05 * forward;
  return Math.abs(v.speed) * dt;
}

/** Push two cars apart when their circles overlap; returns true on a hit. */
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  const min = a.radius + b.radius;
  if (d >= min || d < 1e-6) return false;
  const push = (min - d) / 2 / d;
  a.x -= dx * push;
  a.z -= dz * push;
  b.x += dx * push;
  b.z += dz * push;
  a.speed *= 0.7;
  b.speed *= 0.7;
  return true;
}

export function carColor(rng) {
  return rng.pick(PALETTE.car);
}
