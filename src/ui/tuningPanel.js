// Panel de tuneo de física: barras para mover en vivo los valores del carro
// del jugador. Se abre con T (o desde la pausa) y el juego sigue corriendo.
// Los cambios se guardan por carro en localStorage.
import { GROUPS, PARAMS, baseValue, parseOverrides } from '../data/physicsTuning.js';

const STORAGE_KEY = 'physicsTuning';

export function loadOverrides() {
  try {
    return parseOverrides(localStorage.getItem(STORAGE_KEY));
  } catch {
    return {};
  }
}

function saveOverrides(all) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

const decimals = (step) => (String(step).split('.')[1] ?? '').length;
const show = (p, v) => (p.pct ? `${Math.round(v * 100)} %` : v.toFixed(decimals(p.step)));

export class TuningPanel {
  // overrides: { carId: { key: value } } (se modifica en el lugar).
  // onChange(carDef): se llama tras cada cambio para reconstruir la física.
  constructor(root, overrides, { onChange }) {
    this.root = root;
    this.overrides = overrides;
    this.onChange = onChange;
    this.car = null;
    this.vehicle = null;
    // Con el foco en el panel, las teclas no manejan el carro (T / Esc lo cierran).
    root.addEventListener('keydown', (e) => {
      if (e.code === 'KeyT' || e.code === 'Escape') {
        e.preventDefault();
        this.close();
      }
      e.stopPropagation();
    });
    root.addEventListener('input', (e) => {
      const key = e.target.dataset.key;
      if (key) this.set(key, Number(e.target.value));
    });
    // Tras usar el mouse, el teclado vuelve a manejar el carro.
    root.addEventListener('pointerup', () => setTimeout(() => {
      if (root.contains(document.activeElement)) document.activeElement.blur();
    }));
    root.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.reset) this.reset(t.dataset.reset);
      else if (t.dataset.act === 'close') this.close();
      else if (t.dataset.act === 'reset-all') this.reset(null);
      else if (t.dataset.act === 'copy') this.copy(t);
    });
  }

  get isOpen() {
    return !this.root.classList.contains('hidden');
  }

  // carDef: entrada de CARS. vehicle: el carro en juego (o null en el menú).
  open(carDef, vehicle) {
    this.car = carDef;
    this.vehicle = vehicle;
    this.root.classList.remove('hidden');
    this.render();
  }

  close() {
    this.root.classList.add('hidden');
    document.activeElement?.blur?.();
    this.onClose?.();
  }

  toggle(carDef, vehicle) {
    if (this.isOpen) this.close();
    else this.open(carDef, vehicle);
  }

  value(key) {
    return this.overrides[this.car.id]?.[key] ?? baseValue(this.car.physics, key);
  }

  set(key, v) {
    const ov = (this.overrides[this.car.id] ??= {});
    if (Math.abs(v - baseValue(this.car.physics, key)) < 1e-9) delete ov[key];
    else ov[key] = v;
    if (!Object.keys(ov).length) delete this.overrides[this.car.id];
    this.changed();
    this.updateRow(key);
  }

  reset(key) {
    const ov = this.overrides[this.car.id];
    if (ov) {
      if (key) delete ov[key];
      else delete this.overrides[this.car.id];
      if (ov && !Object.keys(ov).length) delete this.overrides[this.car.id];
    }
    this.changed();
    this.render();
  }

  changed() {
    saveOverrides(this.overrides);
    this.onChange(this.car);
    this.updateInfo();
  }

  async copy(btn) {
    const text = JSON.stringify({ [this.car.id]: this.overrides[this.car.id] ?? {} }, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Copiado';
    } catch {
      btn.textContent = 'No se pudo copiar';
    }
    setTimeout(() => (btn.textContent = 'Copiar valores'), 1500);
  }

  render() {
    const rows = GROUPS.map((g) => {
      const items = PARAMS.filter((p) => p.group === g).map((p) => {
        const v = this.value(p.key);
        return `<div class="tp-row" data-row="${p.key}" title="${p.desc ?? ''}">
          <label>${p.label}<span class="tp-val"></span>
            <button class="tp-reset" data-reset="${p.key}" aria-label="Restablecer ${p.label}">↺</button></label>
          <input type="range" data-key="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}" value="${v}" aria-label="${p.label}" />
        </div>`;
      });
      return `<details open><summary>${g}</summary>${items.join('')}</details>`;
    }).join('');
    this.root.innerHTML = `
      <header><b>Tuneo de física · ${this.car.name}</b>
        <button data-act="close" aria-label="Cerrar">✕</button></header>
      <p class="tp-info"></p>
      <div class="tp-list">${rows}</div>
      <footer>
        <button data-act="reset-all">Restablecer todo</button>
        <button data-act="copy">Copiar valores</button>
      </footer>
      <p class="tp-note">Cambia en vivo y se guarda para este carro. Los rivales se igualan a tu carro al empezar cada carrera. T / Esc: cerrar.</p>`;
    for (const p of PARAMS) this.updateRow(p.key);
    this.updateInfo();
  }

  updateRow(key) {
    const p = PARAMS.find((q) => q.key === key);
    const row = this.root.querySelector(`[data-row="${key}"]`);
    if (!row) return;
    const v = this.value(key);
    const changed = this.overrides[this.car.id]?.[key] !== undefined;
    row.classList.toggle('changed', changed);
    row.querySelector('.tp-val').textContent = show(p, v);
    row.querySelector('input').value = v;
  }

  updateInfo() {
    const info = this.root.querySelector('.tp-info');
    if (!info) return;
    const n = Object.keys(this.overrides[this.car.id] ?? {}).length;
    const top = this.vehicle ? ` · Vel. máx.: ${Math.round(this.vehicle.topSpeed * 3.6)} km/h` : '';
    info.textContent = `${n ? `${n} valor${n > 1 ? 'es' : ''} cambiado${n > 1 ? 's' : ''}` : 'Valores de fábrica'}${top}`;
  }
}
