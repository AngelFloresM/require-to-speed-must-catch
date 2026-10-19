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

## Carros agregados (datos reales de referencia)

Nombres inventados, datos basados en fichas públicas. "≈" = aproximado o sin fuente oficial confirmada.

| | Nizan Marsh | Porshe Taikan Turbo S | Fort Mustank GT |
|---|---|---|---|
| Referencia | Nissan March 1.6 (K13) | Porsche Taycan Turbo S (2025) | Ford Mustang GT (S650, 2024) |
| Motor | 1.6 L 4 cil. | 2 motores eléctricos | 5.0 L V8 Coyote |
| Potencia | 106 hp @ 5600 | 570 kW; 700 kW con overboost | 480 hp @ 7150 (486 con escape activo) |
| Torque | 142 Nm @ 4400 | 1,110 Nm (con Launch Control) | 563 Nm (415 lb-ft) @ ≈4900 |
| Tracción | Delantera | Integral | Trasera |
| Caja | Manual 5 / auto 4 | 2 vel. en eje trasero | Manual 6 / auto 10 |
| Peso | ≈1,030 kg | ≈2,300 kg | ≈1,700–1,750 kg |
| 0-100 km/h real | ≈11 s (sin dato oficial) | 2.4 s (oficial, Launch Control) | ≈4.0–4.5 s (fuentes difieren) |
| Vel. máx real | ≈175 km/h | 260 km/h (oficial) | ≈250 km/h limitada |

Relaciones de caja, curvas de torque, radio de llanta y coeficientes de arrastre son estimaciones razonables (no hay fichas oficiales para todo).
En el juego el agarre es más alto que en la vida real (arcade), por eso los 0-100 del juego pueden salir un poco más rápidos.

Fuentes:
- Nissan March: https://www.mercadolibre.com.mx/blog/mo-march-2024-precio · https://www.autocosmos.com.mx/catalogo/segmentos/nissan/march
- Porsche Taycan Turbo S: hoja oficial de Porsche https://pnr-prd2-pub2.newsroom.porsche.com/dam/jcr:07390e8a-7387-417f-8df1-467fd36df165/Taycan%20Turbo%20S%20spec%20sheet.pdf
- Ford Mustang GT S650: https://www.cjponyparts.com/resources/news/s650-mustang · https://www.musclecarsandtrucks.com/s650-ford-mustang-horsepower-numbers-are-now-official/
