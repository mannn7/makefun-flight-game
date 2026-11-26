// Skylark Ridge — main: the game loop, the state machine and the wiring.
// One job: own the canvas, run the states (title, flying, paused, landed,
// over), and connect input, flight, sound, HUD and renderer together.

'use strict';

// The game states.
const STATE = {
  TITLE: 'title',
  PLAY: 'play',
  PAUSE: 'pause',
  OVER: 'over',
};

// Query parameters the maker uses to frame screenshots: ?shot=cover|ring|
// cruise|landing starts the game at once, mid-flight, in a chosen pose.
// Real players never see a parameter; the game always starts at the title.
function readShotParam() {
  try {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    return ['cover', 'ring', 'cruise', 'landing'].includes(shot) ? shot : null;
  } catch (err) {
    return null;
  }
}

// Put the plane somewhere worth photographing, with the HUD already alive.
function applyShotPreset(game, shot) {
  const plane = game.plane;
  const presets = {
    // Mid-valley, a golden ring ahead over the lake, the mid runway behind.
    cover: { x: 2980, y: 700, speed: 205, throttle: 0.65, rings: 3 },
    // A heartbeat after threading a ring: flash, burst and a score popup.
    ring: { x: 3306, y: 0, speed: 215, throttle: 0.7, rings: 4, atRing: 4 },
    // High cruise over the far ridges at sunset, the next ring in the distance.
    cruise: { x: 5980, y: 430, speed: 250, throttle: 0.8, rings: 7 },
    // Final approach: low over Ridge End, gear down, all twelve rings done.
    // dy puts the plane just above the approach slope, so the runway strip
    // itself is in frame above the instrument panel.
    landing: { x: 8380, dy: -90, speed: 185, throttle: 0.45, rings: 12, pitch: 0.08 },
  };
  const p = presets[shot];
  plane.x = p.x;
  plane.y = p.y !== undefined ? p.y : Terrain.heightAt(p.x) + (p.dy !== undefined ? p.dy : -320);
  plane.speed = p.speed;
  plane.throttle = p.throttle;
  plane.airborne = true;
  plane.pitch = p.pitch !== undefined ? p.pitch : -0.06;
  plane.fuel = 62 + p.rings * 2;
  plane.score = p.rings * 100 + 250;
  plane.ringsPassed = p.rings;
  plane.time = 42 + p.rings * 9;
  for (let i = 0; i < p.rings && i < Terrain.rings.length; i++) {
    Terrain.rings[i].passed = true;
  }
  if (p.atRing !== undefined) {
    const ring = Terrain.rings[p.atRing];
    ring.passed = true;
    ring.flash = 1;
    plane.x = ring.x + 6;
    plane.y = ring.y;
    // The ring in the frame is one the plane has just earned, so it counts
    // in the rings tally and the score too.
    plane.ringsPassed = p.rings + 1;
    plane.score = plane.ringsPassed * 100 + 250;
    spawnBurst(ring.x, ring.y, '#ffd94d', 26, 260);
    spawnBurst(ring.x, ring.y, '#ffffff', 12, 160);
    game.toasts.push({ text: '+100', x: ring.x, y: ring.y - 40, age: 0, life: 2.2, color: '#ffd94d' });
  }
  game.camera.x = Math.max(0, Math.min(WORLD_LENGTH - VIEW_W, plane.x - VIEW_W * 0.38));
  game.camera.y = Math.max(-80, Math.min(WORLD_HEIGHT - VIEW_H, plane.y - VIEW_H * 0.55));
}

// The game object the loop owns.
function createGame(canvas) {
  const ctx = canvas.getContext('2d');
  const game = {
    canvas,
    ctx,
    plane: createPlane(),
    camera: createCamera(),
    state: STATE.TITLE,
    time: 0,
    toasts: [],
    shot: readShotParam(),
    overLines: [],
    overTitle: '',
    overAccent: PALETTE.dialAmber,
    startedAt: 0,
  };
  return game;
}

// Turn flight events into toasts, particles and sounds.
function handleEvents(game) {
  const plane = game.plane;
  for (const event of plane.events) {
    if (event.type === 'ring') {
      const text = event.perfect ? 'PERFECT +' + event.points : '+' + event.points;
      game.toasts.push({ text, x: event.x, y: event.y - 50, age: 0, life: 2.2, color: event.perfect ? '#7dff9a' : '#ffd94d' });
      spawnBurst(event.x, event.y, '#ffd94d', 26, 260);
      spawnBurst(event.x, event.y, '#ffffff', 10, 150);
      playRingChime(event.perfect);
    } else if (event.type === 'land') {
      game.toasts.push({ text: 'LANDED +' + event.points + ' · FUEL FULL', x: plane.x, y: plane.y - 60, age: 0, life: 2.4, color: '#7dff9a' });
      spawnSmoke(plane.x - 10, plane.y + 18, 10);
      playLandThud();
    } else if (event.type === 'takeoff') {
      spawnSmoke(plane.x - 20, plane.y + 18, 8);
    } else if (event.type === 'engineOut') {
      game.toasts.push({ text: 'ENGINE OUT', x: plane.x, y: plane.y - 60, age: 0, life: 2.4, color: '#ff5a4a' });
    } else if (event.type === 'crash') {
      game.camera.shake = 26;
      spawnBurst(plane.x, plane.y, '#ff9d2e', 40, 320);
      spawnSmoke(plane.x, plane.y, 22);
      playCrash();
      endSortie(game, false, 'CRASHED', [
        event.reason,
        'Rings: ' + plane.ringsPassed + ' / ' + Terrain.rings.length + '   ·   Score: ' + plane.score,
        'Time: ' + formatTime(plane.time) + '   ·   Press R or Enter to fly again',
      ], PALETTE.dialRed);
    } else if (event.type === 'win') {
      playRingChime(true);
      endSortie(game, true, 'SORTIE COMPLETE', [
        'All ' + plane.ringsPassed + ' rings threaded and a clean landing on Ridge End.',
        'Score: ' + plane.score + '   ·   Time: ' + formatTime(plane.time) + '   ·   Landings: ' + plane.landings,
        'Press R or Enter to fly the valley again',
      ], PALETTE.dialGreen);
    } else if (event.type === 'incomplete') {
      endSortie(game, false, 'LANDED SHORT', [
        'You landed on Ridge End with only ' + plane.ringsPassed + ' of ' + Terrain.rings.length + ' rings.',
        'Score: ' + plane.score + '   ·   Time: ' + formatTime(plane.time),
        'Press R or Enter to fly again and thread them all',
      ], PALETTE.dialAmber);
    }
  }
  plane.events.length = 0;
}

// The sortie ends: freeze the plane and show the result panel.
function endSortie(game, won, title, lines, accent) {
  game.state = STATE.OVER;
  game.overTitle = title;
  game.overLines = lines;
  game.overAccent = accent;
}

// Back to the start runway for another sortie.
function resetSortie(game) {
  game.plane = createPlane();
  game.toasts.length = 0;
  Particles.list.length = 0;
  game.camera.x = 0;
  game.camera.y = Math.max(-80, Math.min(WORLD_HEIGHT - VIEW_H, game.plane.y - VIEW_H * 0.55));
  game.state = STATE.TITLE;
}

// One frame: read input, step the world, draw it.
function frame(game, dt) {
  game.time += dt;
  const plane = game.plane;

  // Toasts age out wherever the game is.
  for (const toast of game.toasts) toast.age += dt;
  game.toasts = game.toasts.filter((t) => t.age < t.life);
  updateParticles(dt);

  if (consumePause()) {
    if (game.state === STATE.PLAY) {
      game.state = STATE.PAUSE;
      playClick();
    } else if (game.state === STATE.PAUSE) {
      game.state = STATE.PLAY;
      playClick();
    }
  }

  if (game.state === STATE.TITLE) {
    // The title idles over the runway; the plane sits ready.
    if (consumeConfirm()) {
      initAudio();
      playClick();
      game.state = STATE.PLAY;
      game.startedAt = game.time;
    }
    updateCamera(game.camera, plane, dt);
  } else if (game.state === STATE.PLAY) {
    // R restarts the sortie from anywhere while flying.
    stepFlight(plane, Input, dt);
    handleEvents(game);
    updateCamera(game.camera, plane, dt);
    setEngineSound(plane.throttle, plane.airborne);
    if (plane.fuel < 25 && Math.floor(game.time * 2) % 2 === 0) {
      // The low-fuel lamp blinks; the HUD text handles the warning itself.
    }
  } else if (game.state === STATE.PAUSE) {
    if (consumeConfirm()) {
      game.state = STATE.PLAY;
      playClick();
    }
  } else if (game.state === STATE.OVER) {
    if (consumeConfirm()) {
      playClick();
      resetSortie(game);
    }
  }

  draw(game);
}

// Draw the frame for the current state.
function draw(game) {
  const { ctx, plane, camera } = game;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawScene(ctx, plane, camera, game.time, game.toasts);
  drawHud(ctx, plane, { time: game.time });
  drawInstruments(ctx, plane);
  if (game.state === STATE.TITLE) {
    drawTitle(ctx, game.time);
  } else if (game.state === STATE.PAUSE) {
    drawCenterPanel(ctx, 'PAUSED', [
      'Score: ' + plane.score + '   ·   Rings: ' + plane.ringsPassed + ' / ' + Terrain.rings.length,
      'P or click to keep flying   ·   R to restart the sortie',
    ], PALETTE.dialAmber);
  } else if (game.state === STATE.OVER) {
    drawCenterPanel(ctx, game.overTitle, game.overLines, game.overAccent);
  }
}

// The R key restarts the sortie at once, whatever the state (except title).
function bindRestartKey(game) {
  if (typeof window === 'undefined') return;
  window.addEventListener('keydown', (event) => {
    const k = event.key;
    if (k === 'r' || k === 'R') {
      if (game.state === STATE.PLAY || game.state === STATE.PAUSE || game.state === STATE.OVER) {
        playClick();
        resetSortie(game);
        game.state = STATE.PLAY;
      }
    }
  });
}

// Boot the game once the page is ready.
function bootGame() {
  const canvas = document.getElementById('game');
  const game = createGame(canvas);
  Terrain.initDecor();
  Flight.setCanvas(canvas);
  initInput(canvas);
  bindRestartKey(game);
  // A screenshot pose skips the title and starts flying at once.
  if (game.shot) {
    applyShotPreset(game, game.shot);
    game.state = STATE.PLAY;
  }
  // Expose the game for play-testing hooks; harmless in normal play.
  window.SkylarkGame = game;

  let last = performance.now();
  function loop(now) {
    const dt = Math.max(0, Math.min(1 / 30, (now - last) / 1000));
    last = now;
    try {
      frame(game, dt);
    } catch (err) {
      // Never let one bad frame kill the loop; the error surfaces in the console.
      console.error(err);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootGame);
  } else {
    bootGame();
  }
}
