// Combat: Rico's pistol (hitscan from the camera, tracer line, muzzle flash), enemy guards
// for the warehouse job (they stand their ground and shoot back), and damage feedback. Cops
// also shoot when the wanted level is high and they are close. Health, ammo and reload live here.
import * as THREE from 'three';
import { COMBAT } from './config.js';
import { clamp, dist2D } from './utils.js';

export function createCombat(scene) {
  const tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  const tracer = new THREE.Line(
    tracerGeo,
    new THREE.LineBasicMaterial({ color: '#ffe9a0', transparent: true, opacity: 0 }),
  );
  tracer.frustumCulled = false;
  scene.add(tracer);
  return {
    scene,
    ammo: COMBAT.magSize,
    reloading: 0,
    cooldown: 0,
    tracer,
    tracerTimer: 0,
    enemies: [],
    flash: null,
  };
}

function createGuardMesh() {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: '#3a3f35', roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: '#d8a878', roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), dark);
  torso.position.y = 1.08;
  torso.castShadow = true;
  g.add(torso);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.4, 0.4), new THREE.MeshStandardMaterial({ color: '#222222' }));
  vest.position.y = 1.12;
  g.add(vest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.66;
  g.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark);
  helmet.position.y = 1.7;
  g.add(helmet);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.5), new THREE.MeshStandardMaterial({ color: '#111111' }));
  gun.position.set(0.3, 1.15, 0.3);
  g.add(gun);
  return g;
}

/** Spawn a guard (warehouse job) at x, z. Returns the enemy record. */
export function spawnGuard(combat, x, z) {
  const mesh = createGuardMesh();
  mesh.position.set(x, 0, z);
  combat.scene.add(mesh);
  // A health bar floating above the guard.
  const barGeo = new THREE.PlaneGeometry(1.1, 0.12);
  const barMat = new THREE.MeshBasicMaterial({ color: '#e5534b', side: THREE.DoubleSide });
  const bar = new THREE.Mesh(barGeo, barMat);
  bar.position.y = 2.1;
  mesh.add(bar);
  const enemy = {
    mesh,
    bar,
    x,
    z,
    heading: 0,
    health: COMBAT.guardHealth,
    maxHealth: COMBAT.guardHealth,
    fireTimer: 1 + Math.random(),
    alive: true,
    kind: 'guard',
  };
  mesh.userData.enemyRef = enemy;
  combat.enemies.push(enemy);
  return enemy;
}

export function removeEnemy(combat, enemy) {
  enemy.alive = false;
  combat.scene.remove(enemy.mesh);
  combat.enemies = combat.enemies.filter((e) => e !== enemy);
}

/**
 * Fire the pistol from the camera through the crosshair. Hits the nearest enemy (or cop)
 * within range, or a building (a puff). Returns the enemy hit, or null.
 */
export function shoot(combat, camera, player, targets) {
  if (combat.cooldown > 0 || combat.reloading > 0 || combat.ammo <= 0) return null;
  combat.cooldown = COMBAT.fireSeconds;
  combat.ammo -= 1;
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const ray = new THREE.Raycaster(origin, dir, 0.1, COMBAT.pistolRange);
  // Enemies and cops are the hittable targets.
  const meshes = [];
  for (const t of targets) {
    if (t.alive !== false) meshes.push(t.mesh);
  }
  const hits = ray.intersectObjects(meshes, true);
  let hitPoint = origin.clone().addScaledVector(dir, COMBAT.pistolRange);
  let hitEnemy = null;
  if (hits.length > 0) {
    hitPoint = hits[0].point;
    let obj = hits[0].object;
    while (obj && !obj.userData.enemyRef) obj = obj.parent;
    if (obj && obj.userData.enemyRef) {
      hitEnemy = obj.userData.enemyRef;
      hitEnemy.health -= COMBAT.pistolDamage;
      if (hitEnemy.bar) hitEnemy.bar.scale.x = clamp(hitEnemy.health / hitEnemy.maxHealth, 0, 1);
    }
  }
  // Tracer from the muzzle to the hit point.
  const muzzle = origin.clone().addScaledVector(dir, 1.2);
  muzzle.y -= 0.25;
  const pos = combat.tracer.geometry.getAttribute('position');
  pos.setXYZ(0, muzzle.x, muzzle.y, muzzle.z);
  pos.setXYZ(1, hitPoint.x, hitPoint.y, hitPoint.z);
  pos.needsUpdate = true;
  combat.tracer.material.opacity = 0.9;
  combat.tracerTimer = 0.07;
  return hitEnemy;
}

/** Enemies shoot back at the player when close and in range. Returns damage dealt this frame. */
export function updateEnemies(combat, dt, player, city) {
  let damage = 0;
  for (const enemy of [...combat.enemies]) {
    if (!enemy.alive) continue;
    const d = dist2D(enemy, player);
    enemy.heading = Math.atan2(player.x - enemy.x, player.z - enemy.z);
    enemy.mesh.rotation.y = enemy.heading;
    enemy.fireTimer -= dt;
    if (d < COMBAT.enemyRange && enemy.fireTimer <= 0) {
      enemy.fireTimer = COMBAT.enemyFireSeconds * (0.8 + Math.random() * 0.5);
      // Inaccurate: hits about half the time at close range, less far away.
      const hitChance = clamp(0.75 - d / COMBAT.enemyRange, 0.15, 0.75);
      if (Math.random() < hitChance) damage += COMBAT.enemyDamage;
      // A tracer from the enemy toward the player.
      const pos = combat.tracer.geometry.getAttribute('position');
      pos.setXYZ(0, enemy.x, 1.3, enemy.z);
      pos.setXYZ(1, player.x, 1.2, player.z);
      pos.needsUpdate = true;
      combat.tracer.material.opacity = 0.6;
      combat.tracerTimer = 0.06;
    }
  }
  return damage;
}

export function updateCombat(combat, dt) {
  combat.cooldown = Math.max(0, combat.cooldown - dt);
  if (combat.reloading > 0) {
    combat.reloading -= dt;
    if (combat.reloading <= 0) combat.ammo = COMBAT.magSize;
  }
  if (combat.tracerTimer > 0) {
    combat.tracerTimer -= dt;
    if (combat.tracerTimer <= 0) combat.tracer.material.opacity = 0;
  }
}

export function startReload(combat) {
  if (combat.ammo < COMBAT.magSize && combat.reloading <= 0) combat.reloading = COMBAT.reloadSeconds;
}
