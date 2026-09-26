
/* =====================================================================
   HERO BODY (static stage). Everything lives in ArmFrame coordinates:
   +X = hero's left (cyber side), +Y up, +Z forward; frame origin = spear grip
   (held by the cyber hand; the spear is parented to Hand > Grip),
   ground at y = GY. Skeleton: Hips > Spine > Chest > Neck > Head,
   Chest > RightShoulder > RightUpperArm > RightForearm > RightHand,
   Chest > Shoulder (cyber arm) > ... > Hand > Grip > Spear, Hips > Left/RightUpLeg > Left/RightLeg > Left/RightFoot.
   ===================================================================== */
/* ---------- textures ---------- */
function linen(){ const n = rnd() * 18; return [182 + n, 162 + n * 0.9, 127 + n * 0.7]; }   // warm beige, never white under the key light
function stitchRed(){ return [176 + rnd() * 30, 30 + rnd() * 16, 38 + rnd() * 8]; }
const skinTex = pixTex(8, 8, () => { const n = rnd() * 14; return [196 + n, 140 + n * 0.8, 108 + n * 0.6]; });
// hat patch: linen with a red notched rhombus, a cross in the middle and chevrons at the sides
const HAT_ORN = [
  '................',
  '......#.#.......',
  '.....#...#......',
  '..#.#..#..#.#...',
  '.#.#..###..#.#..',
  '..#.#..#..#.#...',
  '.....#...#......',
  '......#.#.......',
  '................',
  '................'
];
const hatOrnTex = pixTex(16, 12, (x, y) => (y === 0 || y === 11 || HAT_ORN[y - 1][x] === '#') ? stitchRed() : linen());
const ropeTex = pixTex(8, 8, (x, y) => { const s = ((x + y) % 4 < 2) ? 18 : -10; const n = rnd() * 12; return [126 + s + n, 92 + s * 0.8 + n, 52 + s * 0.5 + n * 0.5]; });
const pantsTex = pixTex(16, 32, (x, y) => {
  const n = rnd() * 14; let c = [56 + n, 56 + n, 64 + n];
  if (y === 22 || y === 27) c = stitchRed();
  if (y > 22 && y < 27 && Math.abs((x % 4) - 1.5) + Math.abs(y - 24.5) < 1.7) c = stitchRed();
  if (x % 8 === 0) c = c.map(v => v - 10);
  return c;
});
// leg wraps under the shin armour: dark leather bands wound round the leg, overlapping at a slant
const onuchiTex = pixTex(16, 32, (x, y) => {
  const band = ((y + (x >> 2)) >> 2) % 2, seam = (y + (x >> 2)) % 4 === 0;
  const n = rnd() * 12 + (band ? 10 : 0) - (seam ? 16 : 0);
  return [70 + n, 55 + n * 0.85, 46 + n * 0.7];
});
// bast straps and lashings: light, slightly twisted
const bastTex = pixTex(8, 8, (x, y) => { const s = ((x + y * 2) % 5 === 0) ? -26 : 0; const n = rnd() * 14; return [196 + s + n, 166 + s + n, 112 + s * 0.7 + n * 0.6]; });
const laptiTex = pixTex(16, 16, (x, y) => {
  const w = ((x >> 1) + (y >> 1)) % 2; const n = rnd() * 16;
  const e = (x % 2 === 0 || y % 2 === 0) ? -18 : 0;
  return w ? [170 + n + e, 108 + n * 0.8 + e, 52 + n * 0.4 + e] : [140 + n + e, 86 + n * 0.8 + e, 40 + n * 0.4 + e];   // rusty-brown bast weave
});
const leatherTex = pixTex(8, 8, () => { const n = rnd() * 16; return [86 + n, 56 + n * 0.8, 36 + n * 0.5]; });

const mSkin = std(skinTex, 0xffffff, 0.85, 0);
const mHatOrn = std(hatOrnTex, 0xffffff, 0.95, 0);
const mRope = std(ropeTex, 0xffffff, 1, 0); mRope.map.repeat.set(6, 1);
const mPants = std(pantsTex, 0xffffff, 0.95, 0);
const mOnuchi = std(onuchiTex, 0xffffff, 0.95, 0);
const mLapti = std(laptiTex, 0xffffff, 1, 0);
const mBast = std(bastTex, 0xffffff, 1, 0);
const mLeather = std(leatherTex, 0xffffff, 0.9, 0);
const mBrow = std(null, 0x4a2c1c, 1, 0);

/* ---------- shape helpers: chamfered loft & skewed box ----------
   A ring = { y, w (X), d (Z), x, z (centre offset), c (corner chamfer) }.
   loftGeo stitches rings bottom→top into a faceted solid with flat normals.
   UVs: u runs round the perimeter from the back centre, v runs along the rings;
   ku / kv switch either to world units (texels stay the same size on every part). */
function ringPts(r){
  const hw = r.w / 2, hd = r.d / 2, c = Math.max(0.002, Math.min(r.c || 0.002, hw * 0.9, hd * 0.9));
  const x0 = r.x || 0, z0 = r.z || 0;
  return [[0, -hd], [hw - c, -hd], [hw, -hd + c], [hw, hd - c], [hw - c, hd], [-hw + c, hd], [-hw, hd - c], [-hw, -hd + c], [-hw + c, -hd], [0, -hd]]
    .map(p => new V3(x0 + p[0], r.y, z0 + p[1]));
}
function loftGeo(rings, opts){
  opts = opts || {};
  const P = rings.map(ringPts), n = rings.length, pos = [], uv = [];
  const U = P.map(ps => { const a = [0]; for (let j = 1; j < ps.length; j++) a.push(a[j - 1] + ps[j].distanceTo(ps[j - 1])); return a; });
  const C = rings.map(r => new V3(r.x || 0, r.y, r.z || 0));
  const Vc = [0]; for (let i = 1; i < n; i++) Vc.push(Vc[i - 1] + C[i].distanceTo(C[i - 1]));
  const uOf = (i, j) => opts.planarU ? (P[i][j].x - (rings[i].x || 0)) / rings[i].w + 0.5 : opts.ku ? U[i][j] * opts.ku : U[i][j] / U[i][U[i].length - 1];
  const vOf = i => opts.kv ? Vc[i] * opts.kv : (Vc[n - 1] > 0 ? Vc[i] / Vc[n - 1] : 0);
  const e1 = new V3(), e2 = new V3(), nn = new V3(), o = new V3();
  function tri(a, b, c, ta, tb, tc, ref){
    nn.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
    if (nn.dot(ref) < 0) { const t = b; b = c; c = t; const s = tb; tb = tc; tc = s; }
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); uv.push(ta[0], ta[1], tb[0], tb[1], tc[0], tc[1]);
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < 9; j++) {
    const a = P[i][j], b = P[i][j + 1], c = P[i + 1][j + 1], d = P[i + 1][j];
    const mid = a.clone().add(b).add(c).add(d).multiplyScalar(0.25), cc = C[i].clone().add(C[i + 1]).multiplyScalar(0.5);
    o.set(mid.x - cc.x, 0, mid.z - cc.z);
    const ta = [uOf(i, j), vOf(i)], tb = [uOf(i, j + 1), vOf(i)], tc = [uOf(i + 1, j + 1), vOf(i + 1)], td = [uOf(i + 1, j), vOf(i + 1)];
    tri(a, b, c, ta, tb, tc, o); tri(a, c, d, ta, tc, td, o);
  }
  if (opts.caps !== false) for (const [i, sy] of [[0, -1], [n - 1, 1]]) {
    const ps = P[i], cu = opts.ku || 1, cv = opts.kv || 1, c0 = opts.cv0 || 0;
    o.set(0, sy * (rings[n - 1].y >= rings[0].y ? 1 : -1), 0);
    for (let j = 0; j < 9; j++) tri(C[i], ps[j], ps[j + 1], [C[i].x * cu, C[i].z * cv + c0], [ps[j].x * cu, ps[j].z * cv + c0], [ps[j + 1].x * cu, ps[j + 1].z * cv + c0], o);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
// skewed box: bottom wb×db, top wt×dt, top shifted by (ox, oz), height h, chamfer c
function skewBox(wb, db, wt, dt, h, ox, oz, c, opts){
  return loftGeo([{ y: 0, w: wb, d: db, c: c }, { y: h, w: wt, d: dt, x: ox || 0, z: oz || 0, c: c }], opts);
}
function loft(parent, rings, mat, opts, x, y, z){ return put(parent, loftGeo(rings, opts), mat, x, y, z); }
function sbox(parent, wb, db, wt, dt, h, ox, oz, c, mat, x, y, z, opts){ return put(parent, skewBox(wb, db, wt, dt, h, ox, oz, c, opts), mat, x, y, z); }
// ring of a lofted surface at height y (rings may run up or down)
function ringAt(rings, y){
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i], b = rings[i + 1];
    if ((y - a.y) * (y - b.y) <= 0) {
      const t = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y), l = k => lerp(a[k] || 0, b[k] || 0, t);
      return { y, w: l('w'), d: l('d'), x: l('x'), z: l('z'), c: l('c') };
    }
  }
  const r = Math.abs(y - rings[0].y) < Math.abs(y - rings[rings.length - 1].y) ? rings[0] : rings[rings.length - 1];
  return Object.assign({}, r, { y });
}
function inflate(r, t){ return Object.assign({}, r, { w: r.w + 2 * t, d: r.d + 2 * t, c: (r.c || 0) + t * 0.6 }); }
// raised band hugging a lofted surface between y0 and y1
function bandRings(rings, y0, y1, t){
  const ys = [y0, y1].concat(rings.map(r => r.y).filter(y => (y - y0) * (y - y1) < 0)).sort((a, b) => a - b);
  return ys.map(y => inflate(ringAt(rings, y), t));
}
// raised vertical strip on the front (side = 1) or back (side = -1) face of a lofted surface (x = horizontal position)
function frontStripRings(rings, x, y0, y1, w, t, side){
  side = side || 1;
  const ys = [y0, y1].concat(rings.map(r => r.y).filter(y => (y - y0) * (y - y1) < 0)).sort((a, b) => a - b);
  return ys.map(y => {
    const r = ringAt(rings, y), hw = r.w / 2, c = r.c || 0;
    const cut = Math.max(0, Math.abs(x - (r.x || 0)) + w / 2 - (hw - c));        // follow the chamfer, not the bounding box
    return { y, w, d: 2 * t, x, z: (r.z || 0) + side * (r.d / 2 - cut - 0.006 + t), c: 0.004 };
  });
}
// point + outward normal on a ring's perimeter at fraction u (0 = back centre)
function ringPtAt(r, u){
  const ps = ringPts(r), L = [0]; for (let j = 1; j < ps.length; j++) L.push(L[j - 1] + ps[j].distanceTo(ps[j - 1]));
  const s = ((u % 1) + 1) % 1 * L[L.length - 1]; let j = 0; while (j < 8 && L[j + 1] < s) j++;
  const t = (s - L[j]) / Math.max(1e-6, L[j + 1] - L[j]), p = ps[j].clone().lerp(ps[j + 1], t);
  const tg = ps[j + 1].clone().sub(ps[j]).normalize(), nrm = new V3(tg.z, 0, -tg.x);
  if (nrm.x * (p.x - (r.x || 0)) + nrm.z * (p.z - (r.z || 0)) < 0) nrm.negate();
  return { p, n: nrm };
}
// cloth fold: a wedge standing on a lofted surface, from (u0, y0) at the bottom to (u1, y1) at the top
function surfFold(parent, rings, u0, y0, u1, y1, wb, wt, t, mat, name){
  const bot = ringPtAt(ringAt(rings, y0), u0), top = ringPtAt(ringAt(rings, y1), u1);
  const f = hgrp(parent, name || 'Fold', bot.p.x, bot.p.y, bot.p.z);
  f.rotation.y = Math.atan2(bot.n.x, bot.n.z);
  const dlt = top.p.clone().sub(bot.p), tg = new V3(bot.n.z, 0, -bot.n.x);
  sbox(f, wb, t * 2, wt, t * 1.6, dlt.y, dlt.dot(tg), dlt.dot(bot.n) + 0.002, t * 0.9, mat, 0, 0, 0.002, LIN);   // big chamfer: a soft ridge, not a plate
  return f;
}

/* ---------- stage-2 textures (texel ≈ 0.01 unit, world-scaled UVs) ---------- */
// linen: warm beige; faint weave lines and a darker thread every few rows
const linenTex = pixTex(16, 16, (x, y) => { const n = rnd() * 14 + (((x + y * 3) % 5 === 0) ? -12 : 0) + ((y % 4 === 0) ? -6 : 0); return [188 + n, 167 + n * 0.92, 131 + n * 0.75]; });
// dense continuous cross-stitch band: red borders, a chain of rhombuses with hooks, little free cloth
function embTexFn(x, y){
  if (y === 0 || y === 7) return stitchRed();
  const px = x % 8, d = Math.abs(px - 3.5) + Math.abs(y - 3.5);
  let red = (d > 1.9 && d < 3.1) || d < 0.9 || (px === 7 && (y === 3 || y === 4)) || ((y === 1 || y === 6) && (px === 0 || px === 7));
  if (y === 1 || y === 6) red = red || (x % 2 === 0);
  return red ? stitchRed() : linen();
}
const embTex = pixTex(32, 8, embTexFn);
// hem band from the reference: stepped hills with a seed on a double line, a small comb below
function hemTexFn(x, y){
  const d = Math.abs((x % 10) - 4.5); let red = false;
  if (y === 7 || y === 8) red = true;
  else if (y >= 1 && y <= 6) { const half = y; red = Math.abs(d - (half - 0.5)) < 0.6 || (y === 1 && d < 1) || (y === 5 && d < 0.6); }
  else if (y === 10) red = (x % 5) % 2 === 1;
  else if (y === 11) red = (x % 5) === 2;
  return red ? stitchRed() : linen();
}
const hemTex = pixTex(40, 12, hemTexFn);
// sleeve band / plackets from the reference: concentric rhombuses joined by bars, between dotted borders
function bandTexFn(x, y){
  if (y === 0 || y === 15) return stitchRed();
  if (y === 1 || y === 14) return x % 2 ? linen() : stitchRed();
  const px = x % 14, d = Math.abs(px - 6.5) + Math.abs(y - 7.5);
  return (d === 6 || d === 3 || d === 1 || ((px === 0 || px === 13) && Math.abs(y - 7.5) < 1)) ? stitchRed() : linen();
}
const bandTex = pixTex(28, 16, bandTexFn);
const bandTexV = pixTex(16, 28, (x, y) => bandTexFn(y, x));
// ushanka fur: light grey-brown, big 2×2 clumps with darker partings (coarse noise)
const FUR_PAL = [[80, 68, 62], [108, 94, 84], [134, 119, 106], [160, 146, 130]];   // warm grey-brown, as on the reference
const furClump = []; for (let i = 0; i < 64; i++) furClump.push(rnd());
const furTex2 = pixTex(16, 16, (x, y) => {
  const cl = furClump[((y >> 1) * 8 + (x >> 1) + ((y >> 2) & 1)) % 64];
  const part = ((x >> 1) + (y >> 1) * 3) % 7 === 0;
  const k = part ? 0 : cl < 0.25 ? 1 : cl < 0.7 ? 2 : 3;
  return FUR_PAL[k].map(v => v + rnd() * 6);
});
// beard: dark, warm, reddish; fine per-texel noise with vertical strands
const BEARD_PAL = [[50, 28, 16], [74, 40, 21], [98, 55, 28], [126, 72, 36]];
const beardTex2 = pixTex(16, 16, (x, y) => {
  const strand = (x + ((y >> 2) & 1)) % 3 === 0 ? -1 : 0;
  const k = Math.max(0, Math.min(3, ((rnd() * 3.4) | 0) + strand));
  return BEARD_PAL[k].map(v => v + rnd() * 6);
});
const mLinen = std(linenTex, 0xffffff, 0.95, 0);
const mLinenD = std(linenTex, 0xc9b9a6, 0.95, 0);   // fold shadow tone
const mEmb = std(embTex, 0xffffff, 0.9, 0);
const embTexV = pixTex(8, 32, (x, y) => embTexFn(y, x));
const mEmbV = std(embTexV, 0xffffff, 0.9, 0);
const mEmbHem = std(hemTex, 0xffffff, 0.9, 0), mEmbBand = std(bandTex, 0xffffff, 0.9, 0), mEmbBandV = std(bandTexV, 0xffffff, 0.9, 0);
const mFur2 = std(furTex2, 0xffffff, 1, 0);
const mBeard2 = std(beardTex2, 0xffffff, 1, 0);
const mEyeW = std(null, 0xe4ddd0, 0.6, 0), mPupil = std(null, 0x1c2230, 0.5, 0), mMouth = std(null, 0x3a1c16, 0.9, 0);
const mIris = std(null, 0x3d6fa8, 0.4, 0);
const mSkinD = std(skinTex, 0xd9b7a5, 0.85, 0);   // shaded skin for recesses
const LIN = { ku: 6, kv: 6 }, FUR = { ku: 4.5, kv: 4.5 }, BEARD = { ku: 12, kv: 12 };


function hgrp(parent, name, x, y, z){ const g = new THREE.Group(); g.name = name; g.position.set(x || 0, y || 0, z || 0); parent.add(g); return g; }
function hcyl(parent, rt, rb, h, seg, mat, x, y, z, sz){ const m = put(parent, new THREE.CylinderGeometry(rt, rb, h, seg || 8), mat, x, y, z); if (sz) m.scale.z = sz; return m; }

/* ---------- proportions (by the reference): knee at ~27 % of the height, hem-to-sole ~44 %, head ~0.85 of stage 1.1 ----------
   Thigh THIGH, shin SHIN (knee → ankle), chunky lapti FOOT_H tall (ankle → sole). The grip stays at belt height. */
const THIGH = 0.57, SHIN = 0.5, FOOT_H = 0.2;
const KNEE_H = SHIN * Math.cos(0.13) + FOOT_H;   // knee pivot above the sole (the shin leans out by 0.13 rad)
const BX = -0.64, BZ = -0.36;                 // body centre relative to the grip: the spear stands in front of the left hip, clear of the body
const HIP_Y = -0.12;
const GY = HIP_Y - 0.08 - THIGH * Math.cos(0.17) - KNEE_H;  // ground level in ArmFrame
const GRIP_H = -GY;                           // grip height above the ground (the spear's rest height in world3)
const CH_Y0 = -0.3;                           // chest-local height of the belt line
const CYBER_SH = new V3(0.4, 0.235, 0);      // cyber shoulder joint, chest-local

/* ---------- skeleton (pivots: head, shoulders, elbows, wrists, hips, knees, ankles) ---------- */
const hips = hgrp(armFrame, 'Hips', BX, HIP_Y, BZ);
const spine = hgrp(hips, 'Spine', 0, 0.12, 0);
spine.rotation.y = -0.15;                     // slight turn: spear shoulder leads
const chest = hgrp(spine, 'Chest', 0, 0.3, 0);
const neck = hgrp(chest, 'Neck', 0, 0.335, 0.04);
neck.rotation.y = 0.1;                        // head looks straight ahead again
const head = hgrp(neck, 'Head', 0, 0.16, 0);
const headGeo = hgrp(head, 'HeadMesh', 0, 0, 0); headGeo.scale.setScalar(1.06);   // head 15 % smaller than stage 1.1, as on the reference
chest.add(shoulderG); shoulderG.position.copy(CYBER_SH);

/* ---------- torso & shirt: straight chest, shoulders slope into the sleeves ---------- */
// chest-local rings (belt line at CH_Y0 = -0.3); the shoulder width comes from the sleeves, not from the torso
const TORSO = [
  { y: -0.30,  w: 0.535, d: 0.38, z: 0.0,   c: 0.08 },   // belt line: narrower than the rope, so the belt sits on the cloth
  { y: -0.14,  w: 0.61,  d: 0.45, z: 0.01,  c: 0.085 },
  { y:  0.03,  w: 0.72,  d: 0.5,  z: 0.025, c: 0.095 },  // chest: broad, as on the reference
  { y:  0.15,  w: 0.735, d: 0.49, z: 0.02,  c: 0.095 },  // armpits: the sleeves take over from here
  { y:  0.235, w: 0.665, d: 0.44, z: 0.018, c: 0.09 },   // shoulder points
  { y:  0.295, w: 0.5,   d: 0.37, z: 0.02,  c: 0.08 },   // shoulders fall to the neck
  { y:  0.345, w: 0.32,  d: 0.28, z: 0.025, c: 0.07 }    // neck base
];
const shirt = hgrp(chest, 'Shirt', 0, 0, 0);
loft(shirt, TORSO, mLinen, LIN);
// hem: flares below the belt to the upper thigh, closed by pleats and a wide embroidered band
const HEM_B = -0.645;
const HEM = [
  { y: -0.285, w: 0.55, d: 0.39, c: 0.08 },
  { y: -0.45, w: 0.68, d: 0.50, c: 0.10 },
  { y: HEM_B, w: 0.84, d: 0.6, c: 0.13 }
];
const hem = hgrp(shirt, 'Hem', 0, 0, 0);
loft(hem, HEM, mLinen, LIN);
const FOLD_T = 0.022;
for (let k = 0; k < 10; k++) {                                    // pleats: wedges growing toward the hem edge
  const u = (k + 0.5) / 10 + (k % 2 ? 0.012 : -0.012);
  const top = ringPtAt(ringAt(HEM, -0.33), u), bot = ringPtAt(ringAt(HEM, HEM_B + 0.01), u);
  const f = hgrp(hem, 'Pleat' + k, bot.p.x, bot.p.y, bot.p.z);
  f.rotation.y = Math.atan2(bot.n.x, bot.n.z);
  const dlt = top.p.clone().sub(bot.p), tg = new V3(bot.n.z, 0, -bot.n.x);
  const wb = k % 2 ? 0.11 : 0.085;
  sbox(f, wb, FOLD_T * 2, 0.035, FOLD_T, dlt.y, dlt.dot(tg), dlt.dot(bot.n) + 0.004, 0.012, mLinen, 0, 0, 0.004, LIN);
}
loft(hem, bandRings(HEM, HEM_B + 0.02, HEM_B + 0.1, FOLD_T + 0.012), mEmbHem, { ku: 3.1 });  // wide hem band: hills on a line
loft(hem, bandRings(HEM, HEM_B, HEM_B + 0.02, FOLD_T + 0.016), mRed, {});                   // red edging
loft(hem, bandRings(HEM, HEM_B + 0.118, HEM_B + 0.13, FOLD_T + 0.01), mRed, {});            // thin line above the band
loft(shirt, [inflate(ringAt(TORSO, -0.3), 0.004), inflate(ringAt(TORSO, -0.24), 0.012), inflate(ringAt(TORSO, -0.16), 0.0)], mLinen, LIN);   // shirt bloused over the belt (the rope stays visible all round)
// chest folds: tension creases from the armpits toward the belt, short drape folds above the belt
for (const s of [-1, 1]) {
  const uf = u => 0.5 - s * u;                                    // perimeter fraction on this side of the front
  surfFold(shirt, TORSO, uf(0.1), -0.2, uf(0.15), 0.12, 0.1, 0.05, 0.007, mLinen, 'ChestFold');          // broad low swell of cloth under the arm
  surfFold(shirt, TORSO, uf(0.11), -0.05, uf(0.155), 0.1, 0.026, 0.006, 0.0035, mLinenD, 'ChestCrease');   // shadow creases fanning from the armpit
  surfFold(shirt, TORSO, uf(0.13), -0.14, uf(0.163), 0.03, 0.022, 0.005, 0.0035, mLinenD, 'ChestCrease');
  for (const u of [0.04, 0.1]) surfFold(shirt, TORSO, uf(u), -0.27, uf(u + 0.01), -0.17, 0.02, 0.006, 0.0035, mLinenD, 'BlouseCrease');   // cloth bunched above the belt
}
// embroidered ring round the neckline (lies on the shoulders, not a standing collar)
const collarRing = hgrp(shirt, 'Collar', 0, 0, 0);
loft(collarRing, bandRings(TORSO, 0.283, 0.35, 0.012), mEmb, { ku: 3.1, caps: false });
loft(collarRing, bandRings(TORSO, 0.271, 0.285, 0.016), mRed, { caps: false });
// neck slit off-centre (on his right): two straight embroidered plackets, the dark slit between them, no turn at the bottom
const SLIT_X = -0.06;
for (const s of [-1, 1]) loft(shirt, frontStripRings(TORSO, SLIT_X + s * 0.052, -0.03, 0.3, 0.08, 0.012), mEmbBandV, { planarU: true, kv: 7 });
loft(shirt, frontStripRings(TORSO, SLIT_X, 0.1, 0.31, 0.022, 0.016), mDark, {});
// shoulder seam bands: from the neckline ring out to the sleeve (right) and to the cyber mount (left)
for (const s of [-1, 1]) {
  const A = new V3(s * 0.15, 0.345, 0.02), B = new V3(s * 0.345, 0.245, 0.02), L = A.distanceTo(B);
  const g = hgrp(shirt, s < 0 ? 'ShoulderBandR' : 'ShoulderBandL', A.x, A.y - 0.004, A.z);
  g.rotation.z = s * Math.atan2(B.y - A.y, Math.abs(B.x - A.x));
  sbox(g, L + 0.02, 0.09, L + 0.02, 0.085, 0.02, 0, 0, 0.01, mEmb, s * L / 2, 0, 0, { ku: 3.1, kv: 11, cv0: 0.5 });
}
// armhole trim on the cyber side: the shirt ends in an embroidered edge where the steel arm comes out
for (const side of [1, -1]) loft(shirt, frontStripRings(TORSO, 0.302, 0.06, 0.25, 0.05, 0.012, side), mEmbV, { planarU: true, kv: 2.8 });
put(chest, new THREE.BoxGeometry(0.05, 0.2, 0.2), mDark, CYBER_SH.x - 0.02, CYBER_SH.y, 0);   // socket of the cyber mount

/* ---------- neck: short and thick, mostly behind the beard ---------- */
loft(neck, [{ y: -0.04, w: 0.23, d: 0.22, c: 0.05 }, { y: 0.07, w: 0.21, d: 0.2, c: 0.05 }, { y: 0.14, w: 0.2, d: 0.19, z: 0.005, c: 0.045 }], mSkin, LIN);

/* ---------- head (HeadMesh local, scale 1.06): face 20 % larger than stage 1, pushed out from under the hat ---------- */
const HEAD = [
  { y: -0.125, w: 0.16,  d: 0.17,  z: 0.012, c: 0.04 },
  { y: -0.045, w: 0.215, d: 0.225, z: 0.008, c: 0.05 },
  { y:  0.065, w: 0.22,  d: 0.225, z: 0.004, c: 0.05 },
  { y:  0.15,  w: 0.2,   d: 0.205, c: 0.05 }
];
loft(headGeo, HEAD, mSkin, LIN);
const face = hgrp(headGeo, 'Face', 0, 0, 0.113); face.scale.setScalar(1.2);   // front plane of the face
sbox(face, 0.165, 0.045, 0.15, 0.04, 0.03, 0, 0.004, 0.01, mSkin, 0, 0.035, 0.008, LIN);   // brow ridge
put(face, new THREE.BoxGeometry(0.1, 0.006, 0.01), mSkinD, 0, 0.074, 0.0);                  // forehead creases
put(face, new THREE.BoxGeometry(0.075, 0.005, 0.01), mSkinD, 0.004, 0.084, -0.002);
for (const s of [-1, 1]) {
  put(face, new THREE.BoxGeometry(0.06, 0.028, 0.012), mSkinD, s * 0.04, 0.02, -0.002);       // eye socket shadow
  put(face, new THREE.BoxGeometry(0.032, 0.016, 0.01), mEyeW, s * 0.042, 0.02, 0.003);
  put(face, new THREE.BoxGeometry(0.015, 0.016, 0.01), mIris, s * 0.038, 0.019, 0.005);       // blue iris
  put(face, new THREE.BoxGeometry(0.006, 0.008, 0.01), mPupil, s * 0.037, 0.019, 0.007);
  put(face, new THREE.BoxGeometry(0.038, 0.008, 0.014), mSkinD, s * 0.042, 0.029, 0.007);     // heavy upper lid
  const br = put(face, new THREE.BoxGeometry(0.075, 0.024, 0.032), mBrow, s * 0.042, 0.061, 0.02); br.rotation.z = s * 0.22;   // heavy frowning brows
  sbox(face, 0.05, 0.03, 0.04, 0.02, 0.03, s * 0.006, -0.004, 0.008, mSkin, s * 0.062, -0.012, 0.004, LIN);                // cheekbones
  put(headGeo, new THREE.BoxGeometry(0.03, 0.05, 0.035), mSkin, s * 0.118, 0.015, 0.0);        // ears
  put(face, new THREE.BoxGeometry(0.008, 0.006, 0.006), mMouth, s * 0.011, -0.054, 0.058);     // nostrils
}
sbox(face, 0.048, 0.055, 0.03, 0.028, 0.07, 0, -0.012, 0.01, mSkin, 0, -0.045, 0.022, LIN);   // nose, juts forward
put(face, new THREE.BoxGeometry(0.042, 0.026, 0.034), mSkin, 0, -0.041, 0.046);                // bulbous nose tip

/* ---------- tufts: small blunt blocky clumps standing on a surface; they break the outline of fur and beard ---------- */
const Y_UP = new V3(0, 1, 0);
function tuft(parent, p, dir, size, mat, twist){
  const m = put(parent, new THREE.CylinderGeometry(size * 0.32, size * 0.5, size * 0.6, 4), mat, p.x, p.y, p.z);   // tapered block
  m.quaternion.setFromUnitVectors(Y_UP, dir.clone().normalize());
  m.rotateY(twist); m.translateY(size * 0.12);
  return m;
}
function tuftRing(parent, rings, y, n, skip, size, lift, mat, jit){
  for (let k = 0; k < n; k++) {
    const u = (k + 0.5) / n + (rnd() - 0.5) * 0.4 / n;
    if (skip && skip(u)) continue;
    const q = ringPtAt(ringAt(rings, y + (rnd() - 0.5) * (jit || 0)), u);
    tuft(parent, q.p, q.n.clone().add(new V3(0, lift, 0)), size * (0.75 + rnd() * 0.5), mat, rnd() * 3);
  }
}

/* ---------- beard: from the cheekbones down, short and boxy, ends on the collar; warm red-brown, fine grain ---------- */
const beard = hgrp(headGeo, 'Beard', 0, 0, 0);
for (const s of [-1, 1]) loft(beard, [{ y: -0.06, w: 0.03, d: 0.13, x: s * 0.106, z: 0.02, c: 0.01 }, { y: 0.06, w: 0.024, d: 0.1, x: s * 0.108, c: 0.008 }], mBeard2, BEARD);   // narrow sideburns
const JAW = [{ y: -0.15, w: 0.24, d: 0.2, z: 0.05, c: 0.06 }, { y: -0.035, w: 0.245, d: 0.2, z: 0.032, c: 0.058 }];
loft(beard, JAW, mBeard2, BEARD);                                                                        // L1 jaw, up to the cheekbones
const CHIN = [{ y: -0.205, w: 0.21, d: 0.15, z: 0.1, c: 0.055 }, { y: -0.12, w: 0.245, d: 0.17, z: 0.085, c: 0.06 }];
loft(beard, CHIN, mBeard2, BEARD);                                                                       // L2 chin mass
loft(beard, [{ y: -0.235, w: 0.12, d: 0.08, z: 0.12, c: 0.03 }, { y: -0.18, w: 0.17, d: 0.11, z: 0.115, c: 0.045 }], mBeard2, BEARD);  // L3 tip
tuftRing(beard, CHIN, -0.2, 14, u => u < 0.2 || u > 0.8, 0.034, -1.6, mBeard2, 0.01);                 // strands hanging from the chin mass
tuftRing(beard, JAW, -0.12, 10, u => u > 0.3 && u < 0.7, 0.028, -0.9, mBeard2, 0.04);                  // ragged sides of the jaw
for (const s of [-1, 1]) {                                                                    // moustache: thick, droops past the mouth into the beard
  const m = hgrp(beard, s < 0 ? 'MoustacheR' : 'MoustacheL', s * 0.027, -0.066, 0.153);
  loft(m, [{ y: -0.098, w: 0.05, d: 0.044, x: s * 0.058, z: 0.012, c: 0.014 }, { y: -0.035, w: 0.066, d: 0.046, x: s * 0.034, z: 0.006, c: 0.015 }, { y: 0.0, w: 0.078, d: 0.04, c: 0.013 }], mBeard2, BEARD);
}
put(beard, new THREE.BoxGeometry(0.06, 0.016, 0.01), mMouth, 0, -0.1, 0.157);

/* ---------- ushanka: big round fur hat as on the reference, turned-up front flap with the patch, long ear flaps clear of the beard ---------- */
const hat = hgrp(headGeo, 'Ushanka', 0, 0.117, -0.005);
const HAT_BAND = [{ y: 0, w: 0.345, d: 0.345, c: 0.1 }, { y: 0.075, w: 0.355, d: 0.355, c: 0.105 }];
loft(hat, HAT_BAND, mFur2, FUR);                                                              // fur band
const DOME = [{ y: 0.07, w: 0.34, d: 0.34, c: 0.1 }, { y: 0.115, w: 0.325, d: 0.325, c: 0.1 }, { y: 0.15, w: 0.28, d: 0.28, c: 0.09 }, { y: 0.178, w: 0.2, d: 0.2, c: 0.07 }, { y: 0.192, w: 0.11, d: 0.11, c: 0.04 }];
loft(hat, DOME, mFur2, FUR);                                                                  // round crown
const flapF = hgrp(hat, 'HatFlapFront', 0, 0.0, 0.15); flapF.rotation.x = -0.18;
const FLAP_F = [{ y: 0, w: 0.37, d: 0.075, c: 0.028 }, { y: 0.07, w: 0.365, d: 0.072, z: 0.003, c: 0.028 }, { y: 0.145, w: 0.33, d: 0.062, z: -0.01, c: 0.024 }];
loft(flapF, FLAP_F, mFur2, FUR);
const patch = hgrp(flapF, 'HatPatch', 0, 0.07, 0.038);
put(patch, new THREE.BoxGeometry(0.175, 0.1, 0.018), mRed, 0, 0, 0.003);
put(patch, new THREE.BoxGeometry(0.158, 0.086, 0.026), [mLinen, mLinen, mLinen, mLinen, mHatOrn, mLinen], 0, 0, 0.01);
const EAR = [{ y: -0.27, w: 0.07, d: 0.1, z: -0.012, c: 0.03 }, { y: -0.23, w: 0.095, d: 0.15, z: -0.008, c: 0.04 }, { y: -0.1, w: 0.1, d: 0.17, z: -0.004, c: 0.042 }, { y: 0.0, w: 0.09, d: 0.175, c: 0.038 }];
for (const s of [-1, 1]) {
  const ear = hgrp(hat, s < 0 ? 'HatEarR' : 'HatEarL', s * 0.17, 0.035, -0.015);
  ear.rotation.z = s * 0.13;                                                                  // hangs slightly out: a gap to the beard
  loft(ear, EAR, mFur2, FUR);
  tuftRing(ear, EAR, -0.245, 7, null, 0.036, -1.2, mFur2, 0.02);                              // shaggy lower edge
  tuftRing(ear, EAR, -0.12, 6, u => u > 0.5 === (s < 0), 0.03, 0, mFur2, 0.12);               // a few on the outer side
}
const flapB = hgrp(hat, 'HatFlapBack', 0, 0.02, -0.145); flapB.rotation.x = 0.22;
loft(flapB, [{ y: -0.16, w: 0.3, d: 0.075, z: -0.012, c: 0.03 }, { y: 0.0, w: 0.34, d: 0.09, c: 0.035 }], mFur2, FUR);
// shaggy outline: tufts round the band (not over the turned-up flap), over the crown and along the flap's top edge
tuftRing(hat, HAT_BAND, 0.012, 22, u => u > 0.4 && u < 0.6, 0.042, -0.5, mFur2, 0.01);
tuftRing(hat, DOME, 0.14, 16, null, 0.04, 0.9, mFur2, 0.04);
tuftRing(flapF, FLAP_F, 0.135, 6, u => u < 0.3 || u > 0.7, 0.032, 1.4, mFur2, 0.005);

/* ---------- belt: thick rope in two turns, a knot with two braided ends, leather straps, four big charge cells ---------- */
const belt = hgrp(hips, 'Belt', 0, 0.12, 0);
belt.rotation.y = spine.rotation.y;                       // turns with the torso, so the rope hugs the shirt all round
for (const [dy, r] of [[0.02, 0.3], [-0.022, 0.305]]) {
  const t = put(belt, new THREE.TorusGeometry(r, 0.032, 5, 20), mRope, 0, dy, 0); t.rotation.x = Math.PI / 2; t.scale.set(1, 0.76, 1);
}
// knot in front, a little to his right; two braided ends with tassels hang over the hem
const knotG = hgrp(belt, 'BeltKnot', -0.07, 0, 0.245);
put(knotG, new THREE.BoxGeometry(0.1, 0.075, 0.06), mRope, 0, 0, 0.012).rotation.z = 0.2;
put(knotG, new THREE.TorusGeometry(0.036, 0.022, 4, 8), mRope, 0.02, 0.005, 0.035).rotation.y = 0.3;
for (const [dx, n, rz] of [[-0.03, 7, 0.06], [0.035, 8, -0.05]]) {
  const end = hgrp(knotG, 'Braid', dx, -0.03, 0.02); end.rotation.set(-0.3, 0, rz);      // leans out over the flare of the hem
  for (let i = 0; i < n; i++) { const b = put(end, new THREE.BoxGeometry(0.05, 0.05, 0.04), mRope, i % 2 ? 0.007 : -0.007, -i * 0.04, 0); b.rotation.z = i % 2 ? 0.45 : -0.45; }   // plaits lean left and right
  hcyl(end, 0.026, 0.026, 0.018, 6, mBast, 0, -n * 0.04 + 0.005, 0);                    // binding
  hcyl(end, 0.022, 0.042, 0.085, 6, mRope, 0, -n * 0.04 - 0.045, 0);                     // tassel
}
// two leather straps on his right hip
for (const [x, z, len, ry] of [[-0.2, 0.17, 0.3, -0.7], [-0.25, 0.11, 0.24, -0.95]]) {
  const g = hgrp(belt, 'Strap', x, -0.01, z); g.rotation.order = 'YXZ'; g.rotation.set(-0.3, ry, 0.04);
  put(g, new THREE.BoxGeometry(0.055, len, 0.012), mLeather, 0, -len / 2, 0.012);
  put(g, new THREE.BoxGeometry(0.06, 0.014, 0.018), mMetal, 0, -len + 0.03, 0.012);   // metal tip
}
// four big charge cells on his left hip: a glowing glass tube in a steel cage between two capped ends
const batteries = [];
[[0.33, 0.85, mRust], [0.6, 1.0, mMetal], [0.87, 1.0, mMetal], [1.14, 0.9, mMetal]].forEach(([th, k, capM], i) => {
  const g = hgrp(belt, 'Battery' + (i + 1), Math.sin(th) * 0.318, -0.02, Math.cos(th) * 0.24);
  g.rotation.order = 'YXZ'; g.rotation.set(-0.3, th, 0); g.scale.setScalar(k * 1.25);    // hangs out over the flare of the hem
  const zc = 0.03;
  put(g, new THREE.BoxGeometry(0.022, 0.06, 0.012), mMetal, 0, -0.01, zc + 0.008);       // hanger clip over the rope
  hcyl(g, 0.02, 0.02, 0.03, 6, mDark, 0, -0.05, zc);                                     // connector
  hcyl(g, 0.05, 0.054, 0.042, 8, capM, 0, -0.085, zc);                                   // top cap
  const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.15, 8), neonMat(0.0)); cell.position.set(0, -0.18, zc); g.add(cell);
  for (let q = 0; q < 4; q++) { const a = Math.PI / 4 + q * Math.PI / 2; put(g, new THREE.BoxGeometry(0.013, 0.15, 0.013), mDark, Math.sin(a) * 0.046, -0.18, zc + Math.cos(a) * 0.046); }   // cage bars
  hcyl(g, 0.047, 0.047, 0.012, 8, mDark, 0, -0.18, zc);                                  // middle band
  hcyl(g, 0.054, 0.05, 0.042, 8, mMetal, 0, -0.275, zc);                                 // bottom cap
  for (let q = 0; q < 4; q++) { const a = q * Math.PI / 2; put(g, new THREE.BoxGeometry(0.012, 0.012, 0.012), mDark, Math.sin(a) * 0.052, -0.275, zc + Math.cos(a) * 0.052); }   // bolts
  hcyl(g, 0.02, 0.016, 0.022, 6, mDark, 0, -0.306, zc);                                  // bottom nub
  batteries.push(cell);
});

/* ---------- legs: baggy sharovary to the knee; armoured knee, shin plate, leather wraps, bast lashings, big lapti ---------- */
hcyl(hips, 0.28, 0.26, 0.22, 8, mPants, 0, -0.06, 0, 0.78);
// thigh rings run knee → hip so the embroidered band of the texture lands just above the knee
const THIGH_R = [
  { y: -THIGH + 0.03, w: 0.27,  d: 0.26, c: 0.075 },    // gathered over the top of the knee armour
  { y: -THIGH + 0.1,  w: 0.35,  d: 0.34, c: 0.1 },
  { y: -0.32,         w: 0.39,  d: 0.37, c: 0.11 },     // balloon
  { y: -0.15,         w: 0.37,  d: 0.36, c: 0.11 },
  { y:  0.04,         w: 0.31,  d: 0.31, c: 0.09 }
];
// lapot: a chunky woven shoe, rings from the sole up to the ankle opening (foot-local, ankle pivot at 0, +Z forward)
const LAPOT = [
  { y: -FOOT_H,        w: 0.21,  d: 0.45, z: 0.085, c: 0.09 },
  { y: -FOOT_H + 0.05, w: 0.24,  d: 0.49, z: 0.09,  c: 0.105 },
  { y: -FOOT_H + 0.12, w: 0.23,  d: 0.46, z: 0.085, c: 0.105 },
  { y: -0.035,         w: 0.19,  d: 0.33, z: 0.045, c: 0.085 },
  { y: 0.0,            w: 0.15,  d: 0.17, z: -0.02, c: 0.06 }
];
const legs = {};
for (const [side, s] of [['Left', 1], ['Right', -1]]) {
  const up = hgrp(hips, side + 'UpLeg', s * 0.17, -0.08, 0);
  up.rotation.z = s * 0.17;
  loft(up, THIGH_R, mPants, {});
  const kn = hgrp(up, side + 'Leg', 0, -THIGH, 0);
  kn.rotation.z = -s * 0.04;
  // the leg under the armour: dark leather wraps down to the ankle
  loft(kn, [{ y: -SHIN - 0.01, w: 0.15, d: 0.15, c: 0.045 }, { y: -0.3, w: 0.17, d: 0.17, c: 0.05 }, { y: -0.03, w: 0.215, d: 0.21, c: 0.06 }], mOnuchi, { ku: 5, kv: 5 });
  hcyl(kn, 0.07, 0.07, 0.2, 8, mDark, 0, 0, -0.005).rotation.z = Math.PI / 2;           // knee axle
  // knee armour: a faceted steel shield with a neon bar; gear hinges on both sides, the outer hub red
  const kp = hgrp(kn, side + 'KneePlate', 0, -0.005, 0.11); kp.rotation.x = -0.1;
  loft(kp, [{ y: -0.1, w: 0.11, d: 0.05, c: 0.02 }, { y: -0.02, w: 0.175, d: 0.06, c: 0.022 }, { y: 0.075, w: 0.16, d: 0.055, c: 0.02 }, { y: 0.1, w: 0.12, d: 0.045, c: 0.018 }], mPlateFlat, { planarU: true });
  put(kp, new THREE.BoxGeometry(0.036, 0.13, 0.012), mDark, 0, -0.005, 0.029);
  const kNeon = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.112, 0.012), neonMat(0.0)); kNeon.position.set(0, -0.005, 0.033); kp.add(kNeon);
  put(kp, new THREE.BoxGeometry(0.13, 0.016, 0.02), mRust, 0, 0.082, 0.018);
  for (const q of [-1, 1]) {
    const hg = hgrp(kn, 'KneeHinge', q * 0.105, -0.01, 0.01); hg.rotation.z = Math.PI / 2;
    hcyl(hg, 0.056, 0.056, 0.03, 8, mDark, 0, 0, 0);
    for (let t = 0; t < 8; t++) { const a = t * Math.PI / 4; put(hg, new THREE.BoxGeometry(0.016, 0.028, 0.016), mMetal, Math.cos(a) * 0.062, 0, Math.sin(a) * 0.062).rotation.y = -a; }   // gear teeth
    hcyl(hg, 0.026, 0.026, 0.044, 6, q === s ? mRed : mMetal, 0, 0, 0);
  }
  // shin plate: tapered steel with a neon strip and four rivets
  const sp = hgrp(kn, side + 'ShinPlate', 0, -0.12, 0.095); sp.rotation.x = 0.06;
  sbox(sp, 0.085, 0.04, 0.12, 0.045, 0.3, 0, 0.005, 0.014, mPlateFlat, 0, -0.3, 0);
  put(sp, new THREE.BoxGeometry(0.03, 0.11, 0.008), mDark, 0, -0.085, 0.022);
  const sNeon = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.094, 0.01), neonMat(0.0)); sNeon.position.set(0, -0.085, 0.025); sp.add(sNeon);
  for (const [rx, ry] of [[-0.045, -0.02], [0.045, -0.02], [-0.032, -0.275], [0.032, -0.275]]) put(sp, new THREE.BoxGeometry(0.014, 0.014, 0.012), mMetal, rx, ry, 0.024);
  // piston on the outer side, from the knee hinge to the ankle ring
  hcyl(kn, 0.017, 0.017, 0.12, 6, mMetal, s * 0.1, -0.1, -0.02);
  hcyl(kn, 0.009, 0.009, 0.3, 6, mCopper, s * 0.1, -0.3, -0.02);
  // ankle: steel ring with a buckle, bast straps crossed over the front and wound round the ankle
  hcyl(kn, 0.088, 0.088, 0.03, 8, mMetal, 0, -0.45, 0);
  put(kn, new THREE.BoxGeometry(0.03, 0.04, 0.03), mDark, s * 0.09, -0.45, 0.02);
  for (const q of [-1, 1]) put(kn, new THREE.BoxGeometry(0.03, 0.19, 0.012), mBast, 0, -0.475, 0.083).rotation.z = q * 0.55;
  hcyl(kn, 0.083, 0.083, 0.024, 8, mBast, 0, -0.505, 0);
  // lapot with a bast strap over the instep and a steel heel plate
  const ft = hgrp(kn, side + 'Foot', 0, -SHIN, 0);
  ft.rotation.set(0, s * 0.25, -s * 0.13);                    // toes out, sole flat on the ground
  loft(ft, LAPOT, mLapti, { ku: 5, kv: 5 });
  const ins = hgrp(ft, 'Instep', 0, 0, 0.1); ins.rotation.x = Math.PI / 2;   // group Y runs along the foot, so the rings wrap round it
  loft(ins, [{ y: 0, w: 0.252, d: 0.19, z: 0.11, c: 0.075 }, { y: 0.045, w: 0.252, d: 0.19, z: 0.11, c: 0.075 }], mBast, { ku: 6, caps: false });
  put(ft, new THREE.BoxGeometry(0.016, 0.07, 0.08), mMetal, s * 0.1, -0.13, -0.1);
  legs[side] = { up, kn, ft };
}

/* ---------- living right arm: comes out of a full linen sleeve; pose and fist as before ---------- */
const R_UA = 0.33, R_FA = 0.3;
const rShoulder = hgrp(chest, 'RightShoulder', -0.335, 0.2, 0.005);
const rUpper = hgrp(rShoulder, 'RightUpperArm', 0, 0, 0);
rUpper.rotation.set(0.06, 0, -0.28);
// sleeve: the cap sits under the shoulder seam and carries the shoulder line down the arm
const SLEEVE = [
  { y: 0.075,       w: 0.165, d: 0.21,  x: 0.025, c: 0.055 },
  { y: 0.02,        w: 0.25,  d: 0.27,  c: 0.08 },
  { y: -0.12,       w: 0.28,  d: 0.28,  c: 0.09 },     // loose, as on the reference
  { y: -0.27,       w: 0.27,  d: 0.27,  c: 0.085 },
  { y: -R_UA - 0.03, w: 0.245, d: 0.245, c: 0.075 }
];
const sleeveR = hgrp(rUpper, 'RightSleeve', 0, 0, 0);
loft(sleeveR, SLEEVE, mLinen, LIN);
loft(sleeveR, bandRings(SLEEVE, -0.19, -0.07, 0.01), mEmbBand, { ku: 4.8 });         // wide embroidered band at the shoulder
for (const [a, b] of [[-0.205, -0.19], [-0.07, -0.055]]) loft(sleeveR, bandRings(SLEEVE, a, b, 0.013), mRed, {});
const rFore = hgrp(rUpper, 'RightForearm', 0, -R_UA, 0);
rFore.rotation.set(-0.28, 0, 0.08);
const SLEEVE_F = [
  { y: 0.05,   w: 0.215, d: 0.215, c: 0.07 },
  { y: -0.1,   w: 0.22,  d: 0.215, c: 0.07 },
  { y: -0.2,   w: 0.2,   d: 0.195, c: 0.065 },
  { y: -0.255, w: 0.175, d: 0.17,  c: 0.055 }
];
loft(rFore, SLEEVE_F, mLinen, LIN);
loft(rFore, bandRings(SLEEVE_F, -0.25, -0.18, 0.012), mEmbBand, { ku: 8 });          // embroidered cuff at the wrist
loft(rFore, bandRings(SLEEVE_F, -0.262, -0.248, 0.016), mRed, {});
hcyl(rFore, 0.068, 0.066, 0.07, 8, mSkin, 0, -0.275, 0);                              // wrist
const rHand = hgrp(rFore, 'RightHand', 0, -R_FA, 0);
rHand.rotation.set(-0.1, 0.25, 0.05);
// fist, hand-local: -Y toward the knuckles, -X back of the hand (outer side), +X palm, +Z thumb (front)
const fist = hgrp(rHand, 'RightFist', 0, 0, 0); fist.scale.setScalar(1.15);   // big blocky hand, as on the reference
put(fist, new THREE.BoxGeometry(0.085, 0.12, 0.15), mSkin, 0, -0.06, 0);                        // palm block
put(fist, new THREE.BoxGeometry(0.03, 0.1, 0.13), mSkin, -0.045, -0.065, 0);                    // back of the hand (thicker)
const R_FL = [0.06, 0.068, 0.064, 0.054];
for (let i = 0; i < 4; i++) {
  const z = 0.051 - i * 0.034, L = R_FL[i];
  put(fist, new THREE.BoxGeometry(0.085, L, 0.03), mSkin, -0.005, -0.12 - L / 2, z);          // proximal phalanx
  put(fist, new THREE.BoxGeometry(0.03, 0.028, 0.03), mSkin, -0.052, -0.123, z);               // knuckle
  put(fist, new THREE.BoxGeometry(0.05, 0.035, 0.03), mSkin, 0.045, -0.115 - L + 0.012, z);    // curled tip tucked into the palm
}
const rThumb = hgrp(fist, 'RightThumb', 0.035, -0.07, 0.078);
rThumb.rotation.set(0, 0, 0.55);
put(rThumb, new THREE.BoxGeometry(0.04, 0.085, 0.04), mSkin, 0, -0.04, 0);
put(rThumb, new THREE.BoxGeometry(0.04, 0.045, 0.04), mSkin, 0.012, -0.095, -0.012).rotation.z = -0.5;

/* ---------- spear lives in the cyber fist: Hand > Grip > Spear ---------- */
// Grip sits at the shaft centre inside the closed hand; 1/HAND_S keeps the spear at its own scale.
// Each frame its rotation takes the roll/lean of SpearTarget (the old spear chain, now an invisible controller).
const gripG = new THREE.Group(); gripG.name = 'Grip';
gripG.position.set(-0.103, -0.13, 0); gripG.scale.setScalar(1 / HAND_S); hand.add(gripG);
gripG.add(spear); spear.position.set(0, 0, 0); spear.quaternion.identity();
const qGh = new Q(), qGt = new Q();
function gripFollow(){
  hand.getWorldQuaternion(qGh); spearTgt.getWorldQuaternion(qGt);
  gripG.quaternion.copy(qGh).invert().multiply(qGt);
}

/* ---------- baked ambient occlusion on the static body: soft contact shading from sphere proxies ----------
   Each body mesh is approximated by a few spheres along its longest axis; every vertex is darkened by the
   spheres of the other parts in front of it (occlusion ≈ (r/d)² · cos). Computed once and stored as vertex
   colours; the cyber arm and the spear move, so they are left out. */
(function bakeAO(){
  scene.updateMatrixWorld(true);
  const toHips = new THREE.Matrix4().copy(hips.matrixWorld).invert();
  const moving = o => { for (let q = o; q; q = q.parent) if (q === shoulderG || q === gripG) return true; return false; };
  const meshes = []; hips.traverse(o => { if (o.isMesh && !moving(o) && !(Array.isArray(o.material) ? o.material[0] : o.material).isMeshBasicMaterial) meshes.push(o); });
  const mats = meshes.map(m => new THREE.Matrix4().multiplyMatrices(toHips, m.matrixWorld));
  const px = [], py = [], pz = [], pr = [], pm = [];
  meshes.forEach((m, mi) => {
    const g = m.geometry; g.computeBoundingBox();
    const b = g.boundingBox, lo = b.min, hi = b.max, sc = new V3(); mats[mi].decompose(new V3(), new Q(), sc);
    const ext = [(hi.x - lo.x) * sc.x, (hi.y - lo.y) * sc.y, (hi.z - lo.z) * sc.z];
    const ax = ext[0] >= ext[1] && ext[0] >= ext[2] ? 0 : ext[1] >= ext[2] ? 1 : 2;
    const o2 = ext.filter((_, i) => i !== ax), r = 0.5 * Math.sqrt(o2[0] * o2[1]) * 0.85;
    if (r < 0.012) return;                                   // bolts and rivets do not shade anything
    const k = Math.max(1, Math.round(ext[ax] / (2 * r)));
    for (let i = 0; i < k; i++) {
      const c = b.getCenter(new V3()), t = (i + 0.5) / k;
      c.setComponent(ax, lo.getComponent(ax) + (hi.getComponent(ax) - lo.getComponent(ax)) * t);
      c.applyMatrix4(mats[mi]); px.push(c.x); py.push(c.y); pz.push(c.z); pr.push(r); pm.push(mi);
    }
  });
  const cache = new Map();
  const aoMat = mt => { if (!cache.has(mt.uuid)) { const c = mt.clone(); c.vertexColors = true; cache.set(mt.uuid, c); } return cache.get(mt.uuid); };
  const p = new V3(), n = new V3(), nm = new THREE.Matrix3(), STRENGTH = 0.7;
  meshes.forEach((m, mi) => {
    const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, cnt = P.count, col = new Float32Array(cnt * 3);
    nm.getNormalMatrix(mats[mi]);
    for (let i = 0; i < cnt; i++) {
      p.fromBufferAttribute(P, i).applyMatrix4(mats[mi]); n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
      let occ = 0;
      for (let j = 0; j < pr.length; j++) {
        if (pm[j] === mi) continue;
        const dx = px[j] - p.x, dy = py[j] - p.y, dz = pz[j] - p.z, d2 = dx * dx + dy * dy + dz * dz, r2 = pr[j] * pr[j];
        if (d2 <= r2) continue;                              // the vertex sits on that part's surface
        const d = Math.sqrt(d2), cs = (dx * n.x + dy * n.y + dz * n.z) / d;
        if (cs > 0) occ += r2 / d2 * cs;
      }
      const a = Math.max(0.42, 1 - STRENGTH * occ);
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = a;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    m.material = Array.isArray(m.material) ? m.material.map(aoMat) : aoMat(m.material);
  });
})();
