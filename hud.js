// The HUD: health bar, cash, wanted stars, mission objective, speed, ammo, message toasts,
// and a live minimap drawn on a 2D canvas — the city's own ground texture as the base map,
// with blips for the player, cars, police and the objective. All DOM, no WebGL, so it stays
// readable when the 3D view is shrunk to a screenshot.
import { CITY, COMBAT } from './config.js';
import { clamp, money } from './utils.js';

export function createHUD(city) {
  const root = document.getElementById('hud');
  const minimap = document.getElementById('minimap');
  const mapCtx = minimap.getContext('2d');
  const els = {
    healthFill: document.getElementById('health-fill'),
    healthText: document.getElementById('health-text'),
    cash: document.getElementById('cash'),
    stars: document.getElementById('stars'),
    objective: document.getElementById('objective'),
    speed: document.getElementById('speed'),
    ammo: document.getElementById('ammo'),
    message: document.getElementById('message'),
    title: document.getElementById('title-screen'),
    pause: document.getElementById('pause-screen'),
    end: document.getElementById('end-screen'),
    endTitle: document.getElementById('end-title'),
    endText: document.getElementById('end-text'),
    mission: document.getElementById('mission-banner'),
    crosshair: document.getElementById('crosshair'),
    saveNote: document.getElementById('save-note'),
  };
  let messageTimer = 0;
  let bannerTimer = 0;

  function drawMinimap(game) {
    const W = minimap.width;
    const H = minimap.height;
    const half = CITY.half;
    const toMap = (x, z) => [((x + half) / CITY.size) * W, ((z + half) / CITY.size) * H];
    mapCtx.clearRect(0, 0, W, H);
    // The city's ground texture, scaled down, is the map.
    mapCtx.drawImage(city.groundCanvas, 0, 0, W, H);
    const blip = (x, z, color, r) => {
      const [mx, my] = toMap(x, z);
      mapCtx.fillStyle = color;
      mapCtx.beginPath();
      mapCtx.arc(mx, my, r, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.strokeStyle = '#ffffff';
      mapCtx.lineWidth = 1;
      mapCtx.stroke();
    };
    // Objective marker (pulsing yellow diamond).
    if (game.missions.target) {
      const [mx, my] = toMap(game.missions.target.x, game.missions.target.z);
      const pulse = 5 + Math.sin(performance.now() / 240) * 2;
      mapCtx.fillStyle = '#ffd23e';
      mapCtx.beginPath();
      mapCtx.moveTo(mx, my - pulse);
      mapCtx.lineTo(mx + pulse, my);
      mapCtx.lineTo(mx, my + pulse);
      mapCtx.lineTo(mx - pulse, my);
      mapCtx.closePath();
      mapCtx.fill();
      mapCtx.strokeStyle = '#ffffff';
      mapCtx.stroke();
    }
    // Police cars (blue), traffic (grey), player (white arrow).
    for (const car of game.police.cars) blip(car.x, car.z, '#2e6ff2', 3);
    for (const car of game.traffic.cars) blip(car.x, car.z, '#888888', 2);
    const p = game.player;
    const [px, py] = toMap(p.x, p.z);
    const heading = p.onFoot ? p.heading : p.vehicle ? p.vehicle.heading : 0;
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(heading);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -6);
    mapCtx.lineTo(4.5, 5);
    mapCtx.lineTo(-4.5, 5);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.strokeStyle = '#222222';
    mapCtx.stroke();
    mapCtx.restore();
  }

  return {
    setObjective(text) {
      els.objective.textContent = text;
    },
    showMessage(text, seconds = 4) {
      els.message.textContent = text;
      els.message.style.opacity = '1';
      messageTimer = seconds;
    },
    showBanner(text, seconds = 3) {
      els.mission.textContent = text;
      els.mission.style.opacity = '1';
      bannerTimer = seconds;
    },
    showTitle(show, continueAvailable) {
      els.title.style.display = show ? 'flex' : 'none';
      els.saveNote.textContent = continueAvailable
        ? 'A save was found — press Enter to continue your story.'
        : 'New to Solmarina? Press Enter to start.';
    },
    showPause(show) {
      els.pause.style.display = show ? 'flex' : 'none';
    },
    showEnd(show, title, text) {
      els.end.style.display = show ? 'flex' : 'none';
      if (show) {
        els.endTitle.textContent = title;
        els.endText.textContent = text;
      }
    },
    showCrosshair(show) {
      els.crosshair.style.display = show ? 'block' : 'none';
    },
    update(game, dt) {
      const p = game.player;
      els.healthFill.style.width = `${clamp(p.health, 0, 100)}%`;
      els.healthFill.style.background = p.health > 50 ? '#3fae6a' : p.health > 25 ? '#e8b73a' : '#e5534b';
      els.healthText.textContent = `${Math.ceil(Math.max(0, p.health))}`;
      els.cash.textContent = money(game.cash);
      els.stars.textContent = '★'.repeat(game.police.stars) + '☆'.repeat(5 - game.police.stars);
      els.stars.style.color = game.police.stars > 0 ? '#ffd23e' : '#8b93a3';
      const speed = p.onFoot ? p.speed * 3.6 : Math.abs(p.vehicle.speed) * 3.6;
      els.speed.textContent = p.onFoot ? `${Math.round(speed)} km/h on foot` : `${Math.round(speed)} km/h`;
      els.ammo.textContent =
        game.combat.reloading > 0 ? 'Reloading…' : `Ammo ${game.combat.ammo} / ${COMBAT.magSize}  (R reload)`;
      if (messageTimer > 0) {
        messageTimer -= dt;
        if (messageTimer <= 0) els.message.style.opacity = '0';
      }
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) els.mission.style.opacity = '0';
      }
      drawMinimap(game);
    },
  };
}
