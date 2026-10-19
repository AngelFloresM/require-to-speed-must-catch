// Menús y HUD (DOM simple, sin frameworks).

const $ = (id) => document.getElementById(id);
const SCREENS = ['menu', 'controls', 'garage', 'pause', 'results'];

export function showScreen(name) {
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== name);
  const first = name && $(name).querySelector('button');
  if (first) first.focus();
}

export function formatTime(t) {
  if (!isFinite(t)) return '--:--.--';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export function renderGarage(car) {
  $('car-name').textContent = car.name;
  const labels = { topSpeed: 'Velocidad', acceleration: 'Aceleración', handling: 'Manejo' };
  $('car-stats').innerHTML = Object.entries(labels)
    .map(([k, label]) => `<div class="stat"><span>${label}</span><div class="bar"><div style="width:${car.stats[k] * 10}%"></div></div></div>`)
    .join('');
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
    this.set('gear', this.gear, car.gear < 0 ? 'R' : String(car.gear));
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
