// Menús y HUD (DOM simple, sin frameworks).
import { measurePerformance } from '../data/performance.js';
import { TUNING } from '../data/tuning.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['menu', 'controls', 'garage', 'tuning', 'pause', 'results'];

export function showScreen(name) {
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== name);
  const first = name && $(name).querySelector('button');
  if (first) first.focus({ preventScroll: true });
}

export function formatTime(t) {
  if (!isFinite(t)) return '--:--.--';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

// physics: la física con la que se va a correr (con tuneo); por defecto la de fábrica.
export function renderGarage(car, physics = car.physics) {
  const perf = measurePerformance(physics);
  $('car-name').textContent = car.name;
  $('car-type').textContent = car.info.tipo;
  const labels = { motor: 'Motor', potencia: 'Potencia', torque: 'Torque', traccion: 'Tracción', caja: 'Caja', peso: 'Peso', frenos: 'Frenos' };
  $('car-info').innerHTML = Object.entries(labels)
    .map(([k, label]) => `<tr><td>${label}</td><td>${car.info[k]}</td></tr>`)
    .join('');
  const rows = [
    ['Velocidad', 'topSpeed', `${Math.round(perf.topKmh)} km/h`],
    ['Aceleración', 'acceleration', `0-100 en ${perf.zeroTo100.toFixed(1)} s`],
    ['Manejo', 'handling', `${perf.lateralG.toFixed(1)} g en curva`],
  ];
  $('car-stats').innerHTML = rows
    .map(([label, k, value]) => `<div class="stat"><span>${label}</span><div class="bar"><div style="width:${perf.bars[k] * 10}%"></div></div><span class="value">${value}</span></div>`)
    .join('');
}

export function renderTuning(car, tuning) {
  $('tuning-list').innerHTML = TUNING.map((t) => {
    const v = tuning[t.id];
    return `<div class="tune">
      <div class="tune-head"><b>${t.label}</b><span class="tune-value">${v > 0 ? '+' : ''}${v}</span></div>
      <div class="tune-slider">
        <small>${t.left}</small>
        <input type="range" min="-5" max="5" step="1" value="${v}" disabled aria-label="${t.label}" />
        <small>${t.right}</small>
      </div>
      <p>${t.desc}</p>
      <p class="tip">Consejo: ${t.tip}</p>
    </div>`;
  }).join('');
  $('tuning').querySelector('h2').textContent = `Ajustes de rendimiento · ${car.name}`;
}

export function renderResults(race) {
  const p = race.player;
  $('result-title').textContent = p.position === 1 ? '¡Ganaste!' : `Terminaste en ${p.position}º lugar`;
  const rows = [...race.racers].sort((a, b) => a.position - b.position);
  $('result-table').innerHTML =
    '<tr><th>Pos</th><th>Piloto</th><th>Tiempo</th><th>Mejor vuelta</th></tr>' +
    rows
      .map((r) => {
        const best = r.lapTimes.length ? Math.min(...r.lapTimes) : Infinity;
        const time = r.finished ? formatTime(r.finishTime) : 'En carrera';
        return `<tr class="${r.isPlayer ? 'me' : ''}"><td>${r.position}</td><td>${r.name}</td><td>${time}</td><td>${formatTime(best)}</td></tr>`;
      })
      .join('');
}

export class Hud {
  constructor() {
    this.el = $('hud');
    this.pos = $('h-pos');
    this.lap = $('h-lap');
    this.time = $('h-time');
    this.best = $('h-best');
    this.speed = $('h-speed');
    this.gear = $('h-gear');
    this.nitro = $('h-nitro');
    this.rpm = $('h-rpm');
    this.tach = this.rpm.parentElement;
    this.mode = $('h-mode');
    this.center = $('h-center');
    this.cache = {};
  }

  show(on) {
    this.el.classList.toggle('hidden', !on);
  }

  // Solo toca el DOM cuando un valor cambia (más barato).
  set(key, el, value) {
    if (this.cache[key] !== value) {
      this.cache[key] = value;
      el.textContent = value;
    }
  }

  update(race) {
    const p = race.player;
    const car = p.car;
    this.set('pos', this.pos, `${p.position}/${race.racers.length}`);
    this.set('lap', this.lap, `${race.currentLap}/${race.laps}`);
    this.set('time', this.time, formatTime(race.time - p.lapStart));
    this.set('best', this.best, formatTime(p.lapTimes.length ? Math.min(...p.lapTimes) : Infinity));
    this.set('speed', this.speed, String(Math.round(Math.abs(car.forwardSpeed) * 3.6)));
    this.set('gear', this.gear, car.displayGear < 0 ? 'R' : String(car.displayGear ?? car.gear));
    this.set('mode', this.mode, car.automatic ? 'AUTO' : 'MANUAL');
    // Tacómetro: el rojo ocupa el último 10%; parpadea cuando conviene subir.
    const rpm = Math.min(100, Math.round((car.rpm / car.spec.redline) * 90));
    if (this.cache.rpm !== rpm) {
      this.cache.rpm = rpm;
      this.rpm.style.width = `${rpm}%`;
    }
    const shiftNow = !car.automatic && car.rpm > car.spec.redline * car.spec.upshiftAt && car.gear < car.spec.gears.length;
    this.tach.classList.toggle('shift', shiftNow && Math.floor(performance.now() / 120) % 2 === 0);
    const nitro = Math.round((car.nitro / car.spec.nitroCapacity) * 100);
    if (this.cache.nitro !== nitro) {
      this.cache.nitro = nitro;
      this.nitro.style.width = `${nitro}%`;
    }

    let msg = '';
    let warn = false;
    if (race.state === 'countdown') msg = String(Math.ceil(race.countdown));
    else if (race.time < 1) msg = '¡YA!';
    else if (p.finished) msg = 'META';
    else if (p.wrongWayTime > 1) { msg = 'SENTIDO CONTRARIO'; warn = true; }
    else if (race.currentLap === race.laps && race.laps > 1 && race.time - p.lapStart < 2) msg = 'ÚLTIMA VUELTA';
    this.set('center', this.center, msg);
    this.center.classList.toggle('warn', warn);
  }
}
