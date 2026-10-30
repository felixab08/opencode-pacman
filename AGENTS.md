# AGENTS.md

## Propósito del repositorio

Proyecto didáctico para practicar **Spec-Driven Development** con un clon de Pac-Man.
El flujo de specs es el corazón del proyecto: más importante que el código es seguir el proceso.

## Flujo de trabajo obligatorio (specs)

- Skills instaladas en `.agents/skills/` con lock en `skills-lock.json` (fuente: `klerith/fernando-skills`):
  - `/spec <descripción>` — diseña y guarda una spec. **Nunca escribe código.**
  - `/spec-impl <NN-slug>` — implementa una spec. Solo si su estado es `Aprobado`.
- Las specs viven en `specs/` con nombre `NN-slug.md` (numeración secuencial desde `01-`, slug kebab-case).
- Estados de spec: `Borrador` → `Aprobado` → `Implementado` (solo el usuario cambia el estado).
- `/spec-impl` crea una rama git `spec-NN-slug` (controlado por `specs/.spec-config.yml`, `AutoCreateBranch: true` por defecto) e implementa paso a paso con pausas; **nunca commitea por su cuenta**.
- Plantilla y reglas del documento: `.agents/skills/spec/template.md` (encabezado en blockquote, alcance In/Out, plan numerado con pasos que dejan el juego funcionando, criterios de aceptación verificables, decisiones tomadas/descartadas).
- No implementes nada sin una spec aprobada; si piden un cambio pequeño fuera del flujo, proporle crear una spec primero.

## Cómo ejecutar

- No hay build, ni `package.json`, ni lint, ni tests: vanilla JS/HTML/CSS.
- Abrir `src/index.html` en el navegador (o un servidor estático apuntando a `src/`). Control: flechas.

## Arquitectura

- Sin módulos ni bundler: los archivos comparten **globals** y su orden de carga en `src/index.html` es determinista: `maze.js` → `game.js` → `render.js` → `main.js`.
  - `maze.js`: laberinto 28×31 (`MAZE` y derivados: `PACMAN_START`, `GHOST_STARTS`, `TUNNEL_ROW`). Se edita como strings (`#` pared, `.` dot, `-` puerta pen), se parsea a números.
  - `game.js`: estado y reglas (`createGame`, `update`). Depende de los globals de `maze.js`.
  - `render.js`: dibujo en canvas (`draw`). Usa `game.grid` (copia mutable), nunca `MAZE` directamente.
  - `main.js`: bucle `requestAnimationFrame`, teclado y overlays.
- Canvas fijo de 560×620 con `TILE = 20` (28×31 celdas + HUD).

## Convenciones

- Todo en español: README, comentarios de código, textos de UI, specs y mensajes de commit. Responde al usuario en español.
- Estilo peculiar del código: espacios dentro de los paréntesis — `createGame( )`, `grid[ y ][ x ]`. Respetarlo en código nuevo.
