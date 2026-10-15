import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { makeTextures } from './textures.js';
import { buildWorld, PLATFORM_H } from './buildings.js';
import { R, toWorld, toSite, insideCompound, terrainH, inEra, COMPOUND } from './site.js';
import { ERAS, eraFor, hijri } from './timeline.js';

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const coarse = matchMedia('(pointer: coarse)').matches;

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.82;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd9dcd6, 400, 2800);
const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 5000);
camera.rotation.order = 'YXZ';

const sunDir = new THREE.Vector3(-0.55, 0.72, 0.42).normalize();
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(4000, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sun: { value: sunDir } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vD; uniform vec3 sun;
      void main(){
        float h = clamp(vD.y, -0.2, 1.0);
        vec3 horizon = vec3(0.93, 0.88, 0.80);
        vec3 zenith = vec3(0.30, 0.52, 0.80);
        vec3 c = mix(horizon, zenith, pow(max(h, 0.0), 0.55));
        float s = max(dot(normalize(vD), sun), 0.0);
        c += vec3(1.0, 0.85, 0.6) * pow(s, 64.0) * 0.8 + vec3(1.0, 0.8, 0.6) * pow(s, 6.0) * 0.12;
        gl_FragColor = vec4(c, 1.0);
      }`,
  }),
);
sky.renderOrder = -1;
scene.add(sky);

// image-based lighting from the same sky, so gilded and lead domes read
// as metal
{
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(sky.geometry, sky.material));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(3000, 16), new THREE.MeshBasicMaterial({ color: 0x9a8a6c }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -20;
  envScene.add(ground);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.03, 0.1, 10000).texture;
  pmrem.dispose();
}
const hemi = new THREE.HemisphereLight(0xd6e6ff, 0xb39b78, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0dc, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
const SH = 95;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 600 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.5;
scene.add(sun, sun.target);

// ---------------------------------------------------------------- state
const EYE = 1.65;
const player = { pos: new THREE.Vector3(), vy: 0, yaw: 0, pitch: 0, fly: true, onGround: false };
let year = 2026;
let walkables = [], solids = [], activeBoxes = [];

function placeAt(X, Y, y, yaw, pitch = 0, fly = player.fly) {
  const w = toWorld(X, Y);
  player.pos.set(w.x, y, w.z);
  player.yaw = yaw;
  player.pitch = pitch;
  player.vy = 0;
  setFly(fly);
}

function lookAtSite(X, Y, y, tX, tY, ty) {
  const a = toWorld(X, Y), b = toWorld(tX, tY);
  const dx = b.x - a.x, dz = b.z - a.z, dy = ty - (y + EYE);
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

// ---------------------------------------------------------------- collision
const rayDown = new THREE.Raycaster();
const rayH = new THREE.Raycaster();
const v3 = new THREE.Vector3(), dirV = new THREE.Vector3(), nrm = new THREE.Vector3();
const RADIUS = 0.35;

function near(list, x, z, pad) {
  const out = [];
  for (const o of list) {
    const s = o.userData.bs;
    const dx = s.center.x - x, dz = s.center.z - z;
    const rr = s.radius + pad;
    if (dx * dx + dz * dz < rr * rr) out.push(o);
  }
  return out;
}

function groundAt(x, z, feetY, list) {
  rayDown.ray.origin.set(x, feetY + 0.9, z);
  rayDown.ray.direction.set(0, -1, 0);
  rayDown.far = 400;
  const hits = rayDown.intersectObjects(list || near(walkables, x, z, 2), false);
  let g = hits.length ? hits[0].point.y : -Infinity;
  const s = toSite(x, z);
  if (!insideCompound(s.X, s.Y)) g = Math.max(g, terrainH(s.X, s.Y));
  return Math.max(g, -60);
}

function blocked(origin, m, list) {
  const len = Math.hypot(m.x, m.z);
  if (len < 1e-6) return null;
  dirV.set(m.x / len, 0, m.z / len);
  let best = null;
  for (const h of [0.45, 0.95, 1.6]) {
    rayH.ray.origin.set(origin.x, origin.y + h, origin.z);
    rayH.ray.direction.copy(dirV);
    rayH.far = len + RADIUS;
    const hit = rayH.intersectObjects(list, false)[0];
    if (hit && (!best || hit.distance < best.distance)) best = hit;
  }
  return best;
}

function slideMove(m) {
  const list = near(solids, player.pos.x, player.pos.z, 4);
  const hit = blocked(player.pos, m, list);
  if (!hit) return m;
  if (hit.face) {
    nrm.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    nrm.y = 0;
    if (nrm.lengthSq() < 1e-6) return m.set(0, 0, 0);
    nrm.normalize();
    if (nrm.dot(dirV) > 0) nrm.negate();
    const d = m.x * nrm.x + m.z * nrm.z;
    m.x -= nrm.x * d;
    m.z -= nrm.z * d;
    if (blocked(player.pos, m, list)) m.set(0, 0, 0);
    return m;
  }
  return m.set(0, 0, 0);
}

function pushOut() {
  const p = player.pos;
  for (const c of R.circles) {
    const dx = p.x - c.x, dz = p.z - c.z;
    const rr = c.r + RADIUS;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-8) {
      const d = Math.sqrt(d2);
      p.x = c.x + (dx / d) * rr;
      p.z = c.z + (dz / d) * rr;
    }
  }
  for (const b of activeBoxes) {
    if (p.y > b.top - 0.2) continue;
    if (p.x > b.x0 - RADIUS && p.x < b.x1 + RADIUS && p.z > b.z0 - RADIUS && p.z < b.z1 + RADIUS) {
      const pen = [p.x - (b.x0 - RADIUS), b.x1 + RADIUS - p.x, p.z - (b.z0 - RADIUS), b.z1 + RADIUS - p.z];
      const i = pen.indexOf(Math.min(...pen));
      if (i === 0) p.x = b.x0 - RADIUS;
      else if (i === 1) p.x = b.x1 + RADIUS;
      else if (i === 2) p.z = b.z0 - RADIUS;
      else p.z = b.z1 + RADIUS;
    }
  }
}

// ---------------------------------------------------------------- input
const keys = new Set();
const joy = { x: 0, y: 0 };
let flyUp = 0;
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === 'f') setFly(!player.fly);
  if (k === 'm') toggleMap();
  if (k === 'h' || k === '?') toggleHelp();
  if (k === '[' || k === ',') stepEra(-1);
  if (k === ']' || k === '.') stepEra(1);
  if ([' ', 'arrowup', 'arrowdown'].includes(k) && e.target === document.body) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

let dragging = null;
canvas.addEventListener('click', () => {
  if (coarse || document.pointerLockElement) return;
  if (dragMoved) return;
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch (_) { /* pointer lock unavailable: drag to look instead */ }
});
let dragMoved = false;
canvas.addEventListener('mousedown', (e) => { dragging = { x: e.clientX, y: e.clientY }; dragMoved = false; });
addEventListener('mouseup', () => { dragging = null; setTimeout(() => { dragMoved = false; }, 0); });
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) {
    look(e.movementX, e.movementY, 0.0022);
  } else if (dragging) {
    const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
    dragging = { x: e.clientX, y: e.clientY };
    look(dx, dy, 0.004);
  }
});
document.addEventListener('pointerlockchange', () => {
  document.body.classList.toggle('locked', document.pointerLockElement === canvas);
});

function look(dx, dy, s) {
  player.yaw -= dx * s;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - dy * s));
}

// touch: joystick on the left, drag anywhere else to look
const joyEl = $('joy'), knob = $('knob');
let joyId = null, lookId = null, lookLast = null;
joyEl.addEventListener('touchstart', (e) => { joyId = e.changedTouches[0].identifier; moveJoy(e.changedTouches[0]); e.preventDefault(); }, { passive: false });
joyEl.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) if (t.identifier === joyId) moveJoy(t);
  e.preventDefault();
}, { passive: false });
const endJoy = (e) => {
  for (const t of e.changedTouches) if (t.identifier === joyId) { joyId = null; joy.x = joy.y = 0; knob.style.transform = ''; }
};
joyEl.addEventListener('touchend', endJoy);
joyEl.addEventListener('touchcancel', endJoy);
function moveJoy(t) {
  const r = joyEl.getBoundingClientRect();
  let dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2);
  let dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2);
  const l = Math.hypot(dx, dy);
  if (l > 1) { dx /= l; dy /= l; }
  joy.x = dx;
  joy.y = -dy;
  knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
}
canvas.addEventListener('touchstart', (e) => {
  const t = e.changedTouches[0];
  if (lookId === null) { lookId = t.identifier; lookLast = { x: t.clientX, y: t.clientY }; }
}, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) if (t.identifier === lookId) {
    look(t.clientX - lookLast.x, t.clientY - lookLast.y, 0.005);
    lookLast = { x: t.clientX, y: t.clientY };
  }
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchend', (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; });
for (const [id, v] of [['upBtn', 1], ['downBtn', -1]]) {
  const b = $(id);
  const on = (e) => { flyUp = v; e.preventDefault(); };
  const off = () => { flyUp = 0; };
  b.addEventListener('touchstart', on, { passive: false });
  b.addEventListener('mousedown', on);
  b.addEventListener('touchend', off);
  b.addEventListener('mouseup', off);
  b.addEventListener('mouseleave', off);
}
$('jumpBtn').addEventListener('touchstart', (e) => { if (player.onGround) player.vy = 5.5; e.preventDefault(); }, { passive: false });

function setFly(f) {
  player.fly = f;
  if (!f) {
    player.vy = 0;
    const g = groundAt(player.pos.x, player.pos.z, player.pos.y, walkables);
    if (player.pos.y < g) player.pos.y = g;
  }
  document.body.classList.toggle('fly', f);
  $('modeBtn').textContent = f ? 'Flying' : 'Walking';
  $('modeBtn').setAttribute('aria-pressed', String(f));
}
$('modeBtn').addEventListener('click', () => setFly(!player.fly));

// ---------------------------------------------------------------- update
const mv = new THREE.Vector3();
function update(dt) {
  const k = (a, b) => (keys.has(a) || (b && keys.has(b)) ? 1 : 0);
  let f = k('w', 'arrowup') - k('s', 'arrowdown') + joy.y;
  let s = k('d', 'arrowright') - k('a', 'arrowleft') + joy.x;
  const l = Math.hypot(f, s);
  if (l > 1) { f /= l; s /= l; }
  const run = keys.has('shift');
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  if (player.fly) {
    const sp = run ? 70 : 22;
    const cp = Math.cos(player.pitch), spch = Math.sin(player.pitch);
    mv.set((-sy * cp) * f + cy * s, spch * f, (-cy * cp) * f - sy * s);
    mv.y += k(' ', 'e') - k('c', 'q') + flyUp;
    player.pos.addScaledVector(mv, sp * dt);
    const st = toSite(player.pos.x, player.pos.z);
    if (!insideCompound(st.X, st.Y)) player.pos.y = Math.max(player.pos.y, terrainH(st.X, st.Y) + 0.5);
    player.pos.y = Math.min(player.pos.y, 900);
    const lim = 1150;
    player.pos.x = Math.max(-lim, Math.min(lim, player.pos.x));
    player.pos.z = Math.max(-lim, Math.min(lim, player.pos.z));
  } else {
    const sp = run ? 9 : 4.2;
    mv.set(-sy * f + cy * s, 0, -cy * f - sy * s).multiplyScalar(sp * dt);
    slideMove(mv);
    player.pos.x += mv.x;
    player.pos.z += mv.z;
    pushOut();
    const list = near(walkables, player.pos.x, player.pos.z, 2);
    if ((keys.has(' ')) && player.onGround) player.vy = 5.5;
    player.vy -= 20 * dt;
    player.pos.y += player.vy * dt;
    const g = groundAt(player.pos.x, player.pos.z, player.pos.y, list);
    if (player.pos.y <= g) {
      player.pos.y = g;
      player.vy = 0;
      player.onGround = true;
    } else if (player.onGround && player.vy <= 0 && player.pos.y - g < 0.6) {
      player.pos.y = g;
      player.vy = 0;
    } else {
      player.onGround = false;
    }
  }
  camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
  sky.position.copy(camera.position);
  // keep the shadow frustum around the viewer
  const c = camera.position;
  const ahead = player.fly ? 0 : 25;
  sun.target.position.set(Math.round(c.x - sy * ahead), 0, Math.round(c.z - cy * ahead));
  sun.position.copy(sun.target.position).addScaledVector(sunDir, 300);
}

// ---------------------------------------------------------------- eras
function setYear(y) {
  year = y;
  for (const o of R.eraObjs) o.visible = inEra(o.userData, y);
  walkables = [];
  solids = [];
  scene.traverseVisible((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    if (o.userData.walk) walkables.push(o);
    if (o.userData.collide) solids.push(o);
  });
  activeBoxes = R.boxes.filter((b) => inEra(b, y));
  renderEra();
}

let shownEra = null;
function renderEra() {
  const e = eraFor(year);
  $('yearNum').textContent = year;
  $('yearAh').textContent = `≈ ${hijri(year)} AH`;
  $('slider').value = year;
  $('slider').setAttribute('aria-valuetext', `${year} CE, ${e.title}`);
  document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', Number(c.dataset.year) === e.year));
  if (shownEra === e) return;
  shownEra = e;
  $('eraDyn').textContent = e.dynasty;
  $('infoToggle').textContent = `This era · ${e.dynasty}`;
  $('eraTitle').textContent = e.title;
  $('eraText').textContent = e.text;
  const i = ERAS.indexOf(e);
  const next = ERAS[i + 1] ? ERAS[i + 1].year : Infinity;
  const added = R.landmarks.filter((l) => l.from >= e.year && l.from < next && !l.id.startsWith('gate'));
  const ul = $('eraNew');
  ul.innerHTML = '';
  for (const l of added) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span>${l.name}</span><span class="ar" lang="ar">${l.ar}</span>`;
    b.addEventListener('click', () => goToLandmark(l));
    li.append(b);
    ul.append(li);
  }
  $('eraNewWrap').hidden = added.length === 0;
  const active = document.querySelector('.chip.on');
  if (active) active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}

function stepEra(d) {
  const e = eraFor(year);
  const i = Math.max(0, Math.min(ERAS.length - 1, ERAS.indexOf(e) + d));
  setYear(ERAS[i].year);
}

function goToLandmark(l) {
  const offset = Math.max(8, Math.min(30, l.r * 0.9));
  const X = l.X, Y = l.Y - offset;
  const w = toWorld(X, Y);
  const y = groundAt(w.x, w.z, l.h + 40, walkables);
  const la = lookAtSite(X, Y, y, l.X, l.Y, l.h + 4);
  placeAt(X, Y, y, la.yaw, la.pitch, false);
}

// ---------------------------------------------------------------- UI build
function buildUI() {
  const slider = $('slider');
  slider.min = 638;
  slider.max = 2026;
  let pending = null;
  slider.addEventListener('input', () => {
    pending = Number(slider.value);
    requestAnimationFrame(() => { if (pending !== null) { setYear(pending); pending = null; } });
  });
  const ticks = $('ticks');
  const chips = $('chips');
  for (const e of ERAS) {
    const t = document.createElement('span');
    t.className = 'tick';
    t.style.left = `${((e.year - 638) / (2026 - 638)) * 100}%`;
    ticks.append(t);
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'chip';
    c.dataset.year = e.year;
    c.innerHTML = `<b>${e.year}</b><span>${e.label}</span>`;
    c.addEventListener('click', () => setYear(e.year));
    chips.append(c);
  }
  $('prevEra').addEventListener('click', () => stepEra(-1));
  $('nextEra').addEventListener('click', () => stepEra(1));
  let playT = null;
  $('playBtn').addEventListener('click', () => {
    if (playT) {
      clearInterval(playT);
      playT = null;
      $('playBtn').textContent = 'Play history';
      return;
    }
    if (eraFor(year) === ERAS[ERAS.length - 1]) setYear(ERAS[0].year);
    $('playBtn').textContent = 'Stop';
    playT = setInterval(() => {
      if (eraFor(year) === ERAS[ERAS.length - 1]) { $('playBtn').click(); return; }
      stepEra(1);
    }, 5000);
  });

  const sel = $('goto');
  const spots = [
    { name: 'Overview from the air', fn: () => { const la = lookAtSite(-80, -150, 140, 138, 280, 10); placeAt(-80, -150, 140, la.yaw, la.pitch, true); } },
    { name: 'Dome of the Rock · south porch', fn: () => placeAt(138, 258, PLATFORM_H, 0, 0.12, false) },
    { name: 'Inside the Dome of the Rock', fn: () => placeAt(138, 272, PLATFORM_H, 0, 0.15, false) },
    { name: 'Inside al-Qibli Mosque', fn: () => placeAt(138, 74, 0, Math.PI, 0.05, false) },
    { name: 'Al-Kas fountain', fn: () => placeAt(138, 140, 0, 0, 0.1, false) },
    { name: 'Dome of the Chain', fn: () => placeAt(179, 278, PLATFORM_H, 0, 0.1, false) },
    { name: 'Al-Musalla al-Marwani (from 1996)', fn: () => { if (year < 1996) setYear(1996); placeAt(219, 58, -10, Math.PI, 0, false); } },
    { name: 'Bab al-Rahma', fn: () => placeAt(255, 330, 0, -Math.PI / 2, 0.08, false) },
    { name: 'Western riwaq', fn: () => placeAt(4, 300, 0, 0, 0, false) },
    { name: 'Al-Ghawanima minaret', fn: () => placeAt(30, 455, 0, Math.PI / 4, 0.35, false) },
    { name: 'Al-Buraq Wall (outside)', fn: () => placeAt(-55, 100, -12, -Math.PI / 2, 0.15, false) },
    { name: 'Mount of Olives view', fn: () => { const la = lookAtSite(880, 250, 70, 138, 292, 20); placeAt(880, 250, 70, la.yaw, la.pitch, true); } },
  ];
  spots.forEach((s, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = s.name;
    sel.append(o);
  });
  sel.addEventListener('change', () => {
    const s = spots[Number(sel.value)];
    if (s) s.fn();
    sel.value = '';
    sel.blur();
  });
  spots[0].fn();
  $('helpBtn').addEventListener('click', toggleHelp);
  $('helpClose').addEventListener('click', toggleHelp);
  $('mapToggle').addEventListener('click', toggleMap);
  $('infoToggle').addEventListener('click', () => $('info').classList.toggle('collapsed'));
  if (coarse || innerWidth <= 720) {
    $('info').classList.add('collapsed');
    toggleMap();
  }
}

function toggleMap() {
  const collapsed = $('mapWrap').classList.toggle('collapsed');
  $('mapToggle').textContent = collapsed ? 'Show' : 'Hide';
}

function toggleHelp() {
  const h = $('help');
  h.hidden = !h.hidden;
  if (!h.hidden && document.pointerLockElement) document.exitPointerLock();
}

// ---------------------------------------------------------------- minimap
const map = $('map');
const mctx = map.getContext('2d');
const MB = { X0: -135, X1: 315, Y0: -25, Y1: 510 };
function mapScale() {
  const w = map.width, h = map.height;
  const s = Math.min(w / (MB.X1 - MB.X0), h / (MB.Y1 - MB.Y0));
  const ox = (w - (MB.X1 - MB.X0) * s) / 2, oy = (h - (MB.Y1 - MB.Y0) * s) / 2;
  return { s, ox, oy };
}
function mp(X, Y, k) { return [k.ox + (X - MB.X0) * k.s, k.oy + (MB.Y1 - Y) * k.s]; }
function drawMap() {
  const dpr = Math.min(devicePixelRatio, 2);
  const rect = map.getBoundingClientRect();
  if (map.width !== Math.round(rect.width * dpr)) {
    map.width = Math.round(rect.width * dpr);
    map.height = Math.round(rect.height * dpr);
  }
  const k = mapScale();
  const g = mctx;
  g.clearRect(0, 0, map.width, map.height);
  g.fillStyle = 'rgba(31, 27, 22, 0.55)';
  g.fillRect(0, 0, map.width, map.height);
  g.beginPath();
  COMPOUND.forEach(([X, Y], i) => { const [x, y] = mp(X, Y, k); i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.closePath();
  g.fillStyle = '#6f6650';
  g.fill();
  for (const it of R.minimap) {
    if (!inEra(it, year)) continue;
    g.strokeStyle = it.color;
    g.fillStyle = it.color;
    g.lineWidth = Math.max(1, k.s * 1.2);
    if (it.type === 'poly' || it.type === 'wall') {
      g.beginPath();
      it.pts.forEach(([X, Y], i) => { const [x, y] = mp(X, Y, k); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.closePath();
      if (it.dash) { g.setLineDash([4 * dpr, 3 * dpr]); g.stroke(); g.setLineDash([]); }
      else if (it.type === 'wall') { g.lineWidth = 3 * dpr; g.stroke(); }
      else if (it.fill) { g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1; }
      else { g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1; }
    } else if (it.type === 'circle' || it.type === 'oct') {
      const [x, y] = mp(it.X, it.Y, k);
      g.beginPath();
      if (it.type === 'oct') {
        for (let i = 0; i <= 8; i++) {
          const a = Math.PI / 8 + i * Math.PI / 4;
          const px = x + Math.sin(a) * it.r * k.s, py = y + Math.cos(a) * it.r * k.s;
          i ? g.lineTo(px, py) : g.moveTo(px, py);
        }
      } else g.arc(x, y, it.r * k.s, 0, Math.PI * 2);
      g.fill();
    } else if (it.type === 'minaret') {
      const [x, y] = mp(it.X, it.Y, k);
      g.fillRect(x - 2.5 * dpr, y - 2.5 * dpr, 5 * dpr, 5 * dpr);
    } else if (it.type === 'gate') {
      const [x, y] = mp(it.X, it.Y, k);
      g.beginPath();
      g.arc(x, y, 2 * dpr, 0, Math.PI * 2);
      g.fill();
    }
  }
  // the viewer
  const s = toSite(player.pos.x, player.pos.z);
  const [px, py] = mp(Math.max(MB.X0, Math.min(MB.X1, s.X)), Math.max(MB.Y0, Math.min(MB.Y1, s.Y)), k);
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  const ang = Math.atan2(-fz, fx);
  g.save();
  g.translate(px, py);
  g.rotate(-ang);
  g.fillStyle = 'rgba(255, 214, 120, 0.25)';
  g.beginPath();
  g.moveTo(0, 0);
  g.arc(0, 0, 26 * dpr, -0.6, 0.6);
  g.closePath();
  g.fill();
  g.fillStyle = '#ffd36a';
  g.strokeStyle = '#1b160f';
  g.lineWidth = 1.5 * dpr;
  g.beginPath();
  g.moveTo(8 * dpr, 0);
  g.lineTo(-5 * dpr, 5 * dpr);
  g.lineTo(-2 * dpr, 0);
  g.lineTo(-5 * dpr, -5 * dpr);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
  // north arrow
  g.fillStyle = '#f2e7cf';
  g.font = `${11 * dpr}px "IBM Plex Mono", monospace`;
  g.fillText('N ↑', 8 * dpr, 16 * dpr);
}
map.addEventListener('click', (e) => {
  const rect = map.getBoundingClientRect();
  const dpr = map.width / rect.width;
  const k = mapScale();
  const X = ((e.clientX - rect.left) * dpr - k.ox) / k.s + MB.X0;
  const Y = MB.Y1 - ((e.clientY - rect.top) * dpr - k.oy) / k.s;
  const w = toWorld(X, Y);
  const y = groundAt(w.x, w.z, 60, walkables);
  placeAt(X, Y, y, player.yaw, 0, false);
});

// ---------------------------------------------------------------- HUD
let lastNear = null;
function updateHUD() {
  const s = toSite(player.pos.x, player.pos.z);
  let best = null, bd = Infinity;
  for (const l of R.landmarks) {
    if (!inEra(l, year)) continue;
    if (Math.abs(player.pos.y - l.h) > (l.h < 0 ? 6 : 14) && !player.fly) continue;
    const d = Math.hypot(s.X - l.X, s.Y - l.Y) / l.r;
    if (d < 1 && d < bd) { bd = d; best = l; }
  }
  if (player.fly && player.pos.y > 60) best = null;
  if (best !== lastNear) {
    lastNear = best;
    const el = $('near');
    if (!best) { el.hidden = true; return; }
    el.hidden = false;
    $('nearName').textContent = best.name;
    $('nearAr').textContent = best.ar;
    $('nearBuilt').textContent = best.built;
    $('nearText').textContent = best.text;
  }
}

// ---------------------------------------------------------------- loop
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

async function start() {
  resize();
  try {
    await Promise.race([
      Promise.all([document.fonts.load('48px "Amiri"'), document.fonts.ready]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch (_) { /* fall back to system Arabic font */ }
  const T = makeTextures();
  for (const t of Object.values(T)) t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  buildWorld(scene, T);
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh && (o.userData.walk || o.userData.collide)) {
      o.geometry.computeBoundingSphere();
      o.userData.bs = o.geometry.boundingSphere.clone().applyMatrix4(o.matrixWorld);
    }
  });
  buildUI();
  setYear(2026);
  $('loading').hidden = true;
  const clock = new THREE.Clock();
  let mapT = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    update(dt);
    renderer.render(scene, camera);
    mapT += dt;
    if (mapT > 0.1) {
      mapT = 0;
      if (!$('mapWrap').classList.contains('collapsed')) drawMap();
      updateHUD();
      const st = toSite(player.pos.x, player.pos.z);
      $('coords').textContent = `${Math.round(st.X)} E · ${Math.round(st.Y)} N · ${player.pos.y.toFixed(1)} m`;
    }
  });
  // debugging hook: step the walk physics with keys held, without rendering
  const simulate = (held, seconds) => {
    held.forEach((k) => keys.add(k));
    for (let t = 0; t < seconds; t += 1 / 60) update(1 / 60);
    held.forEach((k) => keys.delete(k));
    const s = toSite(player.pos.x, player.pos.z);
    return [+s.X.toFixed(2), +s.Y.toFixed(2), +player.pos.y.toFixed(2)];
  };
  window.__aqsa = { setYear, placeAt, player, scene, camera, renderer, R, simulate };
}

start().catch((err) => {
  console.error(err);
  $('loadingText').textContent = 'The 3D view could not start: ' + err.message;
});
