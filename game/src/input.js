// Skylark Ridge — input: keyboard, mouse wheel and mouse steering, in one place.
// One job: turn raw DOM events into a clean, frame-ready control state.
// Nothing here knows about the plane; flight.js reads this state each step.

'use strict';

// The live control state the flight model reads every frame.
const Input = {
  up: false, // W / ArrowUp: pitch the nose up
  down: false, // S / ArrowDown: pitch the nose down
  left: false, // A / ArrowLeft: throttle down
  right: false, // D / ArrowRight: throttle up
  boost: false, // Space: extra power, burns fuel faster
  confirm: false, // Enter or a canvas click: start, restart, dismiss
  pause: false, // P or Escape: pause / resume (edge-triggered, see consumePause)
  mouseX: 0, // last mouse position over the canvas, CSS pixels
  mouseY: 0,
  mouseMovedAt: -1e9, // performance.now() of the last mouse move
  wheelThrottle: 0, // accumulated mouse-wheel throttle steps, consumed by the loop
  anyKeyAt: -1e9, // performance.now() of the last key or click
};

// Edge-triggered presses the game loop consumes once per frame.
const InputEdges = {
  confirm: false,
  pause: false,
};

// Whether the mouse is steering right now: moved in the last 2.5 seconds.
function mouseSteeringActive(now) {
  return now - Input.mouseMovedAt < 2500;
}

// The pitch the mouse asks for: -1 (climb) .. 1 (dive), from the pointer's
// height over the canvas. 0 when the mouse has not steered lately.
function mousePitchCommand(canvas, now) {
  if (!mouseSteeringActive(now)) return 0;
  const rect = canvas.getBoundingClientRect();
  const y = (Input.mouseY - rect.top) / Math.max(1, rect.height); // 0 top .. 1 bottom
  // The top third of the screen asks for a climb, the bottom third for a dive.
  if (y < 0.34) return -1;
  if (y > 0.66) return 1;
  return 0;
}

// Take one wheel step (callers read and clear Input.wheelThrottle each frame).
function consumeWheel() {
  const steps = Input.wheelThrottle;
  Input.wheelThrottle = 0;
  return steps;
}

function consumeConfirm() {
  const hit = InputEdges.confirm;
  InputEdges.confirm = false;
  return hit;
}

function consumePause() {
  const hit = InputEdges.pause;
  InputEdges.pause = false;
  return hit;
}

function markActivity(now) {
  Input.anyKeyAt = now;
}

function keyName(event) {
  const k = event.key;
  if (k === ' ') return 'Space';
  return k.length === 1 ? k.toLowerCase() : k;
}

// Wire the listeners. Safe to call in a non-browser context: it simply does nothing.
function initInput(canvas) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const now = () => performance.now();

  window.addEventListener('keydown', (event) => {
    const k = keyName(event);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    markActivity(now());
    if (k === 'w' || k === 'ArrowUp') Input.up = true;
    else if (k === 's' || k === 'ArrowDown') Input.down = true;
    else if (k === 'a' || k === 'ArrowLeft') Input.left = true;
    else if (k === 'd' || k === 'ArrowRight') Input.right = true;
    else if (k === 'Space') Input.boost = true;
    else if (k === 'Enter') {
      Input.confirm = true;
      InputEdges.confirm = true;
    } else if (k === 'p' || k === 'P' || k === 'Escape') {
      InputEdges.pause = true;
    }
  });

  window.addEventListener('keyup', (event) => {
    const k = keyName(event);
    if (k === 'w' || k === 'ArrowUp') Input.up = false;
    else if (k === 's' || k === 'ArrowDown') Input.down = false;
    else if (k === 'a' || k === 'ArrowLeft') Input.left = false;
    else if (k === 'd' || k === 'ArrowRight') Input.right = false;
    else if (k === 'Space') Input.boost = false;
    else if (k === 'Enter') Input.confirm = false;
  });

  window.addEventListener('blur', () => {
    Input.up = false;
    Input.down = false;
    Input.left = false;
    Input.right = false;
    Input.boost = false;
  });

  canvas.addEventListener('mousemove', (event) => {
    Input.mouseX = event.clientX;
    Input.mouseY = event.clientY;
    Input.mouseMovedAt = now();
  });

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    // Wheel up: more throttle; wheel down: less.
    Input.wheelThrottle += event.deltaY < 0 ? 1 : -1;
    Input.mouseMovedAt = now();
  }, { passive: false });

  canvas.addEventListener('mousedown', () => {
    markActivity(now());
    InputEdges.confirm = true;
    Input.confirm = true;
  });

  canvas.addEventListener('mouseup', () => {
    Input.confirm = false;
  });
}
