# Require to Speed: Must Catch

Juego de carreras para navegador inspirado en *Need for Speed: Most Wanted (2005)*.

## Versión 0.1 (mínima)

- 1 carro (Raptor GT), 3 rivales con IA
- Pista ovalada, sin texturas
- Colisiones contra muros y entre carros
- Nitro, freno de mano (derrape), cámara de persecución y de cofre
- Menú, garaje, pausa, resultados y HUD mínimo

## Modo libre · Tepic

Menú → **Modo libre · Tepic** → elige carro → **Manejar**. Es el centro de Tepic, Nayarit
(~2.8 × 2.4 km alrededor de la Catedral), con datos reales de **OpenStreetMap**.

- Calles con su forma, nombre y **sentido real**; ancho según el tipo de calle y sus carriles.
  Doble sentido: línea amarilla; un sentido: flechas blancas.
- Semáforos donde OSM los marca; parques, plazas, río Mololoa y edificios con su planta real
  (el resto de los lotes se llena con casas).
- Fuente: `data/tepic.osm.gz` (exportado de openstreetmap.org). Para regenerar el mapa:
  `node scripts/osm2tepic.mjs` → `src/data/tepicMap.js`.
- Datos © OpenStreetMap contributors, licencia ODbL (https://www.openstreetmap.org/copyright).
- Solo se maneja sobre las calles. Las que salen del área terminan en barreras rojo/blanco.
- Minimapa abajo a la izquierda y nombre de la calle arriba.
- **Mapa expandido** (M, botón "Mapa" o cruceta ↑ del control): pausa el juego y muestra toda la
  ciudad con tu posición. Zoom con rueda / + − / gatillos; mover arrastrando, con flechas o el stick;
  C / A centra en ti; M / Esc / B cierra. Con zoom aparecen los nombres de las calles.
- **Tráfico ligero** (24 carros) y **semáforos**. Los carros manejan por
  la derecha, respetan el sentido de cada calle, guardan distancia (también contigo), se detienen
  en rojo y en cruces sin semáforo esperan si está ocupado.
- En modo libre no hay reglas para ti: no hay avisos por pasarte un alto o ir en sentido contrario.

## Cómo correrlo

```bash
npm install
npm run dev      # abre http://localhost:5173
npm test         # pruebas de física y carrera (sin navegador)
npm run build    # versión optimizada en dist/
```

## Publicar (GitHub Pages)

**CD:** cada merge de un PR a `main` (y cualquier push a `main`) corre las pruebas, construye y publica en
`https://angelfloresm.github.io/require-to-speed-must-catch/`
(ver `.github/workflows/deploy.yml`). Al terminar, comenta en el PR la liga publicada.
Si las pruebas fallan, no se publica.

Una sola vez: en GitHub ve a **Settings → Pages → Source** y elige **GitHub Actions**.

### Deploy manual de cualquier rama

1. **Actions → CD - Deploy to GitHub Pages → Run workflow**, elige la rama y dale **Run**.
2. La rama y el commit publicados se ven abajo a la izquierda en el menú.

Solo hay un sitio: el deploy manual reemplaza lo publicado hasta el siguiente deploy.

Una sola vez: **Settings → Environments → github-pages → Deployment branches and tags**
debe permitir las ramas que quieras publicar (por ejemplo `No restriction`, o agrega la regla `claude/*`).
Si no, el deploy de ramas distintas a `main` es rechazado.

## Controles

**Menús con control:** cruceta o stick para moverte, A acepta, B regresa, LB/RB cambian de carro en
el garaje, izquierda/derecha sobre una lista cambia su valor. Con teclado: ↑ ↓, Enter, Tab.

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
  city/                 ciudad del modo libre: calles, grafo de cruces, colisiones
  freeMode.js           modo libre: escena, cámara, HUD de calle
  main.js               loop del juego, cámara
docs/investigacion.md   cómo se hizo NFS Most Wanted y qué tomamos
```

La física corre a 120 Hz fijos, separada del render. La lógica (`race.js`, `physics/`, `ai.js`, `track.js`) no depende de Three.js, así se puede probar en Node.
