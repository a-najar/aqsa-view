// Builds al-Masjid al-Aqsa (al-Haram al-Sharif) and its surroundings.
// Dimensions follow published surveys and plans; earlier eras are
// interpretive reconstructions from historical descriptions.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { R, era, landmark, toWorld, terrainH, westX, eastX, northY, COMPOUND, insideCompound } from './site.js';
import { mat, mesh, put, boxGeo, cylGeo, wallGeo, arcadeGeo, domeGeo, finial, mergeGeos, stairsGeo, floorGeo, rect } from './geom.js';
import { rng } from './textures.js';

export const PLATFORM_H = 3.5; // height of the Dome of the Rock platform (Sahn al-Sakhra)
const P = PLATFORM_H;
const DOR = [138, 292]; // Dome of the Rock centre, site coords

function materials(T) {
  const side2 = { side: THREE.DoubleSide };
  return {
    stone: mat(T.stone),
    stoneWarm: mat(T.stoneWarm),
    wallOld: mat(T.wallOld),
    herodian: mat(T.herodian),
    paving: mat(T.paving, { color: 0xe8e0d0 }),
    earth: mat(T.earth),
    marble: mat(T.marble, { color: 0xe6dfd3, roughness: 0.5 }),
    column: mat(T.marble, { color: 0xd9d1c4, roughness: 0.4 }),
    faceTile: mat(T.faceTile, { roughness: 0.45 }),
    faceMosaic: mat(T.faceMosaic, { roughness: 0.4, metalness: 0.15 }),
    drumTile: mat(T.drumTile, { roughness: 0.45, ...side2 }),
    drumMosaic: mat(T.drumMosaic, { roughness: 0.4, metalness: 0.15, ...side2 }),
    domeInner: mat(T.domeInner, { roughness: 0.5, metalness: 0.3, ...side2 }),
    carpet: mat(T.carpet, { roughness: 1 }),
    ceiling: mat(T.ceiling, { roughness: 0.8, ...side2 }),
    lead: mat(T.lead, { roughness: 0.55, metalness: 0.4, ...side2 }),
    leadDark: mat(T.lead, { color: 0x6c7075, roughness: 0.5, metalness: 0.5, ...side2 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.3, metalness: 0.9, ...side2 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xe2b23c, roughness: 0.22, metalness: 1, ...side2 }),
    goldPale: new THREE.MeshStandardMaterial({ color: 0xd8b25a, roughness: 0.3, metalness: 0.95, ...side2 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc79a3a, roughness: 0.35, metalness: 0.9 }),
    wood: mat(T.wood, { roughness: 0.8 }),
    carved: mat(T.carved),
    rock: new THREE.MeshStandardMaterial({ color: 0x9a8a72, roughness: 1, flatShading: true }),
    water: new THREE.MeshStandardMaterial({ color: 0x3b7ea1, roughness: 0.08, metalness: 0.2 }),
    mihrab: new THREE.MeshStandardMaterial({ color: 0xc9a245, roughness: 0.35, metalness: 0.6, emissive: 0x2a1c05 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffc96a, emissiveIntensity: 1.6 }),
    soot: new THREE.MeshBasicMaterial({ color: 0x0b0806, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }),
    house: mat(T.house),
    cypress: new THREE.MeshStandardMaterial({ color: 0x2f4a2a, roughness: 1 }),
    olive: new THREE.MeshStandardMaterial({ color: 0x7c8a5a, roughness: 1, flatShading: true }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 }),
  };
}

// ---------------------------------------------------------------------------
// Small reusable structures

function domeOn(group, M, { y, r, h, domeMat, drumH = 0, drumMat = null, inner = true, pinch = 0.1, cross = null, finialScale = 0.6 }) {
  if (drumH > 0) {
    const drum = mesh(cylGeo(r, r, drumH, 32, true), drumMat || M.stone);
    drum.position.y = y + drumH / 2;
    group.add(drum);
  }
  const top = y + drumH;
  const d = mesh(domeGeo(r * 1.03, h, { pinch }), domeMat);
  d.position.y = top;
  group.add(d);
  if (inner) {
    const di = mesh(domeGeo(r * 0.95, h * 0.94, { pinch }), M.domeInner, { cast: false });
    di.position.y = top;
    group.add(di);
  }
  if (finialScale) {
    if (cross) {
      const [crossFrom, crossTo] = cross;
      group.add(era(finial(finialScale, M.brass, false), -Infinity, crossFrom).translateY(top + h - 0.1));
      group.add(era(finial(finialScale, M.brass, true), crossFrom, crossTo).translateY(top + h - 0.1));
      group.add(era(finial(finialScale, M.brass, false), crossTo, Infinity).translateY(top + h - 0.1));
    } else {
      const f = finial(finialScale, M.brass);
      f.position.y = top + h - 0.1;
      group.add(f);
    }
  }
}

// Open polygonal pavilion of columns and arches with a dome
// (Dome of the Ascension, Dome of the Prophet, ...). `closed` lists the
// indices of sides filled in with a wall (a mihrab side).
function pavilion(M, { n, r, h, spring, domeR, domeH, drumH = 1, closed = [], domeMat }) {
  const g = new THREE.Group();
  const side = 2 * r * Math.sin(Math.PI / n);
  const inr = r * Math.cos(Math.PI / n);
  for (let k = 0; k < n; k++) {
    const th = (k + 0.5) * (2 * Math.PI / n);
    const geo = closed.includes(k) ? wallGeo(side + 0.05, h, 0.5) : arcadeGeo(side + 0.05, h, 1, spring, 0.45, 0.5);
    const w = mesh(geo, closed.includes(k) ? M.marble : M.stone, { collide: true });
    w.position.set(Math.sin(th) * inr, 0, Math.cos(th) * inr);
    w.rotation.y = th;
    g.add(w);
    const ca = k * (2 * Math.PI / n);
    const col = mesh(cylGeo(0.22, 0.22, spring, 10), M.column, { collide: true });
    col.position.set(Math.sin(ca) * r * 0.985, spring / 2, Math.cos(ca) * r * 0.985);
    g.add(col);
  }
  const roof = mesh(cylGeo(domeR + 0.1, r + 0.35, 0.5, n, false, Math.PI / n), M.stone);
  roof.position.y = h + 0.25;
  g.add(roof);
  const floor = mesh(cylGeo(r + 0.4, r + 0.4, 0.25, n, false, Math.PI / n), M.marble, { walk: true });
  floor.position.y = 0.12;
  g.add(floor);
  domeOn(g, M, { y: h + 0.5, r: domeR, h: domeH, domeMat: domeMat || M.leadDark, drumH, finialScale: 0.45 });
  return g;
}

function cubeDome(M, { w, d, h, domeR, domeH, drumH = 1.2, wallMat, door = 'S', domes = [[0, 0]] }) {
  const g = new THREE.Group();
  const t = 0.8;
  const walls = [
    { len: w, x: 0, z: d / 2 - t / 2, rot: 0, key: 'S' },
    { len: w, x: 0, z: -d / 2 + t / 2, rot: 0, key: 'N' },
    { len: d, x: w / 2 - t / 2, z: 0, rot: Math.PI / 2, key: 'E' },
    { len: d, x: -w / 2 + t / 2, z: 0, rot: Math.PI / 2, key: 'W' },
  ];
  for (const s of walls) {
    const doors = s.key === door ? [{ c: s.len / 2, w: 1.8, s: 2.6 }] : [];
    const windows = [{ c: s.len / 2 + (doors.length ? s.len / 4 : 0), y: h * 0.45, w: 1.0, h: 1.2 }];
    const m = mesh(wallGeo(s.len, h, t, { doors, windows }), wallMat || M.stone, { collide: true });
    m.position.set(s.x, 0, s.z);
    m.rotation.y = s.rot;
    g.add(m);
  }
  const roof = mesh(boxGeo(w + 0.3, 0.6, d + 0.3), M.stone);
  roof.position.y = h + 0.3;
  g.add(roof);
  for (const [dx, dz] of domes) {
    const dg = new THREE.Group();
    dg.position.set(dx, 0, dz);
    domeOn(dg, M, { y: h + 0.6, r: domeR, h: domeH, domeMat: M.leadDark, drumH, finialScale: 0.5 });
    g.add(dg);
  }
  return g;
}

function minaret(M, { h, w, upper = 'cyl', from }) {
  const g = new THREE.Group();
  const shaftH = h * 0.66;
  const shaft = mesh(boxGeo(w, shaftH, w), M.stoneWarm, { collide: true });
  shaft.position.y = shaftH / 2;
  g.add(shaft);
  // decorative string courses and blind arch windows
  for (let i = 1; i < 4; i++) {
    const band = mesh(boxGeo(w + 0.3, 0.3, w + 0.3), M.stone);
    band.position.y = (shaftH / 4) * i;
    g.add(band);
  }
  const balc = mesh(boxGeo(w + 1.8, 0.45, w + 1.8), M.stone);
  balc.position.y = shaftH + 0.2;
  g.add(balc);
  const rail = mesh(cylGeo((w + 1.7) * 0.7, (w + 1.7) * 0.7, 1.0, 4, true, Math.PI / 4), M.stone);
  rail.position.y = shaftH + 0.9;
  g.add(rail);
  const uh = h * 0.2;
  const ur = w * 0.42;
  let up;
  if (upper === 'cyl') up = mesh(cylGeo(ur, ur, uh, 20), M.stoneWarm);
  else if (upper === 'oct') up = mesh(cylGeo(ur, ur, uh, 8, false, Math.PI / 8), M.stoneWarm);
  else up = mesh(boxGeo(ur * 1.7, uh, ur * 1.7), M.stoneWarm);
  up.position.y = shaftH + 0.45 + uh / 2;
  g.add(up);
  const cap = mesh(boxGeo(ur * 2.3, 0.35, ur * 2.3), M.stone);
  if (upper === 'cyl') cap.geometry = cylGeo(ur * 1.25, ur * 1.25, 0.35, 20);
  cap.position.y = shaftH + 0.45 + uh + 0.17;
  g.add(cap);
  domeOn(g, M, { y: shaftH + 0.62 + uh, r: ur * 0.95, h: ur * 1.3, domeMat: M.leadDark, inner: false, pinch: 0.3, finialScale: 0.55 });
  return era(g, from);
}

// Arcade (qantara / mawazin) at the head of a flight of steps up to the
// platform. `dir` is the direction the steps descend.
function qantara(M, scene, { X, Y, dir, width, bays, from = 951 }) {
  const g = new THREE.Group();
  const rot = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 }[dir];
  put(g, X, Y, 0, rot);
  const st = stairsGeo(width, P, 0.25, 0.4);
  g.add(mesh(st.geo, M.stone, { walk: true }));
  const arc = mesh(arcadeGeo(width, 8.2, bays, 5.2, 0.8, 0.9), M.stoneWarm, { collide: true });
  arc.position.set(0, P, -1.6);
  g.add(arc);
  for (let i = 0; i <= bays; i++) {
    const c = mesh(cylGeo(0.36, 0.36, 5.2, 12), M.column, { collide: true });
    c.position.set(-width / 2 + 0.4 + i * ((width - 0.8) / bays), P + 2.6, -1.6);
    g.add(c);
  }
  scene.add(era(g, from));
}

// ---------------------------------------------------------------------------
// The Dome of the Rock (Qubbat al-Sakhra), 691-692 CE / 72 AH.
// Octagon side 20.6 m, drum 23.4 m across, top of dome about 35 m.

function domeOfTheRock(M, scene) {
  const g = new THREE.Group();
  put(g, DOR[0], DOR[1], P);
  const side = 20.6;
  const inr = side / (2 * Math.tan(Math.PI / 8)); // 24.87 m
  const t = 1.3;
  const lowH = 5.2, upH = 6.4, wallH = lowH + upH;
  for (let k = 0; k < 8; k++) {
    const th = k * Math.PI / 4;
    const door = k % 2 === 0;
    const lower = mesh(
      wallGeo(side, lowH, t, { doors: door ? [{ c: side / 2, w: 2.8, s: 4.3, flat: true }] : [] }),
      M.marble, { collide: true });
    const ux = Math.sin(th) * (inr - t / 2), uz = Math.cos(th) * (inr - t / 2);
    lower.position.set(ux, 0, uz);
    lower.rotation.y = th;
    g.add(lower);
    const mos = mesh(wallGeo(side, upH, t), M.faceMosaic);
    mos.position.set(ux, lowH, uz);
    mos.rotation.y = th;
    g.add(era(mos, -Infinity, 1545));
    const tile = mesh(wallGeo(side, upH, t), M.faceTile);
    tile.position.set(ux, lowH, uz);
    tile.rotation.y = th;
    g.add(era(tile, 1545));
  }
  // parapet roof slope (lead)
  const roof = mesh(cylGeo(12.7, inr / Math.cos(Math.PI / 8) + 0.2, 1.2, 8, true, Math.PI / 8), M.lead);
  roof.position.y = wallH + 0.6;
  g.add(roof);
  // ceiling of the ambulatories with an opening under the drum
  const shape = new THREE.Shape();
  for (let k = 0; k <= 8; k++) {
    const a = Math.PI / 8 + k * Math.PI / 4;
    const rr = inr / Math.cos(Math.PI / 8);
    if (k === 0) shape.moveTo(Math.sin(a) * rr, Math.cos(a) * rr);
    else shape.lineTo(Math.sin(a) * rr, Math.cos(a) * rr);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, 11.3, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const ceil = mesh(new THREE.ShapeGeometry(shape, 24), M.ceiling, { cast: false });
  ceil.geometry.rotateX(Math.PI / 2);
  ceil.position.y = wallH;
  g.add(ceil);
  // floor: marble with red carpet in the ambulatories
  const flShape = new THREE.Shape();
  for (let k = 0; k <= 8; k++) {
    const a = Math.PI / 8 + k * Math.PI / 4;
    const rr = inr / Math.cos(Math.PI / 8);
    if (k === 0) flShape.moveTo(Math.sin(a) * rr, Math.cos(a) * rr);
    else flShape.lineTo(Math.sin(a) * rr, Math.cos(a) * rr);
  }
  const fl = mesh(new THREE.ShapeGeometry(flShape, 24), M.marble, { cast: false, walk: true });
  fl.geometry.rotateX(-Math.PI / 2);
  fl.position.y = 0.03;
  g.add(fl);
  const cp = new THREE.Shape();
  for (let k = 0; k <= 8; k++) {
    const a = Math.PI / 8 + k * Math.PI / 4;
    const rr = (inr - t) / Math.cos(Math.PI / 8);
    if (k === 0) cp.moveTo(Math.sin(a) * rr, Math.cos(a) * rr);
    else cp.lineTo(Math.sin(a) * rr, Math.cos(a) * rr);
  }
  const cph = new THREE.Path();
  cph.absarc(0, 0, 12, 0, Math.PI * 2, true);
  cp.holes.push(cph);
  const carpet = mesh(new THREE.ShapeGeometry(cp, 24), M.carpet, { cast: false, walk: true });
  carpet.geometry.rotateX(-Math.PI / 2);
  carpet.position.y = 0.06;
  // carpet texture runs in metres; ShapeGeometry UVs already are
  g.add(era(carpet, 1517));

  // inner octagonal arcade: 8 piers and 16 columns
  const r2 = 19.4;
  const side2 = 2 * r2 * Math.sin(Math.PI / 8);
  const inr2 = r2 * Math.cos(Math.PI / 8);
  for (let k = 0; k < 8; k++) {
    const th = k * Math.PI / 4;
    const a = mesh(arcadeGeo(side2, wallH, 3, 6.2, 0.55, 0.65), M.marble, { collide: true });
    a.position.set(Math.sin(th) * inr2, 0, Math.cos(th) * inr2);
    a.rotation.y = th;
    g.add(a);
    // columns at bay boundaries along this side
    const v0 = th - Math.PI / 8, v1 = th + Math.PI / 8;
    const p0 = [Math.sin(v0) * r2, Math.cos(v0) * r2], p1 = [Math.sin(v1) * r2, Math.cos(v1) * r2];
    for (let i = 0; i < 3; i++) {
      const f = i / 3;
      const isPier = i === 0;
      const c = mesh(isPier ? boxGeo(1.6, 6.2, 1.6) : cylGeo(0.42, 0.42, 6.2, 14), isPier ? M.marble : M.column, { collide: true });
      c.position.set(p0[0] + (p1[0] - p0[0]) * f, 3.1, p0[1] + (p1[1] - p0[1]) * f);
      if (isPier) c.rotation.y = v0;
      g.add(c);
    }
  }
  // circular arcade under the drum: 4 piers and 12 columns
  const r3 = 11.3;
  const side3 = 2 * r3 * Math.sin(Math.PI / 16);
  for (let k = 0; k < 16; k++) {
    const th = (k + 0.5) * Math.PI / 8;
    const a = mesh(arcadeGeo(side3 + 0.05, wallH, 1, 6.0, 0.6, 0.7), M.marble, { collide: true });
    a.position.set(Math.sin(th) * r3 * Math.cos(Math.PI / 16), 0, Math.cos(th) * r3 * Math.cos(Math.PI / 16));
    a.rotation.y = th;
    g.add(a);
    const ca = k * Math.PI / 8;
    const isPier = k % 4 === 0;
    const c = mesh(isPier ? boxGeo(1.7, 6.0, 1.7) : cylGeo(0.4, 0.4, 6.0, 14), isPier ? M.marble : M.column, { collide: true });
    c.position.set(Math.sin(ca) * r3, 3.0, Math.cos(ca) * r3);
    c.rotation.y = ca;
    g.add(c);
  }
  // drum
  const drumH = 9.4;
  const drumOut = mesh(cylGeo(11.7, 11.7, drumH, 48, true), M.drumTile);
  drumOut.position.y = wallH + drumH / 2;
  g.add(era(drumOut, 1545));
  const drumOutM = mesh(cylGeo(11.7, 11.7, drumH, 48, true), M.drumMosaic);
  drumOutM.position.y = wallH + drumH / 2;
  g.add(era(drumOutM, -Infinity, 1545));
  const drumIn = mesh(cylGeo(11.25, 11.25, drumH, 48, true), M.drumMosaic, { cast: false });
  drumIn.position.y = wallH + drumH / 2;
  g.add(drumIn);
  const ring = mesh(cylGeo(12.1, 12.1, 0.5, 48), M.stone);
  ring.position.y = wallH + drumH;
  g.add(ring);
  // the dome: gilded (Umayyad), lead (from the 1022 rebuild), gold-anodised
  // aluminium (1964), gold leaf over copper (1994)
  const domeTop = wallH + drumH + 0.2;
  const domeH = 13.6;
  const variants = [
    [M.goldPale, -Infinity, 1022],
    [M.leadDark, 1022, 1964],
    [M.goldPale, 1964, 1994],
    [M.gold, 1994, Infinity],
  ];
  for (const [m, a, b] of variants) {
    const d = mesh(domeGeo(12.0, domeH, { pinch: 0.2, bulb: 0.02, seg: 64 }), m);
    d.position.y = domeTop;
    g.add(era(d, a, b));
  }
  const di = mesh(domeGeo(11.3, domeH - 0.8, { pinch: 0.2, seg: 64 }), M.domeInner, { cast: false });
  di.position.y = domeTop;
  g.add(di);
  for (const [cross, a, b] of [[false, -Infinity, 1099], [true, 1099, 1187], [false, 1187, Infinity]]) {
    const f = finial(1.1, M.brass, cross);
    f.position.y = domeTop + domeH - 0.2;
    g.add(era(f, a, b));
  }
  // the Rock itself, enclosed by a wooden screen
  const rg = new THREE.IcosahedronGeometry(1, 3);
  const pr = rng(42);
  const pa = rg.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const s = 0.85 + pr() * 0.3;
    pa.setXYZ(i, pa.getX(i) * s, Math.max(-0.2, pa.getY(i)) * s, pa.getZ(i) * s);
  }
  rg.computeVertexNormals();
  const rock = mesh(rg, M.rock, { collide: true });
  rock.scale.set(8.5, 1.7, 6.5);
  rock.position.set(0.5, -0.1, 0.4);
  g.add(rock);
  const screen = mesh(cylGeo(9.6, 9.6, 1.5, 32, true), M.wood, { collide: true });
  screen.position.y = 0.75;
  g.add(screen);
  // porches at the four doors
  for (let k = 0; k < 4; k++) {
    const th = k * Math.PI / 2;
    const big = k === 0;
    const w = big ? 13 : 8, dpt = big ? 4.8 : 3.2, ph = 7.2;
    const pg = new THREE.Group();
    pg.rotation.y = th;
    const front = mesh(arcadeGeo(w, ph, big ? 4 : 3, 4.8, 0.5, 0.6), M.marble, { collide: true });
    front.position.set(0, 0, inr + dpt);
    pg.add(front);
    const roofP = mesh(boxGeo(w + 0.6, 0.5, dpt + 0.4), M.lead);
    roofP.position.set(0, ph + 0.25, inr + dpt / 2);
    pg.add(roofP);
    const ceilP = mesh(boxGeo(w, 0.05, dpt), M.ceiling, { cast: false });
    ceilP.position.set(0, ph - 0.03, inr + dpt / 2);
    pg.add(ceilP);
    for (const sx of [-1, 1]) {
      const sw = mesh(wallGeo(dpt, ph, 0.6, { doors: [{ c: dpt / 2, w: dpt - 1.2, s: 3.6 }] }), M.marble, { collide: true });
      sw.position.set(sx * (w / 2 - 0.3), 0, inr + dpt / 2);
      sw.rotation.y = Math.PI / 2;
      pg.add(sw);
    }
    g.add(pg);
  }
  scene.add(era(g, 691));
  R.minimap.push({ type: 'oct', X: DOR[0], Y: DOR[1], r: 26.9, color: '#d9b44a', from: 691 });
  landmark({
    id: 'dor', name: 'Dome of the Rock', ar: 'قبة الصخرة', built: '691–692 CE · 72 AH',
    X: DOR[0], Y: DOR[1], r: 34, from: 691, h: P,
    text: 'Built by the Umayyad caliph Abd al-Malik ibn Marwan over the Rock from which the Prophet ﷺ ascended on the Night Journey. An octagon of 20.6 m sides; its drum and dome rise about 35 m. Inside, two ambulatories ring the Rock.',
  });
  landmark({
    id: 'rock', name: 'The Rock (al-Sakhra)', ar: 'الصخرة المشرفة', built: 'Bedrock of Mount Moriah',
    X: DOR[0], Y: DOR[1], r: 10, from: 691, h: P,
    text: 'The summit of the mount, enclosed by a wooden screen. Beneath it lies the small cave known as the Well of Souls (Maghārat al-Arwāḥ).',
  });
}

// ---------------------------------------------------------------------------
// The Dome of the Chain (Qubbat al-Silsila), Umayyad.

function domeOfTheChain(M, scene) {
  const g = new THREE.Group();
  put(g, 179, 292, P);
  const n = 11, r = 6.6;
  const side = 2 * r * Math.sin(Math.PI / n);
  const inr = r * Math.cos(Math.PI / n);
  for (let k = 0; k < n; k++) {
    const th = (k + 0.5) * (2 * Math.PI / n);
    const isMihrab = k === 0;
    const w = mesh(isMihrab ? wallGeo(side + 0.05, 5.6, 0.5) : arcadeGeo(side + 0.05, 5.6, 1, 3.4, 0.45, 0.5), isMihrab ? M.marble : M.stone, { collide: true });
    w.position.set(Math.sin(th) * inr, 0, Math.cos(th) * inr);
    w.rotation.y = th;
    g.add(w);
    const ca = k * (2 * Math.PI / n);
    const col = mesh(cylGeo(0.24, 0.24, 3.4, 10), M.column, { collide: true });
    col.position.set(Math.sin(ca) * r, 1.7, Math.cos(ca) * r);
    g.add(col);
  }
  const roof = mesh(cylGeo(3.1, r + 0.4, 0.7, n, false, Math.PI / n), M.lead);
  roof.position.y = 5.95;
  g.add(roof);
  const ri = 2.7;
  for (let k = 0; k < 6; k++) {
    const th = (k + 0.5) * Math.PI / 3;
    const w = mesh(arcadeGeo(ri + 0.05, 6.2, 1, 4.0, 0.4, 0.45), M.stone, { collide: true });
    w.position.set(Math.sin(th) * ri * Math.cos(Math.PI / 6), 0, Math.cos(th) * ri * Math.cos(Math.PI / 6));
    w.rotation.y = th;
    g.add(w);
  }
  const fl = mesh(cylGeo(r + 0.5, r + 0.5, 0.2, n), M.marble, { walk: true });
  fl.position.y = 0.1;
  g.add(fl);
  domeOn(g, M, { y: 6.3, r: 3.0, h: 3.2, domeMat: M.leadDark, drumH: 1.4, drumMat: M.drumTile, finialScale: 0.55 });
  scene.add(era(g, 691));
  R.minimap.push({ type: 'circle', X: 179, Y: 292, r: 7, color: '#b9b2a4', from: 691 });
  landmark({
    id: 'chain', name: 'Dome of the Chain', ar: 'قبة السلسلة', built: 'Umayyad, c. 691 CE',
    X: 179, Y: 292, r: 11, from: 691, h: P,
    text: 'An open pavilion of eleven outer and six inner columns east of the Dome of the Rock, attributed to Abd al-Malik. Its tiled drum is Ottoman; the mihrab on its south side was added in the Ayyubid period.',
  });
}

// ---------------------------------------------------------------------------
// Al-Jami' al-Aqsa (the Qibli Mosque) in its successive forms.

function qibli(M, opts) {
  const { x0, x1, y0, y1, aisles, porch, from, to, domeVariants } = opts;
  const g = new THREE.Group();
  const W = x1 - x0, L = y1 - y0, c = (x0 + x1) / 2;
  const H = 11, Hn = 15, t = 1.6, nave = 11;
  const cross = 11; // square bay under the dome

  const addAt = (m, X, Y, y = 0, rot = 0) => { put(m, X, Y, y, rot); g.add(m); return m; };

  // qibla (south) wall
  addAt(mesh(boxGeo(W + 2 * t, Hn, t), M.stoneWarm, { collide: true }), c, y0 - t / 2, Hn / 2);
  // north facade, one door per aisle
  const k = (aisles - 1) / 2;
  const sideW = (W - nave) / 2 / k;
  const centres = [];
  for (let i = 0; i < k; i++) centres.push(x0 + (i + 0.5) * sideW);
  centres.push(c);
  for (let i = 0; i < k; i++) centres.push(c + nave / 2 + (i + 0.5) * sideW);
  const doors = centres.map((X) => ({ c: X - x0 + t, w: X === c ? 3.6 : 2.8, s: X === c ? 5.6 : 4.4 }));
  addAt(mesh(wallGeo(W + 2 * t, H, t, { doors }), M.stoneWarm, { collide: true }), c, y1 + t / 2);
  // nave clerestory gable on the facade
  addAt(mesh(boxGeo(nave + 1, Hn - H, t), M.stoneWarm), c, y1 + t / 2, H + (Hn - H) / 2);
  const gab = new THREE.Shape();
  gab.moveTo(-nave / 2 - 0.5, 0);
  gab.lineTo(nave / 2 + 0.5, 0);
  gab.lineTo(0, 3.2);
  gab.lineTo(-nave / 2 - 0.5, 0);
  const gabGeo = new THREE.ExtrudeGeometry(gab, { depth: t, bevelEnabled: false });
  gabGeo.translate(0, 0, -t / 2);
  addAt(mesh(gabGeo, M.stoneWarm), c, y1 + t / 2, Hn);
  // side walls with windows and a door
  const sideWins = [];
  for (let s = 4; s < L - 2; s += 6) sideWins.push({ c: s, y: 6.4, w: 1.5, h: 2.2 });
  for (const sx of [-1, 1]) {
    const X = sx < 0 ? x0 - t / 2 : x1 + t / 2;
    const wl = mesh(wallGeo(L, H, t, { windows: sideWins, doors: [{ c: L * 0.55, w: 3, s: 4.4 }] }), M.stoneWarm, { collide: true });
    addAt(wl, X, (y0 + y1) / 2, 0, Math.PI / 2);
  }
  // colonnades
  const colLines = [];
  for (let i = 1; i < k; i++) colLines.push({ X: x0 + i * sideW, h: H, s: 6.6 });
  colLines.push({ X: c - nave / 2, h: Hn, s: 9.6 }, { X: c + nave / 2, h: Hn, s: 9.6 });
  for (let i = 1; i < k; i++) colLines.push({ X: c + nave / 2 + i * sideW, h: H, s: 6.6 });
  for (const cl of colLines) {
    const bays = Math.round(L / 5.2);
    const a = mesh(arcadeGeo(L, cl.h, bays, cl.s, 0.7, 0.8), M.stone, { collide: true });
    addAt(a, cl.X, (y0 + y1) / 2, 0, Math.PI / 2);
    for (let i = 1; i < bays; i++) {
      const col = mesh(cylGeo(0.42, 0.42, cl.s, 14), M.column, { collide: true });
      addAt(col, cl.X, y0 + (i * L) / bays, cl.s / 2);
    }
  }
  // roofs: aisles flat (lead over painted ceilings), nave gabled
  for (const sx of [-1, 1]) {
    const xa = sx < 0 ? x0 - t : c + nave / 2;
    const xb = sx < 0 ? c - nave / 2 : x1 + t;
    const slab = mesh(boxGeo(xb - xa, 0.7, L + t), [M.lead, M.lead, M.lead, M.ceiling, M.lead, M.lead]);
    addAt(slab, (xa + xb) / 2, (y0 + y1) / 2 + t / 2, H + 0.35);
  }
  const naveL = L - cross;
  const navePrism = new THREE.Shape();
  navePrism.moveTo(-nave / 2 - 0.8, 0);
  navePrism.lineTo(nave / 2 + 0.8, 0);
  navePrism.lineTo(0, 3.2);
  navePrism.lineTo(-nave / 2 - 0.8, 0);
  const npGeo = new THREE.ExtrudeGeometry(navePrism, { depth: naveL, bevelEnabled: false });
  npGeo.translate(0, 0, -naveL / 2);
  // ExtrudeGeometry runs along local z, i.e. north-south along the nave
  addAt(mesh(npGeo, M.lead), c, y0 + cross + naveL / 2, Hn);
  const nc = mesh(boxGeo(nave, 0.05, naveL), M.ceiling, { cast: false });
  addAt(nc, c, y0 + cross + naveL / 2, Hn - 0.03);
  // crossing slab with an opening for the dome
  const cs = new THREE.Shape();
  cs.moveTo(-nave / 2, -cross / 2);
  cs.lineTo(nave / 2, -cross / 2);
  cs.lineTo(nave / 2, cross / 2);
  cs.lineTo(-nave / 2, cross / 2);
  cs.lineTo(-nave / 2, -cross / 2);
  const ch = new THREE.Path();
  ch.absarc(0, 0, 5.2, 0, Math.PI * 2, true);
  cs.holes.push(ch);
  const csGeo = new THREE.ShapeGeometry(cs, 24);
  csGeo.rotateX(Math.PI / 2);
  addAt(mesh(csGeo, M.ceiling, { cast: false }), c, y0 + cross / 2, Hn);
  const csTop = mesh(new THREE.ExtrudeGeometry(cs, { depth: 0.6, bevelEnabled: false, curveSegments: 24 }), M.lead);
  csTop.geometry.rotateX(-Math.PI / 2);
  addAt(csTop, c, y0 + cross / 2, Hn);
  // dome over the bay in front of the mihrab
  const dg = new THREE.Group();
  addAt(dg, c, y0 + cross / 2, Hn + 0.6);
  const drum = mesh(cylGeo(5.6, 5.6, 3.2, 40, true), M.stoneWarm);
  drum.position.y = 1.6;
  dg.add(drum);
  for (const [m, a, b] of domeVariants) {
    const d = mesh(domeGeo(6.0, 6.2, { pinch: 0.12 }), m);
    d.position.y = 3.2;
    dg.add(era(d, a, b));
  }
  const di = mesh(domeGeo(5.4, 5.8, { pinch: 0.12 }), M.domeInner, { cast: false });
  di.position.y = 3.2;
  dg.add(di);
  for (const [cross2, a, b] of [[false, -Infinity, 1099], [true, 1099, 1187], [false, 1187, Infinity]]) {
    const f = finial(0.7, M.brass, cross2);
    f.position.y = 3.2 + 6.1;
    dg.add(era(f, a, b));
  }
  // carpet
  const cp = mesh(floorGeo(rect(x0, y0, x1, y1)), M.carpet, { cast: false, walk: true });
  cp.position.y = 0.04;
  g.add(cp);
  // mihrab
  const mih = new THREE.Group();
  addAt(mih, c, y0 + 0.1, 0);
  const frame = mesh(wallGeo(4.4, 6.2, 0.3, { doors: [{ c: 2.2, w: 2.2, s: 3.6 }] }), M.marble);
  frame.position.z = 0.15;
  mih.add(frame);
  const niche = mesh(wallGeo(2.3, 5.4, 0.1), M.mihrab, { cast: false });
  niche.position.z = 0.02;
  mih.add(niche);
  for (const sx of [-1, 1]) {
    const col = mesh(cylGeo(0.14, 0.14, 3.6, 10), M.column);
    col.position.set(sx * 1.2, 1.8, 0.4);
    mih.add(col);
  }
  // porch (Ayyubid, 1217)
  if (porch) {
    const pg = new THREE.Group();
    g.add(era(pg, porch));
    const addP = (m, X, Y, y = 0, rot = 0) => { put(m, X, Y, y, rot); pg.add(m); };
    const pw = W - 6, pd = 7, ph = 10;
    addP(mesh(arcadeGeo(pw, ph, 7, 5.6, 1.3, 1.4), M.stoneWarm, { collide: true }), c, y1 + t + pd);
    const pr = mesh(boxGeo(pw, 0.6, pd + 0.6), [M.lead, M.lead, M.lead, M.ceiling, M.lead, M.lead]);
    addP(pr, c, y1 + t + pd / 2, ph + 0.3);
    for (const sx of [-1, 1]) {
      addP(mesh(wallGeo(pd, ph, 1.2, { doors: [{ c: pd / 2, w: 3, s: 4 }] }), M.stoneWarm, { collide: true }), c + sx * (pw / 2 - 0.6), y1 + t + pd / 2, 0, Math.PI / 2);
    }
    const pf = mesh(floorGeo(rect(c - pw / 2, y1 + t, c + pw / 2, y1 + t + pd)), M.marble, { cast: false, walk: true });
    pf.position.y = 0.05;
    pg.add(pf);
  }
  return era(g, from, to);
}

function minbar(M) {
  // The minbar commissioned by Nur al-Din and installed by Salah al-Din.
  const g = new THREE.Group();
  const len = 5.2, w = 1.1, top = 2.4;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(len, 0);
  s.lineTo(len, top + 0.9);
  s.lineTo(len - 1.2, top + 0.9);
  s.lineTo(0.6, 0.9);
  s.lineTo(0, 0.9);
  s.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  geo.translate(0, 0, -w / 2);
  const body = mesh(geo, M.wood, { collide: true });
  body.rotation.y = Math.PI / 2; // run toward the qibla (south)
  body.position.z = len;
  g.add(body);
  for (const sx of [-1, 1]) for (const sz of [0.1, 1.1]) {
    const post = mesh(cylGeo(0.06, 0.06, 2.2, 6), M.wood);
    post.position.set(sx * 0.5, top + 1.1 + 0.9 - 0.9, sz);
    g.add(post);
  }
  const cap = mesh(new THREE.ConeGeometry(0.8, 1.8, 8), M.wood);
  cap.position.set(0, top + 2.9, 0.6);
  g.add(cap);
  const portal = mesh(wallGeo(1.6, 3.2, 0.3, { doors: [{ c: 0.8, w: 1.0, s: 2.0 }] }), M.wood);
  portal.position.set(0, 0, len + 0.15);
  g.add(portal);
  return g;
}

function qibliMosques(M, scene) {
  // 638: the timber prayer house of Umar ibn al-Khattab, at the south of the
  // enclosure, which Arculf (c. 680) described as holding some 3,000 people.
  {
    const g = new THREE.Group();
    const x0 = 106, x1 = 170, y0 = 3, y1 = 46, h = 5.2;
    const add = (m, X, Y, y = 0, rot = 0) => { put(m, X, Y, y, rot); g.add(m); };
    add(mesh(boxGeo(x1 - x0 + 1, h, 1), M.wallOld, { collide: true }), (x0 + x1) / 2, y0 - 0.5, h / 2);
    const nd = [];
    for (let X = 4; X < x1 - x0; X += 8) nd.push({ c: X, w: 3, s: 3.6, flat: true });
    add(mesh(wallGeo(x1 - x0 + 1, h, 0.8, { doors: nd }), M.wallOld, { collide: true }), (x0 + x1) / 2, y1 + 0.4);
    for (const X of [x0 - 0.4, x1 + 0.4]) {
      add(mesh(wallGeo(y1 - y0, h, 0.8, { doors: [{ c: (y1 - y0) / 2, w: 3, s: 3.6, flat: true }] }), M.wallOld, { collide: true }), X, (y0 + y1) / 2, 0, Math.PI / 2);
    }
    for (let X = x0 + 5; X < x1; X += 6) for (let Y = y0 + 5; Y < y1; Y += 6) {
      add(mesh(boxGeo(0.4, h, 0.4), M.wood, { collide: true }), X, Y, h / 2);
    }
    add(mesh(boxGeo(x1 - x0 + 2, 0.5, y1 - y0 + 2), M.wood), (x0 + x1) / 2, (y0 + y1) / 2, h + 0.25);
    const fl = mesh(floorGeo(rect(x0, y0, x1, y1)), M.wood, { cast: false, walk: true });
    fl.position.y = 0.04;
    g.add(fl);
    scene.add(era(g, 638, 705));
    R.minimap.push({ type: 'poly', pts: rect(x0, y0, x1, y1), color: '#8a6a45', from: 638, to: 705 });
  }
  // c. 705-1033: the Umayyad mosque of al-Walid I, rebuilt by the Abbasids
  // after the earthquake of 746; 15 aisles.
  scene.add(qibli(M, {
    x0: 92, x1: 184, y0: 3, y1: 88, aisles: 15, porch: false, from: 705, to: 1035,
    domeVariants: [[M.lead, -Infinity, Infinity]],
  }));
  R.minimap.push({ type: 'poly', pts: rect(92, 3, 184, 88), color: '#a99f8e', from: 705, to: 1035 });
  // 1035-today: the Fatimid rebuilding by al-Zahir, reduced to 7 aisles.
  const q = qibli(M, {
    x0: 110.5, x1: 165.5, y0: 3, y1: 83, aisles: 7, porch: 1217, from: 1035,
    domeVariants: [[M.lead, -Infinity, 1964], [M.alu, 1964, 1983], [M.lead, 1983, Infinity]],
  });
  scene.add(q);
  R.minimap.push({ type: 'poly', pts: rect(110.5, 3, 165.5, 83), color: '#a99f8e', from: 1035 });
  // minbar of Salah al-Din: 1187-1969, replica from 2007
  for (const [a, b] of [[1187, 1969], [2007, Infinity]]) {
    const mb = minbar(M);
    put(mb, 133.2, 3.4, 0);
    scene.add(era(mb, a, b));
  }
  // the arson of 21 August 1969
  const soot = new THREE.Group();
  const sw = mesh(boxGeo(30, 14, 0.05), M.soot, { cast: false });
  put(sw, 145, 3.2, 7.2);
  soot.add(sw);
  const sc = mesh(boxGeo(30, 0.05, 30), M.soot, { cast: false });
  put(sc, 147, 18, 10.9);
  soot.add(sc);
  scene.add(era(soot, 1969, 1972));

  landmark({
    id: 'umar', name: 'Prayer house of Umar', ar: 'مصلى عمر بن الخطاب', built: '638 CE · 16 AH',
    X: 138, Y: 25, r: 40, from: 638, to: 705,
    text: 'After the city was handed over to Caliph Umar ibn al-Khattab, the Muslims cleared the neglected mount and raised a simple prayer house of timber at its southern end, facing the qibla in Makkah.',
  });
  landmark({
    id: 'qibli-um', name: 'Al-Jami’ al-Aqsa (Umayyad–Abbasid)', ar: 'الجامع الأقصى', built: 'c. 705–715 CE; rebuilt 780',
    X: 138, Y: 45, r: 50, from: 705, to: 1035,
    text: 'Completed by al-Walid I. Damaged in the earthquake of 746 and rebuilt by the Abbasid caliphs al-Mansur and al-Mahdi with 15 aisles running toward the qibla.',
  });
  landmark({
    id: 'qibli', name: 'Al-Jami’ al-Qibli (al-Aqsa Mosque)', ar: 'الجامع القبلي', built: 'Fatimid 1035 CE, on Umayyad foundations',
    X: 138, Y: 43, r: 44, from: 1035,
    text: 'Rebuilt by the Fatimid caliph al-Zahir after the 1033 earthquake with seven aisles; its dome stands over the bay before the mihrab. The porch of seven arches dates from 1217. Restored 1938–43 and after the 1969 arson.',
  });
  landmark({
    id: 'minbar', name: 'Minbar of Salah al-Din', ar: 'منبر صلاح الدين', built: 'Made 1168–74, installed 1187',
    X: 133, Y: 6, r: 6, from: 1187,
    text: 'Commissioned in Aleppo by Nur al-Din Zangi for the liberation of al-Aqsa and installed by Salah al-Din in 1187. Burned in the arson of 1969; a faithful replica was installed in 2007.',
  });
}

// ---------------------------------------------------------------------------
// Compound walls, gates and riwaqs.

function edgeInfo(i) {
  const a = COMPOUND[i], b = COMPOUND[(i + 1) % 4];
  const dX = b[0] - a[0], dY = b[1] - a[1];
  const L = Math.hypot(dX, dY);
  return { a, b, L, ux: dX / L, uy: dY / L, rot: Math.atan2(dY, dX) };
}
function edgePt(e, d, inward = 0) {
  // inward = to the left of a CCW edge
  return [e.a[0] + e.ux * d - e.uy * inward, e.a[1] + e.uy * d + e.ux * inward];
}

const GATES = {
  2: [ // north edge, from NE to NW
    { d: 23, name: 'Bab al-Asbat', ar: 'باب الأسباط', text: 'The Gate of the Tribes, the main entrance from the north-east of the Old City.' },
    { d: 105, name: 'Bab Hitta', ar: 'باب حطة', text: 'The Gate of Remission; its name recalls the word the Children of Israel were commanded to say.' },
    { d: 175, name: 'Bab al-Atm (Bab Faysal)', ar: 'باب العتم', text: 'The Gate of Darkness, renamed for King Faysal I of Iraq after his visit in 1930.' },
  ],
  3: [ // west edge, from NW to SW
    { d: 20, name: 'Bab al-Ghawanima', ar: 'باب الغوانمة', text: 'Named for the Ghanim family; beside it rises the tallest of the minarets.' },
    { d: 150, name: 'Bab al-Nazir', ar: 'باب الناظر', text: 'The Gate of the Inspector, also called Bab al-Majlis.' },
    { d: 185, name: 'Bab al-Hadid', ar: 'باب الحديد', text: 'The Iron Gate, framed by Mamluk buildings.' },
    { d: 215, name: 'Bab al-Qattanin', ar: 'باب القطانين', text: 'The Gate of the Cotton Merchants, built in 1336 by Tankiz with its market street.' },
    { d: 245, name: 'Bab al-Mathara', ar: 'باب المطهرة', text: 'The Gate of Ablution.' },
    { d: 285, name: 'Bab al-Silsila', ar: 'باب السلسلة', text: 'The Gate of the Chain, with its twin Bab al-Sakina; the principal western entrance.' },
    { d: 410, name: 'Bab al-Magharibah', ar: 'باب المغاربة', text: 'The Moroccans’ Gate, once reached through the Mughrabi Quarter. Its keys have been held by the occupation authorities since 1967.' },
  ],
};

function compoundWalls(M, scene) {
  const tops = [7.5, 7.5, 11, 11];
  for (let i = 0; i < 4; i++) {
    const e = edgeInfo(i);
    const th = 3;
    const mid = edgePt(e, e.L / 2, -th / 2);
    const found = mesh(boxGeo(e.L + th * 2, 70, th), M.wallOld, { collide: true });
    put(found, mid[0], mid[1], -35, e.rot);
    scene.add(found);
    const gates = GATES[i] || [];
    const doors = gates.map((gt) => ({ c: gt.d + th, w: 4, s: 4.6 }));
    const w = mesh(wallGeo(e.L + th * 2, tops[i], th, { doors }), M.wallOld, { collide: true });
    put(w, mid[0], mid[1], 0, e.rot);
    scene.add(w);
    // crenellations on the Ottoman city-wall stretches (south and east)
    if (i < 2) {
      const parts = [];
      for (let d = 1; d < e.L; d += 2.2) {
        const b = boxGeo(1.1, 1.2, th);
        b.translate(d - e.L / 2, tops[i] + 0.6, 0);
        parts.push(b);
      }
      const cren = mesh(mergeGeos(parts), M.wallOld);
      put(cren, mid[0], mid[1], 0, e.rot);
      scene.add(cren);
    }
    for (const gt of gates) {
      const p = edgePt(e, gt.d, 2);
      landmark({ id: 'gate-' + gt.name, name: gt.name, ar: gt.ar, built: 'Gate of al-Aqsa', X: p[0], Y: p[1], r: 9, text: gt.text });
      R.minimap.push({ type: 'gate', X: p[0], Y: p[1], color: '#e9dcc0' });
    }
  }
  R.minimap.push({ type: 'wall', pts: COMPOUND, color: '#cdbb92' });

  // Mamluk riwaqs (porticoes) along the west and north walls, with the
  // upper storeys of madrasas and residences above them.
  const riwaq = (edge, d0, d1, from) => {
    const e = edgeInfo(edge);
    const len = d1 - d0, depth = 5.5, h = 7;
    const p = edgePt(e, (d0 + d1) / 2, depth);
    const bays = Math.round(len / 4.6);
    const a = mesh(arcadeGeo(len, h, bays, 4.4, 1.0, 1.0), M.stoneWarm, { collide: true });
    put(a, p[0], p[1], 0, e.rot);
    scene.add(era(a, from));
    const rp = edgePt(e, (d0 + d1) / 2, depth / 2);
    const roof = mesh(boxGeo(len, 0.6, depth + 0.6), [M.stone, M.stone, M.stone, M.ceiling, M.stone, M.stone]);
    put(roof, rp[0], rp[1], h + 0.3, e.rot);
    scene.add(era(roof, from));
    const upper = mesh(wallGeo(len, 5.5, 1, { windows: Array.from({ length: Math.floor(len / 6) }, (_, j) => ({ c: 3 + j * 6, y: 1.6, w: 1.2, h: 1.6 })) }), M.stoneWarm);
    put(upper, p[0], p[1], h + 0.6, e.rot);
    scene.add(era(upper, from));
    const fl = mesh(floorGeo([edgePt(e, d0, 0), edgePt(e, d1, 0), edgePt(e, d1, depth), edgePt(e, d0, depth)]), M.paving, { cast: false, walk: true });
    fl.position.y = 0.05;
    scene.add(fl);
  };
  riwaq(3, 12, 236, 1300);
  riwaq(3, 300, 395, 1300);
  riwaq(2, 40, 300, 1300);
  landmark({ id: 'riwaq', name: 'Western Riwaq', ar: 'الرواق الغربي', built: 'Mamluk, 1307–1336', X: 4, Y: 380, r: 12, from: 1300, text: 'Covered porticoes built along the western and northern walls under the Mamluks, with madrasas and lodgings above.' });

  // The outer face of the south-western wall: al-Buraq Wall.
  const buraq = mesh(boxGeo(3.4, 16, 56), M.herodian, { collide: true });
  put(buraq, westX(114) - 1.6, 114, -5);
  scene.add(buraq);
  landmark({
    id: 'buraq', name: 'Al-Buraq Wall', ar: 'حائط البراق', built: 'Western wall of al-Aqsa',
    X: -30, Y: 114, r: 45, h: -12,
    text: 'Part of the western wall of al-Aqsa, where by tradition the Prophet ﷺ tethered al-Buraq on the Night Journey. In 1930 an international commission confirmed it as Islamic waqf property.',
  });
}

// ---------------------------------------------------------------------------
// Courtyard: ground, platform, paving, trees.

function courtyard(M, scene) {
  const hole = rect(214, 64, 224, 86);
  const g1 = mesh(floorGeo(COMPOUND), M.earth, { cast: false, walk: true });
  scene.add(era(g1, -Infinity, 1996));
  const g2 = mesh(floorGeo(COMPOUND, [hole]), M.earth, { cast: false, walk: true });
  scene.add(era(g2, 1996));
  const pave = (poly, y = 0.02, m = M.paving) => {
    const p = mesh(floorGeo(poly), m, { cast: false, walk: true });
    p.position.y = y;
    scene.add(p);
  };
  pave([[0, 0], [205, 0], [205, 214], [0, 214]]);
  pave([[0, 214], [70, 214], [70, 470], [westX(470) + 1, 470], [westX(214), 214]], 0.025);
  pave(rect(115, 362, 128, northY(121) - 1), 0.025);
  pave(rect(184, 362, 196, northY(190) - 1), 0.025);
  pave(rect(212, 326, 276, 336), 0.025);
  pave(rect(70, 214, 214, 222), 0.03);

  // the raised platform of the Dome of the Rock
  const plat = mesh(boxGeo(140, P, 142), [M.wallOld, M.wallOld, M.paving, M.wallOld, M.wallOld, M.wallOld], { collide: true, walk: true });
  put(plat, 142, 291, P / 2);
  scene.add(plat);
  R.minimap.push({ type: 'poly', pts: rect(72, 220, 212, 362), color: '#d8ccb2', fill: true });

  // arcades and steps up to the platform
  qantara(M, scene, { X: 138, Y: 220, dir: 'S', width: 16, bays: 4, from: 951 });
  qantara(M, scene, { X: 92, Y: 220, dir: 'S', width: 10, bays: 3, from: 1211 });
  qantara(M, scene, { X: 72, Y: 262, dir: 'W', width: 12, bays: 3, from: 1321 });
  qantara(M, scene, { X: 72, Y: 318, dir: 'W', width: 12, bays: 3, from: 1472 });
  qantara(M, scene, { X: 120, Y: 362, dir: 'N', width: 12, bays: 3, from: 1321 });
  qantara(M, scene, { X: 185, Y: 362, dir: 'N', width: 10, bays: 3, from: 1326 });
  qantara(M, scene, { X: 212, Y: 292, dir: 'E', width: 12, bays: 3, from: 1030 });
  landmark({ id: 'mizan', name: 'Southern Arcade (al-Mawazin)', ar: 'قناطر الموازين', built: 'c. 951 CE, rebuilt Fatimid & Mamluk', X: 138, Y: 216, r: 12, h: 0, text: 'The arcades crowning each stairway to the platform are called al-Mawazin, the Scales: tradition holds that the scales of the Day of Judgement will hang here.' });

  // plain stairs where no arcade survives (used before the arcades)
  for (const s of [[138, 220, 0], [72, 262, -Math.PI / 2], [212, 292, Math.PI / 2], [120, 362, Math.PI]]) {
    const st = stairsGeo(14, P, 0.25, 0.4);
    const m = mesh(st.geo, M.wallOld, { walk: true });
    put(m, s[0], s[1], 0, s[2]);
    scene.add(era(m, -Infinity, 951));
  }

  // trees: cypress rows and olive groves
  const r = rng(2024);
  const cypress = [], olives = [];
  for (let X = 76; X < 210; X += 7) if (Math.abs(X - 138) > 11 && Math.abs(X - 92) > 8) cypress.push([X, 210 + r() * 2]);
  for (let a = 0; a < 10; a++) cypress.push([138 + Math.cos(a / 10 * 6.283) * 13, 160 + Math.sin(a / 10 * 6.283) * 13]);
  for (let Y = 110; Y < 460; Y += 9) if (!(Y > 236 && Y < 262) && Math.abs(Y - 262) > 9 && Math.abs(Y - 318) > 9) cypress.push([60 + r() * 4, Y]);
  const avoid = [rect(72, 214, 214, 368), rect(110, 360, 132, 495), rect(180, 360, 200, 495), rect(205, 320, 300, 342),
    rect(196, 60, 230, 92), rect(0, 0, 205, 98), rect(265, 455, 300, 495), rect(0, 455, 30, 495)];
  const inAvoid = (X, Y) => avoid.some(([[a, b], , [c2, d]]) => X > a && X < c2 && Y > b && Y < d);
  for (let i = 0; i < 260; i++) {
    const X = 72 + r() * 215, Y = 92 + r() * 390;
    if (!insideCompound(X - 6, Y) || !insideCompound(X + 6, Y + 6) || inAvoid(X, Y)) continue;
    if (X < 210 && Y > 214 && Y < 370) continue;
    olives.push([X, Y, 0.8 + r() * 0.5]);
  }
  for (let i = 0; i < 40; i++) {
    const X = 10 + r() * 190, Y = 100 + r() * 110;
    if (Math.hypot(X - 138, Y - 160) < 16 || (X > 100 && X < 176 && Y < 112) || X < 66) continue;
    olives.push([X, Y, 0.7 + r() * 0.4]);
  }
  addTrees(M, scene, cypress, olives, (X, Y) => 0);

  // Al-Kas ablution fountain
  const kas = new THREE.Group();
  put(kas, 138, 160, 0);
  const basin = mesh(cylGeo(4.4, 4.6, 0.8, 40), M.marble, { collide: true });
  basin.position.y = 0.4;
  kas.add(basin);
  const water = mesh(new THREE.CircleGeometry(4.0, 40), M.water, { cast: false });
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.81;
  kas.add(water);
  const spout = mesh(cylGeo(0.5, 0.7, 1.6, 16), M.marble);
  spout.position.y = 1.3;
  kas.add(spout);
  for (let a = 0; a < 16; a++) {
    const seat = mesh(boxGeo(0.45, 0.45, 0.45), M.stone);
    seat.position.set(Math.cos(a / 16 * 6.283) * 5.4, 0.22, Math.sin(a / 16 * 6.283) * 5.4);
    kas.add(seat);
  }
  scene.add(era(kas, 1193));
  R.minimap.push({ type: 'circle', X: 138, Y: 160, r: 4.5, color: '#5d9cc0', from: 1193 });
  landmark({ id: 'kas', name: 'Al-Kas Fountain', ar: 'الكأس', built: 'Ayyubid, 1193 CE', X: 138, Y: 160, r: 12, from: 1193, text: 'The ablution fountain between the Qibli Mosque and the platform, first built by the Ayyubid al-Adil and later remodelled with stone seats and taps.' });
}

let treeIdSeed = 1;
function addTrees(M, scene, cypress, olives, groundFn, from = -Infinity, to = Infinity) {
  const dummy = new THREE.Object3D();
  if (cypress.length) {
    const cone = new THREE.ConeGeometry(1.25, 9, 8);
    cone.translate(0, 5.4, 0);
    const im = new THREE.InstancedMesh(cone, M.cypress, cypress.length);
    const tr = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.25, 1.2, 6).translate(0, 0.6, 0), M.trunk, cypress.length);
    cypress.forEach(([X, Y], i) => {
      const w = toWorld(X, Y);
      const s = 0.8 + ((i * 37) % 10) / 25;
      dummy.position.set(w.x, groundFn(X, Y), w.z);
      dummy.scale.set(s, s * 1.05, s);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      tr.setMatrixAt(i, dummy.matrix);
      R.circles.push({ x: w.x, z: w.z, r: 0.5 });
    });
    im.castShadow = true;
    im.receiveShadow = true;
    scene.add(era(im, from, to), era(tr, from, to));
  }
  if (olives.length) {
    const crown = new THREE.IcosahedronGeometry(2.6, 1);
    crown.scale(1.2, 0.8, 1.2);
    crown.translate(0, 3.6, 0);
    const im = new THREE.InstancedMesh(crown, M.olive, olives.length);
    const tr = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.4, 2.6, 6).translate(0, 1.3, 0), M.trunk, olives.length);
    const r = rng(treeIdSeed++ * 999);
    olives.forEach(([X, Y, s = 1], i) => {
      const w = toWorld(X, Y);
      dummy.position.set(w.x, groundFn(X, Y), w.z);
      dummy.rotation.y = r() * 6.28;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      tr.setMatrixAt(i, dummy.matrix);
      R.circles.push({ x: w.x, z: w.z, r: 0.45 * s });
    });
    dummy.rotation.set(0, 0, 0);
    im.castShadow = true;
    im.receiveShadow = true;
    scene.add(era(im, from, to), era(tr, from, to));
  }
}

// ---------------------------------------------------------------------------
// Domes, minarets and other monuments of the courtyard.

function monuments(M, scene) {
  const onPlat = (obj, X, Y) => { put(obj, X, Y, P); return obj; };
  const ascension = pavilion(M, { n: 8, r: 4.2, h: 5.0, spring: 3.4, domeR: 2.6, domeH: 2.8, closed: [4] });
  scene.add(era(onPlat(ascension, 113, 327), 1200));
  landmark({ id: 'miraj', name: 'Dome of the Ascension', ar: 'قبة المعراج', built: 'Ayyubid, 1200–01 CE · 597 AH', X: 113, Y: 327, r: 8, from: 1200, h: P, text: 'Built by the Ayyubid governor Izz al-Din Uthman to commemorate the Prophet’s ﷺ ascension (al-Mi‘raj).' });
  const prophet = pavilion(M, { n: 8, r: 2.6, h: 4.0, spring: 2.8, domeR: 1.9, domeH: 2.0, closed: [4] });
  scene.add(era(onPlat(prophet, 129, 335), 1538));
  landmark({ id: 'nabi', name: 'Dome of the Prophet', ar: 'قبة النبي', built: 'Ottoman, 1538; rebuilt 1620', X: 129, Y: 335, r: 6, from: 1538, h: P, text: 'An octagonal pavilion of eight marble columns marking where, by tradition, the Prophet ﷺ led the prophets in prayer on the Night Journey.' });
  const arwah = pavilion(M, { n: 8, r: 2.4, h: 3.8, spring: 2.6, domeR: 1.8, domeH: 1.9 });
  scene.add(era(onPlat(arwah, 104, 354), 1550));
  landmark({ id: 'arwah', name: 'Dome of the Spirits', ar: 'قبة الأرواح', built: 'Ottoman, 16th century', X: 104, Y: 354, r: 5, from: 1550, h: P, text: 'A small open dome on the north-west of the platform.' });
  const khidr = pavilion(M, { n: 6, r: 2.0, h: 3.5, spring: 2.4, domeR: 1.6, domeH: 1.7, closed: [3] });
  scene.add(era(onPlat(khidr, 92, 350), 1550));
  landmark({ id: 'khidr', name: 'Dome of al-Khidr', ar: 'قبة الخضر', built: 'Ottoman, 16th century', X: 92, Y: 350, r: 5, from: 1550, h: P, text: 'A hexagonal dome on six columns.' });
  const yusuf = pavilion(M, { n: 4, r: 2.4, h: 3.8, spring: 2.6, domeR: 1.6, domeH: 1.6, closed: [0, 1] });
  scene.add(era(onPlat(yusuf, 116, 228), 1191));
  landmark({ id: 'yusuf', name: 'Dome of Yusuf', ar: 'قبة يوسف', built: 'Ayyubid, 1191 CE', X: 116, Y: 228, r: 5, from: 1191, h: P, text: 'Bears an inscription of Salah al-Din Yusuf ibn Ayyub, from whom it takes its name.' });

  // Summer minbar of Burhan al-Din (Mamluk, 1388)
  const sm = new THREE.Group();
  const st = stairsGeo(1.2, 2.4, 0.3, 0.35);
  const stm = mesh(st.geo, M.marble, { collide: true });
  stm.rotation.y = Math.PI;
  stm.position.z = st.length;
  sm.add(stm);
  const canopy = pavilion(M, { n: 4, r: 1.2, h: 2.6, spring: 1.8, domeR: 0.85, domeH: 0.9, drumH: 0.2 });
  canopy.position.set(0, 2.4, -0.4);
  sm.add(canopy);
  scene.add(era(onPlat(sm, 152, 226), 1388));
  landmark({ id: 'summer', name: 'Summer Minbar of Burhan al-Din', ar: 'منبر برهان الدين', built: 'Mamluk, 1388 CE', X: 152, Y: 226, r: 5, from: 1388, h: P, text: 'An outdoor marble pulpit used for sermons in the courtyard during the summer.' });

  // Dome of Moses (Ayyubid, 1249)
  const musa = cubeDome(M, { w: 9, d: 9, h: 7, domeR: 3.6, domeH: 3.6, door: 'N' });
  put(musa, 50, 205);
  scene.add(era(musa, 1249));
  R.minimap.push({ type: 'poly', pts: rect(45.5, 200.5, 54.5, 209.5), color: '#c4b48f', from: 1249 });
  landmark({ id: 'musa', name: 'Dome of Moses', ar: 'قبة موسى', built: 'Ayyubid, 1249 CE · 647 AH', X: 50, Y: 205, r: 9, from: 1249, text: 'A square domed prayer room built under the Ayyubid sultan al-Salih Ayyub.' });

  // Madrasa al-Ashrafiyya and Sabil Qaitbay (Mamluk, 1482)
  const ash = new THREE.Group();
  put(ash, 14, 249);
  const portal = mesh(wallGeo(22, 13, 1.2, { doors: [{ c: 11, w: 4, s: 6.5 }], windows: [{ c: 4, y: 7, w: 1.6, h: 2 }, { c: 18, y: 7, w: 1.6, h: 2 }] }), M.stoneWarm, { collide: true });
  portal.rotation.y = Math.PI / 2;
  portal.position.x = 6;
  ash.add(portal);
  for (let i = 0; i < 6; i++) {
    const stripe = mesh(boxGeo(1.25, 0.45, 22.02), i % 2 ? M.stone : new THREE.MeshStandardMaterial({ color: 0x9a4a3a, roughness: 0.9 }));
    stripe.position.set(6, 9 + i * 0.45, 0);
    ash.add(stripe);
  }
  const body = mesh(boxGeo(10, 13, 22), M.stoneWarm);
  body.position.set(0.4, 6.5, 0);
  ash.add(body);
  scene.add(era(ash, 1482));
  R.minimap.push({ type: 'poly', pts: rect(9, 238, 20, 260), color: '#c4b48f', from: 1482 });
  landmark({ id: 'ashrafiyya', name: 'Madrasa al-Ashrafiyya', ar: 'المدرسة الأشرفية', built: 'Mamluk, 1482 CE', X: 20, Y: 249, r: 12, from: 1482, text: 'Built by Sultan al-Ashraf Qaitbay; the Mamluk historian Mujir al-Din called it the third jewel of the Haram, after the Dome of the Rock and al-Aqsa.' });

  const sabil = new THREE.Group();
  put(sabil, 58, 251);
  sabil.add(cubeDome(M, { w: 4.6, d: 4.6, h: 7.5, domeR: 2.0, domeH: 4.0, drumH: 1.5, door: 'E' }));
  sabil.traverse((o) => { if (o.isMesh && o.material === M.leadDark) o.material = M.carved; });
  scene.add(era(sabil, 1482));
  landmark({ id: 'qaitbay', name: 'Sabil Qaitbay', ar: 'سبيل قايتباي', built: 'Mamluk, 1482 CE', X: 58, Y: 251, r: 7, from: 1482, text: 'A public drinking fountain crowned by the only carved-stone dome of its kind in Jerusalem.' });

  // Islamic Museum (the Maghariba mosque and adjoining halls)
  const mus = new THREE.Group();
  const mw = mesh(wallGeo(96, 9, 1.2, { doors: [{ c: 30, w: 3, s: 4.4 }, { c: 70, w: 3, s: 4.4 }], windows: Array.from({ length: 12 }, (_, i) => ({ c: 6 + i * 8, y: 5, w: 1.4, h: 1.8 })) }), M.stoneWarm, { collide: true });
  put(mw, 52, 20.6);
  mus.add(mw);
  const mroof = mesh(boxGeo(97, 0.6, 18), M.stone);
  put(mroof, 52, 11.5, 9.3);
  mus.add(mroof);
  const mwing = mesh(boxGeo(13, 9, 18), M.stoneWarm, { collide: true });
  put(mwing, 8, 29, 4.5);
  mus.add(mwing);
  scene.add(era(mus, 1193));
  R.minimap.push({ type: 'poly', pts: [[2, 3], [100, 3], [100, 20], [15, 20], [15, 38], [2, 38]], color: '#b9aa88', from: 1193 });
  landmark({ id: 'maghariba', name: 'Mosque of the Maghariba', ar: 'جامع المغاربة', built: 'Ayyubid, 1193 CE', X: 50, Y: 14, r: 22, from: 1193, to: 1923, text: 'A mosque for North African worshippers, part of the endowment of al-Afdal, son of Salah al-Din.' });
  landmark({ id: 'museum', name: 'Islamic Museum', ar: 'المتحف الإسلامي', built: 'Founded 1923', X: 50, Y: 14, r: 22, from: 1923, text: 'Opened by the Supreme Muslim Council in 1923. It keeps the charred fragments of the Salah al-Din minbar, manuscripts and Qur’ans.' });

  // minarets
  const m1 = minaret(M, { h: 23, w: 5, upper: 'cyl', from: 1278 });
  put(m1, 9, 45);
  scene.add(m1);
  landmark({ id: 'fakhariyya', name: 'Al-Fakhariyya Minaret', ar: 'مئذنة الفخرية', built: 'Mamluk, 1278 CE', X: 9, Y: 45, r: 8, from: 1278, text: 'The south-western minaret, named after the Fakhriyya khanqah; its upper drum and dome were rebuilt by the Ottomans.' });
  const m2 = minaret(M, { h: 37, w: 5.5, upper: 'cyl', from: 1329 });
  put(m2, 4, 212);
  scene.add(m2);
  landmark({ id: 'silsila', name: 'Bab al-Silsila Minaret', ar: 'مئذنة باب السلسلة', built: 'Mamluk, 1329 CE', X: 4, Y: 212, r: 8, from: 1329, text: 'Built by the governor Tankiz al-Nasiri above the western portico, beside the Gate of the Chain.' });
  const m3 = minaret(M, { h: 38.5, w: 6.4, upper: 'oct', from: 1297 });
  put(m3, 6, 476);
  scene.add(m3);
  landmark({ id: 'ghawanima', name: 'Al-Ghawanima Minaret', ar: 'مئذنة الغوانمة', built: 'Mamluk, 1297 CE', X: 6, Y: 476, r: 9, from: 1297, text: 'The tallest minaret of al-Aqsa, about 38.5 m, at the north-west corner, built in the reign of Sultan Lajin.' });
  const m4 = minaret(M, { h: 28, w: 5.5, upper: 'cyl', from: 1367 });
  put(m4, 262, 466);
  scene.add(m4);
  landmark({ id: 'asbat', name: 'Bab al-Asbat Minaret', ar: 'مئذنة باب الأسباط', built: 'Mamluk, 1367 CE', X: 262, Y: 466, r: 8, from: 1367, text: 'Built by Sayf al-Din Qutlubugha; its cylindrical upper storey is an Ottoman rebuilding.' });
  for (const [X, Y, from] of [[9, 45, 1278], [4, 212, 1329], [6, 476, 1297], [262, 466, 1367]]) {
    R.minimap.push({ type: 'minaret', X, Y, color: '#efe2c4', from });
  }

  // Bab al-Rahma (the Golden Gate) and its prayer hall
  const br = new THREE.Group();
  put(br, 282.5, 330);
  br.add(cubeDome(M, { w: 15, d: 22, h: 8, domeR: 3.4, domeH: 3.2, drumH: 0.4, door: 'W', domes: [[0, -5.5], [0, 5.5]] }));
  scene.add(era(br, 691));
  R.minimap.push({ type: 'poly', pts: rect(275, 319, 290, 341), color: '#c4b48f' });
  landmark({ id: 'rahma', name: 'Bab al-Rahma', ar: 'باب الرحمة', built: 'Umayyad gate; prayer hall reopened 2019', X: 280, Y: 330, r: 14, from: 691, text: 'The double Gate of Mercy in the eastern wall, sealed since Ottoman times. Imam al-Ghazali is said to have taught in its hall; worshippers reopened it for prayer in February 2019.' });
}

// ---------------------------------------------------------------------------
// Al-Musalla al-Marwani: the vaulted halls under the south-east corner.

function marwani(M, scene) {
  const g = new THREE.Group();
  const y = -10, H = 9;
  const X0 = 200, X1 = 272, Y0 = 4, Y1 = 62;
  const fl = mesh(floorGeo([[X0, Y0], [X1, Y0], [X1, Y1], [224, Y1], [224, 66], [214, 66], [214, Y1], [X0, Y1]]), M.carpet, { cast: false, walk: true });
  fl.position.y = y;
  g.add(fl);
  const cl = mesh(floorGeo(rect(X0, Y0, X1, Y1)), new THREE.MeshStandardMaterial({ map: M.stone.map, side: THREE.DoubleSide, roughness: 1 }), { cast: false });
  cl.position.y = -1;
  g.add(cl);
  const wall = (len, X, Y, rot, doors = []) => {
    const m = mesh(wallGeo(len, H, 1.5, { doors }), M.wallOld, { collide: true });
    put(m, X, Y, y, rot);
    g.add(m);
  };
  wall(X1 - X0 + 3, (X0 + X1) / 2, Y0 - 0.75, 0);
  wall(X1 - X0 + 3, (X0 + X1) / 2, Y1 + 0.75, 0, [{ c: 219 - X0 + 1.5, w: 10, s: 7.4, flat: true }]);
  wall(Y1 - Y0, X0 - 0.75, (Y0 + Y1) / 2, Math.PI / 2);
  wall(Y1 - Y0, X1 + 0.75, (Y0 + Y1) / 2, Math.PI / 2);
  for (let X = X0 + 6; X < X1 - 2; X += 6) {
    const a = mesh(arcadeGeo(Y1 - Y0, H, 9, 5.6, 1.4, 1.4), M.wallOld, { collide: true });
    put(a, X, (Y0 + Y1) / 2, y, Math.PI / 2);
    g.add(a);
  }
  for (let X = X0 + 3; X < X1; X += 12) for (let Y = Y0 + 6; Y < Y1; Y += 12) {
    const l = mesh(new THREE.SphereGeometry(0.35, 10, 8), M.lamp, { cast: false });
    put(l, X, Y, y + 6.5);
    g.add(l);
  }
  scene.add(g);
  const lt = new THREE.PointLight(0xffd59a, 900, 90, 1.6);
  put(lt, 236, 33, y + 7);
  scene.add(era(lt, 1996));
  const lt2 = new THREE.PointLight(0xffd59a, 500, 60, 1.6);
  put(lt2, 210, 50, y + 7);
  scene.add(era(lt2, 1996));

  // the stairway opened in 1996-2000
  const sg = new THREE.Group();
  put(sg, 219, 86, y);
  const st = stairsGeo(10, 10, 0.25, 0.5);
  sg.add(mesh(st.geo, M.stone, { walk: true }));
  for (const sx of [-1, 1]) {
    const sw = mesh(boxGeo(1, 11.2, 22), M.wallOld, { collide: true });
    sw.position.set(sx * 5.5, 5.6, 11);
    sg.add(sw);
  }
  scene.add(era(sg, 1996));
  R.minimap.push({ type: 'poly', pts: rect(X0, Y0, X1, Y1), color: '#7f6a52', dash: true });
  R.minimap.push({ type: 'poly', pts: rect(214, 64, 224, 86), color: '#e9dcc0', from: 1996 });
  landmark({
    id: 'marwani', name: 'Al-Musalla al-Marwani', ar: 'المصلى المرواني', built: 'Umayyad vaults; opened for prayer 1996',
    X: 236, Y: 33, r: 40, from: 1996, h: -10,
    text: 'Vaulted halls under the south-east corner that carry the courtyard above. The Crusaders used them as stables. Restored by the Waqf and the Islamic Movement and opened as a prayer hall for 10,000 worshippers in December 1996.',
  });
  landmark({
    id: 'marwani-closed', name: 'Vaults beneath the south-east (sealed)', ar: 'الأقبية الجنوبية الشرقية', built: 'Umayyad',
    X: 219, Y: 75, r: 14, to: 1996,
    text: 'The vaulted substructures beneath this corner of the courtyard are closed. They will be opened as al-Musalla al-Marwani in 1996.',
  });
}

// ---------------------------------------------------------------------------
// Outside the walls: terrain, the Old City, the Mughrabi Quarter and the
// Mount of Olives.

function surroundings(M, scene) {
  const size = 2400, seg = 300;
  const tg = new THREE.PlaneGeometry(size, size, seg, seg);
  tg.rotateX(-Math.PI / 2);
  const pos = tg.attributes.position;
  const uv = tg.attributes.uv;
  const col = new Float32Array(pos.count * 3);
  const cA = new THREE.Color(0xc9b896), cB = new THREE.Color(0x8d8a5a), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const X = x + 140, Y = -z + 245;
    const h = terrainH(X, Y);
    pos.setY(i, h);
    uv.setXY(i, x, z);
    const slope = Math.min(1, Math.max(0, (h + 10) / 120)) * 0.8 + ((Math.sin(X * 0.05) + Math.cos(Y * 0.07)) * 0.1);
    tmp.copy(cA).lerp(cB, Math.max(0, Math.min(1, slope)));
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  tg.computeVertexNormals();
  const tm = new THREE.MeshStandardMaterial({ map: M.earth.map, vertexColors: true, roughness: 1 });
  const terrain = new THREE.Mesh(tg, tm);
  terrain.receiveShadow = true;
  terrain.userData.terrain = true;
  scene.add(terrain);

  // Western (al-Buraq) plaza since 1967
  const plaza = mesh(floorGeo(rect(-116, 20, -7, 140)), M.paving.clone(), { cast: false });
  plaza.material.polygonOffset = true;
  plaza.material.polygonOffsetFactor = -2;
  plaza.material.polygonOffsetUnits = -2;
  plaza.position.y = -11.85;
  scene.add(era(plaza, 1967));

  // Mughrabi gate approach: earthen ramp, then a wooden bridge since 2005
  const gateY = 80;
  for (const [m, a, b] of [[M.wallOld, -Infinity, 2005], [M.wood, 2005, Infinity]]) {
    const rg = new THREE.Group();
    put(rg, westX(gateY) - 3, gateY, 0, -Math.PI / 2);
    const len = Math.hypot(60, 12), ang = Math.atan2(12, 60);
    const ramp = mesh(boxGeo(4, 0.6, len), m, { walk: true });
    ramp.rotation.x = ang;
    ramp.position.set(0, -6 - 0.3, 30);
    rg.add(ramp);
    for (const sx of [-1, 1]) {
      const rail = mesh(boxGeo(0.25, 1.2, len), m, { collide: true });
      rail.rotation.x = ang;
      rail.position.set(sx * 2.1, -6 + 0.6, 30);
      rg.add(rail);
    }
    scene.add(era(rg, a, b));
  }

  // Old City houses
  const r = rng(99);
  const houses = [], mughrabi = [];
  const gateYs = [80, 205, 245, 275, 305, 340, 470];
  const gateXs = [120, 190, 272];
  const cell = 15;
  const streetFree = (X, Y) => gateYs.some((gy) => Math.abs(Y - gy) < 6 && X < 0) || gateXs.some((gx) => Math.abs(X - gx) < 6 && Y > 470);
  for (let X = -640; X < 330; X += cell) {
    for (let Y = -70; Y < 800; Y += cell) {
      const hx = X + r() * 4, hy = Y + r() * 4;
      const w = 7 + r() * 7, d = 7 + r() * 7;
      const cx = hx + w / 2, cy = hy + d / 2;
      const wy = Math.min(490, Math.max(0, cy));
      if (cy < 505 && cx + w / 2 > westX(wy) - 5 && cx - w / 2 < eastX(Math.min(470, wy)) + 5 && cy - d / 2 < northY(Math.min(295, Math.max(-15, cx))) + 5) continue;
      if (cx > 290 && cy < 480) continue;
      if (cy < -10 && cx > -120) continue;
      if (streetFree(cx, cy)) continue;
      if (r() < 0.12) continue;
      const inPlaza = cx > -122 && cx < -2 && cy > 12 && cy < 148;
      const h = 6 + r() * 7;
      const base = inPlaza ? -12 : terrainH(cx, cy);
      if (inPlaza) {
        if (Math.abs(cy - gateY) < 5) continue;
        mughrabi.push({ cx, cy, w, d, h: h * 0.8, base });
      } else houses.push({ cx, cy, w, d, h, base });
    }
  }
  // inner city wall loop (Ottoman walls of Suleiman, 1537-41)
  const cityWall = [[0, -2], [-650, -80], [-660, 805], [335, 805], [295, 470]];
  for (let i = 0; i < cityWall.length - 1; i++) {
    const [a, b] = [cityWall[i], cityWall[i + 1]];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const wm = mesh(boxGeo(L, 40, 3), M.wallOld, { collide: true });
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    put(wm, mx, my, terrainH(mx, my) - 28, Math.atan2(b[1] - a[1], b[0] - a[0]));
    scene.add(wm);
  }
  const makeHouses = (list, from, to) => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const hm = new THREE.InstancedMesh(box, M.houseInst, list.length);
    const domes = list.filter((_, i) => i % 3 === 0);
    const dm = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.houseInst, domes.length);
    const dummy = new THREE.Object3D();
    const c = new THREE.Color();
    let di = 0;
    list.forEach((hs, i) => {
      const w = toWorld(hs.cx, hs.cy);
      dummy.position.set(w.x, hs.base - 2, w.z);
      dummy.scale.set(hs.w, hs.h + 2, hs.d);
      dummy.updateMatrix();
      hm.setMatrixAt(i, dummy.matrix);
      c.setHSL(0.11, 0.25 + (i % 7) * 0.02, 0.72 + ((i * 13) % 10) / 100);
      hm.setColorAt(i, c);
      R.boxes.push({ x0: w.x - hs.w / 2, x1: w.x + hs.w / 2, z0: w.z - hs.d / 2, z1: w.z + hs.d / 2, top: hs.base + hs.h, from, to });
      if (i % 3 === 0) {
        const dr = Math.min(hs.w, hs.d) * 0.3;
        dummy.position.set(w.x, hs.base + hs.h, w.z);
        dummy.scale.set(dr, dr * 0.9, dr);
        dummy.updateMatrix();
        dm.setMatrixAt(di, dummy.matrix);
        dm.setColorAt(di, c);
        di++;
      }
    });
    hm.castShadow = hm.receiveShadow = true;
    dm.castShadow = dm.receiveShadow = true;
    scene.add(era(hm, from, to), era(dm, from, to));
  };
  M.houseInst = new THREE.MeshStandardMaterial({ map: M.house.map.clone(), roughness: 0.95 });
  M.houseInst.map.repeat.set(1, 1);
  M.houseInst.map.needsUpdate = true;
  makeHouses(houses, -Infinity, Infinity);
  makeHouses(mughrabi, -Infinity, 1967);
  R.minimap.push({ type: 'poly', pts: rect(-120, 14, -6, 146), color: '#9c8f74', to: 1967, fill: true, label: 'Mughrabi Qr.' });
  R.minimap.push({ type: 'poly', pts: rect(-118, 18, -6, 142), color: '#cfc6b2', from: 1967, fill: true, label: 'Plaza' });
  landmark({
    id: 'mughrabi', name: 'Mughrabi Quarter', ar: 'حارة المغاربة', built: 'Endowed 1193 CE by al-Afdal',
    X: -60, Y: 80, r: 60, to: 1967, h: -12,
    text: 'The quarter of North African Muslims, endowed by al-Afdal Ali, son of Salah al-Din, beside the western wall of al-Aqsa. Home to about 135 houses, two mosques and the zawiya of Abu Madyan.',
  });
  landmark({
    id: 'plaza', name: 'Site of the Mughrabi Quarter', ar: 'موقع حارة المغاربة', built: 'Demolished 10–11 June 1967',
    X: -60, Y: 80, r: 60, from: 1967, h: -12,
    text: 'Days after the occupation of East Jerusalem in June 1967, the 770-year-old quarter was demolished and its residents expelled to clear a plaza before al-Buraq Wall.',
  });

  // Mount of Olives: scattered olive trees and houses on the slope
  const mo = [];
  for (let i = 0; i < 700; i++) {
    const X = 380 + r() * 750, Y = -400 + r() * 1300;
    mo.push([X, Y, 0.8 + r() * 0.6]);
  }
  addTrees(M, scene, [], mo, (X, Y) => terrainH(X, Y));
  landmark({ id: 'olives', name: 'Mount of Olives', ar: 'جبل الزيتون', built: 'Jabal al-Tur', X: 900, Y: 245, r: 200, text: 'The ridge east of the Old City across the Kidron valley, with the classic view west over al-Aqsa.' });
}

export function buildWorld(scene, T) {
  const M = materials(T);
  courtyard(M, scene);
  compoundWalls(M, scene);
  domeOfTheRock(M, scene);
  domeOfTheChain(M, scene);
  qibliMosques(M, scene);
  monuments(M, scene);
  marwani(M, scene);
  surroundings(M, scene);
  return M;
}

