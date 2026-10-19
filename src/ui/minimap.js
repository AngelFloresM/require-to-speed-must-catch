// Minimapa del modo libre: calles pre-dibujadas en un canvas; cada frame se
// copia la zona alrededor del jugador, girada para que "arriba" sea su frente.
const SCALE = 0.5; // px por metro en el canvas fuente

export class Minimap {
  constructor(city, canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const xs = city.boundary.map((p) => p[0]);
    const ys = city.boundary.map((p) => p[1]);
    this.minX = Math.min(...xs) - 50;
    this.maxY = Math.max(...ys) + 50;
    const w = (Math.max(...xs) + 50 - this.minX) * SCALE;
    const h = (this.maxY - Math.min(...ys) + 50) * SCALE;
    this.src = document.createElement('canvas');
    this.src.width = Math.ceil(w);
    this.src.height = Math.ceil(h);
    const g = this.src.getContext('2d');
    const P = ([x, y]) => [(x - this.minX) * SCALE, (this.maxY - y) * SCALE];
    g.fillStyle = '#20252b';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2d343c';
    g.beginPath();
    city.boundary.forEach((p, i) => (i ? g.lineTo(...P(p)) : g.moveTo(...P(p))));
    g.fill();
    for (const park of city.parks) {
      g.fillStyle = park.plaza ? '#6b6250' : '#2f5a32';
      g.beginPath();
      park.poly.forEach((p, i) => (i ? g.lineTo(...P(p)) : g.moveTo(...P(p))));
      g.fill();
    }
    g.lineCap = 'round';
    for (const e of city.edges) {
      g.strokeStyle = e.road.major ? '#e8c22c' : '#c9ccd1';
      g.lineWidth = Math.max(2, e.road.width * SCALE);
      g.beginPath();
      e.path.forEach((p, i) => (i ? g.lineTo(...P(p)) : g.moveTo(...P(p))));
      g.stroke();
    }
  }

  draw(car) {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#20252b';
    ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    ctx.rotate(car.heading - Math.PI / 2);
    const zoom = 1.6; // px de pantalla por px fuente
    ctx.scale(zoom, zoom);
    ctx.drawImage(this.src, -(car.x - this.minX) * SCALE, -(this.maxY - car.y) * SCALE);
    ctx.restore();
    // Flecha del jugador (siempre hacia arriba).
    ctx.fillStyle = '#4fc3ff';
    ctx.beginPath();
    ctx.moveTo(W / 2, H / 2 - 9);
    ctx.lineTo(W / 2 + 6, H / 2 + 7);
    ctx.lineTo(W / 2 - 6, H / 2 + 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  }
}
