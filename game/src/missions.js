// Missions and story. Rico Vega, a driver new to Solmarina, works for the fixer Mara Quinn
// through four jobs — steal a car, run a pickup, lose the heat, rob a warehouse — then free
// roams with taxi fares and cash packages. One glowing beacon marks the current objective;
// the HUD and the minimap point at it too.
import * as THREE from 'three';
import { MISSIONS, PLACES, SIDE } from './config.js';
import { addWanted, clearWanted } from './police.js';
import { spawnGuard } from './combat.js';
import { dist2D, money } from './utils.js';

export function createMissions(scene, game) {
  // The objective beacon: a glowing column plus a floating diamond, easy to spot across town.
  const beacon = new THREE.Group();
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: '#ffd23e', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  column.position.y = 30;
  beacon.add(column);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: '#ffd23e' }),
  );
  diamond.position.y = 6;
  beacon.add(diamond);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3, 24),
    new THREE.MeshBasicMaterial({ color: '#ffd23e', transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.1;
  beacon.add(ring);
  beacon.visible = false;
  scene.add(beacon);
  return {
    scene,
    game,
    beacon,
    diamond,
    index: 0, // the next mission to play (0..4); 4 means the story is done
    stage: 0, // the step inside the current mission
    active: false,
    target: null, // {x, z, label} the beacon points at
    guards: [],
    packageTaken: false,
    taxi: null, // {ped, dest} while a fare runs
    packages: [],
    spin: 0,
  };
}

/** Cash packages scattered around town: walk or drive over one to collect it. */
export function scatterPackages(missions, rng, city) {
  const geo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  const mat = new THREE.MeshStandardMaterial({ color: '#3fae6a', emissive: '#1e6e35', emissiveIntensity: 0.6 });
  for (let i = 0; i < SIDE.packageCount; i += 1) {
    const x = rng.range(-220, 220);
    const z = rng.range(-220, 220);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.9, z);
    missions.scene.add(mesh);
    missions.packages.push({ mesh, x, z, taken: false });
  }
}

function setTarget(missions, x, z, label) {
  missions.target = { x, z, label };
  missions.beacon.position.set(x, 0, z);
  missions.beacon.visible = true;
}

function clearTarget(missions) {
  missions.target = null;
  missions.beacon.visible = false;
}

export function startMission(missions, index) {
  const game = missions.game;
  missions.index = index;
  missions.stage = 0;
  missions.active = true;
  const m = MISSIONS[index];
  game.say(`${m.title} — ${m.brief}`);
  game.hud.setObjective(`${m.title}: ${m.brief}`);
  if (index === 0) setTarget(missions, PLACES.garage.x, PLACES.garage.z, PLACES.garage.label);
  else if (index === 1) setTarget(missions, PLACES.docks.x, PLACES.docks.z, PLACES.docks.label);
  else if (index === 2) {
    addWanted(game.police, 3, 'setup');
    setTarget(missions, PLACES.hideout.x, PLACES.hideout.z, PLACES.hideout.label);
  } else if (index === 3) {
    setTarget(missions, PLACES.warehouse.x, PLACES.warehouse.z, PLACES.warehouse.label);
    missions.guards = [
      spawnGuard(game.combat, PLACES.warehouse.x - 8, PLACES.warehouse.z - 6),
      spawnGuard(game.combat, PLACES.warehouse.x + 8, PLACES.warehouse.z - 6),
      spawnGuard(game.combat, PLACES.warehouse.x - 8, PLACES.warehouse.z + 6),
      spawnGuard(game.combat, PLACES.warehouse.x + 8, PLACES.warehouse.z + 6),
    ];
  }
}

function completeMission(missions) {
  const game = missions.game;
  const m = MISSIONS[missions.index];
  game.cash += m.reward;
  game.audio.missionDone();
  game.say(`Job done: ${m.title} — ${money(m.reward)} earned.`);
  clearTarget(missions);
  missions.active = false;
  missions.index += 1;
  missions.stage = 0;
  if (missions.index < MISSIONS.length) {
    game.say(`Next job: ${MISSIONS[missions.index].title}. Press Enter to start it.`);
    game.hud.setObjective(`Next job: ${MISSIONS[missions.index].title} — press Enter to start.`);
  } else {
    game.say('Story complete! Solmarina is yours — taxi fares and cash packages still pay.');
    game.hud.setObjective('Story complete — free roam: taxi fares and cash packages pay.');
  }
  game.save();
}

/** Start a taxi fare: a nearby pedestrian becomes a passenger with a destination. */
export function startTaxi(missions) {
  const game = missions.game;
  if (missions.taxi || missions.active) return false;
  const ped = game.traffic.peds.find((p) => dist2D(p, game.player) < 12);
  if (!ped) return false;
  const dest = { x: (Math.random() < 0.5 ? -1 : 1) * 150, z: (Math.random() < 0.5 ? -1 : 1) * 150 };
  missions.taxi = { ped, dest, timer: 90 };
  setTarget(missions, dest.x, dest.z, 'Fare drop-off');
  game.say(`Taxi fare: take your passenger to the marker. ${money(SIDE.taxiFare)} if you make it in time.`);
  game.hud.setObjective(`Taxi fare — drop your passenger at the marker (${money(SIDE.taxiFare)}).`);
  return true;
}

export function updateMissions(missions, dt) {
  const game = missions.game;
  const p = game.player;
  missions.spin += dt;
  missions.diamond.rotation.y = missions.spin * 2;
  missions.diamond.position.y = 6 + Math.sin(missions.spin * 2.4) * 0.5;
  // Spinning cash packages.
  for (const pack of missions.packages) {
    if (pack.taken) continue;
    pack.mesh.rotation.y += dt * 1.5;
    if (dist2D(pack, p) < 2.2) {
      pack.taken = true;
      pack.mesh.visible = false;
      game.cash += SIDE.packageValue;
      game.audio.pickup();
      game.say(`Cash package: +${money(SIDE.packageValue)}.`);
    }
  }
  // Taxi fare countdown and drop-off.
  if (missions.taxi) {
    const t = missions.taxi;
    t.timer -= dt;
    if (t.timer <= 0) {
      game.say('Fare cancelled — too slow.');
      missions.taxi = null;
      clearTarget(missions);
      game.hud.setObjective(missions.active ? '' : 'Free roam — press T for a taxi fare.');
    } else if (dist2D(p, t.dest) < 5) {
      game.cash += SIDE.taxiFare;
      game.audio.missionDone();
      game.say(`Fare complete: +${money(SIDE.taxiFare)}.`);
      missions.taxi = null;
      clearTarget(missions);
      game.save();
    }
  }
  if (!missions.active) return;
  const i = missions.index;
  const near = missions.target ? dist2D(p, missions.target) : Infinity;
  if (i === 0) {
    // Reach the garage while driving a stolen car.
    if (!p.onFoot && near < 7) completeMission(missions);
  } else if (i === 1) {
    if (missions.stage === 0) {
      if (p.onFoot && near < 5) {
        missions.stage = 1;
        missions.packageTaken = true;
        game.audio.pickup();
        game.say('Package grabbed. Now deliver it to the drop-off across town.');
        setTarget(missions, PLACES.dropoff.x, PLACES.dropoff.z, PLACES.dropoff.label);
        game.hud.setObjective('The Pickup: deliver the package to the drop-off marker.');
      }
    } else if (p.onFoot && near < 5) completeMission(missions);
  } else if (i === 2) {
    // Lose the heat: reach the hideout with no stars left.
    if (near < 7 && game.police.stars === 0) completeMission(missions);
  } else if (i === 3) {
    if (missions.stage === 0) {
      if (near < 14) {
        missions.stage = 1;
        game.say('Guards! Take all four down, then grab the strongbox.');
        game.hud.setObjective('The Last Job: take down all four guards.');
        addWanted(game.police, 1, 'warehouse');
      }
    } else if (missions.stage === 1) {
      const alive = missions.guards.filter((g) => g.alive).length;
      if (alive === 0) {
        missions.stage = 2;
        setTarget(missions, PLACES.warehouse.x, PLACES.warehouse.z, 'Strongbox');
        game.say('All guards down. Grab the strongbox.');
        game.hud.setObjective('The Last Job: grab the strongbox at the warehouse.');
      }
    } else if (p.onFoot && near < 4) {
      completeMission(missions);
      clearWanted(game.police);
    }
  }
}
