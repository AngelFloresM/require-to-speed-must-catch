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

### Deploy manual de cualquier rama

1. **Actions → Deploy to GitHub Pages → Run workflow**, elige la rama y dale **Run**.
2. La rama y el commit publicados se ven abajo a la izquierda en el menú.

Solo hay un sitio: el deploy manual reemplaza lo publicado hasta el siguiente deploy.

Una sola vez: **Settings → Environments → github-pages → Deployment branches and tags**
debe permitir las ramas que quieras publicar (por ejemplo `No restriction`, o agrega la regla `claude/*`).
Si no, el deploy de ramas distintas a `main` es rechazado.

## Controles

Se pueden cambiar en **Controles** (menú principal o pausa): 2 teclas y 1 entrada del control por acción, con botón × para quitar. Se guardan en el navegador. Valores por defecto:

| Acción | Teclado | Control |
|---|---|---|
| Acelerar | W / ↑ | RT |
| Frenar / reversa | S / ↓ | LT |
| Girar | A D / ← → | Stick izq. |
| Freno de mano | Espacio | A |
| Nitro | Shift | X |
| Subir marcha (manual) | E | RB |
| Bajar marcha (manual) | Q | LB |
| Cámara | C | Back |
| Volver a la pista | R | Y |
| Pausa | Esc / P | Start |

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
