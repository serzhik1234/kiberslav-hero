// headless render: node + three r128 + headless-gl, run under xvfb-run
const fs = require('fs');
const THREE = require('three');
const createGL = require('gl');
const html = fs.readFileSync(require('path').join(__dirname, '../../dist/index.html'), 'utf8');
const code = html.slice(html.indexOf('/*WORLD-BEGIN*/'), html.indexOf('/*WORLD-END*/'));
const createWorld = new Function('THREE', 'hooks', code + ';return createWorld(THREE, hooks);');

let s = 1234; const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
const job = JSON.parse(process.argv[2]);
const SS = job.ss || 2, W = job.w * SS, H = job.h * SS;
const gl = createGL(W, H, { preserveDrawingBuffer: true, antialias: false });
const canvas = { width: W, height: H, style: {}, addEventListener(){}, removeEventListener(){}, getContext: () => gl };
gl.canvas = canvas;
const renderer = new THREE.WebGLRenderer({ canvas, context: gl });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

for (const shot of job.shots) {
  s = 1234 + (shot.seed || 0);
  const world = createWorld(THREE, { random: rand, reduceMotion: false });
  try { world.setEnvironment(renderer); } catch (e) { console.log('no environment:', e.message); }
  world.cam.auto = false;
  world.camera.aspect = W / H;
  if (shot.fov) world.camera.fov = shot.fov;
  world.camera.updateProjectionMatrix();
  if (shot.tier !== undefined) world.setTier(shot.tier);
  if (shot.arm) world.snapArm(shot.arm);
  if (shot.plasma === false) world.setPlasma(false);
  const dt = 1 / 60;
  for (let i = 0; i < (shot.warm || 90); i++) world.step(dt);        // settle cable, tiers
  if (shot.loop) world.setLoop(shot.loop);
  if (shot.armMode) world.setArmMode(shot.armMode);
  if (shot.armAct) world.armAct(shot.armAct);
  if (shot.act) world.trigger(shot.act);
  const n = Math.round((shot.t || 0) / dt);
  for (let i = 0; i < n; i++) world.step(dt);
  Object.assign(world.cam, shot.cam || {});
  world.step(0.0001);
  renderer.render(world.scene, world.camera);
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  fs.writeFileSync(shot.out + '.raw', Buffer.from(px));
  fs.writeFileSync(shot.out + '.json', JSON.stringify({ W, H, SS }));
  console.log('rendered', shot.out);
}
