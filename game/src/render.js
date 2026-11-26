// Skylark Ridge — renderer: everything the eye sees, drawn on one canvas.
// One job: turn the flight state and the terrain into a sunset valley frame.
// The camera, the sky, the ground, the plane, the rings and the particles
// all live here; the loop only calls drawScene and drawOverlay.

'use strict';

// Particles: ring bursts, landing dust, crash smoke. Visual only.
const Particles = {
  list: [],
};

function spawnBurst(x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (0.3 + Math.random() * 0.7) * speed;
    Particles.list.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 30,
      life: 0.9 + Math.random() * 0.9,
      age: 0,
      size: 2 + Math.random() * 4,
      color,
    });
  }
}

function spawnSmoke(x, y, count) {
  for (let i = 0; i < count; i++) {
    Particles.list.push({
      x: x + (Math.random() - 0.5) * 30,
      y: y + (Math.random() - 0.5) * 14,
      vx: -20 - Math.random() * 40,
      vy: -14 - Math.random() * 26,
      life: 1.2 + Math.random() * 1.2,
      age: 0,
      size: 5 + Math.random() * 9,
      color: '#8a8078',
    });
  }
}

function updateParticles(dt) {
  for (const p of Particles.list) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy -= 12 * dt;
    p.vx *= 1 - 0.4 * dt;
  }
  Particles.list = Particles.list.filter((p) => p.age < p.life);
}

// The camera: what slice of the world the screen shows.
function createCamera() {
  return { x: 0, y: 0, shake: 0 };
}

function updateCamera(camera, plane, dt) {
  const targetX = Math.max(0, Math.min(WORLD_LENGTH - VIEW_W, plane.x - VIEW_W * 0.38));
  const targetY = Math.max(-80, Math.min(WORLD_HEIGHT - VIEW_H, plane.y - VIEW_H * 0.55));
  const k = 1 - Math.exp(-4.5 * dt);
  camera.x += (targetX - camera.x) * k;
  camera.y += (targetY - camera.y) * k;
  camera.shake = Math.max(0, camera.shake - dt * 26);
}

function cameraOffset(camera) {
  if (camera.shake <= 0) return { x: 0, y: 0 };
  const s = camera.shake;
  return {
    x: (Math.random() - 0.5) * s,
    y: (Math.random() - 0.5) * s,
  };
}

// --- sky ---------------------------------------------------------------------

function drawSky(ctx, camera, time) {
  const P = PALETTE;
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, P.skyTop);
  g.addColorStop(0.45, P.skyMid);
  g.addColorStop(0.75, P.skyLow);
  g.addColorStop(1, P.horizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Stars fading in at the top of the sky.
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 70; i++) {
    const sx = (i * 173.3 + camera.x * 0.05) % VIEW_W;
    const sy = (i * 97.7) % 260;
    const tw = 0.35 + 0.3 * Math.sin(time * 1.7 + i * 2.4);
    ctx.globalAlpha = Math.max(0.05, tw) * (1 - sy / 320);
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.restore();

  // The low sun, with a warm glow.
  const sunX = VIEW_W * 0.76 - camera.x * 0.03;
  const sunY = 168 - camera.y * 0.08;
  const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 190);
  glow.addColorStop(0, 'rgba(255, 190, 90, 0.85)');
  glow.addColorStop(0.35, 'rgba(255, 157, 77, 0.35)');
  glow.addColorStop(1, 'rgba(255, 157, 77, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.fillStyle = P.sunCore;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sunX, sunY, 44, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 233, 168, 0.7)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Clouds, drifting slowly, in three parallax layers.
  for (const cloud of Terrain.decor.clouds) {
    const parallax = 0.12 + cloud.layer * 0.1;
    const cx = (((cloud.x - camera.x * parallax + time * cloud.speed) % (VIEW_W + 320)) + VIEW_W + 320) % (VIEW_W + 320) - 160;
    const cy = cloud.y - camera.y * parallax * 0.5;
    if (cy < -60 || cy > VIEW_H) continue;
    ctx.save();
    ctx.globalAlpha = 0.28 + cloud.layer * 0.1;
    ctx.fillStyle = '#ffd9c0';
    const s = cloud.scale;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 62 * s, 16 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - 34 * s, cy + 5 * s, 36 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 38 * s, cy + 6 * s, 40 * s, 13 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// A distant ridge silhouette, drawn from a sine profile at a parallax factor.
function drawRidgeLayer(ctx, camera, parallax, baseY, amp, color, seed) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  for (let sx = 0; sx <= VIEW_W; sx += 16) {
    const wx = sx + camera.x * parallax;
    const y = baseY
      + amp * Math.sin(wx / 420 + seed)
      + amp * 0.45 * Math.sin(wx / 173 + seed * 2.7)
      - camera.y * parallax * 0.4;
    ctx.lineTo(sx, y);
  }
  ctx.lineTo(VIEW_W, VIEW_H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// --- terrain -----------------------------------------------------------------

function drawTerrain(ctx, camera) {
  const P = PALETTE;
  const x0 = Math.max(0, camera.x - 40);
  const x1 = Math.min(WORLD_LENGTH, camera.x + VIEW_W + 40);

  // The ground body: rock below, grass on top.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0 - camera.x, VIEW_H);
  for (let sx = x0; sx <= x1; sx += 8) {
    ctx.lineTo(sx - camera.x, Terrain.heightAt(sx) - camera.y);
  }
  ctx.lineTo(x1 - camera.x, VIEW_H);
  ctx.closePath();
  const rock = ctx.createLinearGradient(0, 500 - camera.y, 0, VIEW_H);
  rock.addColorStop(0, P.terrainRock);
  rock.addColorStop(1, P.terrainRockDark);
  ctx.fillStyle = rock;
  ctx.fill();
  ctx.restore();

  // Snow on the high ridges.
  ctx.save();
  ctx.fillStyle = P.terrainSnow;
  for (let sx = x0; sx <= x1; sx += 8) {
    const gy = Terrain.heightAt(sx);
    if (gy < 760) {
      ctx.fillRect(sx - camera.x, gy - camera.y, 8, 5);
    }
  }
  ctx.restore();

  // Grass lip along the top edge.
  ctx.save();
  ctx.strokeStyle = P.terrainGrassLight;
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let sx = x0; sx <= x1; sx += 8) {
    const gy = Terrain.heightAt(sx) - camera.y;
    if (sx === x0) ctx.moveTo(sx - camera.x, gy);
    else ctx.lineTo(sx - camera.x, gy);
  }
  ctx.stroke();
  ctx.strokeStyle = P.terrainGrass;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let sx = x0; sx <= x1; sx += 8) {
    const gy = Terrain.heightAt(sx) - camera.y + 4;
    if (sx === x0) ctx.moveTo(sx - camera.x, gy);
    else ctx.lineTo(sx - camera.x, gy);
  }
  ctx.stroke();
  ctx.restore();

  // The lake, where the ground sags.
  if (x1 > Terrain.lake.x0 && x0 < Terrain.lake.x1) {
    const lx0 = Math.max(Terrain.lake.x0, x0) - camera.x;
    const lx1 = Math.min(Terrain.lake.x1, x1) - camera.x;
    const wy = Terrain.lake.waterY - camera.y;
    ctx.save();
    ctx.fillStyle = P.water;
    ctx.fillRect(lx0, wy, lx1 - lx0, 26);
    ctx.fillStyle = P.waterShine;
    ctx.fillRect(lx0, wy, lx1 - lx0, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 5; i++) {
      const rx = lx0 + ((i * 97 + 31) % Math.max(1, lx1 - lx0));
      ctx.fillRect(rx, wy + 8 + (i % 3) * 5, 26, 2);
    }
    ctx.restore();
  }

  // Trees.
  for (const tree of Terrain.decor.trees) {
    if (tree.x < x0 || tree.x > x1) continue;
    const tx = tree.x - camera.x;
    const ty = tree.y - camera.y;
    const s = tree.scale;
    ctx.save();
    ctx.fillStyle = '#4a3423';
    ctx.fillRect(tx - 2 * s, ty - 12 * s, 4 * s, 12 * s);
    ctx.fillStyle = tree.tint > 0.5 ? P.treeLight : P.treeDark;
    ctx.beginPath();
    ctx.moveTo(tx, ty - 34 * s);
    ctx.lineTo(tx - 11 * s, ty - 10 * s);
    ctx.lineTo(tx + 11 * s, ty - 10 * s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tx, ty - 46 * s);
    ctx.lineTo(tx - 8 * s, ty - 26 * s);
    ctx.lineTo(tx + 8 * s, ty - 26 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Houses with lit windows beside the runways.
  for (const house of Terrain.decor.houses) {
    if (house.x < x0 || house.x > x1) continue;
    const hx = house.x - camera.x;
    const hy = house.y - camera.y;
    ctx.save();
    ctx.fillStyle = '#7a5a3a';
    ctx.fillRect(hx, hy - house.h, house.w, house.h);
    ctx.fillStyle = '#5a3a28';
    ctx.beginPath();
    ctx.moveTo(hx - 3, hy - house.h);
    ctx.lineTo(hx + house.w / 2, hy - house.h - 12);
    ctx.lineTo(hx + house.w + 3, hy - house.h);
    ctx.closePath();
    ctx.fill();
    if (house.lit) {
      ctx.fillStyle = '#ffd94d';
      ctx.fillRect(hx + 6, hy - house.h + 7, 8, 8);
      ctx.fillRect(hx + house.w - 14, hy - house.h + 7, 8, 8);
    }
    ctx.restore();
  }

  // Runway strips.
  for (const rw of COURSE.runways) {
    if (rw.x1 < x0 || rw.x0 > x1) continue;
    const rx0 = rw.x0 - camera.x;
    const rx1 = rw.x1 - camera.x;
    const ry = RUNWAY_Y - camera.y;
    ctx.save();
    ctx.fillStyle = PALETTE.runway;
    ctx.fillRect(rx0, ry - 4, rx1 - rx0, 8);
    ctx.fillStyle = PALETTE.runwayLine;
    for (let d = rx0 + 18; d < rx1 - 18; d += 44) {
      ctx.fillRect(d, ry - 1, 24, 2);
    }
    // Threshold bars.
    ctx.fillRect(rx0 + 6, ry - 3, 4, 6);
    ctx.fillRect(rx1 - 10, ry - 3, 4, 6);
    // The strip's name, painted on the grass beside it.
    ctx.font = '700 13px ui-monospace, Menlo, Consolas, monospace';
    ctx.fillStyle = 'rgba(255, 243, 214, 0.85)';
    ctx.textAlign = 'center';
    ctx.fillText(rw.name, (rx0 + rx1) / 2, ry + 24);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  // Rock spires with a blinking beacon on top.
  for (const spire of Terrain.spires) {
    if (spire.x < x0 - 40 || spire.x > x1 + 40) continue;
    const sx = spire.x - camera.x;
    const top = spire.topY - camera.y;
    const base = spire.baseY - camera.y;
    ctx.save();
    ctx.fillStyle = '#5d4a3c';
    ctx.beginPath();
    ctx.moveTo(sx - spire.width / 2, base);
    ctx.lineTo(sx - spire.width / 2 + 5, top + 26);
    ctx.lineTo(sx - 4, top);
    ctx.lineTo(sx + 4, top);
    ctx.lineTo(sx + spire.width / 2 - 5, top + 26);
    ctx.lineTo(sx + spire.width / 2, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.terrainSnow;
    ctx.beginPath();
    ctx.moveTo(sx - 6, top + 12);
    ctx.lineTo(sx, top);
    ctx.lineTo(sx + 6, top + 12);
    ctx.closePath();
    ctx.fill();
    const blink = (Date.now() / 600) % 2 < 1;
    if (blink) {
      ctx.save();
      ctx.shadowColor = '#ff5a4a';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#ff5a4a';
      ctx.beginPath();
      ctx.arc(sx, top - 4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}

// --- rings -------------------------------------------------------------------

function drawRings(ctx, camera, time) {
  const P = PALETTE;
  for (const ring of Terrain.rings) {
    const rx = ring.x - camera.x;
    const ry = ring.y - camera.y;
    if (rx < -120 || rx > VIEW_W + 120 || ry < -120 || ry > VIEW_H + 120) continue;
    ctx.save();
    const pulse = 0.75 + 0.25 * Math.sin(time * 3 + ring.index);
    const glow = ring.flash > 0 ? ring.flash : pulse;
    ctx.shadowColor = P.ringGlow;
    ctx.shadowBlur = ring.passed ? 6 : 22 * glow;
    ctx.strokeStyle = ring.passed ? 'rgba(125, 255, 154, 0.9)' : P.ringGold;
    ctx.lineWidth = ring.passed ? 5 : 8;
    ctx.beginPath();
    ctx.arc(rx, ry, ring.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = ring.passed ? 'rgba(125, 255, 154, 0.55)' : 'rgba(255, 157, 46, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rx, ry, ring.r - 9, 0, Math.PI * 2);
    ctx.stroke();
    // The ring's number, so the pilot can count the course.
    ctx.fillStyle = ring.passed ? '#7dff9a' : '#fff3d6';
    ctx.font = '700 20px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ring.passed ? '✓' : String(ring.index + 1), rx, ry - ring.r - 16);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

// --- the plane ---------------------------------------------------------------

function drawPlane(ctx, plane, camera, time) {
  const P = PALETTE;
  const px = plane.x - camera.x;
  const py = plane.y - camera.y;
  if (px < -120 || px > VIEW_W + 120 || py < -120 || py > VIEW_H + 120) return;

  // Soft shadow on the ground below the plane.
  const groundY = Terrain.heightAt(plane.x) - camera.y;
  const heightAbove = Math.max(0, groundY - py);
  if (heightAbove < 420 && groundY < VIEW_H + 40) {
    const alpha = Math.max(0, 0.28 - heightAbove / 1600);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#1a1420';
    ctx.beginPath();
    ctx.ellipse(px, groundY + 4, 42, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(plane.pitch * 0.85);
  // A faint speed blur when fast.
  if (plane.speed > 240) {
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-58, 0, 34, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Tail fin and stabiliser.
  ctx.fillStyle = P.planeOrange;
  ctx.beginPath();
  ctx.moveTo(-30, -2);
  ctx.lineTo(-42, -22);
  ctx.lineTo(-34, -22);
  ctx.lineTo(-22, -4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = P.planeCream;
  ctx.beginPath();
  ctx.moveTo(-28, 2);
  ctx.lineTo(-46, 8);
  ctx.lineTo(-44, 12);
  ctx.lineTo(-26, 6);
  ctx.closePath();
  ctx.fill();

  // Fuselage.
  ctx.fillStyle = P.planeCream;
  ctx.beginPath();
  ctx.ellipse(0, 0, 46, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  // Sunset stripe.
  ctx.fillStyle = P.planeOrange;
  ctx.beginPath();
  ctx.ellipse(2, 4, 42, 5, 0, 0, Math.PI);
  ctx.fill();
  ctx.fillRect(-40, -1, 82, 5);
  // Nose.
  ctx.fillStyle = P.planeDark;
  ctx.beginPath();
  ctx.arc(44, -1, 5, -Math.PI / 2, Math.PI / 2);
  ctx.fill();

  // Cockpit canopy with the pilot inside.
  ctx.fillStyle = P.glass;
  ctx.beginPath();
  ctx.ellipse(12, -8, 13, 8, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(9, -11, 5, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2e28';
  ctx.beginPath();
  ctx.arc(14, -7, 3.4, 0, Math.PI * 2);
  ctx.fill();

  // Main wing, sweeping back over the fuselage.
  ctx.fillStyle = P.planeOrange;
  ctx.beginPath();
  ctx.moveTo(-6, -4);
  ctx.lineTo(14, -30);
  ctx.lineTo(22, -30);
  ctx.lineTo(10, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = P.planeCream;
  ctx.beginPath();
  ctx.moveTo(14, -30);
  ctx.lineTo(22, -30);
  ctx.lineTo(18, -24);
  ctx.lineTo(12, -24);
  ctx.closePath();
  ctx.fill();

  // Propeller: a spinning disc with two blades.
  const spin = time * (18 + plane.throttle * 42);
  ctx.save();
  ctx.translate(50, -1);
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#d8d2c4';
  ctx.beginPath();
  ctx.ellipse(0, 0, 4, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.rotate(spin);
  ctx.fillStyle = '#2e2620';
  ctx.fillRect(-2, -26, 4, 52);
  ctx.rotate(Math.PI / 2);
  ctx.fillRect(-2, -26, 4, 52);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(50, -1, 4, 0, Math.PI * 2);
  ctx.fillStyle = P.planeDark;
  ctx.fill();

  // Fixed landing gear.
  ctx.strokeStyle = P.planeDark;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-8, 8);
  ctx.lineTo(-12, 20);
  ctx.moveTo(16, 8);
  ctx.lineTo(20, 20);
  ctx.stroke();
  ctx.fillStyle = '#1d1a24';
  ctx.beginPath();
  ctx.arc(-12, 21, 5, 0, Math.PI * 2);
  ctx.arc(20, 21, 5, 0, Math.PI * 2);
  ctx.fill();

  // Wingtip light and landing light when low.
  ctx.fillStyle = '#7dff9a';
  ctx.beginPath();
  ctx.arc(18, -29, 2.5, 0, Math.PI * 2);
  ctx.fill();
  const agl = Terrain.heightAt(plane.x) - plane.y;
  if (agl < 260 && (plane.landed || plane.speed < 200)) {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.moveTo(46, 0);
    ctx.lineTo(190, -26);
    ctx.lineTo(190, 26);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// --- particles ---------------------------------------------------------------

function drawParticles(ctx, camera) {
  for (const p of Particles.list) {
    const age = p.age / p.life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - age);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - camera.x, p.y - camera.y, p.size * (1 + age), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// --- the whole frame -----------------------------------------------------------

function drawScene(ctx, plane, camera, time, toasts) {
  const off = cameraOffset(camera);
  ctx.save();
  ctx.translate(off.x, off.y);
  drawSky(ctx, camera, time);
  drawRidgeLayer(ctx, camera, 0.16, 470, 60, PALETTE.farMountain, 1.7);
  drawRidgeLayer(ctx, camera, 0.32, 540, 80, PALETTE.midHill, 4.2);
  drawTerrain(ctx, camera);
  drawRings(ctx, camera, time);
  drawPlane(ctx, plane, camera, time);
  drawParticles(ctx, camera);
  // Birds, far above the ground.
  ctx.save();
  ctx.strokeStyle = 'rgba(30, 20, 32, 0.7)';
  ctx.lineWidth = 2;
  for (const bird of Terrain.decor.birds) {
    const bx = ((((bird.x + time * bird.speed - camera.x * 0.6) % (VIEW_W + 200)) + VIEW_W + 200) % (VIEW_W + 200)) - 100;
    const by = bird.y - camera.y * 0.5 + Math.sin(time * 2 + bird.phase) * 12;
    if (by < -20 || by > VIEW_H) continue;
    const flap = Math.sin(time * 9 + bird.phase) * 5;
    ctx.beginPath();
    ctx.moveTo(bx - 7, by);
    ctx.quadraticCurveTo(bx - 2, by - 4 - flap, bx, by);
    ctx.quadraticCurveTo(bx + 2, by - 4 - flap, bx + 7, by);
    ctx.stroke();
  }
  ctx.restore();
  // Vignette: the frame darkens a little at the edges.
  const vig = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
  vig.addColorStop(0, 'rgba(10, 8, 20, 0)');
  vig.addColorStop(1, 'rgba(10, 8, 20, 0.34)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.restore();

  // Floating score toasts.
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '700 26px ui-monospace, Menlo, Consolas, monospace';
  for (const toast of toasts) {
    const age = toast.age / toast.life;
    ctx.globalAlpha = Math.max(0, 1 - age * age);
    ctx.fillStyle = toast.color || '#ffd94d';
    ctx.fillText(toast.text, toast.x - camera.x, toast.y - camera.y - age * 46);
  }
  ctx.restore();
}

// --- overlays ------------------------------------------------------------------

function drawCenterPanel(ctx, title, lines, accent) {
  const P = PALETTE;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 8, 20, 0.66)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const w = 640;
  const h = 130 + lines.length * 30;
  const x = (VIEW_W - w) / 2;
  const y = (VIEW_H - h) / 2 - 30;
  ctx.fillStyle = 'rgba(24, 19, 34, 0.94)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = accent || P.dialAmber;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent || P.dialAmber;
  ctx.font = '700 34px system-ui, sans-serif';
  ctx.fillText(title, VIEW_W / 2, y + 52);
  ctx.fillStyle = P.hudText;
  ctx.font = '16px system-ui, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, VIEW_W / 2, y + 92 + i * 30);
  });
  ctx.restore();
}

function drawTitle(ctx, time) {
  const P = PALETTE;
  ctx.save();
  ctx.textAlign = 'center';
  // Title block, high in the frame so the runway stays visible below.
  ctx.fillStyle = 'rgba(10, 8, 20, 0.55)';
  ctx.fillRect(0, 84, VIEW_W, 168);
  ctx.fillStyle = P.hudText;
  ctx.font = '700 58px system-ui, sans-serif';
  ctx.fillText('SKYLARK RIDGE', VIEW_W / 2, 148);
  ctx.fillStyle = '#ffb347';
  ctx.font = '700 19px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText('A SUNSET VALLEY FLIGHT  ·  12 RINGS  ·  3 RUNWAYS  ·  1 SKYLARK', VIEW_W / 2, 182);
  ctx.fillStyle = P.hudText;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Fly the valley, thread every golden ring, and land on Ridge End to finish the sortie.', VIEW_W / 2, 216);
  ctx.fillText('Watch the fuel — land on any runway to fill up again.', VIEW_W / 2, 238);
  // Blinking start prompt.
  if (Math.floor(time * 1.6) % 2 === 0) {
    ctx.fillStyle = '#ffd94d';
    ctx.font = '700 22px ui-monospace, Menlo, Consolas, monospace';
    ctx.fillText('PRESS ENTER OR CLICK TO FLY', VIEW_W / 2, 300);
  }
  ctx.restore();
}

const Render = {
  Particles,
  spawnBurst,
  spawnSmoke,
  updateParticles,
  createCamera,
  updateCamera,
  drawScene,
  drawHud,
  drawInstruments,
  drawCenterPanel,
  drawTitle,
};
