// Minimapa de carrera: la pista pre-dibujada en un canvas; cada cuadro se
// muestra la zona alrededor del jugador, girada para que "arriba" sea su
// frente, con un punto por rival (del color de su carro). No se puede abrir.
import { trackBounds } from '../track.js';

const SCALE = 0.5; // px por metro en el canvas fuente
const ZOOM = 1.4; // px de pantalla por px fuente (~260 m de diámetro)

const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

export class TrackMinimap {
  constructor(track, canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const b = trackBounds(track);
    this.minX = b.minX;
    this.maxY = b.maxY;
    this.src = document.createElement('canvas');
    this.src.width = Math.ceil((b.maxX - b.minX) * SCALE);
    this.src.height = Math.ceil((b.maxY - b.minY) * SCALE);
    const g = this.src.getContext('2d');
    const P = (x, y) => [(x - this.minX) * SCALE, (this.maxY - y) * SCALE];
    g.lineJoin = 'round';
    g.beginPath();
    for (let s = 0; s <= track.length; s += 4) {
      const p = track.pointAt(s);
      if (s === 0) g.moveTo(...P(p.x, p.y));
      else g.lineTo(...P(p.x, p.y));
    }
    g.closePath();
    g.strokeStyle = '#c9ccd1';
    g.lineWidth = track.width * SCALE + 2;
    g.stroke();
    g.strokeStyle = '#4a5058';
    g.lineWidth = track.width * SCALE - 1;
    g.stroke();
    // Meta.
    const p0 = track.pointAt(0);
    const [mx, my] = P(p0.x, p0.y);
    const nx = Math.sin(p0.heading);
    const ny = Math.cos(p0.heading); // y del canvas va hacia abajo
    const hw = track.halfWidth * SCALE;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(mx - nx * hw, my - ny * hw);
    g.lineTo(mx + nx * hw, my + ny * hw);
    g.stroke();
  }

  // Posición en el canvas fuente.
  toSrc(x, y) {
    return [(x - this.minX) * SCALE, (this.maxY - y) * SCALE];
  }

  draw(race) {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    const me = race.player.car;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#20252b';
    ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    ctx.rotate(me.heading - Math.PI / 2);
    ctx.scale(ZOOM, ZOOM);
    const [cx, cy] = this.toSrc(me.x, me.y);
    ctx.translate(-cx, -cy);
    ctx.drawImage(this.src, 0, 0);
    // Rivales.
    for (const r of race.racers) {
      if (r.isPlayer) continue;
      const [x, y] = this.toSrc(r.car.x, r.car.y);
      ctx.beginPath();
      ctx.arc(x, y, 4 / ZOOM + 1.5, 0, Math.PI * 2);
      ctx.fillStyle = css(r.color);
      ctx.fill();
      ctx.lineWidth = 1.2 / ZOOM;
      ctx.strokeStyle = '#000';
      ctx.stroke();
    }
    ctx.restore();
    // Jugador (siempre al centro, hacia arriba).
    ctx.fillStyle = '#4fc3ff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2, H / 2 - 9);
    ctx.lineTo(W / 2 + 6, H / 2 + 7);
    ctx.lineTo(W / 2 - 6, H / 2 + 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  }
}
