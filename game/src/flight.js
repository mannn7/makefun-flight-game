// Skylark Ridge — flight model: the plane, its physics, and the rules of the
// sortie. One job: step the plane forward in time and report what happened.
// Pure logic: no DOM, no canvas, no sound. The game loop calls stepFlight
// once per frame and reads the events it returns.

'use strict';

// A fresh plane sitting on the start runway, ready for takeoff.
function createPlane() {
  const start = COURSE.runways[0];
  return {
    x: start.x0 + 120,
    y: RUNWAY_Y - FLIGHT.groundClearance,
    speed: 0,
    pitch: 0, // radians; negative is nose up, positive is nose down
    throttle: 0.5,
    fuel: FLIGHT.fuelCapacity,
    score: 0,
    ringsPassed: 0,
    time: 0,
    landings: 0,
    airborne: false,
    landed: false, // true while sitting on a runway after a landing
    landedTimer: 0, // counts the pause on the runway before rolling again
    crashed: false,
    crashReason: '',
    finished: false, // the sortie is over (landed on the final runway)
    won: false,
    engineOut: false,
    stallWarning: false,
    events: [], // { type, ... } for the loop to turn into toasts and sounds
    distance: 0,
  };
}

// Feet above the ground, for the altimeter.
function planeAltitudeFeet(plane) {
  const agl = Math.max(0, Terrain.heightAt(plane.x) - plane.y);
  return Math.round(agl * 2.5);
}

// Speed in knots, for the airspeed dial.
function planeSpeedKnots(plane) {
  return Math.round(plane.speed * 0.85);
}

// Heading in degrees: the course runs east (090), crabbed a little by the wind.
function planeHeadingDeg(plane) {
  const wind = COURSE.windAt(plane.x);
  const crab = Math.max(-8, Math.min(8, wind * 9 + plane.pitch * 6));
  return Math.round(90 + crab);
}

// Distance in metres to the next unpassed ring, or null when none is left.
// Rings already flown past (missed or behind the plane) do not count: the
// next ring is the next one still ahead.
function nextRingDistance(plane) {
  for (const ring of Terrain.rings) {
    if (!ring.passed && ring.x > plane.x - 40) {
      return Math.max(0, Math.round((ring.x - plane.x) * 0.9));
    }
  }
  return null;
}

function pushEvent(plane, event) {
  plane.events.push(event);
}

// One physics step. `input` is the Input state; `dt` is seconds, clamped by the caller.
function stepFlight(plane, input, dt) {
  if (plane.crashed || plane.finished) return;
  plane.time += dt;

  // --- throttle ------------------------------------------------------------
  let throttle = plane.throttle;
  if (input.right) throttle += 0.9 * dt;
  if (input.left) throttle -= 0.9 * dt;
  throttle += consumeWheel() * 0.12;
  // The mouse wheel is the only throttle the mouse owns; the keyboard owns the rest.
  throttle = Math.max(0, Math.min(1, throttle));
  plane.throttle = throttle;

  // --- speed ---------------------------------------------------------------
  const boost = input.boost && plane.fuel > 0 && plane.airborne;
  const targetSpeed = FLIGHT.minSpeed + throttle * (FLIGHT.maxSpeed - FLIGHT.minSpeed) + (boost ? FLIGHT.boostSpeed : 0);
  const rate = targetSpeed > plane.speed ? FLIGHT.accel : FLIGHT.decel;
  plane.speed += Math.max(-rate * dt, Math.min(rate * dt, targetSpeed - plane.speed));
  if (plane.speed < 0) plane.speed = 0;

  // --- pitch ---------------------------------------------------------------
  // Keyboard: hold Up to climb, Down to dive. Mouse: the pointer's height
  // steers the same way while it moves. The nose follows at a fixed rate.
  let pitchCommand = 0;
  if (input.up) pitchCommand -= 1;
  if (input.down) pitchCommand += 1;
  if (pitchCommand === 0 && typeof mousePitchCommand === 'function') {
    pitchCommand = mousePitchCommand(GameCanvas, performance.now());
  }
  const targetPitch = pitchCommand * FLIGHT.maxPitch;
  const pitchStep = FLIGHT.pitchRate * dt;
  plane.pitch += Math.max(-pitchStep, Math.min(pitchStep, targetPitch - plane.pitch));

  // --- lift, stall and gravity ---------------------------------------------
  const stalled = plane.speed < FLIGHT.stallSpeed;
  plane.stallWarning = stalled && plane.airborne;
  let vy = plane.speed * Math.sin(plane.pitch);
  if (stalled) {
    // The wing gives up: the nose drops and the plane sinks.
    vy += (FLIGHT.stallSpeed - plane.speed) * 1.1;
    plane.pitch += (0 - plane.pitch) * 0.4 * dt;
  }
  const vx = plane.speed * Math.cos(plane.pitch);

  // --- fuel ------------------------------------------------------------------
  // The tank drains while flying or rolling for takeoff; on the runway after
  // a landing the crew is already refuelling, so it does not drain there.
  if ((plane.airborne || plane.speed > 5) && !plane.landed) {
    const burn = (FLIGHT.fuelDrainBase + plane.throttle * FLIGHT.fuelDrainThrottle) * (boost ? 2 : 1);
    plane.fuel = Math.max(0, plane.fuel - burn * dt);
    if (plane.fuel <= 0 && !plane.engineOut) {
      plane.engineOut = true;
      pushEvent(plane, { type: 'engineOut' });
    }
  }
  if (plane.engineOut) plane.throttle = Math.min(plane.throttle, 0);

  // --- move ------------------------------------------------------------------
  if (plane.landed) {
    // Rolling on the runway: the wheels stay on the ground and the plane
    // gathers speed for the next takeoff.
    plane.landedTimer += dt;
    if (!Terrain.runwayAt(plane.x)) {
      crashPlane(plane, 'Ran off the runway into the rough');
      return;
    }
    if (plane.landedTimer > 1.2) {
      // Line up for takeoff: the throttle spools on its own.
      plane.throttle = Math.max(plane.throttle, 0.7);
    }
    plane.y = Terrain.heightAt(plane.x) - FLIGHT.groundClearance;
    plane.x += plane.speed * dt;
    plane.distance += plane.speed * dt;
    if (plane.landedTimer > 1.6 && plane.speed > FLIGHT.takeoffSpeed) {
      plane.landed = false;
      plane.airborne = true;
      plane.pitch = -0.22;
      // Hop clear of the runway so this frame does not read as a touchdown.
      plane.y -= 40;
      pushEvent(plane, { type: 'takeoff' });
    }
    return;
  }
  plane.x += vx * dt;
  if (plane.airborne) {
    plane.y += vy * dt;
  } else {
    // Still rolling: the wheels stay on the ground until the wing lifts.
    plane.y = Terrain.heightAt(plane.x) - FLIGHT.groundClearance;
  }
  plane.distance += vx * dt;

  // --- takeoff ---------------------------------------------------------------
  if (!plane.airborne) {
    plane.y = Terrain.heightAt(plane.x) - FLIGHT.groundClearance;
    if (plane.speed > FLIGHT.takeoffSpeed) {
      plane.airborne = true;
      plane.pitch = -0.22;
      // Hop clear of the runway so this frame does not read as a touchdown.
      plane.y -= 40;
      pushEvent(plane, { type: 'takeoff' });
    }
  }

  // --- rings -----------------------------------------------------------------
  for (const ring of Terrain.rings) {
    if (ring.passed || ring.flash > 0.9) continue;
    const dx = plane.x - ring.x;
    const dy = plane.y - ring.y;
    if (Math.abs(dx) < ring.r && Math.abs(dy) < ring.r) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < ring.r * 0.75) {
        const perfect = dist < ring.r * 0.35;
        ring.passed = true;
        ring.flash = 1;
        plane.ringsPassed += 1;
        const points = SCORE.ring + (perfect ? SCORE.ringPerfect : 0);
        plane.score += points;
        pushEvent(plane, { type: 'ring', points, perfect, x: ring.x, y: ring.y });
      }
    }
  }
  for (const ring of Terrain.rings) {
    if (ring.flash > 0) ring.flash = Math.max(0, ring.flash - dt / 1.8);
  }

  // --- rock spires -------------------------------------------------------------
  for (const spire of Terrain.spires) {
    if (Math.abs(plane.x - spire.x) < spire.width / 2 + 12 && plane.y > spire.topY - 8) {
      crashPlane(plane, 'Rock spire — the valley bites back');
      return;
    }
  }

  // --- the ground --------------------------------------------------------------
  const ground = Terrain.heightAt(plane.x);
  if (plane.y + FLIGHT.groundClearance >= ground) {
    const runway = Terrain.runwayAt(plane.x);
    const sink = vy;
    // A gentle touchdown on a runway counts as a landing. (The takeoff hop
    // above is what keeps the liftoff frame itself from reading as one.)
    const gentle = sink < FLIGHT.landingMaxSink && plane.speed < FLIGHT.landingMaxSpeed;
    if (runway && gentle && plane.airborne) {
      landPlane(plane, runway);
      return;
    }
    if (runway && !plane.airborne) {
      // Still rolling on the runway during the takeoff run: fine.
      plane.y = ground - FLIGHT.groundClearance;
      return;
    }
    if (plane.airborne && runway) {
      crashPlane(plane, 'Came in too hot for the runway');
      return;
    }
    if (plane.airborne && Terrain.isLakeAt(plane.x)) {
      crashPlane(plane, 'Ditched in the lake');
    } else if (plane.airborne) {
      crashPlane(plane, plane.speed > 200 ? 'Flew into the mountainside' : 'Clipped the terrain');
    } else {
      // Rolling on rough ground off the strip wrecks the undercarriage.
      crashPlane(plane, 'Ran off the runway into the rough');
    }
    return;
  }

  // --- the end of the valley -----------------------------------------------------
  if (plane.x >= WORLD_LENGTH - 40) {
    crashPlane(plane, 'The valley ends at the big wall');
  }
}

// Touch down on a runway: refuel, score, and either roll on or end the sortie.
function landPlane(plane, runway) {
  plane.landed = true;
  plane.airborne = false;
  plane.landedTimer = 0;
  plane.landings += 1;
  plane.fuel = FLIGHT.fuelCapacity;
  plane.engineOut = false;
  plane.score += SCORE.landing;
  plane.y = Terrain.heightAt(plane.x) - FLIGHT.groundClearance;
  plane.pitch = 0;
  pushEvent(plane, { type: 'land', runway: runway.name, points: SCORE.landing });
  const isFinal = runway === COURSE.runways[COURSE.runways.length - 1];
  if (isFinal) {
    plane.finished = true;
    plane.won = plane.ringsPassed >= SCORE.ringsToWin;
    const timeBonus = plane.won ? Math.max(0, Math.round((SCORE.timePar - plane.time) * SCORE.timeBonusRate)) : 0;
    if (plane.won) plane.score += SCORE.winBonus + timeBonus;
    pushEvent(plane, { type: plane.won ? 'win' : 'incomplete', timeBonus });
  }
}

// The sortie ends in the terrain.
function crashPlane(plane, reason) {
  plane.crashed = true;
  plane.crashReason = reason;
  plane.speed = 0;
  pushEvent(plane, { type: 'crash', reason });
}

// The flight module's public surface. GameCanvas is set by main.js so the
// mouse steering helper can read the canvas rect.
let GameCanvas = null;

const Flight = {
  createPlane,
  stepFlight,
  landPlane,
  crashPlane,
  planeAltitudeFeet,
  planeSpeedKnots,
  planeHeadingDeg,
  nextRingDistance,
  setCanvas(canvas) {
    GameCanvas = canvas;
  },
};
