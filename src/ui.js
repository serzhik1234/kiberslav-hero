
(function(){
'use strict';
const stage = document.getElementById('stage');
if (typeof THREE === 'undefined') { document.getElementById('fail').style.display = 'flex'; return; }
const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const nowEl = document.getElementById('now'), flashEl = document.getElementById('flash'), powerLbl = document.getElementById('powerLbl');
const world = createWorld(THREE, {
  reduceMotion,
  onStatus: t => { nowEl.textContent = t; },
  onPower: on => { powerLbl.textContent = on ? 'Выключить плазму' : 'Включить плазму'; }
});
const cam = world.cam;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
try { world.setEnvironment(renderer); } catch (e) { /* no float targets: plain lights only */ }
stage.prepend(renderer.domElement);
let pixelMode = false;

/* ---------- camera controls ---------- */
const cvs = renderer.domElement; let px = 0, py = 0;
cvs.addEventListener('pointerdown', e => { cam.dragging = true; px = e.clientX; py = e.clientY; cvs.setPointerCapture(e.pointerId); });
cvs.addEventListener('pointermove', e => {
  if (!cam.dragging) return;
  cam.theta -= (e.clientX - px) * 0.008; cam.phi = Math.max(0.35, Math.min(1.52, cam.phi - (e.clientY - py) * 0.006));
  px = e.clientX; py = e.clientY;
});
const endDrag = () => { cam.dragging = false; };
cvs.addEventListener('pointerup', endDrag); cvs.addEventListener('pointercancel', endDrag);
cvs.addEventListener('wheel', e => { e.preventDefault(); cam.r = Math.max(1.4, Math.min(10, cam.r * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });
document.getElementById('zin').addEventListener('click', () => { cam.r = Math.max(1.6, cam.r * 0.88); });
document.getElementById('zout').addEventListener('click', () => { cam.r = Math.min(9, cam.r * 1.12); });

function resize(){
  const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
  renderer.setPixelRatio(pixelMode ? 0.33 : Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(w, h, false); world.camera.aspect = w / h; world.camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage); resize();

/* ---------- UI ---------- */
function setLoop(m){
  world.setLoop(m);
  document.querySelectorAll('[data-loop]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.loop === m)));
}
function setArm(m){
  world.setArmMode(m);
  document.querySelectorAll('[data-arm]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.arm === m)));
}
document.querySelectorAll('[data-loop]').forEach(b => b.addEventListener('click', () => setLoop(b.dataset.loop)));
document.querySelectorAll('[data-arm]').forEach(b => b.addEventListener('click', () => setArm(b.dataset.arm)));
document.querySelectorAll('[data-armact]').forEach(b => b.addEventListener('click', () => world.armAct(b.dataset.armact)));
document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => world.trigger(b.dataset.act)));
const tierInput = document.getElementById('tier'), tierName = document.getElementById('tierName');
tierInput.addEventListener('input', () => { const i = +tierInput.value - 1; world.setTier(i); tierName.textContent = tierInput.value + ', ' + world.TIERS[i].name; });
document.getElementById('slow').addEventListener('change', e => world.setSlow(e.target.checked));
document.getElementById('pix').addEventListener('change', e => { pixelMode = e.target.checked; stage.classList.toggle('pixel', pixelMode); resize(); });
const autoBox = document.getElementById('auto'); autoBox.checked = cam.auto; autoBox.addEventListener('change', e => { cam.auto = e.target.checked; });
(function(){
  const dl = document.getElementById('timings'); const fmt = s => s.toFixed(2).replace('.', ',') + ' с';
  const add = (label, dur) => { const dt = document.createElement('dt'); dt.textContent = label; const dd = document.createElement('dd'); dd.textContent = fmt(dur); dl.append(dt, dd); };
  ['thrust', 'sweep', 'throw', 'slide', 'jump', 'on', 'off'].forEach(k => add(world.ACTIONS[k].label, world.ACTIONS[k].dur));
  add('Хват копья и отпускание', world.GRIP_DUR);
  add(world.ARM_ACTIONS.clench.label, world.ARM_ACTIONS.clench.dur);
  add(world.ARM_ACTIONS.charge.label, world.ARM_ACTIONS.charge.dur);
})();
window.addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const map = { Digit1: () => setLoop('idle'), Digit2: () => setLoop('run'),
    KeyG: () => world.armAct('clench'), KeyC: () => world.armAct('charge'),
    KeyJ: () => world.trigger('thrust'), KeyK: () => world.trigger('sweep'), KeyL: () => world.trigger('throw'),
    ShiftLeft: () => world.trigger('slide'), ShiftRight: () => world.trigger('slide'), Space: () => world.trigger('jump'), KeyF: () => world.trigger('toggle') };
  const f = map[e.code]; if (!f) return;
  if (e.code === 'Space') e.preventDefault();
  f();
});

let last = performance.now() / 1000;
function frame(ms){
  requestAnimationFrame(frame);
  const now = ms / 1000; const raw = Math.min(1 / 30, Math.max(0, now - last)); last = now;
  world.step(raw);
  flashEl.style.opacity = world.flash.toFixed(3);
  renderer.render(world.scene, world.camera);
}
requestAnimationFrame(frame);
})();
