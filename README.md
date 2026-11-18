# SOLMARINA — an open-world crime game

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/lalantang973-bit/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/lalantang973-bit/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

Rico Vega just rolled into **Solmarina** — a sun-soaked coastal city — with empty pockets
and a fast mouth. The fixer Mara Quinn has work for a driver who doesn't ask questions:
steal a car, run a pickup, lose the heat, and pull one last warehouse job. An open-world
crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/c/gta6-01). Everything is original: the city,
characters, vehicles, names, story, art, sound and music.

## Play

Serve `game/` with any static server, then open `game/index.html` in desktop Chrome:

```sh
node serve.ts   # serves game/ on http://localhost:8080
```

No build step, no network requests at runtime — three.js is vendored under
`game/vendor/three.module.min.js` and every sound is synthesised with Web Audio.

## What's in the city

- **A city to explore on foot and by car** — a 9×9 grid of blocks with a beach and a sea,
  procedural buildings, street lamps and palms, driven in third person.
- **Traffic and pedestrians** — cars drive the road grid in the right lane and turn at
  intersections; pedestrians stroll the sidewalks and flee from danger.
- **Cars to steal and drive** — walk up to a parked car, press E, and it's yours (the
  Solmarina PD will notice). Arcade handling with a handbrake.
- **A wanted level and police** — crimes raise stars; police cars and foot cops chase you,
  and the heat fades when you stay quiet and out of sight. Get caught and you're busted.
- **Missions and a story** — four jobs for Mara Quinn (First Wheels, The Pickup,
  Hot Pursuit, The Last Job), plus taxi fares and cash packages to collect around town.
- **Combat** — a pistol with hitscan shooting, reloads, enemy guards with health bars,
  and cops who shoot back.
- **HUD with a live minimap** — health, cash, wanted stars, mission objective, speed,
  ammo, and a minimap drawn from the city's own map with blips for cars, police and the
  objective.
- **Start screen and save** — progress (cash, mission, position) autosaves to
  localStorage; the start screen offers Continue.
- **Sound and music** — engine hum, police sirens, gunshots, pickup chimes and an
  ambient music loop, all synthesised.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot / drive |
| Mouse drag | Orbit the camera |
| E | Enter / exit a car |
| Click | Shoot (on foot) |
| R | Reload |
| Shift | Run |
| Space | Handbrake |
| T | Taxi fare |
| P / Esc | Pause |
| M | Mute |

## Layout

- `game/index.html` — page, import map for three.js, HUD and screens
- `game/src/main.js` — boot, game loop, screens, crimes, bust/wasted
- `game/src/city.js` — procedural Solmarina: buildings, roads, beach, sea
- `game/src/player.js` — Rico on foot, camera, entering cars
- `game/src/vehicles.js` — car meshes and arcade driving physics
- `game/src/traffic.js` — traffic cars and pedestrians
- `game/src/police.js` — wanted system and the Solmarina PD
- `game/src/combat.js` — pistol, guards, tracers, damage
- `game/src/missions.js` — story jobs, taxi fares, cash packages
- `game/src/hud.js` — HUD and live minimap
- `game/src/audio.js` — synthesised sound and music
- `game/src/save.js` — localStorage save / continue
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=`)
- `main.ts` — the entry program: copies `game/` + `screenshots/` to `/output` and
  writes `dossier.json`

## Screenshots

`?shot=chase|drive|mission|start` (with `&seed=N`) stages a deterministic scene of the
real game — the four screenshots in `screenshots/` were taken that way.

## License

MIT — see [LICENSE](LICENSE).
