# SPEC 01 — Cuatro fantasmas clásicos con modos scatter/chase

> **Estado:** implementado
> **Depende de:** ninguna
> **Fecha:** 2026-10-30
> **Objetivo:** Reemplazar los 2 fantasmas actuales por los 4 clásicos (Blinky agresivo, Pinky emboscador, Inky flanqueador y Clyde tímido) con alternancia temporizada scatter/chase, salida escalonada de la pen, puerta de un solo sentido y 4 colores propios.

---

## Alcance

**En:**

- Ampliar `GHOST_STARTS` de 2 a 4 fantasmas con `kind`: `blinky`, `pinky`, `inky`, `clyde`.
- Un único algoritmo de decisión (`chooseDir`) que minimiza la distancia Manhattan hasta un target; la personalidad define el target, no el algoritmo.
- Personalidades en modo **chase**:
  - `blinky` (agresivo): target = celda de pacman.
  - `pinky`: target = celda de pacman + 4 celdas en la dirección actual de pacman.
  - `inky`: pivot = celda de pacman + 2 en dirección de pacman; target = pivot + (pivot − celda de blinky). Toma a blinky como `game.ghosts[0]`.
  - `clyde`: si la distancia Manhattan a pacman es > 8, target = pacman; si es ≤ 8, target = su esquina de scatter.
- Modo alternancia temporizada global en `game`: empieza en `scatter` 7 s → `chase` 20 s → `scatter` 7 s → `chase` 20 s, en bucle. En `scatter`, el target de cada fantasma es su esquina clásica: blinky (25, 0), pinky (2, 0), inky (27, 30), clyde (0, 30).
- Cambio de dirección solo en celdas alineadas, sin giro de 180 grados salvo callejón sin salida (regla existente, se generaliza).
- Desempate de distancias iguales: prioridad `up` > `left` > `down` > `right`.
- Puerta de la pen de un solo sentido: solo es transitable de salida. Flag `inPen` en cada fantasma; con `inPen: false` la puerta (valor 3) es muro para el fantasma.
- Salida escalonada: retardos de 0 / 2 / 4 / 6 s para blinky / pinky / inky / clyde. Antes de su turno el fantasma oscila verticalmente entre las filas 13 y 15 de su columna de arranque; al llegar su turno avanza a la columna de puerta más cercana (13 si su `x` ≤ 13, 14 si no) y sube hasta la fila 11.
- Al perder una vida: solo pacman vuelve a `PACMAN_START`; los fantasmas se quedan donde están; el modo vuelve a `scatter` con temporizador a 0 y se reinicia el `releaseTimer` de los fantasmas que queden dentro de la pen. Los fantasmas a ≤ 4 celdas Manhattan del punto de respawn vuelven a la pen como `inPen: true` a la espera.
- Colores por personalidad en `render.js`: blinky `#ff0000`, pinky `#ffb8ff`, inky `#00ffff`, clyde `#ffb852`, con un color por defecto para `kind` desconocido.

**Fuera del alcance (para otras specs):**

- Pacdots y modo frightenado (fantasmas azules comestibles). Los laberintos actuales solo tienen dots normales.
- Velocidades distintas por fantasma (p. ej. blinky turbo).
- Incremento de dificultad por nivel (temporizador más agresivo por nivel).
- Adaptación clásica del "crucero": celdas prohibidas para girar hacia arriba frente a la pen.
- El bug histórico del arcade de Pinky (desplazamiento adicional cuando pacman mira arriba): se toma el target limpio.
- HUD con los nombres de los fantasmas o intro de partida.

---

## Modelo de datos

```js
// maze.js — 4 fantasmas arrancan dentro de la pen (filas 13-15, cols 11-16 libres)
const GHOST_STARTS = [
  { x: 12, y: 14, kind: 'blinky' },
  { x: 13, y: 14, kind: 'pinky' },
  { x: 14, y: 14, kind: 'inky' },
  { x: 15, y: 14, kind: 'clyde' },
];

// game.js — constantes nuevas
const SCATTER_FRAMES = 420;  // 7 s a 60 fps
const CHASE_FRAMES = 1200;   // 20 s a 60 fps
const RELEASE_FRAMES = [0, 120, 240, 360]; // 0 / 2 / 4 / 6 s, indexado igual que GHOST_STARTS

// Estado nuevo en cada partida (lo existente no cambia)
{
  mode: 'scatter',    // alterna con 'chase' al agotar modeTimer
  modeTimer: 0,       // frames transcurridos en el modo actual
  ghosts: [
    {
      x: 12, y: 14, dir: 'up', speed: GHOST_SPEED, kind: 'blinky',
      inPen: true,           // false => la puerta se vuelve muro para este fantasma
      releaseTimer: 0,       // frames restantes para su salida; solo cuenta si inPen
      home: { x: 25, y: 0 }, // esquina de scatter según kind
    },
    // ... pinky: home { x: 2, y: 0 } · inky: home { x: 27, y: 30 } · clyde: home { x: 0, y: 30 }
  ],
}
```

---

## Plan de implementación

1. `maze.js`: `GHOST_STARTS` pasa a 4 entradas con `kind` `blinky` / `pinky` / `inky` / `clyde` en las celdas (12, 14), (13, 14), (14, 14), (15, 14). En `game.js`, `decideGhost` trata `blinky` como el `hunter` actual y al resto como `random`. Ejecutar el juego en el navegador: los 4 aparecen en la pen, blinky persigue, el resto vaga.
2. `game.js`: refactor de `decideGhost` en `ghostTarget(game, g)` + `chooseDir(game, g, target)` (minimizar Manhattan, sin 180 salvo callejón, desempate `up` > `left` > `down` > `right`). Implementar los 4 targets de chase. Ejecutar: pinky embosca, inky flanquea, clyde huye cuando está cerca.
3. `game.js`: añadir `mode` / `modeTimer` a `createGame` y su avance en `update`; targets de las esquinas de scatter; `home` por fantasma. Ejecutar: ciclo de 7 s que dispersa y 20 s que persigue.
4. `game.js`: puerta de un solo sentido — `inPen` por fantasma, la puerta (3) bloquea al fantasma con `inPen: false` en `isWall`. Ejecutar: ningún fantasma fuera vuelve a entrar en la pen.
5. `game.js`: salida escalonada — `releaseTimer` con `RELEASE_FRAMES`, oscilación vertical en la pen antes del turno, estado de salida hacia la puerta más cercana. Ejecutar: los 4 aparecen en la pen y salen uno a uno cada ~2 s.
6. `game.js`: `resetPositions` ya no recoloca a los fantasmas; reinicia `mode` a `scatter`, `modeTimer` a 0 y el `releaseTimer` de los que estén en la pen; los fantasmas a ≤ 4 celdas Manhattan de `PACMAN_START` vuelven a su posición de arranque con `inPen: true` y espera. Ejecutar: perder una vida sin que se reinicie la partida completa ni muertes instantáneas al respawnear.
7. `render.js`: mapa `GHOST_COLORS` con los 4 colores y fallback. Ejecutar: los 4 fantasmas distinguibles en el canvas.

---

## Criterios de aceptación

- [ ] Al abrir `src/index.html` la consola no muestra errores.
- [ ] Hay 4 fantasmas con colores rojo, rosa, cian y naranja respectivamente.
- [ ] blinky sale de la pen de inmediato, pinky ~a los 2 s, inky ~a los 4 s y clyde ~a los 6 s.
- [ ] Antes de su turno los fantasmas en la pen oscilan verticalmente, no deambulan.
- [ ] En modo chase blinky toma siempre el movimiento que reduce su distancia a pacman.
- [ ] pinky sitúa su target ~4 celdas por delante de pacman y llega antes que blinky a los cruces por delante.
- [ ] inky flanquea: su target depende de la posición de blinky.
- [ ] clyde se aleja de pacman cuando la distancia es ≤ 8 celdas y lo persigue cuando es > 8.
- [ ] Cada ~7 s los 4 desisten y van hacia sus esquinas (scatter) y a los ~20 s vuelven a la caza (chase).
- [ ] Ningún fantasma fuera de la pen cruza la puerta hacia dentro en ninguna dirección.
- [ ] Al perder una vida el juego reinicia solo la posición de pacman, el modo vuelve a scatter y los temporizadores se reinician.
- [ ] Si algún fantasma está a ≤ 4 celdas del respawn, ese fantasma vuelve a la pen y no hay muertes instantáneas al reaparecer pacman.

---

## Decisiones

- **Sí:** un único algoritmo de decisión compartido (`chooseDir`); la personalidad vive solo en el target. Es fiel al arcade, hace el código corto y añadir un fantasma queda en una línea.
- **Sí:** distancias Manhattan por todas partes, incluido el umbral de clyde. Es lo que ya usa `decideGhost`; el arcade usa euclídea y la diferencia es imperceptible.
- **Sí:** desempate `up` > `left` > `down` > `right` para que los fantasmas no vacilen en cruces simétricos.
- **Sí:** empieza en scatter 7 s / chase 20 s (nivel 1 del arcade), confirmado por el usuario en la fase de preguntas.
- **Sí:** alternancia scatter/chase temporizada en vez de personalidad fija, confirmado por el usuario. Los timers viven en `game` y son globales: una spec por dominio, no dos temporizadores que divergen.
- **Sí:** al morir, los fantasmas no vuelven a la pen (decisión confirmada por el usuario). Solo se reinicia mode/timers. Mitigación anti-camp: los fantasmas a ≤ 4 celdas del respawn se mandan a la pen.
- **Sí:** puerta de un solo sentido con flag `inPen`. Sin el flag, `isWall` no sabe distinguir entrada de salida y se vuelve a la ambigüedad actual.
- **No:** modo frightenado ni pacdots. No hay base en el maze actual (solo dots normales queda); es una spec futura limpia.
- **No:** velocidades distintas por fantasma. Mantener `GHOST_SPEED` común evita que pinky embosque de forma injusta y las velocidades fraccionarias (0.1) ya se alinean difícil de sync con 0.125 de pacman.
- **No:** bug del arcade de Pinky en dirección `up`. Reproducir un bug a propósito resta claridad didáctica.
- **No:** recolocar a los fantasmas en el reset de vidas (comportamiento actual). Contradice la decisión confirmada y borra el progreso de presión del fantasma agresivo.
- **Definición rápida:** el patrón Clásico 7s/20s y las 4 esquinas se confirmaron con opciones concretas; no hubo segunda ronda de aclaraciones sobre el valor exacto de `SCATTER_FRAMES`/`CHASE_FRAMES` (se adoptan 420/1200 a 60 fps).

---

## Riesgos

| Riesgo                                                                              | Mitigación                                                                                                                          |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Bucle de muerte instantánea si un fantasma queda sobre `PACMAN_START` al respawnear | Regla anti-camp del paso 6: fantasma a ≤ 4 celdas Manhattan del spawn vuelve a la pen como `inPen: true`.                           |
| inky depende de la posición de blinky                                               | leer siempre `game.ghosts[0]`, documentado; `GHOST_STARTS` fija blinky en el índice 0.                                              |
| Fantasma liberado "se pierde" deambulando dentro de la pen durante la salida        | Estado de salida determinista: avanza a la columna de puerta (13 o 14) y sube por ella hasta la fila 11; sin random dentro del pen. |
| Timers en frames asumen 60 fps                                                      | `SCATTER_FRAMES` / `CHASE_FRAMES` / `RELEASE_FRAMES` son constantes; si el juego corre a otro fps, se ajustan solo estas.           |

---

## Qué no entra en esta spec

- Modo frightenado y pacdots.
- Velocidades por fantasma.
- Dificultad progresiva por nivel.
- Celdas prohibidas de giro frente a la pen.
- HUD de fantasmas.

Cada una de estas, si aterriza, va en su propia spec.
