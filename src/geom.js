// Geometry helpers. All UVs are in metres so textures tile at true scale.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { toWorld } from './site.js';

export function mat(map, opts = {}) {
  return new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0, ...opts });
}

export function mesh(geo, material, { cast = true, recv = true, collide = false, walk = false } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = recv;
  if (collide) m.userData.collide = true;
  if (walk) m.userData.walk = true;
  return m;
}

// Place an object at site coordinates (X east, Y north), height y, and a
// heading `rot` in radians (counter-clockwise seen from above).
export function put(obj, X, Y, y = 0, rot = 0) {
  const w = toWorld(X, Y);
  obj.position.set(w.x, y, w.z);
  obj.rotation.y = rot;
  return obj;
}

// Box with metre UVs on every face.
export function boxGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
    }
  }
  return g;
}

export function cylGeo(rTop, rBot, h, seg = 24, open = false, thetaStart = 0) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open, thetaStart);
  const uv = g.attributes.uv;
  const circ = Math.PI * (rTop + rBot);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ, uv.getY(i) * h);
  return g;
}

// Points of a two-centred pointed arch from (L, s) to (R, s).
export function archPoints(L, R, s, n = 10, pointed = true) {
  const w = R - L;
  const pts = [];
  if (!pointed) {
    for (let i = 0; i <= n * 2; i++) {
      const a = Math.PI - (i / (n * 2)) * Math.PI;
      pts.push([L + w / 2 + Math.cos(a) * w / 2, s + Math.sin(a) * w / 2]);
    }
    return pts;
  }
  const r = 0.65 * w;
  const phi = Math.acos((w / 2 - r) / r);
  for (let i = 0; i <= n; i++) {
    const a = Math.PI - (i / n) * (Math.PI - phi);
    pts.push([L + r + Math.cos(a) * r, s + Math.sin(a) * r]);
  }
  for (let i = n - 1; i >= 0; i--) {
    const a = Math.PI - (i / n) * (Math.PI - phi);
    pts.push([R - r - Math.cos(a) * r, s + Math.sin(a) * r]);
  }
  return pts;
}

// A wall `len` long and `height` tall, `t` thick, centred on the origin
// along x. `doors` cut from the ground: { c, w, s (spring height), flat }.
// `windows` are holes: { c, y, w, h }.
export function wallGeo(len, height, t, { doors = [], windows = [], pointed = true } = {}) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  const ds = [...doors].sort((a, b) => a.c - b.c);
  for (const d of ds) {
    const L = d.c - d.w / 2, Rr = d.c + d.w / 2;
    shape.lineTo(L, 0);
    shape.lineTo(L, d.s);
    if (d.flat) {
      shape.lineTo(Rr, d.s);
    } else {
      for (const [x, y] of archPoints(L, Rr, d.s, 8, pointed)) shape.lineTo(x, Math.min(y, height - 0.2));
    }
    shape.lineTo(Rr, 0);
  }
  shape.lineTo(len, 0);
  shape.lineTo(len, height);
  shape.lineTo(0, height);
  shape.lineTo(0, 0);
  for (const wn of windows) {
    const hole = new THREE.Path();
    const L = wn.c - wn.w / 2, Rr = wn.c + wn.w / 2;
    hole.moveTo(L, wn.y);
    hole.lineTo(Rr, wn.y);
    const pts = archPoints(L, Rr, wn.y + wn.h, 6, pointed).reverse();
    for (const [x, y] of pts) hole.lineTo(x, y);
    hole.lineTo(L, wn.y);
    shape.holes.push(hole);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 6 });
  g.translate(-len / 2, 0, -t / 2);
  return g;
}

// An arcade: `bays` arches across `len`, piers `pier` wide.
export function arcadeGeo(len, height, bays, spring, pier, t, pointed = true) {
  const bw = len / bays;
  const doors = [];
  for (let i = 0; i < bays; i++) doors.push({ c: (i + 0.5) * bw, w: bw - pier, s: spring });
  return wallGeo(len, height, t, { doors, pointed });
}

// Lathe dome. `pinch` > 0 draws the top in to a point, as on the Dome of
// the Rock; `bulb` > 0 swells the haunches.
export function domeGeo(R, H, { pinch = 0.15, bulb = 0, seg = 48, n = 24 } = {}) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI / 2;
    let x = R * Math.cos(a) * (1 - pinch * Math.pow(Math.sin(a), 6));
    x *= 1 + bulb * Math.sin(a * 2);
    pts.push(new THREE.Vector2(Math.max(0.001, x), H * Math.sin(a)));
  }
  const g = new THREE.LatheGeometry(pts, seg);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * R, uv.getY(i) * H * 1.4);
  return g;
}

// Finial with crescent (hilal), or a cross for the Crusader occupation.
export function finial(scale, material, cross = false) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 8), material);
  pole.position.y = 1.1;
  g.add(pole);
  for (const [y, r] of [[0.5, 0.28], [1.0, 0.22], [1.45, 0.18]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), material);
    b.position.y = y;
    g.add(b);
  }
  if (cross) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.4, 0.14), material);
    v.position.y = 2.6;
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.14), material);
    h.position.y = 2.85;
    g.add(v, h);
  } else {
    const c = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 8, 24, Math.PI * 1.45), material);
    c.position.y = 2.75;
    c.rotation.z = Math.PI / 2 + Math.PI * 0.275;
    g.add(c);
  }
  g.scale.setScalar(scale);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Merge non-indexed copies of geometries that share position/normal/uv.
export function mergeGeos(list) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array, o * 3);
    nor.set(p.attributes.normal.array, o * 3);
    if (p.attributes.uv) uv.set(p.attributes.uv.array, o * 2);
    o += p.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

// Flight of steps descending along local +z from height `h` to 0.
export function stairsGeo(width, h, rise = 0.25, tread = 0.4) {
  const n = Math.round(h / rise);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const top = h - i * rise;
    const g = boxGeo(width, top, tread);
    g.translate(0, top / 2, (i + 0.5) * tread);
    parts.push(g);
  }
  return { geo: mergeGeos(parts), length: n * tread };
}

// Polygon (site coords) to a horizontal ShapeGeometry at height y.
export function floorGeo(poly, holes = []) {
  const shape = new THREE.Shape();
  poly.forEach(([X, Y], i) => {
    const w = toWorld(X, Y);
    if (i === 0) shape.moveTo(w.x, -w.z);
    else shape.lineTo(w.x, -w.z);
  });
  for (const hp of holes) {
    const path = new THREE.Path();
    hp.forEach(([X, Y], i) => {
      const w = toWorld(X, Y);
      if (i === 0) path.moveTo(w.x, -w.z);
      else path.lineTo(w.x, -w.z);
    });
    shape.holes.push(path);
  }
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  return g;
}

export function rect(X0, Y0, X1, Y1) {
  return [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]];
}
