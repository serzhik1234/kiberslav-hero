
/* ================= CYBER ARM ================= */
/* Rig: ArmPivot (follows the spear when gripping) > ArmFrame (turned so the hero faces +X, arm on his left, -Z)
   > Shoulder > UpperArm > Forearm > Hand > Finger1..4 (3 bones each), Thumb (2 bones).
   Inside ArmFrame: +X is the outer side of the arm, +Z is forward, bones hang along -Y. */
const UA = 0.42, FA = 0.36;
const SHOULDER = new V3(0.5, 0.6, -0.15);
const armPivot = new THREE.Group(); armPivot.name = 'ArmPivot'; scene.add(armPivot);
const armFrame = new THREE.Group(); armFrame.name = 'ArmFrame'; armFrame.rotation.y = Math.PI / 2; armPivot.add(armFrame);
const shoulderG = new THREE.Group(); shoulderG.name = 'Shoulder'; shoulderG.position.copy(SHOULDER); armFrame.add(shoulderG);
const upperArm = new THREE.Group(); upperArm.name = 'UpperArm'; shoulderG.add(upperArm);
const forearm = new THREE.Group(); forearm.name = 'Forearm'; forearm.position.y = -UA; upperArm.add(forearm);
const HAND_S = 1.12;
const hand = new THREE.Group(); hand.name = 'Hand'; hand.position.y = -FA; hand.scale.setScalar(HAND_S); forearm.add(hand);

function put(parent, geo, mat, x, y, z){
  const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function sideD(m){ const c = m.clone(); c.side = THREE.DoubleSide; return c; }

/* ---------- arm materials ---------- */
const mPlate = std(plateTex(), 0xffffff, 0.42, 0.62); mPlate.map.repeat.set(6, 1);
const mPlateFlat = std(plateTex(), 0xffffff, 0.42, 0.62);
const mSteel = std(metalTex(2, 150, 50), 0xffffff, 0.45, 0.6);
const mSteelD = sideD(mSteel), mRustD = sideD(mRust), mRedD = sideD(mRed);
const mPaul = std(paulTex(), 0xffffff, 0.45, 0.55); mPaul.side = THREE.DoubleSide;
const mOrn = std(ornTex(), 0xffffff, 0.55, 0.45);
const mRubber = std(null, 0x1a181e, 0.95, 0);
const NEON = new THREE.Color(0x4ef3ff), WHITE = new THREE.Color(1, 1, 1), PINK = new THREE.Color(0xff3bd4);
const neonMats = [];
function neonMat(order){ const m = new THREE.MeshBasicMaterial({ color: 0x4ef3ff }); m.userData.order = order; neonMats.push(m); return m; }
const arcNodes = [];   // points along the arm for charge arcs, ordered shoulder → fist

/* a neon strip sunk into a flat face of a hex plate; ang = face direction (0 = +Z, PI/2 = +X) */
function neonStrip(parent, ang, rTop, rBot, yc, h, len, order){
  const aT = rTop * 0.866, aB = rBot * 0.866, a = (aT + aB) / 2 + 0.002;
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  g.position.set(Math.sin(ang) * a, yc, Math.cos(ang) * a); g.rotation.set(Math.atan2(aT - aB, h), ang, 0); parent.add(g);
  put(g, new THREE.BoxGeometry(0.03, len + 0.018, 0.006), mDark, 0, 0, 0.001);
  const s = new THREE.Mesh(new THREE.BoxGeometry(0.014, len, 0.008), neonMat(order)); s.position.z = 0.003; g.add(s);
  arcNodes.push({ o: s, order });
  return g;
}

/* ---------- shoulder mount (would bolt onto the torso) ---------- */
const flange = put(shoulderG, new THREE.CylinderGeometry(0.078, 0.078, 0.028, 8), mRust, -0.105, 0, 0); flange.rotation.z = Math.PI / 2;
const collar = put(shoulderG, new THREE.CylinderGeometry(0.048, 0.06, 0.06, 8), mMetal, -0.065, 0, 0); collar.rotation.z = Math.PI / 2;
for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; put(shoulderG, new THREE.BoxGeometry(0.012, 0.014, 0.014), mMetal, -0.121, Math.cos(a) * 0.058, Math.sin(a) * 0.058); }

/* ---------- pauldron: layered angular shell, ornament plate on the outer face ---------- */
// annular sector in the frame's XY plane (0 = outer side, PI/2 = top), extruded along Z (forward)
function paulShell(rIn, rOut, a0, a1, seg, depth, uvK){
  const sh = new THREE.Shape();
  for (let i = 0; i <= seg; i++) { const a = a0 + (a1 - a0) * i / seg; i ? sh.lineTo(Math.cos(a) * rOut, Math.sin(a) * rOut) : sh.moveTo(Math.cos(a) * rOut, Math.sin(a) * rOut); }
  for (let i = seg; i >= 0; i--) { const a = a0 + (a1 - a0) * i / seg; sh.lineTo(Math.cos(a) * rIn, Math.sin(a) * rIn); }
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, steps: 1 });
  g.translate(0, 0, -depth / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvK, uv.getY(i) * uvK);
  return g;
}
const pauldron = new THREE.Group(); pauldron.name = 'Pauldron';
pauldron.position.set(0.035, 0.03, 0); pauldron.rotation.z = -0.22; shoulderG.add(pauldron);
const PR = 0.175, PA0 = -0.62, PA1 = 2.12;
const shell = put(pauldron, paulShell(PR - 0.03, PR, PA0, PA1, 7, 0.34, 4), mSteel);
// servo housing that fills the shell (reads as a solid shoulder from the front)
const housing = put(pauldron, new THREE.CylinderGeometry(0.118, 0.118, 0.29, 6), mMetal, -0.015, 0.0, 0); housing.rotation.x = Math.PI / 2;
for (const zs of [-1, 1]) { const cap = put(pauldron, new THREE.CylinderGeometry(0.07, 0.085, 0.02, 6), mRust, -0.015, 0.0, zs * 0.15); cap.rotation.x = Math.PI / 2;
  const hub = put(pauldron, new THREE.CylinderGeometry(0.03, 0.03, 0.02, 8), mDark, -0.015, 0.0, zs * 0.165); hub.rotation.x = Math.PI / 2; }
// front / back rust trims with rivets
for (const zs of [-1, 1]) {
  put(pauldron, paulShell(PR - 0.034, PR + 0.012, PA0 - 0.02, PA1 + 0.02, 7, 0.026, 4), mRust, 0, 0, zs * 0.163);
  for (let i = 1; i < 7; i++) { const a = PA0 + (PA1 - PA0) * (i + 0.5) / 7.5; put(pauldron, new THREE.BoxGeometry(0.016, 0.016, 0.016), mMetal, Math.cos(a) * (PR + 0.012), Math.sin(a) * (PR + 0.012), zs * 0.163); }
}
// lower lames stepping down the outer side
const lame1 = put(pauldron, paulShell(PR - 0.005, PR + 0.022, -1.02, -0.3, 3, 0.31, 4), mSteel, 0, 0, 0);
const lame2 = put(pauldron, paulShell(PR + 0.012, PR + 0.036, -1.32, -0.82, 2, 0.28, 4), mRust, 0, 0, 0);
// raised crest ridge along the top
put(pauldron, new THREE.BoxGeometry(0.03, 0.02, 0.36), mRust, Math.cos(1.45) * (PR + 0.004), Math.sin(1.45) * (PR + 0.004), 0).rotation.z = 1.45 - Math.PI / 2;
// ornament plate: a rhombus bolted to the upper-outer facet, facing out
const PAo = 0.62;
const ornG = new THREE.Group(); ornG.rotation.order = 'ZYX'; ornG.rotation.set(0, Math.PI / 2, PAo);
ornG.position.set(Math.cos(PAo) * (PR + 0.004), Math.sin(PAo) * (PR + 0.004), 0); pauldron.add(ornG);
const ornBack = put(ornG, new THREE.BoxGeometry(0.142, 0.142, 0.014), mRust, 0, 0, 0.004); 
const boss = put(ornG, new THREE.BoxGeometry(0.128, 0.128, 0.016), [mSteel, mSteel, mSteel, mSteel, mOrn, mSteel], 0, 0, 0.012);
for (let k = 0; k < 4; k++) { const ph = k * Math.PI / 2; put(ornG, new THREE.BoxGeometry(0.016, 0.016, 0.02), mMetal, Math.cos(ph + Math.PI / 4) * 0.087, Math.sin(ph + Math.PI / 4) * 0.087, 0.014); }
arcNodes.push({ o: boss, order: 0.02 });

/* ---------- upper arm ---------- */
put(upperArm, new THREE.IcosahedronGeometry(0.062, 0), mMetal);
put(upperArm, new THREE.CylinderGeometry(0.024, 0.024, UA, 6), mDark, 0, -UA / 2, 0);
function coil(parent, r, y0, y1, turns, phase, mat){
  const c = new THREE.CatmullRomCurve3(helix(r, y0, y1, turns, phase));
  return put(parent, new THREE.TubeGeometry(c, Math.ceil(turns * 24), 0.009, 4, false), mat);
}
coil(upperArm, 0.05, -0.03, -0.17, 1.4, 0, mRed); coil(upperArm, 0.05, -0.03, -0.17, 1.4, Math.PI, mBlue);
function lame(r0, r1, h, y, tl){
  const ts = Math.PI / 2 - tl / 2;
  put(upperArm, new THREE.CylinderGeometry(r0, r1, h, 8, 1, true, ts, tl), mSteelD, 0.015, y, 0);
  put(upperArm, new THREE.CylinderGeometry(r1 + 0.002, r1 + 0.004, 0.012, 8, 1, true, ts, tl), mRustD, 0.015, y - h / 2 + 0.006, 0);
}
lame(0.108, 0.118, 0.06, -0.135, Math.PI * 1.3);
put(upperArm, new THREE.CylinderGeometry(0.094, 0.094, 0.018, 6), mRust, 0, -0.18, 0);
put(upperArm, new THREE.CylinderGeometry(0.09, 0.082, 0.16, 6), mPlate, 0, -0.265, 0);
put(upperArm, new THREE.CylinderGeometry(0.085, 0.085, 0.016, 6), mRust, 0, -0.352, 0);
neonStrip(upperArm, Math.PI / 2, 0.09, 0.082, -0.265, 0.16, 0.11, 0.22);
neonStrip(upperArm, Math.PI / 6, 0.09, 0.082, -0.265, 0.16, 0.07, 0.26);

/* ---------- elbow + forearm ---------- */
const elb = put(forearm, new THREE.CylinderGeometry(0.052, 0.052, 0.13, 8), mMetal); elb.rotation.z = Math.PI / 2;
[-1, 1].forEach(s => { const c = put(forearm, new THREE.CylinderGeometry(0.042, 0.042, 0.02, 8), mDark, s * 0.072, 0, 0); c.rotation.z = Math.PI / 2; });
const elbRing = new THREE.Mesh(new THREE.TorusGeometry(0.027, 0.006, 4, 10), neonMat(0.42)); elbRing.position.set(0.084, 0, 0); elbRing.rotation.y = Math.PI / 2; forearm.add(elbRing);
arcNodes.push({ o: elbRing, order: 0.42 });
const guard = put(forearm, new THREE.CylinderGeometry(0, 0.046, 0.075, 4), mSteel, 0, 0.005, -0.062); guard.rotation.x = -Math.PI / 2;
put(forearm, new THREE.CylinderGeometry(0.022, 0.022, FA, 6), mDark, 0, -FA / 2, 0);
put(forearm, new THREE.CylinderGeometry(0.09, 0.09, 0.014, 6), mRust, 0, -0.038, 0);
put(forearm, new THREE.CylinderGeometry(0.086, 0.078, 0.14, 6), mPlate, 0, -0.108, 0);
put(forearm, new THREE.CylinderGeometry(0.08, 0.08, 0.012, 6), mRust, 0, -0.2, 0);
put(forearm, new THREE.CylinderGeometry(0.076, 0.07, 0.12, 6), mPlate, 0, -0.262, 0);
neonStrip(forearm, Math.PI / 2, 0.086, 0.078, -0.108, 0.14, 0.1, 0.55);
neonStrip(forearm, Math.PI / 6, 0.086, 0.078, -0.108, 0.14, 0.075, 0.6);
neonStrip(forearm, Math.PI / 2, 0.076, 0.07, -0.262, 0.12, 0.085, 0.75);
put(forearm, new THREE.CylinderGeometry(0.07, 0.066, 0.034, 8), mRust, 0, -0.338, 0);
// hydraulic "tendon" on the back of the forearm
put(forearm, new THREE.CylinderGeometry(0.014, 0.014, 0.13, 6), mMetal, 0, -0.12, -0.098);
put(forearm, new THREE.BoxGeometry(0.02, 0.022, 0.03), mRust, 0, -0.06, -0.085);
put(forearm, new THREE.BoxGeometry(0.02, 0.022, 0.03), mRust, 0, -0.3, -0.078);
const pRod = put(forearm, new THREE.CylinderGeometry(0.0075, 0.0075, 0.12, 6), mCopper, 0, -0.225, -0.098);
// wrist connector for the spear cable
put(forearm, new THREE.BoxGeometry(0.034, 0.058, 0.052), mMetal, 0.08, -0.292, 0);
const sockRing = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 4, 8), neonMat(0.9)); sockRing.position.set(0.098, -0.292, 0); sockRing.rotation.y = Math.PI / 2; forearm.add(sockRing);
arcNodes.push({ o: sockRing, order: 0.9 });
const plug = new THREE.Group(); plug.position.set(0.13, -0.292, 0); plug.rotation.z = Math.PI / 2; forearm.add(plug);
(function(){
  put(plug, new THREE.BoxGeometry(0.04, 0.07, 0.04), mMetal);
  put(plug, new THREE.BoxGeometry(0.03, 0.02, 0.03), mRed, 0, -0.03, 0);
  const l = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.012), ledOn); l.position.set(0, 0, 0.021); plug.add(l);
})();
const wristCable = new THREE.Object3D(); wristCable.position.set(0.172, -0.292, 0); forearm.add(wristCable);
const ventA = new THREE.Object3D(); ventA.position.set(0.05, -0.188, -0.05); forearm.add(ventA);
const armLight = new THREE.PointLight(0x4ef3ff, 0.5, 1.1, 2); armLight.position.set(0.15, -0.2, 0.05); forearm.add(armLight);

/* ---------- hand: massive steel fist ---------- */
put(hand, new THREE.IcosahedronGeometry(0.036, 0), mDark);
put(hand, new THREE.BoxGeometry(0.095, 0.115, 0.14), mSteel, 0, -0.075, 0);
put(hand, new THREE.BoxGeometry(0.024, 0.108, 0.152), mPlateFlat, 0.058, -0.07, 0);
(function(){
  const g = new THREE.Group(); g.position.set(0.071, -0.066, 0); g.rotation.y = Math.PI / 2; hand.add(g);
  put(g, new THREE.BoxGeometry(0.03, 0.082, 0.004), mDark);
  const s = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.068, 0.006), neonMat(0.95)); s.position.z = 0.002; g.add(s);
  arcNodes.push({ o: s, order: 0.95 });
})();
put(hand, new THREE.BoxGeometry(0.052, 0.032, 0.16), mMetal, 0.022, -0.128, 0);
const FZ = [0.051, 0.017, -0.017, -0.051];
FZ.forEach(z => put(hand, new THREE.BoxGeometry(0.02, 0.024, 0.024), mRust, 0.052, -0.128, z));
put(hand, new THREE.BoxGeometry(0.012, 0.1, 0.13), mRubber, -0.0535, -0.078, 0);
const knuckles = new THREE.Object3D(); knuckles.position.set(0.05, -0.14, 0); hand.add(knuckles);
arcNodes.push({ o: knuckles, order: 1 });
const FL = [0.07, 0.055, 0.045];
const KNUCKLE = new V3(-0.0325, -0.13, 0);
const GRIP_C = new V3(-0.103, -0.13, 0).multiplyScalar(HAND_S);           // shaft centre inside the closed hand
const fingers = FZ.map((z, i) => {
  const bones = []; let parent = hand;
  const sc = i === 3 ? 0.9 : 1;
  for (let j = 0; j < 3; j++) {
    const b = new THREE.Group(); b.name = 'Finger' + (i + 1) + '_' + (j + 1);
    if (j === 0) b.position.set(KNUCKLE.x, KNUCKLE.y, z); else b.position.y = -FL[j - 1] * sc;
    parent.add(b);
    const L = FL[j] * sc;
    put(b, new THREE.BoxGeometry(0.034 - j * 0.002, L - 0.008, 0.029), j === 2 ? mMetal : mSteel, 0, -L / 2, 0);
    const pin = put(b, new THREE.CylinderGeometry(0.012, 0.012, 0.033, 6), mDark); pin.rotation.x = Math.PI / 2;
    if (j === 2) put(b, new THREE.BoxGeometry(0.026, 0.01, 0.025), mRust, 0.004, -L + 0.004, 0);
    bones.push(b); parent = b;
  }
  return bones;
});
const thumb = [];
(function(){
  let parent = hand; const TL = [0.056, 0.046];
  for (let j = 0; j < 2; j++) {
    const b = new THREE.Group(); b.name = 'Thumb_' + (j + 1);
    if (j === 0) b.position.set(-0.042, -0.04, 0.078); else b.position.y = -TL[0];
    parent.add(b);
    put(b, new THREE.BoxGeometry(0.034, TL[j] - 0.008, 0.032), j ? mMetal : mSteel, 0, -TL[j] / 2, 0);
    const pin = put(b, new THREE.CylinderGeometry(0.013, 0.013, 0.036, 6), mDark); pin.rotation.x = Math.PI / 2;
    thumb.push(b); parent = b;
  }
})();
arcNodes.sort((a, b) => a.order - b.order);

/* ---------- exposed wires running through the joints (rebuilt every frame) ---------- */
const wires = [0.5, 2.1, 3.7, 5.3].map((a, k) => {
  const s = k - 1.5;
  const P = (bone, r, y, da) => [bone, new V3(Math.sin(a + (da || 0)) * r, y, Math.cos(a + (da || 0)) * r)];
  return { mat: k % 2 ? mBlue : mRed, mesh: null, pts: [
    [shoulderG, new V3(-0.1, -0.01 + s * 0.008, s * 0.02)],
    [shoulderG, new V3(-0.06, -0.09 - Math.abs(s) * 0.012, s * 0.035)],
    P(upperArm, 0.056, -0.05), P(upperArm, 0.07, -0.155, 0.2), P(upperArm, 0.045, -0.26),
    P(upperArm, 0.066, -0.37, 0.25), P(forearm, 0.072, -0.004, 0.3), P(forearm, 0.045, -0.1),
    P(forearm, 0.072, -0.188, 0.3), P(forearm, 0.042, -0.262), P(forearm, 0.048, -0.345),
    [hand, new V3(0, -0.03, s * 0.02)]
  ]};
});
function rebuildWires(){
  wires.forEach(w => {
    const pts = w.pts.map(([b, v]) => b.localToWorld(v.clone()));
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.0085, 4, false);
    if (!w.mesh) { w.mesh = new THREE.Mesh(geo, w.mat); w.mesh.castShadow = true; w.mesh.frustumCulled = false; scene.add(w.mesh); }
    else { w.mesh.geometry.dispose(); w.mesh.geometry = geo; }
  });
}

/* ---------- arm charge arcs + cable pulses ---------- */
const armArcs = []; for (let i = 0; i < 6; i++) armArcs.push(arcLine(scene, i % 2 ? 0xffffff : 0x9ff8ff));
const pulses = [];
for (let i = 0; i < 10; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x4ef3ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.visible = false; s.scale.set(0.16, 0.16, 1); scene.add(s); pulses.push({ s, on: false, u: 1, final: false });
}
function spawnPulse(final){ const p = pulses.find(x => !x.on) || pulses[0]; p.on = true; p.u = 1; p.final = !!final; p.s.visible = true; }

/* ---------- cable: verlet rope pinned at the spear socket and the wrist connector ---------- */
const CN = 19, CL = 0.05; const cp = [], cq = []; let cableInit = false, cableCurve = null;
const cableMat = new THREE.MeshStandardMaterial({ color: 0x1f1d24, roughness: 0.7, metalness: 0.2, flatShading: true, emissive: 0x000000 });
let cableMesh = null;

/* ---------- arm animation data ---------- */
const ARM_DEF = { w: 0, curl: 0, lift: 0, neon: 0, wave: -1, shake: 0, piston: 0, arc: 0 };
const ARM_ACTIONS = {
  clench: { label: 'Сжатие кулака', dur: 1.1,
    keys: prepG(ARM_DEF, [{ t: 0 }, { t: 0.18, w: 1, lift: 1, curl: 0.15 },
      { t: 0.34, e: 'out', curl: 0.55 }, { t: 0.42, curl: 0.6 },
      { t: 0.52, e: 'out', curl: 1, neon: 1, piston: 1, shake: 0.006 },
      { t: 0.72, neon: 0.5, shake: 0 }, { t: 1, w: 0, lift: 0, curl: 0, neon: 0, piston: 0 }]),
    ev: [[0.52, 'clank'], [0.58, 'steam']] },
  charge: { label: 'Заряд руки', dur: 1.9,
    keys: prepG(ARM_DEF, [{ t: 0, wave: 0 }, { t: 0.12, w: 1, lift: 0.35, curl: 0.35, piston: 0.6 },
      { t: 0.45, e: 'lin', wave: 1.25, neon: 1.1, shake: 0.002, arc: 3 },
      { t: 0.8, neon: 1.3, arc: 5, shake: 0.003 }, { t: 0.9, neon: 0.8, arc: 1, shake: 0 },
      { t: 1, w: 0, lift: 0, curl: 0, neon: 0, piston: 0, arc: 0 }]),
    ev: [[0.04, 'hum'], [0.3, 'pulse'], [0.38, 'pulse'], [0.46, 'pulse'], [0.54, 'pulse'], [0.62, 'pulse'], [0.7, 'final']] }
};
const GRIP_DUR = 0.55;
const REST_C = [0.22, 0.32, 0.26], GRIP_A = [0.508, 0.9, 0.71], FIST_C = [1.35, 1.55, 1.2];
const POLE_REST = new V3(0.25, -0.25, -1), POLE_LIFT = new V3(0.35, -1, -0.35), POLE_GRIP = new V3(0.5, -1, -0.6);
const relRest = new Q().setFromEuler(new THREE.Euler(-0.12, 0.1, 0.05));
const relLift = new Q().setFromEuler(new THREE.Euler(0.2, -0.45, 0.2));
const relGrip = new Q();
