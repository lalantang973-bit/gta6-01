// Rico Vega on foot: a simple low-poly figure (jacket, head, swinging limbs) with
// third-person movement relative to the camera, building collision, and entering / exiting
// cars. The camera is owned here too: it orbits on mouse drag and chases from behind.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { clamp, pushCircleOutOfBox } from './utils.js';

function createFigure(color) {
  const figure = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: '#e8b88a', roughness: 0.8 });
  const jacket = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: '#2b3440', roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), jacket);
  torso.position.y = 1.08;
  torso.castShadow = true;
  figure.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.66;
  head.castShadow = true;
  figure.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), jacket);
  cap.position.y = 1.7;
  figure.add(cap);
  const limbs = {};
  for (const [name, x, y, mat] of [
    ['armL', -0.4, 1.28, jacket],
    ['armR', 0.4, 1.28, jacket],
    ['legL', -0.17, 0.68, pants],
    ['legR', 0.17, 0.68, pants],
  ]) {
    const limb = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.18), mat);
    limb.geometry.translate(0, -0.31, 0);
    limb.position.set(x, y, 0);
    limb.castShadow = true;
    figure.add(limb);
    limbs[name] = limb;
  }
  figure.userData.limbs = limbs;
  return figure;
}

export function createPlayer(scene, x, z) {
  const mesh = createFigure('#d97b2f');
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh,
    x,
    z,
    heading: 0,
    speed: 0,
    health: PLAYER.health,
    onFoot: true,
    vehicle: null,
    walkPhase: 0,
    radius: PLAYER.radius,
    camYaw: 0,
    camPitch: 0.32,
    camDist: 8,
  };
}

/** Move on foot. `move` is {x, z} in camera space, `run` sprints. Returns speed. */
export function walkPlayer(p, dt, move, run, city) {
  const targetSpeed = move.x === 0 && move.z === 0 ? 0 : run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  p.speed += (targetSpeed - p.speed) * Math.min(1, 10 * dt);
  if (p.speed > 0.1) {
    const targetHeading = Math.atan2(move.x, move.z);
    let d = targetHeading - p.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    p.heading += clamp(d, -PLAYER.turnSpeed * dt, PLAYER.turnSpeed * dt);
  }
  const nx = p.x + Math.sin(p.heading) * p.speed * dt;
  const nz = p.z + Math.cos(p.heading) * p.speed * dt;
  const circle = { x: nx, z: nz, radius: p.radius };
  for (const box of city.colliders) pushCircleOutOfBox(circle, box);
  p.x = circle.x;
  p.z = circle.z;
  city.clampToWorld(p, 2);
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
  // Swing the limbs with the stride.
  p.walkPhase += p.speed * dt * 1.6;
  const swing = Math.sin(p.walkPhase) * clamp(p.speed / PLAYER.walkSpeed, 0, 1) * 0.55;
  const limbs = p.mesh.userData.limbs;
  limbs.armL.rotation.x = swing;
  limbs.armR.rotation.x = -swing;
  limbs.legL.rotation.x = -swing;
  limbs.legR.rotation.x = swing;
  return p.speed;
}

/** Put the player into a car (hides the figure) or back on foot beside it. */
export function enterCar(p, vehicle) {
  p.onFoot = false;
  p.vehicle = vehicle;
  vehicle.occupied = true;
  p.mesh.visible = false;
}
export function exitCar(p, city) {
  const v = p.vehicle;
  if (!v) return;
  v.occupied = false;
  p.vehicle = null;
  p.onFoot = true;
  // Step out on the driver's side.
  const side = { x: v.x + Math.cos(v.heading) * 1.6, z: v.z - Math.sin(v.heading) * 1.6 };
  const circle = { x: side.x, z: side.z, radius: p.radius };
  for (const box of city.colliders) pushCircleOutOfBox(circle, box);
  p.x = circle.x;
  p.z = circle.z;
  p.heading = v.heading;
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
}

/**
 * Third-person camera: on foot it orbits freely on mouse drag; in a car it chases from behind,
 * easing back behind the car after the player looks around. The camera never goes under the ground.
 */
export function updateCamera(camera, p, orbit, dt) {
  p.camYaw -= orbit.dx * 0.005;
  p.camPitch = clamp(p.camPitch + orbit.dy * 0.003, 0.08, 1.1);
  const focus = p.onFoot ? p : p.vehicle;
  if (!p.onFoot) {
    // Ease the chase camera back behind the car.
    const behind = focus.heading + Math.PI;
    let d = behind - p.camYaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    p.camYaw += d * Math.min(1, 2.2 * dt);
  }
  const yaw = p.camYaw;
  const dist = p.onFoot ? 7 : 11;
  const height = p.onFoot ? 2.6 : 4.2;
  const cx = focus.x + Math.sin(yaw) * Math.cos(p.camPitch) * dist;
  const cz = focus.z + Math.cos(yaw) * Math.cos(p.camPitch) * dist;
  const cy = height + Math.sin(p.camPitch) * dist;
  camera.position.set(cx, Math.max(cy, 1.2), cz);
  camera.lookAt(focus.x, p.onFoot ? 1.4 : 1.2, focus.z);
}
