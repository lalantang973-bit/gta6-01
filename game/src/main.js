// Boot and the one loop: SOLMARINA, an open-world crime game in the spirit of GTA 6. The
// world advances in fixed 1/60 s steps; the game moves between title, play, paused and end
// screens. Rico Vega drives, steals cars, runs jobs for Mara Quinn, and dodges the Solmarina PD.
//
// ?seed=N fixes the city layout. ?shot=chase|drive|mission|start (with &seed=N) stages that
// scene instead of running the loop, plays it forward, paints it and sets window.__shotReady.
import * as THREE from 'three';
import { CITY, COMBAT, MISSIONS, PLACES, STEP, WANTED } from './config.js';
import { createCity } from './city.js';
import { createPlayer, enterCar, exitCar, updateCamera, walkPlayer } from './player.js';
import { carColor, collideCars, createVehicle, driveVehicle } from './vehicles.js';
import { createTraffic, nearestParkedCar, parkedSpots, updateTraffic } from './traffic.js';
import { addWanted, clearWanted, createPolice, updatePolice } from './police.js';
import { createCombat, removeEnemy, shoot, startReload, updateCombat, updateEnemies } from './combat.js';
import { createMissions, scatterPackages, startMission, startTaxi, updateMissions } from './missions.js';
import { createHUD } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, saveGame } from './save.js';
import { ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_MUTE, ACTION_PAUSE, ACTION_RELOAD, createInput } from './input.js';
import { stageShot } from './shots.js';
import { clamp, dist2D, makeRng, money } from './utils.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;
const SAVE_EVERY_SECONDS = 20;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const rng = makeRng(seed);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const city = createCity(scene, seed);
const player = createPlayer(scene, -150, -130);
player.camYaw = Math.PI;
const traffic = createTraffic(scene, city, seed, parkedSpots(city, rng));
// One parked car right by the spawn, so the first job can start at once.
{
  const near = createVehicle(-155.4, -110, 0, '#c0392b');
  near.parked = true;
  scene.add(near.mesh);
  traffic.parked.push(near);
}
const police = createPolice(scene, city);
const combat = createCombat(scene);
const audio = createAudio();
const input = createInput(canvas);
const hud = createHUD(city);

const game = {
  scene,
  camera,
  renderer,
  city,
  player,
  traffic,
  police,
  combat,
  audio,
  hud,
  input,
  rng,
  cash: 0,
  screen: 'title',
  saveTimer: 0,
  missions: null,
  say(text) {
    hud.showMessage(text, 5);
    status.textContent = text;
  },
  save() {
    saveGame(game);
  },
  /** Spawn a car the player (or a shot) can drive. */
  spawnCar(x, z, heading, color) {
    const car = createVehicle(x, z, heading, color || carColor(rng));
    car.parked = true;
    scene.add(car.mesh);
    traffic.parked.push(car);
    return car;
  },
};
game.missions = createMissions(scene, game);
scatterPackages(game.missions, rng, city);

const saved = loadSave();
if (saved) {
  game.cash = saved.cash;
  game.missions.index = Math.min(saved.missionIndex, MISSIONS.length);
  player.x = saved.x;
  player.z = saved.z;
  player.mesh.position.set(player.x, 0, player.z);
  if (saved.muted) audio.setMuted(true);
}

function announce(message) {
  status.textContent = message;
}

/** The player's car and every other car, pushed apart on contact. */
function collideAllCars() {
  const all = [];
  if (!player.onFoot && player.vehicle) all.push(player.vehicle);
  for (const c of traffic.cars) all.push(c);
  for (const c of traffic.parked) all.push(c);
  for (const c of police.cars) all.push(c);
  for (let i = 0; i < all.length; i += 1) {
    for (let j = i + 1; j < all.length; j += 1) {
      if (all[i].parked && all[j].parked) continue;
      collideCars(all[i], all[j]);
    }
  }
  // Sync meshes after pushes.
  for (const c of all) c.mesh.position.set(c.x, 0, c.z);
}

/** Crimes the player commits: stealing, hitting a pedestrian, shooting. */
function commitCrime(kind) {
  if (kind === 'steal') {
    addWanted(police, 1, 'stolen car');
    game.say('Car stolen! The PD is on you — 1 star.');
  } else if (kind === 'ped') {
    addWanted(police, 1, 'hit pedestrian');
    game.say('You hit a pedestrian! 1 star.');
  } else if (kind === 'shoot') {
    addWanted(police, 1, 'shots fired');
  }
}

function bustPlayer() {
  const fine = Math.min(game.cash, WANTED.finePerStar * police.stars);
  game.cash -= fine;
  clearWanted(police);
  audio.busted();
  player.health = 100;
  if (!player.onFoot) exitCar(player, city);
  player.x = PLACES.hospital.x;
  player.z = PLACES.hospital.z;
  player.mesh.position.set(player.x, 0, player.z);
  game.screen = 'end';
  hud.showEnd(true, 'BUSTED', `The Solmarina PD caught you. Fine ${money(fine)} — press Enter to walk out of the hospital.`);
  hud.showCrosshair(false);
  game.save();
}

function wastePlayer() {
  const lost = Math.min(game.cash, 200);
  game.cash -= lost;
  clearWanted(police);
  audio.busted();
  player.health = 100;
  if (!player.onFoot) exitCar(player, city);
  player.x = PLACES.hospital.x;
  player.z = PLACES.hospital.z;
  player.mesh.position.set(player.x, 0, player.z);
  game.screen = 'end';
  hud.showEnd(true, 'WASTED', `You got taken down. ${money(lost)} in medical bills — press Enter to walk out of the hospital.`);
  hud.showCrosshair(false);
  game.save();
}

/** One fixed step of the world while playing. `inp` is the real input or a scripted one. */
function stepGame(dt, inp) {
  const actions = inp.takeActions();
  if (actions & ACTION_PAUSE) {
    game.screen = 'pause';
    hud.showPause(true);
    announce('Paused.');
    return;
  }
  if (actions & ACTION_MUTE) {
    audio.setMuted(!audio.isMuted());
    game.say(audio.isMuted() ? 'Sound muted (M to unmute).' : 'Sound on.');
  }
  if (actions & ACTION_RELOAD) startReload(combat);
  // Enter or exit a car.
  if (actions & ACTION_ENTER_CAR) {
    if (player.onFoot) {
      const car = nearestParkedCar(traffic, player.x, player.z, 4.5);
      if (car) {
        const wasParked = car.parked;
        enterCar(player, car);
        car.parked = false;
        player.camYaw = car.heading + Math.PI;
        audio.click();
        if (wasParked) commitCrime('steal');
      } else {
        game.say('No car close enough — walk up to a parked car and press E.');
      }
    } else {
      exitCar(player, city);
      audio.click();
    }
  }
  // Taxi fare on T.
  if (inp.taxiPressed && inp.taxiPressed()) {
    if (player.onFoot) startTaxi(game.missions);
    else game.say('Get out of the car to pick up a fare.');
  }

  const orbit = inp.takeOrbit();
  if (player.onFoot) {
    // Camera-relative movement.
    const fwdX = -Math.sin(player.camYaw);
    const fwdZ = -Math.cos(player.camYaw);
    const rightX = Math.cos(player.camYaw);
    const rightZ = -Math.sin(player.camYaw);
    const move = {
      x: fwdX * inp.throttle() + rightX * inp.steer(),
      z: fwdZ * inp.throttle() + rightZ * inp.steer(),
    };
    const len = Math.hypot(move.x, move.z);
    if (len > 1) {
      move.x /= len;
      move.z /= len;
    }
    walkPlayer(player, dt, move, inp.running(), city);
    // Shooting (mouse held) fires from the camera through the crosshair.
    if (inp.shooting()) {
      const targets = [...combat.enemies, ...police.cops.filter((c) => c.alive)];
      const hit = shoot(combat, camera, player, targets);
      if (hit) {
        audio.gunshot();
        if (hit.health <= 0) {
          if (hit.kind === 'guard') {
            removeEnemy(combat, hit);
            game.say('Guard down.');
          } else if (hit.kind === 'cop') {
            police.scene.remove(hit.mesh);
            police.cops = police.cops.filter((c) => c !== hit);
            addWanted(police, 2, 'cop down');
            game.say('Cop down! The whole PD is coming — +2 stars.');
          }
        }
      } else if (combat.ammo > 0 && combat.cooldown <= 0) {
        audio.gunshot();
        commitCrime('shoot');
        for (const ped of traffic.peds) {
          if (dist2D(ped, player) < 20) ped.flee = 2;
        }
      }
    }
    hud.showCrosshair(true);
    audio.setEngine(0, false);
  } else {
    const v = player.vehicle;
    driveVehicle(v, dt, { throttle: inp.throttle(), steer: inp.steer(), handbrake: inp.handbrake() }, city);
    hud.showCrosshair(false);
    audio.setEngine(Math.abs(v.speed) / 34, true);
    // Ramming a pedestrian at speed knocks them down — and the PD notices.
    for (const ped of traffic.peds) {
      if (ped.down > 0) continue;
      if (dist2D(ped, v) < 2.1 && Math.abs(v.speed) > 3) {
        ped.down = 8;
        commitCrime('ped');
      }
    }
  }

  collideAllCars();
  updateTraffic(traffic, dt, city, player.onFoot ? null : player.vehicle);
  const busted = updatePolice(police, dt, player, rng, bustPlayer);
  if (busted === 'busted') return;
  const damage = updateEnemies(combat, dt, player, city);
  if (damage > 0) {
    player.health -= damage;
    game.say(`Hit! Health ${Math.max(0, Math.ceil(player.health))}.`);
    if (player.health <= 0) {
      wastePlayer();
      return;
    }
  }
  updateCombat(combat, dt);
  updateMissions(game.missions, dt);
  audio.setSiren(police.stars > 0);
  updateCamera(camera, player, orbit, dt);
  // The sun's shadow follows the player so the lit area stays where the action is.
  city.sun.position.set(player.x + 120, 180, player.z + 60);
  city.sun.target.position.set(player.x, 0, player.z);
  city.sun.target.updateMatrixWorld();
  // Autosave while playing.
  game.saveTimer += dt;
  if (game.saveTimer > SAVE_EVERY_SECONDS) {
    game.saveTimer = 0;
    game.save();
  }
  hud.update(game, dt);
}

function startPlay(fresh) {
  if (fresh) {
    game.cash = 0;
    game.missions.index = 0;
    player.health = 100;
    player.x = -150;
    player.z = -130;
    player.mesh.position.set(player.x, 0, player.z);
    if (!player.onFoot) exitCar(player, city);
  }
  hud.showTitle(false);
  hud.showEnd(false);
  game.screen = 'play';
  if (game.missions.index < MISSIONS.length && !game.missions.active) {
    startMission(game.missions, game.missions.index);
  }
  audio.unlock();
  announce('Playing. WASD move or drive, E enter a car, mouse to shoot, P pause.');
}

function runShot(name) {
  const staged = stageShot(name, game);
  game.screen = staged.screen;
  // The title overlay is only for the title scene; gameplay shots hide it.
  if (staged.screen === 'play') {
    hud.showTitle(false);
    hud.showEnd(false);
  }
  // A scripted input that drives with the autopilot and takes no other actions.
  const scripted = {
    throttle: () => (staged.autopilot ? staged.autopilot(game).throttle : 0),
    steer: () => (staged.autopilot ? staged.autopilot(game).steer : 0),
    running: () => false,
    handbrake: () => false,
    shooting: () => false,
    takeOrbit: () => ({ dx: 0, dy: 0 }),
    takeActions: () => 0,
    taxiPressed: () => false,
  };
  const steps = Math.round(staged.seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (game.screen === 'play') stepGame(STEP, scripted);
    else updateTraffic(traffic, STEP, city, null);
  }
  // Park the camera for the frame, then paint twice and flag the shot ready.
  updateCamera(camera, player, { dx: 0, dy: 0 }, STEP);
  hud.update(game, 0);
  let painted = 0;
  function paint() {
    renderer.render(scene, camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const realInput = input;
  // T starts a taxi fare (a one-shot key the input module does not own).
  let taxiQueued = false;
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyT' && !event.repeat) taxiQueued = true;
  });
  const wrappedInput = {
    throttle: () => realInput.throttle(),
    steer: () => realInput.steer(),
    running: () => realInput.running(),
    handbrake: () => realInput.handbrake(),
    shooting: () => realInput.shooting(),
    takeOrbit: () => realInput.takeOrbit(),
    takeActions: () => realInput.takeActions(),
    taxiPressed: () => {
      const t = taxiQueued;
      taxiQueued = false;
      return t;
    },
  };
  let accumulator = 0;
  let last = performance.now();
  hud.showTitle(true, saved !== null);
  hud.setObjective('Press Enter to start — Rico Vega is new in Solmarina.');
  announce('Solmarina. Press Enter to start.');

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (game.screen === 'title') {
      const actions = realInput.takeActions();
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        startPlay(false);
      } else if (actions & ACTION_MUTE) {
        audio.setMuted(!audio.isMuted());
      }
      // The title camera drifts slowly over the city while traffic moves.
      player.camYaw += 0.02 * Math.min(accumulator, STEP);
      updateTraffic(traffic, Math.min(accumulator, STEP), city, null);
      updateCamera(camera, player, { dx: 0, dy: 0 }, Math.min(accumulator, STEP));
      hud.update(game, Math.min(accumulator, STEP));
      accumulator = 0;
    } else if (game.screen === 'play') {
      while (accumulator >= STEP) {
        stepGame(STEP, wrappedInput);
        accumulator -= STEP;
        if (game.screen !== 'play') break;
      }
    } else if (game.screen === 'pause') {
      const actions = realInput.takeActions();
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        game.screen = 'play';
        hud.showPause(false);
        announce('Playing.');
      }
      accumulator = 0;
    } else if (game.screen === 'end') {
      const actions = realInput.takeActions();
      if (actions & ACTION_CONFIRM) {
        hud.showEnd(false);
        startPlay(false);
      }
      accumulator = 0;
    }
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === 'play') {
      game.screen = 'pause';
      hud.showPause(true);
      announce('Paused.');
    }
  });
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
