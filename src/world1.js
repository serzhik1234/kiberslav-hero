/*WORLD-BEGIN*/
function createWorld(THREE, hooks){
'use strict';
hooks = hooks || {};
const onStatus = hooks.onStatus || function(){};
const onPower = hooks.onPower || function(){};
const V3 = THREE.Vector3, Q = THREE.Quaternion;
const R = hooks.random || Math.random;
const reduceMotion = !!hooks.reduceMotion;

/* ---------- helpers ---------- */
let seed = 20260926;
function rnd(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function cl(v){ v = Math.round(v); return v < 0 ? 0 : v > 255 ? 255 : v; }
function clamp01(v){ return v < 0 ? 0 : v > 1 ? 1 : v; }
function sstep(a, b, v){ const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); }
function lerp(a, b, t){ return a + (b - a) * t; }
function fmt(s){ return s.toFixed(2).replace('.', ',') + ' с'; }

/* ---------- textures: generated as DataTexture (works in browser and headless-gl alike) ---------- */
function dataTex(w, h, fn, opts){
  const d = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn(x, y); const i = ((h - 1 - y) * w + x) * 4;   // row 0 = top of the image, like a canvas
    d[i] = cl(c[0]); d[i+1] = cl(c[1]); d[i+2] = cl(c[2]); d[i+3] = c.length > 3 ? cl(c[3]) : 255;
  }
  const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat);
  const smooth = opts && opts.smooth;
  t.magFilter = t.minFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = (opts && opts.clamp) ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}
const pixTex = dataTex;
function woodTex(){
  const cn = []; for (let i = 0; i < 16; i++) cn.push(rnd());
  return pixTex(16, 64, (x, y) => {
    const s = cn[x] * 0.6 + (Math.sin(y * 0.35 + cn[x] * 6) * 0.5 + 0.5) * 0.4;
    const n = rnd() * 16; const knot = ((x * 7 + y * 3) % 53 === 0) ? -45 : 0;
    return [96 + s * 44 + n + knot, 58 + s * 28 + n * 0.7 + knot * 0.7, 32 + s * 14 + n * 0.5 + knot * 0.5];
  });
}
function metalTex(blotCount, base, spread){
  const blots = []; for (let i = 0; i < blotCount; i++) blots.push([rnd() * 16, rnd() * 16, 1.5 + rnd() * 3.5]);
  return pixTex(16, 16, (x, y) => {
    let r = 0;
    for (const b of blots) { const d = Math.hypot(x - b[0], y - b[1]); if (d < b[2]) r = Math.max(r, 1 - d / b[2]); }
    const n = base + rnd() * spread; const k = Math.min(1, r * 1.6);
    const rc = [120 + rnd() * 45, 56 + rnd() * 22, 26 + rnd() * 10];
    return [n * (1 - k) + rc[0] * k, n * (1 - k) + rc[1] * k, (n + 8) * (1 - k) + rc[2] * k];
  });
}
function tapeTex(){ return pixTex(8, 16, (x, y) => { const band = (y + x) % 6 === 0 ? -34 : 0; const n = 148 + rnd() * 26 + band; return [n, n - 4, n - 14]; }); }
function groundTex(){
  return pixTex(32, 32, (x, y) => {
    const n = rnd(); let c = [30 + n * 9, 26 + n * 7, 36 + n * 9];
    if (n > 0.97) c = [54, 47, 36];
    if (((x >> 3) + (y >> 3)) % 2 === 0) c = c.map(v => v + 3);
    return c;
  });
}
function ribbonTex(){
  return pixTex(8, 32, (x, y) => {
    const yy = y % 8; const d = Math.abs(x - 3.5) + Math.abs(yy - 3.5);
    const red = (d > 2.4 && d < 3.6) || (x === 0 || x === 7) && yy % 2 === 0;
    const n = rnd() * 14;
    return red ? [180 + n, 30 + n * 0.5, 38] : [226 + n * 0.6, 216 + n * 0.6, 196 + n * 0.5];
  });
}
// arm: armour plate tile — steel, dark seam, corner rivets, a little rust
function plateTex(){
  const blots = [[rnd() * 16, 12 + rnd() * 4, 2 + rnd() * 2], [rnd() * 16, rnd() * 16, 1.2 + rnd()]];
  return pixTex(16, 16, (x, y) => {
    let n = 150 + rnd() * 42 - y * 1.2;
    if (x === 0 || x === 15 || y === 0 || y === 15) n = 88 + rnd() * 14;
    const riv = (x === 2 || x === 13) && (y === 2 || y === 13);
    if (riv) n = 222; if ((x === 2 || x === 13) && (y === 3 || y === 14)) n = 96;
    let r = 0; for (const b of blots) { const d = Math.hypot(x - b[0], y - b[1]); if (d < b[2]) r = Math.max(r, 1 - d / b[2]); }
    const k = Math.min(1, r * 1.5);
    return [n * (1 - k) + 132 * k, n * (1 - k) + 62 * k, (n + 10) * (1 - k) + 30 * k];
  });
}
// pauldron dome: steel with a red embroidered band near the rim (uv.y 1 = crown, 0 = rim)
function paulTex(){
  return pixTex(64, 16, (x, y) => {
    let n = 150 + rnd() * 44 - (15 - y) * 0.6; let c = [n, n, n + 8];
    if (y === 5 && x % 16 < 13) c = [n - 52, n - 52, n - 46];                       // plate seam
    if (y === 11 || y === 15) c = [72 + rnd() * 12, 64, 70];
    if (y >= 12 && y <= 14) {
      const dd = Math.abs((x % 8) - 3.5) + Math.abs(y - 13);
      c = dd < 1.6 ? [190 + rnd() * 30, 186 + rnd() * 26, 176] : [176 + rnd() * 26, 30 + rnd() * 16, 38];
    }
    return c;
  });
}
// ornament boss: the peasant rhombus ("засеянное поле" with hooks), painted and worn
function ornTex(){
  const c = 15.5;
  return pixTex(32, 32, (x, y) => {
    const n = 150 + rnd() * 44; const steel = [n, n, n + 8];
    const ax = Math.abs(x - c), ay = Math.abs(y - c), d = ax + ay;
    let red = (d > 11 && d < 13.2);                                   // outer rhombus
    red = red || (d > 5 && d < 7.2);                                   // inner rhombus
    red = red || (d < 5.2 && (ax < 1 || ay < 1));                      // cross in the centre
    red = red || (Math.abs(ax - ay) < 1 && d > 7 && d < 11.2 && false);
    red = red || (Math.abs(ax - 4.5) < 1.1 && Math.abs(ay - 4.5) < 1.1); // four seeds
    red = red || ((ax < 1 && d >= 13 && d < 15.2) || (ay < 1 && d >= 13 && d < 15.2)); // spurs at the vertices
    red = red || ((ay >= 13.2 && ay < 15 && Math.abs(ax - 1.8) < 0.9) || (ax >= 13.2 && ax < 15 && Math.abs(ay - 1.8) < 0.9)); // hooks
    if (red && rnd() > 0.09) return [178 + rnd() * 34, 28 + rnd() * 18, 36 + rnd() * 8];
    return steel;
  });
}
const bgTex = dataTex(1, 64, (x, y) => {
  const k = y / 63; const a = [0x34, 0x29, 0x5a], b = [0x1c, 0x17, 0x36], c = [0x10, 0x0d, 0x1e];
  if (k < 0.55) { const u = k / 0.55; return a.map((v, i) => v + (b[i] - v) * u); }
  const u = (k - 0.55) / 0.45; return b.map((v, i) => v + (c[i] - v) * u);
}, { smooth: true, clamp: true });
const glowTex = dataTex(64, 64, (x, y) => {
  const r = Math.hypot(x - 31.5, y - 31.5) / 32;
  const a = r < 0.25 ? 1 - 0.45 * r / 0.25 : r < 1 ? 0.55 * (1 - (r - 0.25) / 0.75) : 0;
  return [255, 255, 255, a * 255];
}, { smooth: true, clamp: true });

function std(map, color, rough, metal){
  return new THREE.MeshStandardMaterial({ map: map || null, color: color === undefined ? 0xffffff : color,
    roughness: rough === undefined ? 0.85 : rough, metalness: metal || 0, flatShading: true });
}

/* ---------- scene, camera ---------- */
const scene = new THREE.Scene();
scene.background = bgTex;
scene.fog = new THREE.Fog(0x17122a, 6, 15);
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 60);
const cam = { theta: 2.25, phi: 1.33, r: 5.4, tx: -0.25, ty: 1.4, tz: 0.4, auto: !reduceMotion, dragging: false };

/* ---------- lights ---------- */
scene.add(new THREE.HemisphereLight(0xd3d9ff, 0x2a2018, 0.72));
const sun = new THREE.DirectionalLight(0xffe2c4, 0.78);        // softer key: top faces of linen and fur stay beige, not white
sun.position.set(3, 6, 2.5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 1, far: 16 });
scene.add(sun);
const rim = new THREE.DirectionalLight(0x9a7bff, 0.55); rim.position.set(-3, 2.5, -3); scene.add(rim);

/* ---------- ground + rocks ---------- */
const gTex = groundTex(); gTex.repeat.set(80, 80);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: gTex, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const rocks = []; const rockMat = std(null, 0x5d5264, 1, 0);
for (let i = 0; i < 20; i++) {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.04 + rnd() * 0.09, 0), rockMat);
  let z = -3.5 + rnd() * 7; if (Math.abs(z) < 0.7) z += 1.4 * (z < 0 ? -1 : 1);
  m.position.set(-7 + rnd() * 14, 0.02, z); m.scale.y = 0.6;
  m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); m.castShadow = true; m.receiveShadow = true;
  scene.add(m); rocks.push(m);
}

/* ================= SPEAR ================= */
/* hierarchy: root(position) > yaw > tilt > spear model; grip at the origin, shaft along +Y */
const root = new THREE.Group(); root.name = 'SpearRoot'; scene.add(root);
const yawG = new THREE.Group(); root.add(yawG);
const tiltG = new THREE.Group(); yawG.add(tiltG);
const spear = new THREE.Group(); spear.name = 'Spear'; tiltG.add(spear);   // re-parented to the cyber hand's Grip in world2b
const spearTgt = new THREE.Group(); spearTgt.name = 'SpearTarget'; tiltG.add(spearTgt);   // controller the arm IK reaches for

function addMesh(geo, mat, x, y, z){
  const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true; m.receiveShadow = true; spear.add(m); return m;
}
function cyl(rt, rb, h, seg, mat, y){ return addMesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, 0, y, 0); }
function tube(points, r, mat, seg, rad){
  const curve = new THREE.CatmullRomCurve3(points);
  const m = addMesh(new THREE.TubeGeometry(curve, seg || 32, r, rad || 5, false), mat);
  m.userData.curve = curve; return m;
}
function helix(r, y0, y1, turns, phase){
  const pts = []; const n = Math.ceil(turns * 12);
  for (let i = 0; i <= n; i++) { const k = i / n; const a = phase + k * turns * Math.PI * 2; pts.push(new V3(Math.cos(a) * r, y0 + (y1 - y0) * k, Math.sin(a) * r)); }
  return pts;
}

/* ---------- materials ---------- */
const mWood = std(woodTex()); mWood.map.repeat.set(1, 5);
const mMetal = std(metalTex(3, 115, 55), 0xffffff, 0.55, 0.55);
const mRust = std(metalTex(8, 72, 40), 0xffffff, 0.9, 0.35);
const mTape = std(tapeTex(), 0xffffff, 0.95, 0); mTape.map.repeat.set(2, 3);
const mRed = std(null, 0xc62a30, 0.7, 0.05), mBlue = std(null, 0x2c56d8, 0.7, 0.05);
const mCopper = std(null, 0xc27434, 0.45, 0.7), mDark = std(null, 0x26242c, 0.8, 0.1);

/* ---------- shaft ---------- */
cyl(0.036, 0.042, 1.95, 8, mWood, -0.025);
cyl(0.05, 0.052, 0.12, 6, mMetal, -0.98);
cyl(0.035, 0.0, 0.12, 6, mMetal, -1.1);
[-0.78, -0.4, 0.33, 0.74].forEach(y => cyl(0.05, 0.05, 0.035, 8, mMetal, y));
cyl(0.047, 0.047, 0.3, 8, mTape, 0);
cyl(0.047, 0.047, 0.22, 8, mTape, -0.62);
tube(helix(0.045, 0.18, 0.92, 3.2, 0), 0.009, mRed, 70, 4);
tube(helix(0.045, 0.18, 0.92, 3.2, Math.PI), 0.009, mBlue, 70, 4);
tube(helix(0.046, -0.94, -0.8, 1.1, 0.5), 0.009, mRed, 26, 4);
tube(helix(0.046, -0.94, -0.8, 1.1, 0.5 + Math.PI), 0.009, mBlue, 26, 4);
[-0.2, -0.24, -0.28].forEach(y => addMesh(new THREE.BoxGeometry(0.02, 0.008, 0.012), mDark, 0, y, 0.041));

// cable clamp + socket
addMesh(new THREE.BoxGeometry(0.075, 0.07, 0.1), mMetal, 0.04, -0.33, 0);
const sock = addMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.04, 6), mDark, 0.09, -0.33, 0); sock.rotation.z = Math.PI / 2;
const cableAnchor = new THREE.Object3D(); cableAnchor.position.set(0.11, -0.33, 0); spear.add(cableAnchor);

// charge indicator: 5 LEDs on the shaft
const ledOn = new THREE.MeshBasicMaterial({ color: 0x4ef3ff });
const ledOff = new THREE.MeshBasicMaterial({ color: 0x1b3a44 });
addMesh(new THREE.BoxGeometry(0.03, 0.2, 0.02), mMetal, 0, 0.52, 0.045);
const leds = [];
for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.022, 0.012), ledOff); l.position.set(0, 0.44 + i * 0.038, 0.058); spear.add(l); leds.push(l); }

/* ---------- head: collar, brackets, reactor flask ---------- */
cyl(0.062, 0.046, 0.11, 6, mMetal, 0.99);
[-1, 1].forEach(s => { const p = addMesh(new THREE.BoxGeometry(0.028, 0.15, 0.08), mRust, s * 0.07, 1.0, 0); p.rotation.z = s * 0.12; });
cyl(0.074, 0.074, 0.03, 8, mMetal, 1.07);
const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.16, 8),
  new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.28, roughness: 0.1, flatShading: true, depthWrite: false }));
glass.position.y = 1.165; spear.add(glass);
const flaskCoreMat = new THREE.MeshBasicMaterial({ color: 0xd8b0ff });
const flaskCore = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.15, 6), flaskCoreMat);
flaskCore.position.y = 1.165; spear.add(flaskCore);
tube(helix(0.042, 1.09, 1.24, 5, 0), 0.006, mCopper, 90, 4);
const capTop = cyl(0.074, 0.07, 0.03, 8, mMetal, 1.255); capTop.rotation.z = 0.07; capTop.rotation.x = -0.04;
for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; addMesh(new THREE.BoxGeometry(0.012, 0.2, 0.012), mRust, Math.cos(a) * 0.072, 1.165, Math.sin(a) * 0.072); }
cyl(0.022, 0.028, 0.05, 6, mMetal, 1.285);

/* ---------- pitchfork emitter ---------- */
tube([new V3(-0.15, 1.305, 0.03), new V3(-0.08, 1.285, -0.02), new V3(0, 1.278, -0.045), new V3(0.08, 1.285, -0.02), new V3(0.15, 1.305, 0.03)], 0.019, mRust, 24, 5);
const tineDefs = [
  [[-0.15, 1.305, 0.03], [-0.175, 1.45, 0.035], [-0.16, 1.64, 0.03], [-0.085, 1.86, 0.012], [-0.04, 1.95, 0]],
  [[0.15, 1.305, 0.03], [0.175, 1.45, 0.035], [0.16, 1.64, 0.03], [0.085, 1.86, 0.012], [0.04, 1.95, 0]],
  [[0, 1.278, -0.045], [0, 1.45, -0.085], [0, 1.68, -0.085], [0, 1.88, -0.055], [0, 1.97, -0.03]]
];
const tines = tineDefs.map(d => tube(d.map(p => new V3(p[0], p[1], p[2])), 0.013, mRust, 40, 5));
const nubMat = new THREE.MeshBasicMaterial({ color: 0xff5ce0 });
tines.forEach(t => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.02, 0), nubMat); m.position.copy(t.userData.curve.getPoint(1)); spear.add(m); });
tines.forEach(t => [0.35, 0.62].forEach(u => {
  const c = t.userData.curve; const ring = addMesh(new THREE.TorusGeometry(0.021, 0.007, 4, 8), mCopper);
  ring.position.copy(c.getPoint(u)); ring.quaternion.setFromUnitVectors(new V3(0, 0, 1), c.getTangent(u).normalize());
}));
[-0.15, 0.15].forEach(x => { const b = addMesh(new THREE.TorusGeometry(0.024, 0.006, 4, 8), mRed, x, 1.33, 0.03); b.rotation.x = Math.PI / 2; });

/* ---------- embroidered ribbon ---------- */
const ribbonPivot = new THREE.Group(); ribbonPivot.position.set(-0.05, 0.93, 0); spear.add(ribbonPivot);
const ribMat = std(ribbonTex(), 0xffffff, 0.95, 0);
[[0, 0.3], [0.035, 0.24]].forEach(([dx, len]) => {
  const g = new THREE.BoxGeometry(0.035, len, 0.004); g.translate(dx, -len / 2, 0);
  const m = new THREE.Mesh(g, ribMat); m.castShadow = true; ribbonPivot.add(m);
});
const knot = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 4, 8), mRed); knot.rotation.x = Math.PI / 2; knot.position.y = 0.93; spear.add(knot);

/* ---------- plasma blade ---------- */
const blade = new THREE.Group(); blade.position.y = 1.36; spear.add(blade);
const prof = [[0, 0], [0.045, 0.06], [0.092, 0.19], [0.1, 0.26], [0.072, 0.44], [0.036, 0.62], [0, 0.8]].map(p => new THREE.Vector2(p[0], p[1]));
function bladeGeo(sx, sy, sz){ const g = new THREE.LatheGeometry(prof, 6); g.scale(sx, sy, sz); return g; }
const coreMat = new THREE.MeshBasicMaterial({ color: 0xfff0ff });
blade.add(new THREE.Mesh(bladeGeo(0.5, 0.97, 0.28), coreMat));
const shellMat = new THREE.MeshBasicMaterial({ color: 0xff3bd4, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const shellGeo = bladeGeo(1, 1, 0.5); const shellBase = shellGeo.attributes.position.array.slice();
blade.add(new THREE.Mesh(shellGeo, shellMat));
const auraMat = new THREE.MeshBasicMaterial({ color: 0x9b4dff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const auraGeo = bladeGeo(1.45, 1.1, 0.85); const auraBase = auraGeo.attributes.position.array.slice();
const aura = new THREE.Mesh(auraGeo, auraMat); aura.position.y = -0.03; blade.add(aura);
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff4fd8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
glow.position.y = 0.3; blade.add(glow);
const plasmaLight = new THREE.PointLight(0xff4fd8, 2, 2.8, 2); plasmaLight.position.y = 0.3; blade.add(plasmaLight);
const flaskLight = new THREE.PointLight(0xb87bff, 0.8, 1.2, 2); flaskLight.position.y = 1.165; spear.add(flaskLight);
const flaskGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xb87bff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
flaskGlow.position.y = 1.165; flaskGlow.scale.set(0.35, 0.42, 1); spear.add(flaskGlow);

function jitter(geo, base, amp, t, freq){
  const p = geo.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) {
    const x = base[i], y = base[i+1], z = base[i+2];
    const n = Math.sin(y * freq + t * 17 + x * 40) * 0.5 + Math.sin(y * freq * 1.7 - t * 23 + z * 50) * 0.5;
    const k = 1 + amp * n; p[i] = x * k; p[i+1] = y + amp * 0.05 * n; p[i+2] = z * k;
  }
  geo.attributes.position.needsUpdate = true;
}

/* ---------- electric arcs (spear) ---------- */
const ARC_N = 12; const arcs = [];
function arcLine(parent, color){
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC_N * 3), 3));
  const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const l = new THREE.Line(g, m); l.visible = false; l.frustumCulled = false; parent.add(l); return { line: l, ttl: 0 };
}
for (let i = 0; i < 14; i++) arcs.push(arcLine(spear, i % 2 ? 0xffffff : 0xd49bff));
function zigzag(a, A, B, amp){
  const p = a.line.geometry.attributes.position.array; const d = B.clone().sub(A); const len = d.length();
  for (let i = 0; i < ARC_N; i++) {
    const k = i / (ARC_N - 1); const j = (i === 0 || i === ARC_N - 1) ? 0 : len * amp;
    p[i*3] = A.x + d.x * k + (R() - 0.5) * j; p[i*3+1] = A.y + d.y * k + (R() - 0.5) * j; p[i*3+2] = A.z + d.z * k + (R() - 0.5) * j;
  }
  a.line.geometry.attributes.position.needsUpdate = true; a.ttl = 0.04 + R() * 0.08;
}
function bladeSurfacePoint(){
  const h = 0.06 + R() * 0.6; let r = 0;
  for (let i = 0; i < prof.length - 1; i++) { const a = prof[i], b = prof[i+1]; if (h >= a.y && h <= b.y) { r = a.x + (b.x - a.x) * (h - a.y) / (b.y - a.y); break; } }
  const s = blade.scale; const ang = R() * Math.PI * 2;
  return new V3(Math.cos(ang) * r * s.x * 0.9, blade.position.y + h * s.y, Math.sin(ang) * r * 0.5 * s.z * 0.9);
}
function reArc(a, mode){
  let A, B;
  if (mode === 'flask') { A = new V3((R() - 0.5) * 0.05, 1.17 + (R() - 0.5) * 0.1, (R() - 0.5) * 0.05); B = bladeSurfacePoint(); }
  else {
    A = tines[(R() * 3) | 0].userData.curve.getPoint(0.3 + R() * 0.7);
    B = R() < 0.25 ? tines[(R() * 3) | 0].userData.curve.getPoint(0.3 + R() * 0.7) : bladeSurfacePoint();
  }
  zigzag(a, A, B, 0.2);
}

/* ---------- particles ---------- */
function makeParticles(n, size, additive){
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pos[i*3+1] = -99;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size, map: glowTex, vertexColors: true, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true, opacity: additive ? 1 : 0.75 });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
  return {
    n, pos, col, g, vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n), base: new Float32Array(n * 3),
    grav: additive ? -2.4 : 0.25, drag: additive ? 0.985 : 0.94, idx: 0,
    emit(p, v, life, c){
      const i = this.idx; this.idx = (this.idx + 1) % this.n; const k = i * 3;
      this.pos[k] = p.x; this.pos[k+1] = p.y; this.pos[k+2] = p.z; this.vel[k] = v.x; this.vel[k+1] = v.y; this.vel[k+2] = v.z;
      this.life[i] = life; this.max[i] = life; this.base[k] = c.r; this.base[k+1] = c.g; this.base[k+2] = c.b;
    },
    update(dt, wind){
      for (let i = 0; i < this.n; i++) {
        if (this.life[i] <= 0) continue;
        this.life[i] -= dt; const k = i * 3;
        if (this.life[i] <= 0) { this.pos[k+1] = -99; continue; }
        this.vel[k] = this.vel[k] * this.drag + wind * dt; this.vel[k+1] = this.vel[k+1] * this.drag + this.grav * dt; this.vel[k+2] *= this.drag;
        this.pos[k] += this.vel[k] * dt; this.pos[k+1] += this.vel[k+1] * dt; this.pos[k+2] += this.vel[k+2] * dt;
        if (this.pos[k+1] < 0.01) { this.pos[k+1] = 0.01; this.vel[k+1] *= -0.35; this.vel[k] *= 0.7; this.vel[k+2] *= 0.7; }
        const f = this.life[i] / this.max[i];
        this.col[k] = this.base[k] * f; this.col[k+1] = this.base[k+1] * f; this.col[k+2] = this.base[k+2] * f;
      }
      this.g.attributes.position.needsUpdate = true; this.g.attributes.color.needsUpdate = true;
    }
  };
}
const sparks = makeParticles(800, 0.045, true);
const dust = makeParticles(260, 0.14, false);
const DUST_COL = new THREE.Color(0x8a7a66), STEAM_COL = new THREE.Color(0xb4c0cc);

/* ---------- trail ribbon ---------- */
const TN = 22;
const trailPos = new Float32Array(TN * 6), trailCol = new Float32Array(TN * 6);
const tg = new THREE.BufferGeometry();
tg.setAttribute('position', new THREE.BufferAttribute(trailPos, 3)); tg.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
(function(){ const idx = []; for (let i = 0; i < TN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } tg.setIndex(idx); })();
const trail = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
trail.frustumCulled = false; trail.visible = false; scene.add(trail);
const samples = []; let trailOn = false;

/* ---------- shock rings ---------- */
const rings = [];
for (let i = 0; i < 8; i++) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.visible = false; scene.add(m); rings.push({ m, t: 0, dur: 1, s0: 0.1, s1: 1, ground: false });
}
function ring(pos, s0, s1, dur, isGround, color){
  const r = rings.find(x => !x.m.visible) || rings[0];
  r.m.visible = true; r.m.position.copy(pos); r.t = 0; r.dur = dur; r.s0 = s0; r.s1 = s1; r.ground = isGround;
  r.m.material.color.copy(color || shellCol);
  if (isGround) { r.m.rotation.set(-Math.PI / 2, 0, 0); r.m.position.y = 0.02; }
}

/* ---------- thrown plasma projectile ---------- */
const proj = { g: new THREE.Group(), active: false, t: 0, vel: new V3() };
const projShellMat = shellMat.clone(); const projGlowMat = glow.material.clone();
(function(){
  proj.g.add(new THREE.Mesh(bladeGeo(0.5, 0.97, 0.28), coreMat));
  proj.g.add(new THREE.Mesh(bladeGeo(1, 1, 0.5), projShellMat));
  const gl = new THREE.Sprite(projGlowMat); gl.position.y = 0.3; gl.scale.set(1, 1.4, 1); proj.g.add(gl);
  const pl = new THREE.PointLight(0xff4fd8, 2.5, 3, 2); pl.position.y = 0.3; proj.g.add(pl); proj.light = pl;
  proj.g.visible = false; scene.add(proj.g);
})();

/* ---------- tiers ---------- */
const TIERS = [
  { name: 'Искра',          scale: 0.5,  arcs: 2,  bright: 0.6,  shell: 0x7a3cff, core: 0xcdb8ff, aura: 0x5a2dd0, sparks: 4 },
  { name: 'Разряд',         scale: 0.72, arcs: 3,  bright: 0.8,  shell: 0xb13cff, core: 0xe8d6ff, aura: 0x7a35ff, sparks: 7 },
  { name: 'Клинок',         scale: 0.9,  arcs: 5,  bright: 1.0,  shell: 0xff3bd4, core: 0xfff0ff, aura: 0x9b4dff, sparks: 11 },
  { name: 'Буря',           scale: 1.05, arcs: 8,  bright: 1.25, shell: 0xff4fe0, core: 0xffffff, aura: 0xc04dff, sparks: 18 },
  { name: 'Солнце Перуна',  scale: 1.25, arcs: 12, bright: 1.6,  shell: 0xff7aea, core: 0xffffff, aura: 0xff5cc8, sparks: 28 }
].map(t => Object.assign(t, { shellC: new THREE.Color(t.shell), coreC: new THREE.Color(t.core), auraC: new THREE.Color(t.aura) }));
let tierIdx = 2, tierScale = TIERS[2].scale, tierBright = TIERS[2].bright;
const shellCol = TIERS[2].shellC.clone(), coreCol = TIERS[2].coreC.clone(), auraCol = TIERS[2].auraC.clone();

/* ---------- keyframe helpers (shared by spear and arm) ---------- */
function prepG(def, keys, carry){
  (carry || []).forEach(c => { if (keys[0][c] === undefined) { const f = keys.find(k => k[c] !== undefined); if (f) keys[0][c] = f[c]; } });
  let prev = Object.assign({}, def);
  return keys.map(k => { const o = Object.assign({}, prev, k); o.e = k.e || 'io'; prev = o; return o; });
}
function ease(e, u){
  if (e === 'out') return 1 - Math.pow(1 - u, 3);
  if (e === 'in') return u * u * u;
  if (e === 'lin') return u;
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}
function sampleG(def, keys, k){
  let i = 0; while (i < keys.length - 2 && k > keys[i+1].t) i++;
  const a = keys[i], b = keys[i+1]; const u = Math.max(0, Math.min(1, (k - a.t) / ((b.t - a.t) || 1))); const e = ease(b.e, u);
  const o = {};
  for (const c in def) {
    const va = a[c], vb = b[c];
    if (va === null || vb === null || va === undefined || vb === undefined) o[c] = (vb === undefined ? null : vb);
    else o[c] = va + (vb - va) * e;
  }
  return o;
}

/* ---------- spear animation data ---------- */
const CH_DEF = { w: 0, tilt: 0, roll: 0, dx: 0, dy: 0, yaw: 0, stretch: 1, glow: 0, pm: 1, speed: 0, power: null, flask: null, arc: 0 };
const prep = keys => prepG(CH_DEF, keys, ['tilt', 'roll', 'power', 'flask']);
const TAU = Math.PI * 2;
const ACTIONS = {
  thrust: { label: 'Тычок', dur: 0.65,
    keys: prep([{ t: 0 }, { t: 0.25, w: 1, tilt: -1.5, roll: 0.05, dx: -0.36, dy: 0.03, stretch: 0.9, glow: 0.4 },
      { t: 0.33, e: 'out', tilt: -1.56, roll: 0, dx: 0.62, dy: 0, stretch: 1.8, glow: 1.3 },
      { t: 0.5, tilt: -1.54, dx: 0.5, stretch: 1.25, glow: 0.6 }, { t: 1, w: 0, tilt: -1.5, dx: 0, stretch: 1, glow: 0 }]),
    ev: [[0.28, 'trailOn'], [0.33, 'impact'], [0.55, 'trailOff']] },
  sweep: { label: 'Размах', dur: 0.95,
    keys: prep([{ t: 0, tilt: -1.57 }, { t: 0.18, w: 1, tilt: -1.62, roll: 0.12, yaw: 0.55, dy: -0.12, stretch: 1.1, glow: 0.3 },
      { t: 0.68, yaw: 0.55 - TAU, roll: -0.08, stretch: 1.35, glow: 1.1 }, { t: 1, w: 0, yaw: -TAU, roll: 0, dy: 0, stretch: 1, glow: 0 }]),
    ev: [[0.2, 'trailOn'], [0.45, 'shakeS'], [0.7, 'trailOff']], emit: [0.2, 0.68, 'tip'] },
  slide: { label: 'Подкат', dur: 1.0,
    keys: prep([{ t: 0 }, { t: 0.15, e: 'out', w: 1, tilt: -1.32, roll: -0.22, dx: 0.12, dy: -0.6, speed: 7 },
      { t: 0.75, tilt: -1.28, roll: -0.18, dx: 0.18, dy: -0.58, speed: 6 }, { t: 1, w: 0, tilt: -1.1, roll: 0, dx: 0, dy: 0, speed: 0 }]),
    ev: [[0.15, 'shakeS']], emit: [0.15, 0.75, 'ground'] },
  jump: { label: 'Прыжок с ударом', dur: 1.3,
    keys: prep([{ t: 0 }, { t: 0.12, w: 0.7, tilt: -0.4, dy: -0.12 }, { t: 0.4, e: 'out', w: 1, tilt: 0.15, dy: 1.0, roll: 0 },
      { t: 0.58, tilt: -2.9, dy: 1.4, dx: 0.1 }, { t: 0.7, e: 'in', tilt: -3.1, dy: 1.0, dx: 0.22, stretch: 1.3, glow: 1 },
      { t: 0.86, tilt: -3.1, dy: 1.0, dx: 0.22, stretch: 1.1, glow: 0.5 }, { t: 1, w: 0, tilt: -0.3, dy: 0, dx: 0, stretch: 1, glow: 0 }]),
    ev: [[0.52, 'trailOn'], [0.7, 'slam'], [0.76, 'trailOff']] },
  throw: { label: 'Бросок плазмы', dur: 1.5,
    keys: prep([{ t: 0 }, { t: 0.45, w: 1, tilt: -1.42, roll: 0.1, dx: -0.32, dy: 0.12, stretch: 1.45, glow: 1.4 },
      { t: 0.52, e: 'out', tilt: -1.55, roll: 0, dx: 0.45, dy: 0, stretch: 1, glow: 0.6, pm: 0.12 },
      { t: 0.7, dx: 0.3, glow: 0.2, pm: 0.12 }, { t: 1, w: 0, dx: 0, glow: 0, pm: 1, stretch: 1 }]),
    ev: [[0.5, 'launch']], emit: [0.08, 0.45, 'charge'], shake: [0.3, 0.48] },
  on: { label: 'Активация', dur: 1.8,
    keys: prep([{ t: 0, power: 0, flask: 0.2 }, { t: 0.35, w: 0.6, tilt: -0.08, roll: 0.05, power: 0, flask: 1.4, arc: 4 },
      { t: 0.58, power: 0.12, flask: 1.2, arc: 8 }, { t: 0.75, e: 'out', power: 1.3, flask: 1, arc: 6, glow: 1 },
      { t: 0.86, power: 0.92, glow: 0.5, arc: 2 }, { t: 1, w: 0, power: 1, flask: 1, arc: 0, glow: 0 }]),
    ev: [[0.75, 'ignite']], shake: [0.4, 0.72] },
  off: { label: 'Отключение', dur: 0.7,
    keys: prep([{ t: 0, power: 1, flask: 1 }, { t: 0.3, power: 1.1, flask: 1, arc: 5, glow: 0.6 }, { t: 1, e: 'in', power: 0, flask: 0.15, arc: 0, glow: 0 }]),
    ev: [[0.95, 'fizzle']] }
};
