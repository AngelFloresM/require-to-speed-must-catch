# Require to Speed: Must Catch

Juego de carreras para navegador inspirado en *Need for Speed: Most Wanted (2005)*.

## Versión 0.1 (mínima)

- 1 carro (Raptor GT), 3 rivales con IA
- Pista ovalada, sin texturas
- Colisiones contra muros y entre carros
- Nitro, freno de mano (derrape), cámara de persecución y de cofre
- Menú, garaje, pausa, resultados y HUD mínimo

## Cómo correrlo

```bash
npm install
npm run dev      # abre http://localhost:5173
npm test         # pruebas de física y carrera (sin navegador)
npm run build    # versión optimizada en dist/
```

## Publicar (GitHub Pages)

Cada push a `main` corre las pruebas, construye y publica en
`https://angelfloresm.github.io/require-to-speed-must-catch/`
(ver `.github/workflows/deploy.yml`).

Una sola vez: en GitHub ve a **Settings → Pages → Source** y elige **GitHub Actions**.

## Controles

| Acción | Teclado | Control |
|---|---|---|
| Acelerar | W / ↑ | RT |
| Frenar / reversa | S / ↓ | LT |
| Girar | A D / ← → | Stick izq. |
| Freno de mano | Espacio | A |
| Nitro | Shift | X |
| Cámara | C | RB |
| Volver a la pista | R | Y |
| Pausa | Esc | Start |

## Estructura

```
src/
  data/cars.js          datos de los carros (agregar carros aquí)
  track.js              geometría del óvalo (punto ↔ distancia en pista)
  physics/vehicle.js    física arcade del carro
  physics/collision.js  choques carro-muro y carro-carro
  ai.js                 pilotos IA
  race.js               reglas: vueltas, posiciones, cuenta regresiva
  render/               mallas 3D (Three.js)
  ui/screens.js         menús y HUD
  main.js               loop del juego, cámara
docs/investigacion.md   cómo se hizo NFS Most Wanted y qué tomamos
```

La física corre a 120 Hz fijos, separada del render. La lógica (`race.js`, `physics/`, `ai.js`, `track.js`) no depende de Three.js, así se puede probar en Node.
