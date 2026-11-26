# Skylark Ridge

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/mannn7/makefun-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/mannn7/makefun-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A sunset valley flight. You are the pilot of a little bush plane — the
Skylark — crossing a mountain valley at dusk. Thread twelve golden rings,
mind the fuel gauge, and bring her down on Ridge End to finish the sortie.

## How to play

Open `game/index.html` in a desktop browser (or serve `game/` with any
static server). No network, no build step, no install.

| Control | What it does |
| --- | --- |
| W / S or ↑ / ↓ | Pitch the nose up / down |
| A / D or ← / → | Throttle down / up |
| Mouse | Steer by pointer height (move it and the plane follows) |
| Mouse wheel | Throttle up / down |
| Space | Boost (burns fuel faster) |
| P | Pause |
| R | Restart the sortie |
| Enter / click | Start, and dismiss the end panel |

## The sortie

- **Take off** from Skylark Field, climb out over the valley, and chase the
  golden rings. Each ring is worth 100 points; threading the middle third
  is a perfect pass worth 125.
- **Fuel** drains as you fly. Land on any runway to fill up again and bank
  250 points. Lakeside Strip sits halfway along the valley for exactly that.
- **Rock spires** rise out of the terrain with red beacons on top. The
  mountainsides, the lake and the end wall are all as hard as they look.
- **Finish** by landing on Ridge End with at least 8 of the 12 rings for a
  win, plus a 500 point bonus and a time bonus.

The cockpit is lit the whole way: altitude, speed and heading across the
top bar, and an attitude indicator, airspeed and altimeter dials, a compass
tape, fuel gauge, throttle lever and warning lamps along the bottom panel.

## Structure

```
game/
  index.html          page shell, loads the scripts in order
  style.css           page chrome around the canvas
  src/
    config.js         world size, physics tuning, course layout, palette
    input.js          keyboard, mouse steering and wheel throttle
    terrain.js        the valley: ground height, runways, rings, spires
    flight.js         the flight model: lift, stall, fuel, rings, landings
    audio.js          the synthesizer: engine hum, chimes, thuds
    hud.js            top status bar and the lit instrument panel
    render.js         the sunset valley, the plane, the rings, the particles
    main.js           the loop, the states, the screenshot poses
main.ts               copies game/ + screenshots/ to /output, writes dossier.json
vendor/
  makefun-game.ts     the kit's dossier library, copied unchanged
```

## License

MIT — see [LICENSE](LICENSE).
