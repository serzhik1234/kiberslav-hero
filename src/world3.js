
/* ================= STATE ================= */
let loopMode = 'idle', runBlend = 0, action = null, queued = null, plasmaOn = true;
let shakeAmp = 0, flashV = 0, sparkAcc = 0, T = 0, slow = false, boost = 0;
let armMode = 'grip', gwLin = 1, gwTarget = 1, armAction = null, armMoving = false, gripSign = 1, pulseAcc = 0;
let twitchT = 2, flickT = 3, flickIdx = -1, flickLeft = 0;
const twitch = [0, 0, 0, 0];

function spearWorld(v){ return spear.localToWorld(v.clone()); }
function tipWorld(){ return spear.localToWorld(new V3(0, blade.position.y + 0.8 * blade.scale.y, 0)); }
function bladeMidWorld(){ return spear.localToWorld(new V3(0, blade.position.y + 0.3 * blade.scale.y, 0)); }
function shake(a){ shakeAmp = Math.max(shakeAmp, reduceMotion ? a * 0.15 : a); }
function flash(a){ if (!reduceMotion) flashV = Math.max(flashV, a); }
function plasmaColor(){ return R() < 0.5 ? coreCol : shellCol; }
function neonColor(){ return R() < 0.4 ? WHITE : NEON; }
function burst(p, n, spd, upBias, colFn){
  for (let i = 0; i < n; i++) {
    const d = new V3(R() - 0.5, R() - 0.5, R() - 0.5).normalize().multiplyScalar(spd * (0.4 + R()));
    d.y += upBias || 1; sparks.emit(p, d, 0.35 + R() * 0.55, (colFn || plasmaColor)());
  }
}
function wpos(o){ return o.getWorldPosition(new V3()); }

function loopLabel(){ return loopMode === 'run' ? 'Бежит' : 'Стоит на месте'; }
function idleLabel(){ return action || armAction || armMoving ? null : loopLabel(); }
function setLoop(m){ loopMode = m; const l = idleLabel(); if (l) onStatus(l); }
function start(name){
  const def = ACTIONS[name]; action = { def, name, t: 0, fired: new Set() };
  if (name === 'on') plasmaOn = true;
  if (name === 'off') plasmaOn = false;
  onPower(plasmaOn);
  onStatus(def.label + ', ' + fmt(def.dur));
}
function trigger(name){
  if (name === 'toggle') name = plasmaOn ? 'off' : 'on';
  if (name === 'throw' && !plasmaOn) name = 'on';
  if (action) { if (action.name !== name) queued = name; return; }
  start(name);
}
function fire(name){
  if (name === 'trailOn') trailOn = true;
  else if (name === 'trailOff') trailOn = false;
  else if (name === 'shakeS') shake(0.03);
  else if (name === 'impact') { const p = tipWorld(); ring(p, 0.05, 0.5, 0.35, false); burst(p, 40, 3, 0.5); shake(0.06); flash(0.25); }
  else if (name === 'slam') {
    const p = tipWorld(); p.y = 0.02;
    ring(p, 0.1, 1.7, 0.6, true); ring(p, 0.05, 0.7, 0.35, true, coreCol); burst(p, 80, 3.5, 2.2);
    for (let i = 0; i < 30; i++) dust.emit(p, new V3((R() - 0.5) * 3, 0.3 + R() * 0.8, (R() - 0.5) * 3), 0.8 + R() * 0.6, DUST_COL);
    shake(0.14); flash(0.4);
  }
  else if (name === 'launch') {
    const base = spear.localToWorld(new V3(0, blade.position.y, 0)); const tip = tipWorld();
    const dir = tip.clone().sub(base).normalize();
    proj.g.position.copy(base); blade.getWorldQuaternion(proj.g.quaternion);
    proj.g.scale.set(tierScale * 1.05, tierScale * 1.25, tierScale * 1.05);
    proj.vel.copy(dir).multiplyScalar(9); proj.t = 0; proj.active = true; proj.g.visible = true;
    burst(tip, 30, 2.5, 0.4); shake(0.07); flash(0.3);
  }
  else if (name === 'ignite') { const p = bladeMidWorld(); ring(p, 0.05, 0.75, 0.45, false); burst(p, 55, 2.6, 0.8); flash(0.35); shake(0.05); }
  else if (name === 'fizzle') { burst(bladeMidWorld(), 20, 0.9, 0.2); }
}
function emitFor(type, dt){
  if (type === 'tip') { const p = tipWorld(); for (let i = 0; i < Math.ceil(60 * dt); i++) sparks.emit(p, new V3((R() - 0.5) * 1.2, R() * 1.2, (R() - 0.5) * 1.2), 0.3 + R() * 0.4, plasmaColor()); }
  else if (type === 'ground') {
    const b = spearWorld(new V3(0, -1.16, 0)); b.y = 0.03;
    for (let i = 0; i < Math.ceil(90 * dt); i++) sparks.emit(b, new V3(-3 - R() * 2, 1 + R() * 1.6, (R() - 0.5) * 1.5), 0.35 + R() * 0.4, R() < 0.5 ? new THREE.Color(1, 0.7, 0.35) : shellCol);
    for (let i = 0; i < Math.ceil(28 * dt); i++) dust.emit(b, new V3(-1.5 - R(), 0.3 + R() * 0.5, (R() - 0.5) * 0.7), 0.7 + R() * 0.5, DUST_COL);
  }
  else if (type === 'charge') {
    const c = bladeMidWorld();
    for (let i = 0; i < Math.ceil(80 * dt); i++) {
      const d = new V3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(); const p = c.clone().addScaledVector(d, 0.55);
      sparks.emit(p, d.multiplyScalar(-1.9), 0.28, plasmaColor());
    }
  }
}

/* ---------- arm control ---------- */
function setArmMode(m){
  if (m !== 'grip') return;        // the spear now lives in the cyber hand; 'rest' returns with body animation
  if (m === armMode) return;
  armMode = m; gwTarget = m === 'grip' ? 1 : 0; armMoving = true;
  onStatus((m === 'grip' ? 'Хват копья, ' : 'Рука в покой, ') + fmt(GRIP_DUR));
}
function armAct(name){
  if (armAction && armAction.name === name) return;
  const def = ARM_ACTIONS[name]; armAction = { def, name, t: 0, fired: new Set() };
  onStatus(def.label + ', ' + fmt(def.dur));
}
function deliver(){
  // energy from the arm reaches the spear
  const s = wpos(cableAnchor); burst(s, 24, 1.6, 0.4, neonColor);
  if (!plasmaOn && !action) { start('on'); return; }
  boost = 1;
  const p = bladeMidWorld(); ring(p, 0.05, 0.62, 0.4, false); burst(p, 45, 2.4, 0.7); flash(0.25); shake(0.04);
}
function fireArm(name){
  if (name === 'clank') {
    const k = wpos(knuckles); burst(k, 34, 1.8, 0.6, neonColor); shake(0.035);
    if (gwLin > 0.5) burst(spear.localToWorld(new V3(0, 0, 0)), 16, 1.2, 0.3, neonColor);
  }
  else if (name === 'steam') {
    const v = wpos(ventA); const back = new V3(0, 0, -1).applyQuaternion(forearm.getWorldQuaternion(new Q()));
    for (let i = 0; i < 22; i++) dust.emit(v, back.clone().multiplyScalar(0.4 + R() * 0.5).add(new V3((R() - 0.5) * 0.3, 0.25 + R() * 0.4, (R() - 0.5) * 0.3)), 0.6 + R() * 0.5, STEAM_COL);
  }
  else if (name === 'hum') burst(wpos(shoulderG), 16, 0.9, 0.5, neonColor);
  else if (name === 'pulse') spawnPulse(false);
  else if (name === 'final') spawnPulse(true);
}

/* ---------- two-bone IK ---------- */
const tmpM = new THREE.Matrix4();
const qS = new Q(), qU = new Q(), qF = new Q(), qH = new Q(), qG = new Q(), qFree = new Q(), qAl = new Q(), qSp = new Q(), qTmp = new Q(), qRel = new Q(), qA = new Q(), qB = new Q();
const eTmp = new THREE.Euler();
function basisQuat(yv, ref, out){
  const z = ref.clone().addScaledVector(yv, -ref.dot(yv));
  if (z.lengthSq() < 1e-8) z.set(0, 0, 1).addScaledVector(yv, -yv.z);
  z.normalize(); const x = new V3().crossVectors(yv, z);
  tmpM.makeBasis(x, yv, z); return out.setFromRotationMatrix(tmpM);
}
function solveArm(S, Tg, pole){
  const a = UA, b = FA; const dv = Tg.clone().sub(S); let d = dv.length();
  const dir = d > 1e-6 ? dv.divideScalar(d) : new V3(0, -1, 0);
  d = Math.min(a + b - 1e-3, Math.max(Math.abs(a - b) + 1e-3, d));
  const cosA = (a * a + d * d - b * b) / (2 * a * d); const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const perp = pole.clone().addScaledVector(dir, -pole.dot(dir)); if (perp.lengthSq() < 1e-8) perp.set(0, 0, -1); perp.normalize();
  const E = S.clone().addScaledVector(dir, a * cosA).addScaledVector(perp, a * sinA);
  const W = S.clone().addScaledVector(dir, d); const inner = perp.clone().negate();
  basisQuat(S.clone().sub(E).normalize(), inner, qU);
  basisQuat(E.clone().sub(W).normalize(), inner, qF);
  return W;
}
function gripQuat(axis){
  qTmp.copy(qF).multiply(relGrip);
  const zH = new V3(0, 0, 1).applyQuaternion(qTmp); const d = zH.dot(axis);
  if (Math.abs(d) > 0.2) gripSign = d >= 0 ? 1 : -1;
  qAl.setFromUnitVectors(zH, axis.clone().multiplyScalar(gripSign)); qG.copy(qAl).multiply(qTmp);
}
const wristGuess = new V3(); let wristInit = false;
const restPivot = new V3();

/* ================= FRAME ================= */
function step(raw){
  const dt = slow ? raw * 0.25 : raw; T += dt;

  // loop poses
  runBlend += ((loopMode === 'run' ? 1 : 0) - runBlend) * Math.min(1, dt * 6);
  const ph = T * 9;
  const iP = { y: GRIP_H + 0.025 * Math.sin(T * 1.7), tilt: -0.05 + 0.02 * Math.sin(T * 0.9), roll: -0.13 + 0.02 * Math.sin(T * 1.3), yaw: 0 };
  const rP = { y: GRIP_H - 0.12 + 0.05 * Math.abs(Math.sin(ph)), tilt: -1.05 + 0.06 * Math.sin(ph), roll: 0.1 + 0.07 * Math.sin(ph / 2), yaw: 0.07 * Math.sin(ph / 2) };
  const b = runBlend;
  const L = { y: iP.y + (rP.y - iP.y) * b, tilt: iP.tilt + (rP.tilt - iP.tilt) * b, roll: iP.roll + (rP.roll - iP.roll) * b, yaw: rP.yaw * b };

  // spear action
  let A = null, k = 0;
  if (action) { action.t += dt; k = Math.min(1, action.t / action.def.dur); A = sampleG(CH_DEF, action.def.keys, k); }
  const w = A ? A.w : 0;
  root.position.set(A ? A.dx : 0, L.y + (A ? A.dy : 0), 0);
  yawG.rotation.y = L.yaw + (A ? A.yaw : 0);
  tiltG.rotation.set(L.roll + (A ? (A.roll - L.roll) * w : 0), 0, L.tilt + (A ? (A.tilt - L.tilt) * w : 0));

  // plasma params
  const tier = TIERS[tierIdx]; const lk = Math.min(1, dt * 5);
  tierScale += (tier.scale - tierScale) * lk; tierBright += (tier.bright - tierBright) * lk;
  shellCol.lerp(tier.shellC, lk); coreCol.lerp(tier.coreC, lk); auraCol.lerp(tier.auraC, lk);
  let power = (A && A.power !== null) ? A.power : (plasmaOn ? 1 : 0);
  power *= A ? A.pm : 1;
  const pw = Math.max(0, power); const stretch = A ? A.stretch : 1; const glowX = (A ? A.glow : 0) + boost * 0.7;
  if (pw < 0.01) blade.visible = false;
  else {
    blade.visible = true;
    const sy = tierScale * Math.pow(pw, 1.25) * stretch; const sx = tierScale * Math.pow(pw, 0.6) * (1 - (stretch - 1) * 0.18);
    blade.scale.set(sx, sy, sx);
  }
  scene.updateMatrixWorld(true);

  if (action) {
    const def = action.def;
    if (def.ev) def.ev.forEach(([t, name]) => { if (k >= t && !action.fired.has(name + t)) { action.fired.add(name + t); fire(name); } });
    if (def.emit && k >= def.emit[0] && k <= def.emit[1]) emitFor(def.emit[2], dt);
    if (def.shake && k >= def.shake[0] && k <= def.shake[1]) shake(0.02);
    if (k >= 1) {
      action = null; trailOn = false;
      if (queued) { const q = queued; queued = null; trigger(q); } else { const l = idleLabel(); if (l) onStatus(l); }
    }
  }

  const flick = 0.88 + 0.12 * Math.sin(T * 31) * Math.sin(T * 17.3);
  const I = (tierBright * flick + glowX * 0.6) * Math.min(1.3, pw);
  coreMat.color.copy(coreCol); shellMat.color.copy(shellCol); auraMat.color.copy(auraCol); glow.material.color.copy(shellCol);
  shellMat.opacity = Math.min(0.9, 0.5 * I + 0.1); auraMat.opacity = Math.min(0.5, 0.18 * I);
  glow.material.opacity = Math.min(1, 0.55 * I);
  glow.scale.set((0.7 + 0.5 * I), (0.9 + 0.6 * I), 1);
  plasmaLight.intensity = 2.4 * I; plasmaLight.color.copy(shellCol);
  if (blade.visible) { jitter(shellGeo, shellBase, 0.12 + 0.1 * glowX, T, 9); jitter(auraGeo, auraBase, 0.2 + 0.15 * glowX, T * 0.8, 6); }
  const flaskV = ((A && A.flask !== null) ? A.flask : (plasmaOn ? 1 : 0.15)) + boost * 0.6;
  flaskCoreMat.color.copy(coreCol).lerp(shellCol, 0.35).multiplyScalar(0.3 + 0.7 * Math.min(1.3, flaskV) * flick);
  flaskLight.intensity = 0.9 * flaskV; flaskLight.color.copy(shellCol); flaskGlow.material.opacity = Math.min(0.9, 0.45 * flaskV); flaskGlow.material.color.copy(shellCol);
  nubMat.color.copy(shellCol).multiplyScalar(0.25 + 0.75 * Math.min(1, pw + (A ? A.arc * 0.12 : 0) + boost));
  let lit = Math.round((tierIdx + 1) * Math.min(1, pw));
  if (boost > 0.3 && R() < 0.5) lit = 5;
  leds.forEach((l, i) => { l.material = i < lit ? ledOn : ledOff; });

  // spear arcs
  let nArcs = pw > 0.05 ? Math.round(tier.arcs * Math.min(1.2, pw)) : 0;
  nArcs += A ? Math.round(A.arc) : 0; nArcs += Math.round(boost * 4); if (glowX > 0.8) nArcs += 3; nArcs = Math.min(arcs.length, nArcs);
  arcs.forEach((a, i) => {
    if (i >= nArcs) { a.line.visible = false; return; }
    a.ttl -= dt;
    if (a.ttl <= 0) {
      if (R() < 0.8) { reArc(a, i % 4 === 3 ? 'flask' : 'tine'); a.line.visible = true; a.line.material.color.copy(i % 2 ? coreCol : shellCol); }
      else { a.line.visible = false; a.ttl = 0.03 + R() * 0.06; }
    }
  });

  // ambient sparks
  if (blade.visible) {
    sparkAcc += tier.sparks * pw * dt * (1 + glowX);
    while (sparkAcc >= 1) { sparkAcc -= 1; sparks.emit(spearWorld(bladeSurfacePoint()), new V3((R() - 0.5) * 0.6, 0.4 + R() * 0.6, (R() - 0.5) * 0.6), 0.4 + R() * 0.5, plasmaColor()); }
  }

  // world scroll (running / sliding)
  const scroll = runBlend * 5 + (A ? A.speed : 0);
  gTex.offset.x += scroll * dt;
  rocks.forEach(r => { r.position.x -= scroll * dt; if (r.position.x < -7) r.position.x += 14; });
  const wind = -scroll * 1.2;

  // ribbon hangs down in world space and sways
  spear.getWorldQuaternion(qA); ribbonPivot.quaternion.copy(qA).invert();
  eTmp.set(0.25 * Math.sin(T * 2.3) + scroll * 0.06, 0, 0.3 * Math.sin(T * 3.1) + scroll * 0.12);
  qB.setFromEuler(eTmp); ribbonPivot.quaternion.multiply(qB);

  /* ---------- ARM ---------- */
  const gStep = dt / GRIP_DUR;
  if (gwLin !== gwTarget) {
    gwLin += Math.sign(gwTarget - gwLin) * Math.min(Math.abs(gwTarget - gwLin), gStep);
    if (gwLin === gwTarget) {
      armMoving = false;
      if (gwTarget === 1) burst(spear.localToWorld(new V3(0, 0, 0)), 14, 1.1, 0.3, neonColor);
      const l = idleLabel(); if (l) onStatus(l);
    }
  }
  const gw = sstep(0, 1, gwLin);
  let AA = null, ak = 0;
  if (armAction) { armAction.t += dt; ak = Math.min(1, armAction.t / armAction.def.dur); AA = sampleG(ARM_DEF, armAction.def.keys, ak); }
  const aw = AA ? AA.w : 0;

  // body pivot: in grip mode the whole arm follows the spear's root (the hero moves with his weapon)
  restPivot.set(0, L.y, 0);
  armPivot.position.lerpVectors(restPivot, root.position, gw);
  armPivot.rotation.y = yawG.rotation.y * gw;
  armPivot.updateMatrixWorld(true);
  shoulderG.getWorldQuaternion(qS);
  const S = wpos(shoulderG);

  const liftW = AA ? AA.lift * aw * (1 - gw) : 0;
  const swing = runBlend * (1 - gw);
  const restT = (new V3(0.06 + 0.012 * Math.sin(T * 1.1), -0.74 + 0.01 * Math.sin(T * 1.7) + 0.05 * swing * Math.abs(Math.sin(ph / 2)),
    0.07 + 0.015 * Math.sin(T * 0.9) + 0.2 * swing * Math.sin(ph / 2)));
  const liftT = new V3(0.05, -0.34, 0.33);
  const tFree = shoulderG.localToWorld(restT.lerp(liftT, liftW));
  const poleF = POLE_REST.clone().lerp(POLE_LIFT, liftW).normalize().applyQuaternion(qS);
  const poleG = POLE_GRIP.clone().normalize().applyQuaternion(qS);
  const pole = poleF.lerp(poleG, gw).normalize();

  spearTgt.getWorldQuaternion(qSp);
  const axis = new V3(0, 1, 0).applyQuaternion(qSp);
  const gripP = spearTgt.localToWorld(new V3(0, -0.01, 0));
  if (!wristInit) { wristGuess.copy(gripP); wristInit = true; }
  for (let it = 0; it < 3; it++) {
    solveArm(S, tFree.clone().lerp(wristGuess, gw), pole);
    gripQuat(axis);
    wristGuess.copy(gripP).sub(GRIP_C.clone().applyQuaternion(qG));
  }
  solveArm(S, tFree.clone().lerp(wristGuess, gw), pole);
  gripQuat(axis);
  qRel.copy(relRest).slerp(relLift, liftW);
  qFree.copy(qF).multiply(qRel);
  qH.copy(qFree).slerp(qG, gw);
  if (AA && AA.shake > 0) { eTmp.set((R() - 0.5) * AA.shake * 6, (R() - 0.5) * AA.shake * 6, (R() - 0.5) * AA.shake * 6); qH.multiply(qA.setFromEuler(eTmp)); }
  upperArm.quaternion.copy(qS).invert().multiply(qU);
  forearm.quaternion.copy(qU).invert().multiply(qF);
  hand.quaternion.copy(qF).invert().multiply(qH);
  gripFollow();

  // fingers: open while reaching, wrap the shaft on arrival, clench on command
  const g2 = sstep(0.55, 1, gwLin);
  const open = Math.sin(Math.PI * clamp01(gwLin)) * (1 - g2);
  const cc = AA ? AA.curl * aw : 0;
  const judder = AA ? AA.shake * 12 : 0;
  twitchT -= dt;
  if (twitchT <= 0) { twitchT = 2.4 + R() * 3.5; if (!AA && gw < 0.1) twitch[(R() * 4) | 0] = 0.45; }
  for (let i = 0; i < 4; i++) {
    twitch[i] *= Math.exp(-dt * 9);
    for (let j = 0; j < 3; j++) {
      const base = lerp(REST_C[j] * (1 - open) - open * 0.12, GRIP_A[j], g2);
      const v = lerp(base, FIST_C[j], cc * (1 - g2)) + cc * g2 * 0.06 + twitch[i] * (j ? 0.6 : 1) + (R() - 0.5) * judder + i * 0.02 * (1 - g2);
      fingers[i][j].rotation.z = -v;
    }
  }
  const tz1 = lerp(lerp(-0.3 + 0.2 * open, -1.28, g2), -1.5, cc * (1 - g2));
  const tx1 = lerp(lerp(-0.35 - 0.3 * open, -0.1, g2), -0.06, cc * (1 - g2));
  const tz2 = lerp(lerp(-0.2, -0.75, g2), -0.95, cc * (1 - g2));
  thumb[0].rotation.set(tx1, 0, tz1); thumb[1].rotation.set(0, 0, tz2);
  pRod.position.y = -0.225 - (AA ? AA.piston * aw : 0) * 0.035;

  // arm events
  if (armAction) {
    armAction.def.ev.forEach(([t, name]) => { if (ak >= t && !armAction.fired.has(name + t)) { armAction.fired.add(name + t); fireArm(name); } });
    if (ak >= 1) { armAction = null; const l = idleLabel(); if (l) onStatus(l); }
  }

  // neon: breathing, flicker, charge wave, and a sympathetic glow when the spear draws power
  let neonSp = 0;
  if (action && action.name === 'throw') neonSp = sstep(0.05, 0.4, k) * (1 - sstep(0.5, 0.7, k));
  if (action && action.name === 'on') neonSp = sstep(0.1, 0.5, k) * (1 - sstep(0.75, 0.95, k));
  if (neonSp > 0.4) { pulseAcc += dt * 9; while (pulseAcc >= 1) { pulseAcc -= 1; spawnPulse(false); } }
  flickT -= dt;
  if (flickT <= 0) { flickT = 1.5 + R() * 4; flickIdx = (R() * neonMats.length) | 0; flickLeft = 0.12 + R() * 0.15; }
  flickLeft -= dt;
  const breath = 0.62 + 0.08 * Math.sin(T * 2.2);
  const actN = AA ? AA.neon * aw : 0;
  const wave = (AA && AA.wave !== null && AA.wave >= 0 && aw > 0.01) ? AA.wave : -9;
  let nSum = 0;
  neonMats.forEach((m, i) => {
    let In = breath + actN + neonSp * 0.8 + boost * 0.3;
    if (wave > -1) In += 1.4 * Math.exp(-Math.pow((wave - m.userData.order) * 5, 2));
    if (i === flickIdx && flickLeft > 0 && R() < 0.7) In *= 0.25;
    m.color.copy(NEON).multiplyScalar(0.25 + 0.75 * Math.min(1, In));
    if (In > 1) m.color.lerp(WHITE, Math.min(0.7, (In - 1) * 0.6));
    nSum += In;
  });
  armLight.intensity = 0.2 + 0.55 * nSum / neonMats.length;

  // arm arcs during charge
  const nArm = Math.min(armArcs.length, Math.round((AA ? AA.arc * aw : 0) + (neonSp > 0.6 ? 1 : 0)));
  armArcs.forEach((a, i) => {
    if (i >= nArm) { a.line.visible = false; return; }
    a.ttl -= dt;
    if (a.ttl <= 0) {
      const n = (R() * (arcNodes.length - 1)) | 0;
      zigzag(a, wpos(arcNodes[n].o), wpos(arcNodes[n + 1].o), 0.18); a.line.visible = true;
    }
  });

  scene.updateMatrixWorld(true);
  rebuildWires();

  /* ---------- cable ---------- */
  const a0 = wpos(cableAnchor), a1 = wpos(wristCable);
  if (!cableInit) {
    for (let i = 0; i < CN; i++) { const u = i / (CN - 1); const p = a0.clone().lerp(a1, u); p.y -= Math.sin(Math.PI * u) * 0.25; cp.push(p); cq.push(p.clone()); }
    cableInit = true;
  }
  const g = -9.8 * dt * dt; const cw = -scroll * 3 * dt * dt;
  for (let i = 1; i < CN - 1; i++) {
    const p = cp[i], q = cq[i];
    const vx = (p.x - q.x) * 0.985, vy = (p.y - q.y) * 0.985, vz = (p.z - q.z) * 0.985;
    q.copy(p); p.x += vx + cw; p.y += vy + g; p.z += vz;
    if (p.y < 0.014) { p.y = 0.014; p.x -= (p.x - q.x) * 0.3; p.z -= (p.z - q.z) * 0.3; }
  }
  for (let it = 0; it < 10; it++) {
    cp[0].copy(a0); cp[CN - 1].copy(a1);
    for (let i = 0; i < CN - 1; i++) {
      const p1 = cp[i], p2 = cp[i+1];
      const dx = p2.x - p1.x, dy = p2.y - p1.y, dz = p2.z - p1.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6; const diff = (d - CL) / d;
      if (i === 0) { p2.x -= dx * diff; p2.y -= dy * diff; p2.z -= dz * diff; }
      else if (i === CN - 2) { p1.x += dx * diff; p1.y += dy * diff; p1.z += dz * diff; }
      else { p1.x += dx * diff * 0.5; p1.y += dy * diff * 0.5; p1.z += dz * diff * 0.5; p2.x -= dx * diff * 0.5; p2.y -= dy * diff * 0.5; p2.z -= dz * diff * 0.5; }
    }
  }
  cp[0].copy(a0); cp[CN - 1].copy(a1); cq[0].copy(a0); cq[CN - 1].copy(a1);
  cableCurve = new THREE.CatmullRomCurve3(cp);
  const cgeo = new THREE.TubeGeometry(cableCurve, 40, 0.013, 5, false);
  if (!cableMesh) { cableMesh = new THREE.Mesh(cgeo, cableMat); cableMesh.castShadow = true; cableMesh.frustumCulled = false; scene.add(cableMesh); }
  else { cableMesh.geometry.dispose(); cableMesh.geometry = cgeo; }

  // energy pulses travel from the wrist (u=1) to the spear (u=0)
  let activeP = 0;
  pulses.forEach(p => {
    if (!p.on) return;
    p.u -= dt * 2.3;
    if (p.u <= 0) {
      p.on = false; p.s.visible = false;
      burst(a0, 5, 0.8, 0.3, neonColor); boost = Math.min(1.2, boost + 0.08);
      if (p.final) deliver();
      return;
    }
    activeP++;
    p.s.position.copy(cableCurve.getPoint(p.u));
    p.s.material.color.copy(NEON).lerp(PINK, (1 - p.u) * 0.85);
    const sc = 0.13 + 0.05 * Math.sin(T * 40 + p.u * 9); p.s.scale.set(sc, sc, 1);
    if (R() < 0.25) sparks.emit(p.s.position, new V3((R() - 0.5) * 0.4, R() * 0.3, (R() - 0.5) * 0.4), 0.25, p.s.material.color);
  });
  const cg = Math.min(0.7, neonSp * 0.35 + activeP * 0.1 + (armAction && armAction.name === 'charge' ? 0.25 * aw : 0) + boost * 0.15);
  cableMat.emissive.copy(NEON).multiplyScalar(cg);
  boost *= Math.exp(-dt * 2.5); if (boost < 0.002) boost = 0;

  sparks.update(dt, wind); dust.update(dt, wind * 0.5);

  // trail
  if (trailOn && blade.visible) {
    samples.unshift({ a: tipWorld(), b: spear.localToWorld(new V3(0, blade.position.y + 0.42 * blade.scale.y, 0)) });
    if (samples.length > TN) samples.pop();
  } else if (samples.length) { samples.pop(); if (samples.length) samples.pop(); }
  const ns = samples.length; trail.visible = ns > 1;
  if (ns > 1) {
    for (let i = 0; i < TN; i++) {
      const s = samples[Math.min(i, ns - 1)]; const f = 0.55 * Math.pow(Math.max(0, 1 - i / (ns - 1)), 1.6); const o = i * 6;
      trailPos[o] = s.a.x; trailPos[o+1] = s.a.y; trailPos[o+2] = s.a.z; trailPos[o+3] = s.b.x; trailPos[o+4] = s.b.y; trailPos[o+5] = s.b.z;
      trailCol[o] = shellCol.r * f; trailCol[o+1] = shellCol.g * f; trailCol[o+2] = shellCol.b * f;
      trailCol[o+3] = shellCol.r * f * 0.25; trailCol[o+4] = shellCol.g * f * 0.25; trailCol[o+5] = shellCol.b * f * 0.25;
    }
    tg.attributes.position.needsUpdate = true; tg.attributes.color.needsUpdate = true;
  }

  // rings
  rings.forEach(r => {
    if (!r.m.visible) return; r.t += dt; const kk = r.t / r.dur;
    if (kk >= 1) { r.m.visible = false; return; }
    const s = r.s0 + (r.s1 - r.s0) * (1 - Math.pow(1 - kk, 3)); r.m.scale.set(s, s, s); r.m.material.opacity = 1 - kk;
    if (!r.ground) r.m.quaternion.copy(camera.quaternion);
  });

  // projectile
  if (proj.active) {
    proj.t += dt; proj.g.position.addScaledVector(proj.vel, dt);
    projShellMat.color.copy(shellCol); projGlowMat.color.copy(shellCol); proj.light.color.copy(shellCol);
    for (let i = 0; i < 3; i++) sparks.emit(proj.g.position, new V3(-proj.vel.x * 0.08 + (R() - 0.5), (R() - 0.3), (R() - 0.5)), 0.3 + R() * 0.3, plasmaColor());
    if (proj.t > 0.85 || proj.g.position.y < 0.05) {
      const p = proj.g.position.clone(); burst(p, 50, 3, 0.6); ring(p, 0.05, 0.9, 0.4, false);
      proj.active = false; proj.g.visible = false; shake(0.04);
    }
  }

  // camera
  if (cam.auto && !cam.dragging) cam.theta += raw * 0.12;
  camera.position.set(cam.tx + cam.r * Math.sin(cam.phi) * Math.sin(cam.theta), cam.ty + cam.r * Math.cos(cam.phi), (cam.tz || 0) + cam.r * Math.sin(cam.phi) * Math.cos(cam.theta));
  camera.lookAt(cam.tx, cam.ty, cam.tz || 0);
  if (shakeAmp > 0.001) { camera.position.x += (R() - 0.5) * shakeAmp; camera.position.y += (R() - 0.5) * shakeAmp; }
  shakeAmp *= Math.exp(-raw * 9);
  flashV *= Math.exp(-raw * 7);
}

return {
  scene, camera, cam, ACTIONS, ARM_ACTIONS, TIERS, GRIP_DUR,
  step, setLoop, trigger, setArmMode, armAct, setEnvironment,
  setTier(i){ tierIdx = i; }, setSlow(v){ slow = !!v; },
  get flash(){ return flashV; }, get plasmaOn(){ return plasmaOn; }, get armMode(){ return armMode; },
  // for offline renders: jump straight into a pose
  snapArm(m){ armMode = m; gwTarget = gwLin = m === 'grip' ? 1 : 0; armMoving = false; },
  setPlasma(v){ plasmaOn = !!v; },
  rig: { armPivot, shoulderG, upperArm, forearm, hand, spear, root }
};
}
/*WORLD-END*/
