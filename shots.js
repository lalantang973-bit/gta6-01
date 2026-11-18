// The screenshot scenes behind ?shot=chase|drive|mission|start. Each one sets the real game
// to a fixed state (a seeded city, a car, a wanted level, a mission) and then plays the real
// rules forward for a few seconds with a road-following autopilot, so the frame is what a
// short game really looks like and the same seed always gives the same frame. The cover is the
// chase: wanted stars, police, minimap and mission objective all on screen at once.
import { CITY } from './config.js';
import { angleDelta, clamp } from './utils.js';
import { startMission } from './missions.js';
import { addWanted } from './police.js';
import { enterCar } from './player.js';

const DRIVE_SECONDS = 9;
const CHASE_SECONDS = 2.5;
const MISSION_SECONDS = 1.5;

/**
 * Steer a car along the road grid with pure pursuit: aim at a point on the lane centre 12
 * units ahead, so the car holds its lane without weaving, and go straight at intersections.
 * Returns the drive input for one frame.
 */
export function roadAutopilot(game) {
  const v = game.player.vehicle;
  if (!v) return { throttle: 0, steer: 0, handbrake: false };
  const centres = game.city.centres;
  const vertical = Math.abs(Math.sin(v.heading)) < 0.7;
  let targetX;
  let targetZ;
  if (vertical) {
    let cx = centres[0];
    for (const c of centres) if (Math.abs(v.x - c) < Math.abs(v.x - cx)) cx = c;
    const dir = Math.cos(v.heading) >= 0 ? 1 : -1;
    targetX = cx - (CITY.road / 4) * dir;
    targetZ = v.z + dir * 12;
  } else {
    let cz = centres[0];
    for (const c of centres) if (Math.abs(v.z - c) < Math.abs(v.z - cz)) cz = c;
    const dir = Math.sin(v.heading) >= 0 ? 1 : -1;
    targetX = v.x + dir * 12;
    targetZ = cz + (CITY.road / 4) * dir;
  }
  const desiredHeading = Math.atan2(targetX - v.x, targetZ - v.z);
  const steer = clamp(angleDelta(v.heading, desiredHeading) * 2.0, -1, 1);
  let throttle = 0.75;
  for (const o of game.traffic.cars) {
    const dx = o.x - v.x;
    const dz = o.z - v.z;
    const ahead = dx * Math.sin(v.heading) + dz * Math.cos(v.heading);
    const side = Math.abs(dx * Math.cos(v.heading) - dz * Math.sin(v.heading));
    if (ahead > 0 && ahead < 11 && side < 2.6) {
      throttle = 0.25;
      break;
    }
  }
  return { throttle, steer, handbrake: false };
}

/** Put the player in a fresh car on a road, heading along it. Returns the car. */
function giveCar(game, x, z, heading, color = '#c0392b') {
  const car = game.spawnCar(x, z, heading, color);
  enterCar(game.player, car);
  game.player.camYaw = heading + Math.PI;
  return car;
}

/**
 * Stage the named scene and return { screen, seconds, autopilot } — how long to play it
 * forward and what drives the car while it plays. The caller steps the world, then paints.
 * Cars are always placed on a road centre line, never inside a building lot.
 */
export function stageShot(name, game) {
  const p = game.player;
  if (name === 'drive') {
    giveCar(game, -150, -60, 0);
    game.hud.setObjective('Free roam — Solmarina is yours. Press Enter for the next job.');
    return { screen: 'play', seconds: DRIVE_SECONDS, autopilot: roadAutopilot };
  }
  if (name === 'chase') {
    giveCar(game, -60, -150, Math.PI / 2, '#2e6fb0');
    addWanted(game.police, 3, 'shot');
    // A scripted police car ahead in the opposite lane, pacing the player — the chase is
    // in the frame while both cars keep moving.
    game.police.placeCar(-45, -153.5, Math.PI / 2);
    game.hud.setObjective('Hot Pursuit — lose the heat! Reach the hideout marker.');
    return { screen: 'play', seconds: CHASE_SECONDS, autopilot: roadAutopilot };
  }
  if (name === 'mission') {
    giveCar(game, 150, 100, 0, '#e8b73a');
    startMission(game.missions, 1);
    game.hud.setObjective('The Pickup — drive to the docks marker and grab the package.');
    return { screen: 'play', seconds: MISSION_SECONDS, autopilot: roadAutopilot };
  }
  // 'start' and anything else: the title screen over the city — Rico on a south road,
  // looking north down the avenue at the Solmarina Tower, the sun at his back.
  p.x = 30;
  p.z = 150;
  p.heading = Math.PI;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
  p.camYaw = 0;
  p.camPitch = 0.35;
  game.hud.showTitle(true, false);
  return { screen: 'title', seconds: 0, autopilot: null };
}
