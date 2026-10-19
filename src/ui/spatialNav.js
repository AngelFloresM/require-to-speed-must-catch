// Navegación espacial entre elementos de un menú (lógica pura, sin DOM).

// Índice del elemento más cercano en la dirección (dx, dy), o -1.
// "across" mide la separación entre bordes (0 si se traslapan), así una
// lista ancha justo debajo gana sobre un botón más chico pero desalineado.
export function pickNext(fromRect, rects, dx, dy) {
  const cx = fromRect.left + fromRect.width / 2;
  const cy = fromRect.top + fromRect.height / 2;
  let best = -1;
  let bestScore = Infinity;
  rects.forEach((r, i) => {
    const x = r.left + r.width / 2 - cx;
    const y = r.top + r.height / 2 - cy;
    const along = x * dx + y * dy;
    if (along <= 4) return; // no está en esa dirección
    const across = dy
      ? Math.max(0, r.left - (fromRect.left + fromRect.width), fromRect.left - (r.left + r.width))
      : Math.max(0, r.top - (fromRect.top + fromRect.height), fromRect.top - (r.top + r.height));
    const score = along + across * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}
