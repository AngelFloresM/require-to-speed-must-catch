// Miniatura de la pista en el menú de carrera rápida: el trazo completo
// ajustado al canvas, la meta y una flecha con el sentido de carrera.
import { trackBounds } from '../track.js';

export function drawTrackThumb(canvas, track) {
  // Oculto (otro menú en pantalla): se dibuja al mostrarse.
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);

  const b = trackBounds(track);
  const pad = 12;
  const k = Math.min((w - pad * 2) / (b.maxX - b.minX), (h - pad * 2) / (b.maxY - b.minY));
  const ox = (w - (b.maxX - b.minX) * k) / 2;
  const oy = (h - (b.maxY - b.minY) * k) / 2;
  const P = (x, y) => [ox + (x - b.minX) * k, oy + (b.maxY - y) * k];

  g.lineJoin = 'round';
  g.beginPath();
  for (let s = 0; s <= track.length; s += 4) {
    const p = track.pointAt(s);
    if (s === 0) g.moveTo(...P(p.x, p.y));
    else g.lineTo(...P(p.x, p.y));
  }
  g.closePath();
  g.strokeStyle = '#e8e8e8';
  g.lineWidth = 3;
  g.stroke();

  // Meta: raya cruzada a la pista.
  const p0 = track.pointAt(0);
  const [mx, my] = P(p0.x, p0.y);
  const nx = Math.sin(p0.heading);
  const ny = Math.cos(p0.heading);
  g.strokeStyle = '#4caf50';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(mx - nx * 7, my - ny * 7);
  g.lineTo(mx + nx * 7, my + ny * 7);
  g.stroke();

  // Flecha del sentido de carrera, un poco después de la meta.
  const p1 = track.pointAt(Math.min(track.length * 0.04, 120));
  const [ax, ay] = P(p1.x, p1.y);
  const fx = Math.cos(p1.heading);
  const fy = -Math.sin(p1.heading);
  g.fillStyle = '#ffd34d';
  g.beginPath();
  g.moveTo(ax + fx * 8, ay + fy * 8);
  g.lineTo(ax - fx * 4 - fy * 5, ay - fy * 4 + fx * 5);
  g.lineTo(ax - fx * 4 + fy * 5, ay - fy * 4 - fx * 5);
  g.closePath();
  g.fill();

  // Largo de la vuelta.
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.font = '12px system-ui, sans-serif';
  g.textAlign = 'right';
  g.fillText(`${(track.length / 1000).toFixed(1)} km`, w - 6, h - 6);
}
