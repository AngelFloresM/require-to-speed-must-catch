import * as THREE from 'three';
import { trackBounds } from './track.js';
import { TRACKS } from './data/tracks.js';
import { Race, PHYSICS_DT } from './race.js';
import { CARS, RIVAL_COLORS } from './data/cars.js';
import { buildTrack } from './render/trackMesh.js';
import { CarMesh } from './render/carMesh.js';
import { Vehicle } from './physics/vehicle.js';
import { readInput } from './input.js';
import { initControls, renderControls, leaveControls } from './ui/controls.js';
import { Hud, showScreen, renderGarage, renderResults, renderTuning } from './ui/screens.js';
import { applyTuning, defaultTuning } from './data/tuning.js';

// ---------- Escena ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc8e8);
scene.fog = new THREE.Fog(0x9cc8e8, 250, 900);
scene.add(new THREE.HemisphereLight(0xdfefff, 0x445533, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.05;
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 200 });
scene.add(sun, sun.target);

const camera = new THREE.PerspectiveCamera(65, 1, 0.3, 1500);
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- Pista ----------
let trackIndex = 0;
let track = null;
let trackGroup = null;
let trackView = { x: 0, y: 0, rx: 380, ry: 260 }; // centro y radios de la cámara del menú

function disposeGroup(group) {
  group.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) for (const m of [].concat(o.material)) m.dispose();
  });
}

function loadTrack(i) {
  trackIndex = i;
  const def = TRACKS[i];
  if (trackGroup) {
    scene.remove(trackGroup);
    disposeGroup(trackGroup);
  }
  track = def.build();
  trackGroup = buildTrack(track, def.theme);
  scene.add(trackGroup);
  scene.background.set(def.theme.sky);
  scene.fog.color.set(def.theme.sky);
  const b = trackBounds(track);
  trackView = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, rx: (b.maxX - b.minX) * 0.75, ry: (b.maxY - b.minY) * 0.75 };
  document.getElementById('track-desc').textContent = def.desc;
  if (preview) showPreview();
}

// ---------- Estado del juego ----------
const hud = new Hud();
let carIndex = 0;
let race = null;
let meshes = [];
let mode = 'menu'; // menu | racing | paused | results
let camMode = 0;   // 0 = persecución, 1 = cofre
let shake = 0;
let laps = 3;
// Ajustes de rendimiento (solo vista por ahora: siempre en 0).
const tuning = defaultTuning();
let gearbox = 'auto';
try {
  gearbox = localStorage.getItem('gearbox') === 'manual' ? 'manual' : 'auto';
} catch {}

const RIVALS = [
  { name: 'Rojo', lane: -4, skill: 0.95 },
  { name: 'Amarillo', lane: 3, skill: 0.88 },
  { name: 'Verde', lane: 0, skill: 0.8 },
];

function startRace() {
  for (const m of meshes) scene.remove(m.group);
  const playerCar = CARS[carIndex];
  const physics = applyTuning(playerCar.physics, tuning);
  const spec = { ...physics, color: playerCar.color };
  // Los rivales usan el mismo carro que el jugador (carrera pareja).
  const colors = RIVAL_COLORS.filter((c) => c !== playerCar.color);
  const rivals = RIVALS.map((r, i) => ({ ...r, spec: physics, color: colors[i] }));
  race = new Race(track, spec, { laps, rivals });
  race.onHit = (f) => (shake = Math.min(1, shake + f / 15));
  meshes = race.racers.map((r) => new CarMesh(r.car, r.color, playerCar.model));
  race.player.car.automatic = gearbox === 'auto';
  for (const m of meshes) scene.add(m.group);
  snapCamera();
  if (preview) scene.remove(preview.group);
  camera.clearViewOffset();
  mode = 'racing';
  showScreen(null);
  hud.show(true);
}

function toMenu() {
  if (preview) scene.add(preview.group);
  mode = 'menu';
  hud.show(false);
  showScreen('menu');
}

// ---------- Menús ----------
document.querySelectorAll('[data-go]').forEach((b) =>
  b.addEventListener('click', () => {
    if (b.dataset.go === 'controls') openControls('menu');
    else showScreen(b.dataset.go);
  }),
);

// Controles: se abren desde el menú o desde la pausa y regresan ahí.
let controlsReturn = 'menu';
function openControls(from) {
  controlsReturn = from;
  renderControls();
  showScreen('controls');
}
initControls();
document.getElementById('controls-back').addEventListener('click', () => {
  leaveControls();
  showScreen(controlsReturn);
});
document.getElementById('pause-controls').addEventListener('click', () => openControls('pause'));
// Carro de muestra en el garaje: detrás de la meta de la pista elegida.
let preview = null;
function showPreview() {
  if (preview) scene.remove(preview.group);
  const c = CARS[carIndex];
  const v = new Vehicle(c.physics);
  const p = track.pointAt(-15);
  v.place(p.x, p.y, p.heading);
  preview = new CarMesh(v, c.color, c.model);
  preview.sync(0);
  scene.add(preview.group);
}

// Selector de pista.
const trackSelect = document.getElementById('track');
trackSelect.innerHTML = TRACKS.map((t, i) => `<option value="${i}">${t.name}</option>`).join('');
trackSelect.addEventListener('change', (e) => loadTrack(Number(e.target.value)));
loadTrack(0);

renderGarage(CARS[carIndex]);
showPreview();
function pickCar(dir) {
  carIndex = (carIndex + dir + CARS.length) % CARS.length;
  renderGarage(CARS[carIndex]);
  showPreview();
}
document.getElementById('car-prev').addEventListener('click', () => pickCar(-1));
document.getElementById('car-next').addEventListener('click', () => pickCar(1));
window.addEventListener('keydown', (e) => {
  if (document.getElementById('garage').classList.contains('hidden')) return;
  if (e.code === 'ArrowLeft') pickCar(-1);
  if (e.code === 'ArrowRight') pickCar(1);
});
document.getElementById('laps').addEventListener('change', (e) => (laps = Number(e.target.value)));
const gearboxSelect = document.getElementById('gearbox');
gearboxSelect.value = gearbox;
gearboxSelect.addEventListener('change', (e) => {
  gearbox = e.target.value;
  try {
    localStorage.setItem('gearbox', gearbox);
  } catch {}
});
document.getElementById('start').addEventListener('click', startRace);
document.getElementById('open-tuning').addEventListener('click', () => {
  renderTuning(CARS[carIndex], tuning);
  showScreen('tuning');
});
document.getElementById('again').addEventListener('click', startRace);
document.getElementById('restart').addEventListener('click', startRace);
document.getElementById('back').addEventListener('click', toMenu);
document.getElementById('quit').addEventListener('click', toMenu);
document.getElementById('resume').addEventListener('click', () => {
  mode = 'racing';
  showScreen(null);
});

// ---------- Cámara ----------
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();

function cameraTarget(car, out, look) {
  const fx = Math.cos(car.heading);
  const fz = -Math.sin(car.heading);
  if (camMode === 1) {
    out.set(car.x + fx * 0.6, 1.25, -car.y + fz * 0.6);
    look.set(car.x + fx * 20, 1.0, -car.y + fz * 20);
  } else {
    const back = 7 + car.speed * 0.02;
    out.set(car.x - fx * back, 2.6, -car.y - fz * back);
    look.set(car.x + fx * 4, 1.0, -car.y + fz * 4);
  }
}

function snapCamera() {
  cameraTarget(race.player.car, camPos, camLook);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

const tmpPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();
function updateCamera(dt) {
  const car = race.player.car;
  cameraTarget(car, tmpPos, tmpLook);
  const k = camMode === 1 ? 1 : 1 - Math.exp(-8 * dt);
  camPos.lerp(tmpPos, k);
  camLook.lerp(tmpLook, camMode === 1 ? 1 : 1 - Math.exp(-14 * dt));
  camera.position.copy(camPos);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake * 0.4;
    camera.position.y += (Math.random() - 0.5) * shake * 0.4;
    shake = Math.max(0, shake - dt * 3);
  }
  camera.lookAt(camLook);
  // El campo de visión se abre con la velocidad (sensación de rapidez).
  const fov = 62 + Math.min(car.speed / car.topSpeed, 1.2) * 14 + (car.nitroActive ? 6 : 0);
  camera.fov += (fov - camera.fov) * (1 - Math.exp(-4 * dt));
  camera.updateProjectionMatrix();

  sun.position.set(car.x + 30, 60, -car.y + 20);
  sun.target.position.set(car.x, 0, -car.y);
}

// ---------- Loop ----------
let last = performance.now();
let acc = 0;
let menuAngle = 0;

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  const input = readInput();

  const inControls = !document.getElementById('controls').classList.contains('hidden');
  if (inControls && input.actions.has('pause')) {
    // En la pantalla de controles, pausa/Esc solo regresa.
    leaveControls();
    showScreen(controlsReturn);
  } else if (mode === 'racing' || mode === 'paused') {
    if (input.actions.has('pause')) {
      mode = mode === 'racing' ? 'paused' : 'racing';
      showScreen(mode === 'paused' ? 'pause' : null);
    }
  }

  if (mode === 'racing') {
    const p = race.player;
    if (input.actions.has('camera')) camMode = (camMode + 1) % 2;
    if (!p.car.automatic && race.state === 'racing') {
      if (input.actions.has('shiftUp')) p.car.manualShift(1);
      if (input.actions.has('shiftDown')) p.car.manualShift(-1);
    }
    if (input.actions.has('reset') && race.state === 'racing') race.respawn(p);
    if (!p.finished) Object.assign(p.car.input, input);

    acc += dt;
    while (acc >= PHYSICS_DT) {
      race.step(PHYSICS_DT);
      acc -= PHYSICS_DT;
    }
    for (const m of meshes) m.sync(dt);
    updateCamera(dt);
    hud.update(race);

    if (race.state === 'finished') {
      mode = 'results';
      setTimeout(() => {
        hud.show(false);
        renderResults(race);
        showScreen('results');
      }, 1500);
    }
  } else if (mode === 'results') {
    acc += dt;
    while (acc >= PHYSICS_DT) {
      race.step(PHYSICS_DT);
      acc -= PHYSICS_DT;
    }
    for (const m of meshes) m.sync(dt);
    updateCamera(dt);
  } else if (mode === 'menu' && ['garage', 'tuning'].some((id) => !document.getElementById(id).classList.contains('hidden'))) {
    // Garaje: la cámara gira alrededor del carro elegido (a la derecha del panel).
    menuAngle += dt * 0.3;
    const d = 7.5;
    const { x, y } = preview.car;
    camera.position.set(x + Math.cos(menuAngle) * d, 2.2, -y + Math.sin(menuAngle) * d);
    camera.lookAt(x, 0.6, -y);
    camera.setViewOffset(window.innerWidth, window.innerHeight, -window.innerWidth * 0.22, 0, window.innerWidth, window.innerHeight);
    sun.position.set(x + 20, 40, -y + 15);
    sun.target.position.set(x, 0, -y);
  } else if (mode === 'menu') {
    camera.clearViewOffset();
    // Cámara girando sobre la pista en el menú.
    menuAngle += dt * 0.05;
    const v = trackView;
    camera.position.set(v.x + Math.cos(menuAngle) * v.rx, 140, -v.y + Math.sin(menuAngle) * v.ry);
    camera.lookAt(v.x, 0, -v.y);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// Rama y commit publicados (lo pone el workflow de deploy).
const build = import.meta.env.VITE_BUILD_INFO;
if (build) document.getElementById('build-info').textContent = build.replace(/([0-9a-f]{7})[0-9a-f]{33}$/, '$1');

showScreen('menu');
requestAnimationFrame(frame);

// Acceso para pruebas en consola.
window.__game = { get race() { return race; }, startRace };
