# Investigación: Need for Speed: Most Wanted (2005)

Notas para guiar el diseño. Marco lo que no está confirmado.

## Datos generales

- Desarrollado por **EA Black Box** (Vancouver), publicado por EA en 2005.
  Versiones portátiles hechas por otros estudios.
- Motor propio de EA (evolución del de *Underground 2*). Algunas fuentes lo llaman **EAGL** (EA Graphics Library) — sin confirmar.
- No hay documentación pública del código ni de la física. Lo de abajo sale de cómo se *siente* el juego, guías y datos extraídos por la comunidad de modding.

## Física / manejo

- **Arcade, no simulación.** Los carros se sienten "pegados" al piso: mucho agarre, poco riesgo de perder el control.
- Ayudas fuertes: el giro se reduce a alta velocidad, el carro se estabiliza solo.
- Derrape fácil con freno de mano.
- **Nitro**: empuje extra limitado, se recarga.
- **Speedbreaker**: cámara lenta que mejora el control (pendiente para una versión futura).
- Choques: los carros rebotan, no hay daño visual que afecte el manejo.
- **Rubber banding** (IA que se acelera/frena según tu posición): muy conocido en la serie.

### Lo que hicimos nosotros

Modelo "bicicleta" 2D con ángulo de deriva por eje (clásico en juegos arcade):
- Fuerza lateral = curva de llanta (lineal hasta un pico, luego cae un poco) × carga del eje.
- Tracción trasera limitada por potencia (F = P / v) y por agarre.
- Arrastre aerodinámico (∝ v²) + resistencia al rodamiento.
- Ayudas: giro máx. que baja con la velocidad, amortiguación del giro.
- Freno de mano = menos agarre atrás → derrape.
- Colisiones por impulsos (con giro), carros como 2 círculos, muros como distancia a la línea central.

## Atributos de los carros

- En el juego cada carro muestra 3 barras: **Velocidad máxima, Aceleración, Manejo**.
- Se mejoran con piezas por niveles (motor, transmisión, suspensión, llantas, nitro, turbo…). Las piezas "Junkman" son las mejores.
- Los carros se agrupan en niveles (*tiers*). Detalles exactos por carro: sin confirmar.
- Las fuentes no coinciden en cuál es el más rápido (BMW M3 GTR, Murciélago, Carrera GT).

Nosotros guardamos los 3 valores de menú (0–10) y aparte los valores físicos reales (masa, potencia, agarre…) en `src/data/cars.js`.

## Reglas / modos

- Carreras: **Circuito**, **Sprint**, **Drag**, **Lap Knockout**, **Tollbooth**, **Speedtrap**.
- **Blacklist**: 15 rivales; para retar a uno necesitas ganar carreras e hitos de persecución.
- **Policía** con niveles de *heat*, barricadas, picos, helicóptero, *pursuit breakers* y fase de enfriamiento para escapar.

## Plan sugerido por versiones

1. **v0.1 (esta)**: óvalo, 1 carro, IA, colisiones, nitro, menús mínimos.
2. v0.2: sonido de motor, speedbreaker, más carros con stats distintos.
3. v0.3: mapa abierto pequeño, modo sprint, policía básica (1 nivel de heat).
4. v0.4: tuning simple, persecuciones con niveles de heat, Blacklist.

## Fuentes

- https://en.wikipedia.org/wiki/Need_for_Speed:_Most_Wanted_(2005_video_game)
- https://nfs.fandom.com/wiki/EA_Black_Box
- https://www.gamepressure.com/needforspeedmostwanted/the-basics-car-handling/zb1fd
- https://www.thetoptens.com/games/best-cars-need-for-speed-most-wanted/
- https://www.thedrive.com/news/one-nfs-most-wanted-feature-was-so-controversial-it-drove-developers-to-quit
