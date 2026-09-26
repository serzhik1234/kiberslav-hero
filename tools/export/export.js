// Blockout export: the procedural hero as one skinned mesh + skeleton + baked animation clips (.glb).
// usage: node tools/export/export.js [out.glb]      (needs: npm i in tools/export, playwright's chromium)
// Then tools/export/to_fbx.py turns the .glb into .fbx and .blend with Blender (bpy).
//
// Every part of the model is rigidly bound (weight 1) to its nearest rig joint, so the file is a reference
// for proportions, pivots and timings, not final skinning. Export space: Y up, the hero faces +Z,
// 1 unit = 1 m (the prototype is scaled so the hero is ~1.8 m tall), origin on the ground under the hips.
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const ROOT = path.join(__dirname, '../..');
const out = path.resolve(process.argv[2] || path.join(ROOT, 'export/kiberslav_blockout.glb'));
const html = fs.readFileSync(path.join(ROOT, 'dist/index.html'), 'utf8');
const code = html.slice(html.indexOf('/*WORLD-BEGIN*/'), html.indexOf('/*WORLD-END*/'));
const nm = path.join(__dirname, 'node_modules/three');
const three = fs.readFileSync(path.join(nm, 'build/three.min.js'), 'utf8');
const exporter = fs.readFileSync(path.join(nm, 'examples/js/exporters/GLTFExporter.js'), 'utf8');

const page = `<html><body><script>${three}</script><script>${exporter}</script><script>${code}
window.run = function(){
  const V3 = THREE.Vector3, Q = THREE.Quaternion, M4 = THREE.Matrix4;
  let seed = 1234; const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const FPS = 30, SCALE = 0.7;
  // [prototype joint, exported bone]
  const BONES = [
    ['Hips', 'Hips'], ['Spine', 'Spine'], ['Chest', 'Chest'], ['Neck', 'Neck'], ['Head', 'Head'],
    ['RightShoulder', 'RightShoulder'], ['RightUpperArm', 'RightArm'], ['RightForearm', 'RightForeArm'], ['RightHand', 'RightHand'],
    ['Shoulder', 'LeftShoulder'], ['UpperArm', 'LeftArm'], ['Forearm', 'LeftForeArm'], ['Hand', 'LeftHand'],
    ['LeftUpLeg', 'LeftUpLeg'], ['LeftLeg', 'LeftLeg'], ['LeftFoot', 'LeftFoot'],
    ['RightUpLeg', 'RightUpLeg'], ['RightLeg', 'RightLeg'], ['RightFoot', 'RightFoot'],
    ['Spear', 'Spear']
  ];
  for (let i = 1; i <= 4; i++) for (let j = 1; j <= 3; j++) BONES.push(['Finger' + i + '_' + j, 'LeftHandFinger' + i + '_' + j]);
  for (let j = 1; j <= 2; j++) BONES.push(['Thumb_' + j, 'LeftHandThumb' + j]);

  function makeWorld(){
    seed = 1234;
    const w = createWorld(THREE, { random: rand });
    w.snapArm('grip');
    for (let i = 0; i < 90; i++) w.step(1 / 60);
    const pivot = w.scene.getObjectByName('ArmPivot'), map = {};
    pivot.traverse(o => { if (o.name && map[o.name] === undefined) map[o.name] = o; });
    return { w, map };
  }

  // ---- bind pose: idle, standing ----
  const { w: W0, map: M0 } = makeWorld();
  W0.scene.updateMatrixWorld(true);
  const hipsW = M0.Hips.getWorldPosition(new V3());
  const O = new V3(hipsW.x, 0, hipsW.z);
  const RC = new Q().setFromAxisAngle(new V3(0, 1, 0), -Math.PI / 2);     // +X (prototype forward) -> +Z
  const TEXP = new M4().makeScale(SCALE, SCALE, SCALE).multiply(new M4().makeRotationFromQuaternion(RC)).multiply(new M4().makeTranslation(-O.x, -O.y, -O.z));
  const recs = BONES.filter(([src]) => M0[src]).map(([src, name]) => ({ src, name }));
  const bySrc = {}; recs.forEach((r, i) => { r.i = i; bySrc[r.src] = r; });
  recs.forEach(r => { let p = M0[r.src].parent; while (p && !bySrc[p.name]) p = p.parent; r.parent = p ? bySrc[p.name] : null; });

  const tv = new V3(), tq = new Q();
  function expWorld(obj, out){   // export-space world matrix without scale
    obj.getWorldPosition(tv); obj.getWorldQuaternion(tq);
    tv.sub(O).applyQuaternion(RC).multiplyScalar(SCALE);
    return out.compose(tv, new Q().copy(RC).multiply(tq), new V3(1, 1, 1));
  }
  function locals(map){          // bone local transforms in export space
    const Wm = recs.map(r => expWorld(map[r.src], new M4()));
    return recs.map((r, i) => {
      const L = r.parent ? new M4().copy(Wm[r.parent.i]).invert().multiply(Wm[i]) : Wm[i].clone();
      const p = new V3(), q = new Q(), s = new V3(); L.decompose(p, q, s); return { p, q };
    });
  }

  // ---- geometry: every visible opaque mesh of the hero, baked into export space, merged by material ----
  const visible = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const groups = new Map();      // material -> {mat, parts: []}
  let skipped = 0;
  M0.ArmPivot = W0.scene.getObjectByName('ArmPivot');
  M0.ArmPivot.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh || !visible(o)) return;
    let b = o; while (b && !bySrc[b.name]) b = b.parent;
    const bone = b ? bySrc[b.name].i + 1 : 0;                   // +1: bone 0 is Root
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    const M = new M4().multiplyMatrices(TEXP, o.matrixWorld);
    g.applyMatrix4(M);
    const flip = M.determinant() < 0;
    const ranges = Array.isArray(o.material) && g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
    for (const rg of ranges) {
      const mat = mats[rg.materialIndex || 0];
      if (!mat || mat.transparent || mat.visible === false) { skipped++; continue; }
      if (!groups.has(mat)) groups.set(mat, { mat, parts: [] });
      groups.get(mat).parts.push({ g, start: rg.start, count: rg.count, bone, flip });
    }
  });

  // one skinned mesh per material, all on one skeleton (a multi-material glTF mesh shares its vertex buffers,
  // which Blender's importer would duplicate for every primitive); to_fbx.py joins them into one object
  const matList = [], geos = []; let tris = 0;
  const va = new V3(), vb = new V3(), vc = new V3(), n = new V3();
  for (const { mat, parts } of groups.values()) {
    const P = [], N = [], UV = [], C = [], SI = [], SW = [];
    for (const { g, start: s0, count, bone, flip } of parts) {
      const pos = g.attributes.position, uv = g.attributes.uv, col = g.attributes.color;
      for (let t = s0; t + 2 < s0 + count; t += 3) {
        const idx = flip ? [t, t + 2, t + 1] : [t, t + 1, t + 2];
        va.fromBufferAttribute(pos, idx[0]); vb.fromBufferAttribute(pos, idx[1]); vc.fromBufferAttribute(pos, idx[2]);
        n.subVectors(vc, vb).cross(new V3().subVectors(va, vb)).normalize();   // flat normal
        for (const k of idx) {
          P.push(pos.getX(k), pos.getY(k), pos.getZ(k)); N.push(n.x, n.y, n.z);
          UV.push(uv ? uv.getX(k) : 0, uv ? uv.getY(k) : 0);
          C.push(col ? col.getX(k) : 1, col ? col.getY(k) : 1, col ? col.getZ(k) : 1);
          SI.push(bone, 0, 0, 0); SW.push(1, 0, 0, 0);
        }
      }
    }
    const m = mat.clone(); m.skinning = true;
    if (!m.name) m.name = 'M' + matList.length;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
    matList.push(m); geos.push(geo); tris += P.length / 9;
  }

  // ---- skeleton at the bind pose ----
  const root = new THREE.Bone(); root.name = 'Root';
  const bones = recs.map(r => { const b = new THREE.Bone(); b.name = r.name; return b; });
  const bind = locals(M0);
  recs.forEach((r, i) => { bones[i].position.copy(bind[i].p); bones[i].quaternion.copy(bind[i].q); (r.parent ? bones[r.parent.i] : root).add(bones[i]); });
  const scene = new THREE.Scene();
  scene.add(root); scene.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([root, ...bones]);
  geos.forEach((g, i) => { const m = new THREE.SkinnedMesh(g, matList[i]); m.name = 'Kiberslav_' + matList[i].name; scene.add(m); m.bind(skeleton); });

  // ---- clips: sampled from the running prototype ----
  const A = W0.ACTIONS;
  const CLIPS = [
    { name: 'Idle', dur: 3.0 },
    { name: 'Run', dur: 2 * Math.PI / 9, setup: w => { w.setLoop('run'); for (let i = 0; i < 90; i++) w.step(1 / 60); } },
    ...[['thrust', 'Thrust'], ['sweep', 'Spin'], ['slide', 'Slide'], ['jump', 'JumpSlam'], ['throw', 'ThrowPlasma'], ['on', 'PlasmaOn'], ['off', 'PlasmaOff']]
      .map(([act, name]) => ({ name, dur: A[act].dur + 0.4, setup: w => w.trigger(act) }))
  ];
  const clips = [];
  for (const c of CLIPS) {
    const { w, map } = makeWorld();
    if (c.setup) c.setup(w);
    const frames = Math.round(c.dur * FPS), times = [];
    const pv = recs.map(() => []), qv = recs.map(() => []), last = recs.map(() => null);
    for (let f = 0; f <= frames; f++) {
      if (f) { w.step(1 / (FPS * 2)); w.step(1 / (FPS * 2)); }
      w.scene.updateMatrixWorld(true);
      const L = locals(map);
      times.push(f / FPS);
      L.forEach(({ p, q }, i) => {
        if (last[i] && last[i].dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);   // keep quaternions continuous
        last[i] = q.clone(); pv[i].push(p.x, p.y, p.z); qv[i].push(q.x, q.y, q.z, q.w);
      });
    }
    const tracks = [];
    recs.forEach((r, i) => {
      tracks.push(new THREE.VectorKeyframeTrack(r.name + '.position', times, pv[i]));
      tracks.push(new THREE.QuaternionKeyframeTrack(r.name + '.quaternion', times, qv[i]));
    });
    clips.push(new THREE.AnimationClip(c.name, -1, tracks));
  }

  // pixel textures are Uint8Array DataTextures; the exporter's ImageData wants Uint8ClampedArray
  for (const m of matList) for (const k of ['map', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'normalMap']) {
    const im = m[k] && m[k].image;
    if (im && im.data && !(im.data instanceof Uint8ClampedArray)) im.data = new Uint8ClampedArray(im.data.buffer, im.data.byteOffset, im.data.byteLength);
  }

  return new Promise(res => new THREE.GLTFExporter().parse(scene, glb => {
    const u8 = new Uint8Array(glb); let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    res({ glb: btoa(s), stats: { tris, materials: matList.length, bones: bones.length + 1, clips: clips.map(c => c.name + ' ' + c.duration.toFixed(2) + 's'), skipped } });
  }, { binary: true, animations: clips, onlyVisible: false }));
};
</script></body></html>`;

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.setContent(page);
  const r = await p.evaluate(() => window.run());
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(r.glb, 'base64'));
  console.log(out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB', JSON.stringify(r.stats));
  await b.close();
})();
