# AGENT.md — Skylark Ridge

## What this is

An entry for make.fun's `best-flight-game-20261126-0057` ("Make the best
flight game", $500). A complete, original 2D canvas flight game: a bush
plane crosses a sunset valley, threads twelve golden rings, manages fuel,
and lands on a final runway. Built from scratch in this session — no
starter code was read or copied, except the kit's `vendor/makefun-game.ts`,
which is the kit's own dossier library, copied unchanged as the rules ask.

## How it was built

- Plain HTML + CSS + JavaScript, no build step, no libraries, no network.
  The game is static files under `game/` and plays from any static server.
- One clear job per source file (see README.md for the map): config,
  input, terrain, flight model, audio synth, HUD/instruments, renderer,
  and the main loop with its states.
- The flight model is pure logic (`src/flight.js`, no DOM), so it was
  unit-tested in Node: throttle, climb, stall, ring passes, terrain and
  spire collisions, runway landings and refuelling, fuel exhaustion.
- Screenshots are real renders of the game's own code in headless Chrome,
  framed with the `?shot=` poses (`cover`, `ring`, `cruise`, `landing`)
  that start the game mid-flight in a chosen spot. Nothing was edited,
  composited or borrowed.
- `main.ts` copies `game/` and `screenshots/` to the output directory and
  writes `dossier.json` with `buildDossier` from `vendor/makefun-game.ts`.
  Two runs were verified byte-identical.

## How to play

`game/index.html` in a desktop browser. W/S or arrows pitch, A/D or
arrows throttle, the mouse steers, the wheel throttles, Space boosts,
P pauses, R restarts. Full instructions are in README.md.

## Verification (this session, 27 Nov 2026)

- Flight model: 26/26 Node logic assertions pass (`/tmp/test-flight.mjs`,
  scratch only, not part of the entry) — takeoff, climb, dive, stall sink,
  throttle up/down, ring +100 and event, terrain and spire crashes, runway
  landing + refuel to 100 + 250 pts, fuel exhaustion = engine out, final
  runway win with 8+ rings, incomplete landing, HUD helpers, and
  next-ring distance skipping rings already flown past.
- Two real bugs were found by the tests and fixed in the game: the stall
  sink had the wrong sign (the plane climbed when it should have sunk),
  and the takeoff frame read as a touchdown (the plane landed on itself
  the instant it lifted off); both are covered by the tests now.
- Game serves and renders: headless Chrome screenshots at 1280x780,
  inspected visually — title screen, cover, ring pass, high cruise and
  final approach all read clearly, with sane HUD values (NEXT distance,
  rings tally and score all consistent with the scene).
- Screenshots (all JPEG, 1280x780, under the 256 KiB cap):
  `1-takeoff.jpg` 80,366 B · `2-ring.jpg` 79,067 B ·
  `3-cruise.jpg` 75,801 B · `4-landing.jpg` 80,628 B.
- `MAKEFUN_OUTPUT_DIR=out node main.ts` writes `out/game/`,
  `out/screenshots/` and `out/dossier.json`; generating the dossier twice
  (Node 22 and Node 24) produces byte-identical files, sha256
  `f9a11885e72a7b7ea82bf618d6e3fec2ef784c59c80e180bb6e87ff239ca8d8f`.
- No network references anywhere in `game/` or `main.ts` (grep clean);
  `node --check` passes on all eight game scripts; `vendor/makefun-game.ts`
  is byte-identical to the kit copy (sha256
  `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129`).
