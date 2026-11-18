// Save and continue: the story state (cash, mission index, completed jobs) and the player's
// position persist in localStorage, so the start screen can offer Continue. A save never
// blocks play — storage can be off, and the game then lasts one visit only.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: typeof data.cash === 'number' ? data.cash : 0,
      missionIndex: typeof data.missionIndex === 'number' ? data.missionIndex : 0,
      x: typeof data.x === 'number' ? data.x : 0,
      z: typeof data.z === 'number' ? data.z : 0,
      muted: data.muted === true,
    };
  } catch {
    return null;
  }
}

export function saveGame(game) {
  try {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        cash: Math.floor(game.cash),
        missionIndex: game.missions.index,
        x: Math.round(game.player.x * 10) / 10,
        z: Math.round(game.player.z * 10) / 10,
        muted: game.audio.isMuted(),
      }),
    );
  } catch {
    // Storage off: the game continues without saving.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
