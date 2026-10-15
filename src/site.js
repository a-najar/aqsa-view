// Site frame and shared registry.
//
// Site coordinates: X metres east and Y metres north of the compound's
// south-west corner. Three.js world: x = X - CX, z = -(Y - CY), y = up.
// Wall lengths follow the published survey of al-Haram al-Sharif:
// west 491 m, east 462 m, north 310 m, south 281 m (about 144 dunams).

export const CX = 140;
export const CY = 245;

export const COMPOUND = [
  [0, 0],      // SW corner
  [280, 0],    // SE corner
  [295, 470],  // NE corner
  [-15, 490],  // NW corner
];

export const westX = (Y) => -15 * (Y / 490);
export const eastX = (Y) => 280 + 15 * (Y / 470);
export const northY = (X) => 490 - 20 * ((X + 15) / 310);

export function toWorld(X, Y) {
  return { x: X - CX, z: -(Y - CY) };
}
export function toSite(x, z) {
  return { X: x + CX, Y: -z + CY };
}

export function insideCompound(X, Y) {
  return Y >= 0 && Y <= northY(X) && X >= westX(Y) && X <= eastX(Y);
}

const sstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Height of the land outside the compound, relative to the compound's
// courtyard (0). The Old City streets to the north and west are close to
// courtyard level; the land falls away to the south (Ophel) and east (the
// Kidron valley) and rises again to the Mount of Olives.
export function terrainH(X, Y) {
  if (insideCompound(X, Y)) return -3;
  let h = 0;
  const de = X - eastX(Math.min(470, Math.max(0, Y)));
  if (de > 0) h += -48 * sstep(0, 160, de) + 135 * sstep(230, 760, de);
  if (Y < 0) {
    const ds = -Y;
    h += -14 * sstep(0, 35, ds) - 0.16 * Math.max(0, ds - 35);
  }
  // The low ground along the outside of the west wall (al-Buraq wall),
  // the site of the Mughrabi Quarter and, since 1967, a plaza.
  if (X < westX(Y)) {
    const mx = sstep(-140, -120, X);
    const my = sstep(-5, 15, Y) * (1 - sstep(145, 165, Y));
    h += -12 * mx * my;
  }
  if (Y > 490) h += 6 * sstep(490, 700, Y);
  if (X < -60) h += 6 * sstep(-60, -500, X);
  return h;
}

// Shared registry filled by the builders and read by the engine.
export const R = {
  eraObjs: [],     // objects with userData.from / userData.to
  landmarks: [],   // { id, name, ar, built, from, to, X, Y, r, text, h }
  circles: [],     // tree trunks: { x, z, r }
  boxes: [],       // houses: { x0, x1, z0, z1, top, from, to }
  minimap: [],     // drawing commands for the minimap
};

export function era(obj, from = -Infinity, to = Infinity) {
  obj.userData.from = from;
  obj.userData.to = to;
  R.eraObjs.push(obj);
  return obj;
}

export function landmark(o) {
  R.landmarks.push({ from: -Infinity, to: Infinity, r: 25, h: 0, ...o });
}

export function inEra(o, year) {
  return year >= (o.from ?? -Infinity) && year < (o.to ?? Infinity);
}
