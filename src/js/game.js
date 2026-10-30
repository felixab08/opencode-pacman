// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// SPEC 01: alternancia scatter/chase a 60 fps (pane 1 del arcade).
const SCATTER_FRAMES = 420; // 7 s dispersos hacia su esquina
const CHASE_FRAMES = 1200;  // 20 s de caza

// Esquina de scatter de cada fantasma (target inalcanzable a proposito, como el arcade).
const GHOST_HOMES = {
  blinky: { x: 25, y: 0 },
  pinky: { x: 2, y: 0 },
  inky: { x: 27, y: 30 },
  clyde: { x: 0, y: 30 },
};

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    mode: 'scatter',   // SPEC 01: scatter/chase global
    modeTimer: 0,      // frames transcurridos en el modo actual
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      home: GHOST_HOMES[ g.kind ],
      inPen: true,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado por pared (1) y, crucial, por la puerta (3) si ya salio:
//           la puerta es de un solo sentido (salir de la pen, no volver a entrar).
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  if ( v === 3 && actor !== 'pacman' && !actor.inPen ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Celda (entera) en la que se encuentra un actor.
function cellOf( a ) {
  return { x: Math.round( a.x ), y: Math.round( a.y ) };
}

function manhattan( a, b ) {
  return Math.abs( a.x - b.x ) + Math.abs( a.y - b.y );
}

// Orden de desempate de la SPEC 01: up > left > down > right.
const DIR_PRIORITY = [ 'up', 'left', 'down', 'right' ];

// Celda a la que quiere llegar el fantasma segun su personalidad.
// La personalidad SOLO define el target; el algoritmo vive en chooseDir.
// En scatter TODOS van a su esquina; en chase actua su personalidad.
function ghostTarget( game, g ) {
  if ( game.mode === 'scatter' ) return g.home;

  const p = cellOf( game.pacman );
  const d = DIRS[ game.pacman.dir ];

  if ( g.kind === 'blinky' ) {
    // Agresivo: persigue siempre la celda exacta de pacman.
    return p;
  }
  if ( g.kind === 'pinky' ) {
    // Emboscador: 4 celdas por delante de pacman en su direccion actual.
    return { x: p.x + d.x * 4, y: p.y + d.y * 4 };
  }
  if ( g.kind === 'inky' ) {
    // Flanqueador: vector duplicado desde blinky a traves del pivot
    // 2 celdas delante de pacman. blinky es siempre ghosts[0].
    const b = cellOf( game.ghosts[ 0 ] );
    const pivot = { x: p.x + d.x * 2, y: p.y + d.y * 2 };
    return { x: pivot.x + ( pivot.x - b.x ), y: pivot.y + ( pivot.y - b.y ) };
  }
  if ( g.kind === 'clyde' ) {
    // Timido: persigue a distancia; de cerca se retira a su esquina de scatter.
    if ( manhattan( cellOf( g ), p ) > 8 ) return p;
    return g.home;
  }
  return p;
}

// Elige la direccion que minimiza la distancia Manhattan al target.
// No se permite el giro de 180 salvo callejon sin salida; empates por DIR_PRIORITY.
function chooseDir( game, g, target ) {
  const grid = game.grid;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, g )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ OPPOSITE[ g.dir ] ];

  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of DIR_PRIORITY ) {
    if ( !choices.includes( dir ) ) continue;
    const d = DIRS[ dir ];
    const dist = manhattan( { x: g.x + d.x, y: g.y + d.y }, target );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

function decideGhost( game, g ) {
  chooseDir( game, g, ghostTarget( game, g ) );
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    // SPEC 01: llegar a la fila 11 (pasillo sobre la pen) marca al fantasma como fuera.
    if ( g.inPen && g.y === 11 ) g.inPen = false;
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, g ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    // SPEC 01: tras el reset, los fantasmas se recolocan dentro de la pen y
    // la puerta vuelve a ser transitable para salir (criterio anti-camp en paso 6).
    g.inPen = true;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

// Avanza el temporizador global de scatter/chase y alterna el modo al agotarlo.
function updateMode( game ) {
  game.modeTimer++;
  if ( game.mode === 'scatter' && game.modeTimer >= SCATTER_FRAMES ) {
    game.mode = 'chase';
    game.modeTimer = 0;
  } else if ( game.mode === 'chase' && game.modeTimer >= CHASE_FRAMES ) {
    game.mode = 'scatter';
    game.modeTimer = 0;
  }
}

function update( game ) {
  updateMode( game );
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
