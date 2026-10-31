# SPEC 02 — Power pellets con modo frightenado

> **Estado:** Aprovado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-31
> **Objetivo:** Añadir los 4 power pellets clásicos en las esquinas del maze que, además de 50 puntos, activan 6 s de modo frightenado: fantasmas azules, reversa inicial, velocidad reducida, dirección aleatoria, cadenas 200/400/800/1600 y regreso a la pen.

---

## Alcance

**En:**

- Nuevo char `'o'` en `maze.js` (valor 4 = power pellet) en las celdas clásicas: (1, 3), (26, 3), (1, 23), (26, 23), una hacia adentro desde cada esquina.
- Comerse un pellet: +50 puntos, se resta de `dotsRemaining` y activa el modo frightenado.
- `game.frightenedTimer`: 360 frames (6 s a 60 fps), mediado por la constante `FRIGHT_FRAMES`; comerse otro pellet lo reinicia a 360.
- Reversa 180 al activarse: los fantasmas fuera de la pen (`inPen: false`) invierten su `dir` y pasan a `frightened: true`.
- Fantasma frightened: velocidad `GHOST_FRIGHT_SPEED = 0.05` (mitad de las 0.1 normales) y dirección **aleatoria** en cada celda alineada, sin target; se reutiliza la regla de no-180-salvo-callejón.
- Los fantasmas que estaban en la pen al activarse la ventada **no** salen asustados; los fantasmas comidos y devueltos a la pen también salen normales.
- Comer fantasma frightened dentro de la misma ventana: 200 / 400 / 800 / 1600 (`GHOST_POINTS`), el fantasma se teletransporta a su celda de `GHOST_STARTS` con `inPen: true`, `releaseTimer` de su índice y `frightened: false`.
- Parpadeo de aviso: en `render.js` los frightened alternan azul `#2121ff` y blanco `#ffffff` durante los últimos 120 frames (2 s) de la ventada.
- `updateMode` pausa el temporizador scatter/chase (`modeTimer` no avanza) mientras `frightenedTimer > 0`.
- `resetPositions` (perder vida) cancela el frightenado: `frightenedTimer` a 0, `frightened: false` en todos y `ghostChain` a 0.
- Los 4 pellets cuentan para ganar: `createGame` suma a `dotsRemaining` los valores 2 y 4.

**Fuera del alcance (para otras specs):**

- Duración o velocidad frightenada por nivel (progresiva): `FRIGHT_FRAMES` es fijo de nivel 1.
- Animación de ojos regresando a la pen: teleport directo sin animación.
- Puntos flotantes ("200" sobre el fantasma comido).
- Sonido: sirena de frightenado o jingle al comer fantasma.
- Fruta bonus.
- Parpadeo del pellet en sí (el arcade lo hace; el aviso útil aquí es el parpadeo final del fantasma).

---

## Modelo de datos

```js
// maze.js — leyenda: '#'(1) '.'(2) ' '(0) '-'(3) 'o'(4 = power pellet)
'#.####.#####.##.#####.####.#', // fila 3 -> (1,3) y (26,3) son 'o'
'#...##................##...#', // fila 23 -> (1,23) y (26,23) son 'o'

// game.js — constantes nuevas (a 60 fps)
const FRIGHT_FRAMES = 360;               // 6 s de ventada
const FRIGHT_FLASH_FRAMES = 120;         // últimos 2 s: parpadeo azul/blanco
const GHOST_FRIGHT_SPEED = 0.05;         // mitad de GHOST_SPEED (0.1)
const GHOST_POINTS = [ 200, 400, 800, 1600 ]; // indexado por game.ghostChain

// Estado nuevo en game (lo de SPEC 01 no cambia)
{
  frightenedTimer: 0, // frames restantes de ventada; 0 = frightenado apagado
  ghostChain: 0,      // fantasmas comidos en la ventada actual (0..3)

  // Cada fantasma lleva flag propio (lo de SPEC 01 no cambia)
  ghosts: [
    { /* ... */ frightened: false },
  ],
}
```

`parseTile` en `maze.js` mapea `'o'` a 4. El `grid` copiable ya soporta un valor más sin cambios: la copia por filas es agnóstica del contenido.

---

## Plan de implementación

1. `maze.js`: cambiar los 4 dots de las celdas (1, 3), (26, 3), (1, 23), (26, 23) a `'o'`; `parseTile` devuelve 4 para `'o'`; actualizar el comentario de leyenda. Ejecutar: la partida corre, los pellets aún se ven como puntos (el valor 4 no se dibuja distinto todavía).
2. `render.js`: en `drawDots`, dibujar radio 7 (`TILE / 2 - 3`) para valor 4 y 2.5 para dots. Ejecutar: 4 pellets visibles grandes, el resto sin cambios.
3. `game.js`: `createGame` suma a `dotsRemaining` las celdas con valor 2 **o** 4, inicializa `frightenedTimer` / `ghostChain` a 0 y `frightened: false` por fantasma. `movePacman` come el pellet: +50, `dotsRemaining--` y activa el frightenado (`frightenedTimer = FRIGHT_FRAMES`, `ghostChain = 0`, flag + reversa 180 en los `inPen: false`). `update` decrementa `frightenedTimer`. Ejecutar: comer un pellet da +50, los fantasmas giran 180 y van más despacio.
4. `game.js`: comportamiento frightened en `moveGhost`: velocidad `GHOST_FRIGHT_SPEED` y, en celdas alineadas, `chooseDirRandom` (mismas reglas de `chooseDir` pero elección uniforme). `updateMode` no avanza `modeTimer` mientras `frightenedTimer > 0`. Ejecutar: durante la ventada vagan sin perseguir; al terminar retoman scatter/chase por donde lo dejaron.
5. `game.js`: en `update`, colisión con fantasma `frightened: true`: `score += GHOST_POINTS[ ghostChain ]` (y `ghostChain++`), teleport a su `GHOST_STARTS[ i ]` con `inPen: true`, `releaseTimer` de su índice y `frightened: false`; el bucle no se corta (pueden comerse dos en el mismo frame). Ejecutar: cadena 200/400 y regreso a la pen.
6. `game.js`: `resetPositions` cancela el frightenado (timer a 0, flags a false, chain a 0). Ejecutar: perder vida durante la ventada no deja fantasmas azules al reaparecer pacman.
7. `render.js`: el color del fantasma es azul `#2121ff` cuando `game.frightenedTimer > 0 && g.frightened`, y alterna con `#ffffff` en los últimos 120 frames (alterna cada 8). Ejecutar: azules distinguibles y parpadeo final visible.

---

## Criterios de aceptación

- [ ] Al abrir `src/index.html` la consola no muestra errores.
- [ ] Hay 4 pellets grandes exactamente en (1, 3), (26, 3), (1, 23), (26, 23), claramente más grandes que los dots.
- [ ] Comer un pellet suma 50 puntos.
- [ ] Al comer un pellet, todo fantasma fuera de la pen pasa a `frightened: true` e invierte su dirección 180 inmediatamente.
- [ ] Mientras está frightened, el fantasma cruza una celda en el doble de frames que un fantasma normal y no persigue target: deambula aleatoriamente sin giro de 180 salvo callejón.
- [ ] Comer un fantasma frightened suma 200, luego 400, luego 800 y luego 1600 en la misma ventada; en la siguiente ventada se reinicia a 200.
- [ ] El fantasma comido reaparece en su celda de `GHOST_STARTS`, dentro de la pen, y sale según `RELEASE_FRAMES`.
- [ ] Los fantasmas que estaban en la pen al activarse la ventada salen con color normal.
- [ ] `modeTimer` no avanza durante el frightenado: al terminar la ventada, el ciclo scatter/chase reanuda en el punto en que estaba.
- [ ] En los últimos 2 s de frightenado el fantasma parpadea azul/blanco.
- [ ] Comer otro pellet durante la ventada reinicia el tiempo a 6 s sin resetear la cadena de puntos de fantasmas.
- [ ] Los 4 pellets cuentan para completar la partida: el nivel se gana (`state: 'won'`) solo cuando no quedan dots ni pellets.
- [ ] Perder una vida cancela el frightenado: tras el respawn no hay fantasmas azules ni timer residual.

---

## Decisiones

- **Sí:** frightenado completo (azules, comibles, cadena de puntos), confirmado por el usuario. Un pellet que solo diera 50 puntos es un dot grande decorativo.
- **Sí:** celdas clásicas (1, 3), (26, 3), (1, 23), (26, 23) — una interior de cada esquina. Las esquinas literales son pared y el arcade usa estas.
- **Sí:** char `'o'` como valor 4 nuevo en el grid. Reusar el 2 exigiría llevar aparte las celdas de pellet; el grid ya es un parse de chars y un cuarto valor no toca a nadie.
- **Sí:** flag `frightened` por fantasma y no solo el timer global. Es lo que distingue a los comidos/devueltos a la pen (que salen normales) de los asustados dentro de la ventada; un booleano por fantasma es state mínimo.
- **Sí:** los fantasmas en pen al activarse la ventada salen normales. Es una simplificación deliberada frente al arcade (que sí los asusta al salir); mantiene limpio el respawn de los comidos. Queda registrada para revisión futura.
- **Sí:** reversa 180 al activarse, confirmado por el usuario. Sin ella, pinky flanqueando mata antes de que el pellet surta efecto.
- **Sí:** direcciones aleatorias (no huida a esquina ni seguir target), confirmado por el usuario. Es el comportamiento del arcade: en ventada los fantasmas dejan de decidir por target.
- **Sí:** teleport a la pen al comer fantasma, sin animación de ojos (seguir el arcade completo va en otra spec); confirmado por el usuario.
- **Sí:** cadena 200/400/800/1600 por ventada, reinicio a la próxima activación; confirmado por el usuario.
- **Sí:** `updateMode` pausa `modeTimer` durante la ventada. Si siguiera contando, el frightenado "roba" 6 s de scatter/chase y el ciclo se desincroniza.
- **Sí:** perder vida cancela la ventada, consistente con SPEC 01 (los modos/timers se reinician); confirmado por el usuario.
- **No:** velocidad fraccional rara: `0.05` es exactamente la mitad de `0.1` y ambos alinean limpio con `aligned`.
- **No:** parpadeo del pellet en sí. El arcade lo hace, pero el aviso que cambia el juego es el blink final del fantasma.
- **Definición rápida:** duración (6 s), velocidades y colores salieron de las opciones recomendadas que el usuario aceptó; el ritmo del flash (8 frames) y el radio del pellet (7 px) quedaron como defaults no confirmados en segunda ronda.

---

## Riesgos

| Riesgo                                                                                                          | Mitigación                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GHOST_FRIGHT_SPEED = 0.05` alinea tarde (cada 20 frames) y los cambios de dirección random se sienten a saltos | Comprobar en el paso 4 que los cruces se deciden en celdas alineadas; si no, subir a `0.0625` (1/16), que alinea cada 16 frames.                        |
| Colisión y teleport en el mismo frame: otro fantasma puede haber "cruzado" la celda del comido                  | El teleport lo saca del conjunto de colisión (`inPen: true` en la pen y pacman no entra); `frightened: false` evita doble consumo en frames siguientes. |
| Comer pellet y fantasma el mismo frame                                                                          | `update` mueve a pacman antes que a los fantasmas, así el `frightenedTimer` y los flags están listos antes del loop de colisiones.                      |
| Doble conteo en `dotsRemaining` al comer pellet                                                                 | El pellet se consume exactamente igual que un dot en `movePacman`; el branch del valor 2 se generaliza a 2/4 en un único lugar.                         |

---

## Qué no entra en esta spec

- Duración/velocidad frightenada por nivel.
- Animación de ojos regresando.
- Puntos flotantes y sonido.
- Fruta bonus.
- Parpadeo del pellet en sí.

Cada una de estas, si aterriza, va en su propia spec.
