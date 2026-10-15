// Procedural canvas textures. Every texture is authored for a known size in
// metres so geometry with metre-based UVs maps it 1:1 (repeat = 1 / size).
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Surah Ya-Sin 36:1-4, verified text (quran.ai, ar-imlaei edition). The Ottoman
// tile frieze along the top of the Dome of the Rock carries Surah Ya-Sin.
const YASIN = 'يس ۝ وَالْقُرْآنِ الْحَكِيمِ ۝ إِنَّكَ لَمِنَ الْمُرْسَلِينَ ۝ عَلَىٰ صِرَاطٍ مُّسْتَقِيمٍ ۝';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finish(canvas, metresW, metresH, { color = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / metresW, 1 / metresH);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

function grain(g, w, h, amount, r) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (r() - 0.5) * amount;
    d[i] += v;
    d[i + 1] += v;
    d[i + 2] += v * 0.9;
  }
  g.putImageData(img, 0, 0);
}

function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, f);
  return '#' + c.getHexString();
}

// Jerusalem limestone ashlar: 4 m x 4 m tile, 0.5 m courses.
function ashlar(seed, base, { course = 0.5, minL = 0.7, maxL = 1.6, mortar = '#efe4cc', size = 4, px = 512, rough = 26 } = {}) {
  const c = makeCanvas(px, px);
  const g = c.getContext('2d');
  const r = rng(seed);
  const s = px / size;
  g.fillStyle = mortar;
  g.fillRect(0, 0, px, px);
  for (let y = 0; y < size - 1e-6; y += course) {
    let x = -r() * maxL;
    while (x < size) {
      const L = minL + r() * (maxL - minL);
      const tone = (r() - 0.5) * 0.09;
      g.fillStyle = shade(base, tone);
      g.fillRect(x * s + 1.5, y * s + 1.5, L * s - 3, course * s - 3);
      // wrap horizontally so the tile is seamless
      if (x < 0) g.fillRect((x + size) * s + 1.5, y * s + 1.5, L * s - 3, course * s - 3);
      if (x + L > size) g.fillRect((x - size) * s + 1.5, y * s + 1.5, L * s - 3, course * s - 3);
      // subtle chisel-drafted margin
      g.strokeStyle = shade(base, tone - 0.05);
      g.lineWidth = 1;
      g.strokeRect(x * s + 3, y * s + 3, L * s - 6, course * s - 6);
      x += L;
    }
  }
  grain(g, px, px, rough, r);
  return finish(c, size, size);
}

function paving() {
  const px = 512, size = 4, s = px / size;
  const c = makeCanvas(px, px);
  const g = c.getContext('2d');
  const r = rng(77);
  g.fillStyle = '#b9ad94';
  g.fillRect(0, 0, px, px);
  for (let y = 0; y < size; y += 1) {
    const off = (y % 2) * 0.5;
    for (let x = -1; x < size + 1; x += 1) {
      g.fillStyle = shade('#d6ccb6', (r() - 0.5) * 0.08);
      g.fillRect((x + off) * s + 2, y * s + 2, s - 4, s - 4);
    }
  }
  grain(g, px, px, 22, r);
  return finish(c, size, size);
}

function earth() {
  const px = 512, size = 10, s = px / size;
  const c = makeCanvas(px, px);
  const g = c.getContext('2d');
  const r = rng(5);
  g.fillStyle = '#8f7f5c';
  g.fillRect(0, 0, px, px);
  for (let i = 0; i < 900; i++) {
    const x = r() * px, y = r() * px, rad = 2 + r() * 14;
    g.fillStyle = r() < 0.55 ? `rgba(98,112,56,${0.25 + r() * 0.4})` : `rgba(120,100,70,${0.2 + r() * 0.3})`;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  grain(g, px, px, 30, r);
  void s;
  return finish(c, size, size);
}

function marble() {
  const px = 512, size = 4, s = px / size;
  const c = makeCanvas(px, px);
  const g = c.getContext('2d');
  const r = rng(11);
  for (let i = 0; i < size; i++) {
    g.fillStyle = shade('#e4e0d8', (r() - 0.5) * 0.06);
    g.fillRect(i * s, 0, s, px);
    g.strokeStyle = 'rgba(110,105,100,0.35)';
    for (let v = 0; v < 6; v++) {
      g.beginPath();
      let x = i * s + r() * s, y = 0;
      g.moveTo(x, y);
      while (y < px) {
        y += 10 + r() * 30;
        x += (r() - 0.5) * 18;
        g.lineTo(x, y);
      }
      g.lineWidth = 0.5 + r() * 1.2;
      g.stroke();
    }
    g.fillStyle = 'rgba(80,70,60,0.5)';
    g.fillRect(i * s, 0, 2, px);
  }
  grain(g, px, px, 10, r);
  return finish(c, size, size);
}

// One octagon face of the Dome of the Rock (20.6 m x 6.4 m upper zone):
// seven arched panels, five of them pierced windows, with an inscription
// frieze on top. `kind` is 'tile' (Ottoman, from 1545) or 'mosaic' (Umayyad).
function faceTexture(kind) {
  const W = 2048, H = 640, mW = 20.6, mH = 6.4;
  const s = W / mW;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const r = rng(kind === 'tile' ? 31 : 32);
  const tile = kind === 'tile';
  const ground = tile ? '#1f5296' : '#2f6a4a';
  g.fillStyle = ground;
  g.fillRect(0, 0, W, H);
  // small repeating motif
  for (let y = 0; y < H; y += 16) {
    for (let x = (y / 16) % 2 ? 8 : 0; x < W; x += 16) {
      g.fillStyle = tile ? (r() < 0.5 ? '#2c67b0' : '#173f78') : (r() < 0.5 ? '#c7a43f' : '#3d7d57');
      g.beginPath();
      g.arc(x, y, tile ? 3 : 2.4, 0, Math.PI * 2);
      g.fill();
    }
  }
  // frieze band
  const band = 1.0 * s;
  g.fillStyle = tile ? '#0e2a57' : '#1d3d2b';
  g.fillRect(0, 0, W, band);
  g.fillStyle = tile ? '#f4f1e6' : '#e7c45a';
  g.font = `${Math.round(band * 0.62)}px "Amiri", "Noto Naskh Arabic", "Scheherazade New", serif`;
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  g.direction = 'rtl';
  g.fillText(YASIN, W / 2, band * 0.52, W * 0.97);
  g.fillStyle = tile ? '#4fa3c7' : '#d6b452';
  g.fillRect(0, band, W, 5);
  // seven arches
  const n = 7, pw = mW / n;
  for (let i = 0; i < n; i++) {
    const cx = (i + 0.5) * pw * s;
    const aw = pw * 0.62 * s;
    const top = band + 0.55 * s;
    const bottom = H - 0.25 * s;
    const window = i > 0 && i < n - 1;
    g.save();
    g.beginPath();
    g.moveTo(cx - aw / 2, bottom);
    g.lineTo(cx - aw / 2, top + aw * 0.55);
    g.quadraticCurveTo(cx - aw / 2, top, cx, top - aw * 0.12);
    g.quadraticCurveTo(cx + aw / 2, top, cx + aw / 2, top + aw * 0.55);
    g.lineTo(cx + aw / 2, bottom);
    g.closePath();
    g.lineWidth = 10;
    g.strokeStyle = tile ? '#e8f0f2' : '#e1c062';
    g.stroke();
    g.fillStyle = window ? (tile ? '#16253a' : '#1a2a20') : (tile ? '#2b5ea2' : '#3a7350');
    g.fill();
    if (window) {
      g.clip();
      g.strokeStyle = tile ? 'rgba(170,200,230,0.45)' : 'rgba(225,192,98,0.45)';
      g.lineWidth = 3;
      for (let k = -20; k < 20; k++) {
        g.beginPath();
        g.moveTo(cx + k * 14, top - 40);
        g.lineTo(cx + k * 14 + 200, bottom);
        g.moveTo(cx + k * 14, top - 40);
        g.lineTo(cx + k * 14 - 200, bottom);
        g.stroke();
      }
    }
    g.restore();
  }
  grain(g, W, H, 10, r);
  return finish(c, mW, mH);
}

// Drum: 16 windows round a 73.5 m circumference -> one window per 4.59 m.
function drumTexture(kind) {
  const W = 256, H = 512, mW = 4.594, mH = 9.0;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const tile = kind === 'tile';
  g.fillStyle = tile ? '#1e4f92' : '#2f6a4a';
  g.fillRect(0, 0, W, H);
  g.fillStyle = tile ? '#0e2a57' : '#1d3d2b';
  g.fillRect(0, 0, W, 50);
  g.fillStyle = tile ? '#4fa3c7' : '#d6b452';
  g.fillRect(0, 50, W, 6);
  g.fillRect(0, H - 40, W, 6);
  const cx = W / 2, aw = W * 0.5, top = 120, bottom = H - 70;
  g.beginPath();
  g.moveTo(cx - aw / 2, bottom);
  g.lineTo(cx - aw / 2, top + aw * 0.5);
  g.quadraticCurveTo(cx - aw / 2, top, cx, top - 20);
  g.quadraticCurveTo(cx + aw / 2, top, cx + aw / 2, top + aw * 0.5);
  g.lineTo(cx + aw / 2, bottom);
  g.closePath();
  g.lineWidth = 8;
  g.strokeStyle = tile ? '#e8f0f2' : '#e1c062';
  g.stroke();
  g.fillStyle = '#17263b';
  g.fill();
  return finish(c, mW, mH);
}

// Painted interior of a dome: gold ground with red/green roundels.
function domeInterior() {
  const px = 512, size = 6;
  const c = makeCanvas(px, px);
  const g = c.getContext('2d');
  const r = rng(9);
  g.fillStyle = '#b8862d';
  g.fillRect(0, 0, px, px);
  for (let y = 0; y < px; y += 64) {
    for (let x = 0; x < px; x += 64) {
      const ox = (y / 64) % 2 ? 32 : 0;
      g.fillStyle = '#7a1d1b';
      g.beginPath();
      g.arc(x + ox, y, 22, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#f2d27a';
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = '#1f5a45';
      g.beginPath();
      g.arc(x + ox, y, 8, 0, Math.PI * 2);
      g.fill();
    }
  }
  grain(g, px, px, 14, r);
  return finish(c, size, size);
}

function carpet() {
  const px = 256, size = 1.25;
  const c = makeCanvas(px, px);
  const g = c.getContext('2d');
  g.fillStyle = '#8c1f22';
  g.fillRect(0, 0, px, px);
  g.fillStyle = '#6d1518';
  g.fillRect(0, px - 26, px, 26);
  g.strokeStyle = '#c9a65a';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(40, px - 30);
  g.lineTo(40, 90);
  g.quadraticCurveTo(40, 30, px / 2, 22);
  g.quadraticCurveTo(px - 40, 30, px - 40, 90);
  g.lineTo(px - 40, px - 30);
  g.stroke();
  g.fillStyle = '#a3302f';
  g.fillRect(70, 110, px - 140, px - 160);
  return finish(c, size, size);
}

function ceiling() {
  const px = 256, size = 2.5;
  const c = makeCanvas(px, px);
  const g = c.getContext('2d');
  g.fillStyle = '#5a3a22';
  g.fillRect(0, 0, px, px);
  g.fillStyle = '#2d4d73';
  g.fillRect(16, 16, px - 32, px - 32);
  g.strokeStyle = '#d9b45e';
  g.lineWidth = 5;
  g.strokeRect(24, 24, px - 48, px - 48);
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.moveTo(px / 2, px / 2);
    g.lineTo(px / 2 + Math.cos(a) * 80, px / 2 + Math.sin(a) * 80);
  }
  g.stroke();
  return finish(c, size, size);
}

function lead() {
  const px = 256, size = 3;
  const c = makeCanvas(px, px);
  const g = c.getContext('2d');
  const r = rng(3);
  g.fillStyle = '#7d8288';
  g.fillRect(0, 0, px, px);
  for (let x = 0; x < px; x += px / 5) {
    g.fillStyle = '#5e6267';
    g.fillRect(x, 0, 3, px);
  }
  grain(g, px, px, 20, r);
  return finish(c, size, size);
}

function wood() {
  const px = 256, size = 2;
  const c = makeCanvas(px, px);
  const g = c.getContext('2d');
  const r = rng(21);
  for (let y = 0; y < px; y += 32) {
    g.fillStyle = shade('#6b4526', (r() - 0.5) * 0.08);
    g.fillRect(0, y, px, 30);
    g.strokeStyle = 'rgba(40,20,10,0.35)';
    for (let k = 0; k < 6; k++) {
      g.beginPath();
      g.moveTo(0, y + r() * 30);
      g.bezierCurveTo(80, y + r() * 30, 160, y + r() * 30, px, y + r() * 30);
      g.stroke();
    }
  }
  return finish(c, size, size);
}

// Carved stone arabesque (Sabil Qaitbay's dome).
function carved() {
  const px = 256, size = 2;
  const c = makeCanvas(px, px);
  const g = c.getContext('2d');
  g.fillStyle = '#d4c19c';
  g.fillRect(0, 0, px, px);
  g.strokeStyle = '#a58f66';
  g.lineWidth = 6;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.arc(px / 2, px / 2, 20 + i * 30, 0, Math.PI * 2);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(px, px);
  g.moveTo(px, 0);
  g.lineTo(0, px);
  g.stroke();
  return finish(c, size, size);
}

export function makeTextures() {
  return {
    stone: ashlar(1, '#dccaa4'),
    stoneWarm: ashlar(2, '#d2b98e', { mortar: '#e5d5b5' }),
    wallOld: ashlar(3, '#c4b089', { course: 1.0, minL: 1.2, maxL: 3.2, mortar: '#b8a47e', size: 8, rough: 34 }),
    herodian: ashlar(4, '#cdbb92', { course: 1.1, minL: 2.0, maxL: 5.0, mortar: '#9f8d68', size: 10, rough: 30 }),
    house: ashlar(6, '#d8c7a5', { course: 0.4, minL: 0.5, maxL: 1.1, mortar: '#e8dcc2', size: 3, rough: 28 }),
    paving: paving(),
    earth: earth(),
    marble: marble(),
    faceTile: faceTexture('tile'),
    faceMosaic: faceTexture('mosaic'),
    drumTile: drumTexture('tile'),
    drumMosaic: drumTexture('mosaic'),
    domeInner: domeInterior(),
    carpet: carpet(),
    ceiling: ceiling(),
    lead: lead(),
    wood: wood(),
    carved: carved(),
  };
}
