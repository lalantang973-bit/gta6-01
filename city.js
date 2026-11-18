// The city of Solmarina: a 9x9 grid of blocks on a painted ground plane, buildings as two
// instanced meshes (bodies with a window facade texture, dark roof caps), street lamps and palm
// trees, a beach and a sea along the south edge, and the road network the traffic drives on.
// The ground is one canvas texture, which the minimap reuses as its base map.
import * as THREE from 'three';
import { CITY, PALETTE, PLACES } from './config.js';
import { makeRng } from './utils.js';

function facadeTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e8dcc8';
  g.fillRect(0, 0, 128, 256);
  // Window grid: lit and dark glass.
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const lit = (row * 4 + col) % 3 === 0;
      g.fillStyle = lit ? '#ffd98a' : PALETTE.glass;
      g.fillRect(12 + col * 28, 14 + row * 30, 18, 20);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function groundTexture(rng, parks) {
  const S = 2048;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  const half = CITY.half;
  const scale = S / CITY.size;
  const toPx = (v) => (v + half) * scale;
  // Sidewalk base.
  g.fillStyle = PALETTE.sidewalk;
  g.fillRect(0, 0, S, S);
  // Block interiors: a slightly varied tone, or grass for a park block.
  const pitch = CITY.block + CITY.road;
  for (let bx = 0; bx < CITY.blocks; bx += 1) {
    for (let bz = 0; bz < CITY.blocks; bz += 1) {
      const x0 = -half + CITY.road + bx * pitch;
      const z0 = -half + CITY.road + bz * pitch;
      const isPark = parks.has(`${bx},${bz}`);
      g.fillStyle = isPark ? PALETTE.grass : (bx + bz) % 2 === 0 ? '#a8adb5' : '#9aa0a8';
      g.fillRect(toPx(x0), toPx(z0), CITY.block * scale, CITY.block * scale);
      if (isPark) {
        // A path cross through the park.
        g.fillStyle = '#c9b98a';
        g.fillRect(toPx(x0 + CITY.block / 2 - 2), toPx(z0), 4 * scale, CITY.block * scale);
        g.fillRect(toPx(x0), toPx(z0 + CITY.block / 2 - 2), CITY.block * scale, 4 * scale);
      }
    }
  }
  // Roads: asphalt strips along every centre line.
  const centres = CITY.roadCentres();
  g.fillStyle = PALETTE.ground;
  for (const line of centres) {
    g.fillRect(toPx(line - CITY.road / 2), 0, CITY.road * scale, S);
    g.fillRect(0, toPx(line - CITY.road / 2), S, CITY.road * scale);
  }
  // Dashed yellow centre lines.
  g.fillStyle = '#e8c832';
  for (const line of centres) {
    for (let t = -half; t < half; t += 12) {
      g.fillRect(toPx(line) - 1, toPx(t), 2, 6 * scale);
      g.fillRect(toPx(t), toPx(line) - 1, 6 * scale, 2);
    }
  }
  // Crosswalks at every intersection.
  g.fillStyle = '#f2f2f2';
  for (const cx of centres) {
    for (const cz of centres) {
      for (let i = -3; i <= 3; i += 1) {
        g.fillRect(toPx(cx + i * 1.8) - 2, toPx(cz - CITY.road / 2 + 1), 4, 3 * scale);
        g.fillRect(toPx(cx + i * 1.8) - 2, toPx(cz + CITY.road / 2 - 4), 4, 3 * scale);
        g.fillRect(toPx(cx - CITY.road / 2 + 1), toPx(cz + i * 1.8) - 2, 3 * scale, 4);
        g.fillRect(toPx(cx + CITY.road / 2 - 4), toPx(cz + i * 1.8) - 2, 3 * scale, 4);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { texture: tex, canvas: c, scale };
}

/** Build the whole city into `scene`. Returns colliders, roads and place helpers. */
export function createCity(scene, seed) {
  const rng = makeRng(seed);
  const half = CITY.half;
  const colliders = [];
  const buildings = [];
  const parks = new Set();
  // A few blocks are parks (grass + palms), never the blocks holding mission places.
  const placeBlocks = new Set(['1,1', '7,7', '7,1', '1,7', '4,7', '1,4']);
  for (let i = 0; i < 12; i += 1) {
    const key = `${rng.int(0, CITY.blocks - 1)},${rng.int(0, CITY.blocks - 1)}`;
    if (!placeBlocks.has(key)) parks.add(key);
  }

  // --- Ground, beach and sea ---
  const { texture, canvas, scale } = groundTexture(rng, parks);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.size, CITY.size),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.size, 26),
    new THREE.MeshStandardMaterial({ color: '#e0c98f', roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, half + 13);
  sand.receiveShadow = true;
  scene.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.size * 3, 400),
    new THREE.MeshStandardMaterial({ color: PALETTE.water, roughness: 0.25, metalness: 0.1 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, half + 26 + 200);
  scene.add(sea);

  // --- Buildings (instanced) ---
  const pitch = CITY.block + CITY.road;
  const downtown = 2; // blocks within this distance of the centre are downtown (taller)
  for (let bx = 0; bx < CITY.blocks; bx += 1) {
    for (let bz = 0; bz < CITY.blocks; bz += 1) {
      if (parks.has(`${bx},${bz}`)) continue;
      const x0 = -half + CITY.road + bx * pitch;
      const z0 = -half + CITY.road + bz * pitch;
      const distCentre = Math.max(Math.abs(bx - 4), Math.abs(bz - 4));
      const lots = 2;
      for (let lx = 0; lx < lots; lx += 1) {
        for (let lz = 0; lz < lots; lz += 1) {
          if (rng.chance(0.18)) continue; // an empty lot: a yard, a car park
          const lot = CITY.block / lots;
          const w = rng.range(11, lot - 5);
          const d = rng.range(11, lot - 5);
          const cx = x0 + lx * lot + lot / 2 + rng.range(-2, 2);
          const cz = z0 + lz * lot + lot / 2 + rng.range(-2, 2);
          const tall = distCentre <= downtown;
          const h = tall ? rng.range(18, 42) : rng.range(8, 20);
          buildings.push({ x: cx, z: cz, w, d, h, color: rng.pick(PALETTE.building) });
          colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
        }
      }
    }
  }
  // The Solmarina Tower: the city's tallest landmark, dead centre.
  buildings.push({ x: 0, z: 0, w: 22, d: 22, h: 64, color: '#b8c4cc' });
  colliders.push({ minX: -11, maxX: 11, minZ: -11, maxZ: 11 });

  const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
  bodyGeo.translate(0, 0.5, 0);
  const bodyMat = new THREE.MeshStandardMaterial({ map: facadeTexture(), roughness: 0.85 });
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, buildings.length);
  const roofGeo = new THREE.BoxGeometry(1, 1, 1);
  roofGeo.translate(0, 0.5, 0);
  const roofMat = new THREE.MeshStandardMaterial({ color: '#4a4f55', roughness: 0.95 });
  const roofs = new THREE.InstancedMesh(roofGeo, roofMat, buildings.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const col = new THREE.Color();
  buildings.forEach((b, i) => {
    p.set(b.x, 0, b.z);
    s.set(b.w, b.h, b.d);
    m.compose(p, q, s);
    bodies.setMatrixAt(i, m);
    col.set(b.color);
    bodies.setColorAt(i, col);
    p.set(b.x, b.h, b.z);
    s.set(b.w + 0.4, 0.5, b.d + 0.4);
    m.compose(p, q, s);
    roofs.setMatrixAt(i, m);
  });
  bodies.castShadow = true;
  bodies.receiveShadow = true;
  roofs.castShadow = true;
  scene.add(bodies);
  scene.add(roofs);

  // --- Street lamps and palms (instanced) ---
  const lampPositions = [];
  const centres = CITY.roadCentres();
  for (const line of centres) {
    for (let t = -half + 20; t < half - 10; t += 46) {
      lampPositions.push({ x: line + CITY.road / 2 + 1.5, z: t });
      lampPositions.push({ x: t, z: line + CITY.road / 2 + 1.5 });
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6);
  poleGeo.translate(0, 2.7, 0);
  const poleMat = new THREE.MeshStandardMaterial({ color: '#3c4148', roughness: 0.7, metalness: 0.4 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampPositions.length);
  const headGeo = new THREE.SphereGeometry(0.28, 8, 6);
  const headMat = new THREE.MeshStandardMaterial({ color: '#ffe9a8', emissive: '#ffdf80', emissiveIntensity: 0.9 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, lampPositions.length);
  lampPositions.forEach((lp, i) => {
    p.set(lp.x, 0, lp.z);
    s.set(1, 1, 1);
    m.compose(p, q, s);
    poles.setMatrixAt(i, m);
    p.set(lp.x, 5.4, lp.z);
    m.compose(p, q, s);
    heads.setMatrixAt(i, m);
  });
  scene.add(poles);
  scene.add(heads);

  const palmSpots = [];
  for (const key of parks) {
    const [bx, bz] = key.split(',').map(Number);
    const x0 = -half + CITY.road + bx * pitch;
    const z0 = -half + CITY.road + bz * pitch;
    for (let i = 0; i < 5; i += 1) {
      palmSpots.push({ x: x0 + rng.range(6, CITY.block - 6), z: z0 + rng.range(6, CITY.block - 6) });
    }
  }
  for (let i = 0; i < 24; i += 1) {
    const line = rng.pick(centres);
    palmSpots.push({ x: rng.range(-half + 20, half - 20), z: line + CITY.road / 2 + 2.5 });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 4.4, 6);
  trunkGeo.translate(0, 2.2, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#8a6b48', roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const canopyGeo = new THREE.SphereGeometry(1.7, 8, 6);
  canopyGeo.scale(1, 0.55, 1);
  const canopyMat = new THREE.MeshStandardMaterial({ color: '#4e8a3f', roughness: 1 });
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, palmSpots.length);
  palmSpots.forEach((pp, i) => {
    p.set(pp.x, 0, pp.z);
    s.set(1, 1, 1);
    m.compose(p, q, s);
    trunks.setMatrixAt(i, m);
    p.set(pp.x, 4.6, pp.z);
    m.compose(p, q, s);
    canopies.setMatrixAt(i, m);
  });
  trunks.castShadow = true;
  canopies.castShadow = true;
  scene.add(trunks);
  scene.add(canopies);

  // --- Sky, sun, fog ---
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(new THREE.Color('#a8d4ea'), 220, 620);
  const hemi = new THREE.HemisphereLight(0xbfdfff, 0x8a7a5a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  return {
    colliders,
    centres,
    groundCanvas: canvas,
    groundScale: scale,
    sun,
    /** The nearest point on a road centre line to (x, z). */
    nearestRoadPoint(x, z) {
      let best = null;
      let bestD = Infinity;
      for (const line of centres) {
        const d1 = Math.abs(x - line);
        if (d1 < bestD) {
          bestD = d1;
          best = { x: line, z };
        }
        const d2 = Math.abs(z - line);
        if (d2 < bestD) {
          bestD = d2;
          best = { x, z: line };
        }
      }
      return best;
    },
    /** True when (x, z) is on a road (not inside a block). */
    onRoad(x, z) {
      for (const line of centres) {
        if (Math.abs(x - line) < CITY.road / 2 || Math.abs(z - line) < CITY.road / 2) return true;
      }
      return false;
    },
    clampToWorld(v, margin = 4) {
      v.x = Math.max(-half + margin, Math.min(half - margin, v.x));
      v.z = Math.max(-half + margin, Math.min(half + 24, v.z));
    },
  };
}
