// Skylark Ridge — HUD and instruments: the numbers and dials the pilot reads.
// One job: draw the top status bar and the lit instrument panel at the bottom.
// Nothing here moves the plane; it only reads the flight state.

'use strict';

// Format seconds as M:SS.
function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}

// The top status bar: altitude, speed, heading, score, rings, time, fuel.
function drawHud(ctx, plane, view) {
  const P = PALETTE;
  ctx.save();
  // A dark strip so the text reads over any sky.
  ctx.fillStyle = 'rgba(12, 10, 22, 0.62)';
  ctx.fillRect(0, 0, VIEW_W, 46);
  ctx.fillStyle = P.hudText;
  ctx.textBaseline = 'middle';

  ctx.font = '700 13px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillStyle = '#ffb347';
  ctx.fillText('ALT', 18, 14);
  ctx.fillText('SPD', 18, 32);
  ctx.fillStyle = P.hudText;
  ctx.font = '700 20px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(String(planeAltitudeFeet(plane)).padStart(4, '0') + ' FT', 62, 14);
  ctx.fillText(planeSpeedKnots(plane) + ' KT', 62, 32);

  ctx.font = '700 13px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillStyle = '#ffb347';
  ctx.fillText('HDG', 218, 14);
  ctx.fillText('FUEL', 218, 32);
  ctx.fillStyle = P.hudText;
  ctx.font = '700 20px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(String(planeHeadingDeg(plane)).padStart(3, '0') + '°', 268, 14);
  // Fuel bar beside the number.
  const fuelW = 110;
  const fuelX = 268;
  const fuelY = 26;
  ctx.fillStyle = '#2a2438';
  ctx.fillRect(fuelX, fuelY, fuelW, 10);
  const fuelFrac = Math.max(0, plane.fuel / FLIGHT.fuelCapacity);
  ctx.fillStyle = fuelFrac > 0.25 ? P.dialGreen : P.dialRed;
  ctx.fillRect(fuelX, fuelY, fuelW * fuelFrac, 10);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.strokeRect(fuelX + 0.5, fuelY + 0.5, fuelW, 10);

  // Centre: score and rings.
  ctx.textAlign = 'center';
  ctx.font = '700 13px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillStyle = '#ffb347';
  ctx.fillText('SCORE', VIEW_W / 2, 14);
  ctx.fillStyle = P.hudText;
  ctx.font = '700 22px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(String(plane.score), VIEW_W / 2, 32);
  ctx.font = '700 13px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillStyle = '#8fc3dd';
  const next = nextRingDistance(plane);
  ctx.fillText('RINGS ' + plane.ringsPassed + '/' + Terrain.rings.length + (next !== null ? '   NEXT ' + next + 'm' : '   ALL RINGS DONE'), VIEW_W / 2 + 190, 23);
  ctx.textAlign = 'left';

  // Right: mission clock and throttle.
  ctx.textAlign = 'right';
  ctx.font = '700 13px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillStyle = '#ffb347';
  ctx.fillText('TIME', VIEW_W - 118, 14);
  ctx.fillStyle = P.hudText;
  ctx.font = '700 20px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(formatTime(plane.time), VIEW_W - 60, 14);
  ctx.font = '700 13px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillStyle = '#ffb347';
  ctx.fillText('THR', VIEW_W - 118, 32);
  ctx.fillStyle = P.hudText;
  ctx.fillText(Math.round(plane.throttle * 100) + '%', VIEW_W - 60, 32);
  ctx.textAlign = 'left';

  // Warnings, flashing when they matter.
  if (view.time % 0.9 < 0.55) {
    ctx.textAlign = 'center';
    ctx.font = '700 20px ui-monospace, Menlo, Consolas, monospace';
    if (plane.engineOut) {
      ctx.fillStyle = P.dialRed;
      ctx.fillText('FUEL EMPTY — GLIDE TO A RUNWAY', VIEW_W / 2, 78);
    } else if (plane.fuel < 25 && plane.fuel > 0) {
      ctx.fillStyle = P.dialRed;
      ctx.fillText('LOW FUEL', VIEW_W / 2, 78);
    } else if (plane.stallWarning) {
      ctx.fillStyle = P.dialAmber;
      ctx.fillText('STALL — PUSH THE THROTTLE', VIEW_W / 2, 78);
    }
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

// One round dial: face, ticks, a needle and a digital readout below.
function drawDial(ctx, cx, cy, r, label, valueText, frac, opts) {
  const P = PALETTE;
  ctx.save();
  ctx.translate(cx, cy);
  // Face.
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = P.dialFace;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = P.panelEdge;
  ctx.stroke();
  // Lit rim.
  ctx.beginPath();
  ctx.arc(0, 0, r - 2, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.55)';
  ctx.stroke();
  // Ticks.
  ctx.strokeStyle = 'rgba(242, 240, 232, 0.6)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    const r1 = r - 4;
    const r2 = r - (i % 5 === 0 ? 12 : 8);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    ctx.stroke();
  }
  // Needle.
  const angle = -Math.PI * 0.75 + Math.max(0, Math.min(1, frac)) * Math.PI * 1.5;
  ctx.strokeStyle = opts && opts.needle ? opts.needle : P.dialAmber;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(angle) * (r - 10), Math.sin(angle) * (r - 10));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fillStyle = P.dialWhite;
  ctx.fill();
  // Label and digital value.
  ctx.fillStyle = '#ffb347';
  ctx.font = '700 10px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, 0, r + 13);
  ctx.fillStyle = P.hudText;
  ctx.font = '700 12px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(valueText, 0, -r + 16);
  ctx.restore();
}

// The artificial horizon: sky and ground halves that roll with the pitch.
function drawAttitude(ctx, cx, cy, r, plane) {
  const P = PALETTE;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  // The horizon tilts with the pitch: nose up (negative pitch) pushes the
  // horizon down, so more sky shows above it.
  const pitchPx = Math.max(-r, Math.min(r, -plane.pitch * r * 1.4));
  ctx.fillStyle = '#3f7fc4';
  ctx.fillRect(-r, -r + pitchPx - r, r * 2, r * 2);
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(-r, pitchPx, r * 2, r * 2);
  // Horizon line.
  ctx.strokeStyle = P.dialWhite;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, pitchPx);
  ctx.lineTo(r, pitchPx);
  ctx.stroke();
  // Pitch ladder marks.
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 1;
  for (const off of [-24, -12, 12, 24]) {
    const y = pitchPx + off;
    if (Math.abs(y) > r - 4) continue;
    ctx.beginPath();
    ctx.moveTo(-14, y);
    ctx.lineTo(14, y);
    ctx.stroke();
  }
  // Fixed wings marker in the middle.
  ctx.strokeStyle = P.dialAmber;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-r + 8, 0);
  ctx.lineTo(-8, 0);
  ctx.moveTo(8, 0);
  ctx.lineTo(r - 8, 0);
  ctx.stroke();
  ctx.restore();
  // Rim.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = P.panelEdge;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.55)';
  ctx.stroke();
  ctx.fillStyle = '#ffb347';
  ctx.font = '700 10px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', cx, cy + r + 13);
  ctx.restore();
}

// A compass tape: the heading strip with N/E/S/W and the lubber line.
function drawCompass(ctx, x, y, w, plane) {
  const P = PALETTE;
  const heading = planeHeadingDeg(plane);
  ctx.save();
  ctx.fillStyle = P.dialFace;
  ctx.fillRect(x, y, w, 34);
  ctx.strokeStyle = P.panelEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, 32);
  // Clip to the strip.
  ctx.beginPath();
  ctx.rect(x, y, w, 34);
  ctx.clip();
  ctx.font = '700 13px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  const pxPerDeg = w / 120; // 120 degrees visible
  for (let d = 0; d < 360; d += 5) {
    let rel = d - heading;
    while (rel > 180) rel -= 360;
    while (rel < -180) rel += 360;
    if (Math.abs(rel) > 60) continue;
    const cx = x + w / 2 + rel * pxPerDeg;
    const major = d % 45 === 0;
    ctx.strokeStyle = major ? P.dialWhite : 'rgba(242,240,232,0.4)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(cx, y + (major ? 6 : 12));
    ctx.lineTo(cx, y + 18);
    ctx.stroke();
    if (major) {
      const label = d === 0 ? 'N' : d === 90 ? 'E' : d === 180 ? 'S' : d === 270 ? 'W' : String(d).padStart(3, '0');
      ctx.fillStyle = d === 90 ? P.dialAmber : P.hudText;
      ctx.fillText(label, cx, y + 29);
    }
  }
  // Lubber line.
  ctx.fillStyle = P.dialRed;
  ctx.beginPath();
  ctx.moveTo(x + w / 2 - 6, y);
  ctx.lineTo(x + w / 2 + 6, y);
  ctx.lineTo(x + w / 2, y + 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffb347';
  ctx.font = '700 10px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('HEADING ' + String(heading).padStart(3, '0') + '°', x + w / 2, y + 46);
  ctx.textAlign = 'left';
}

// The whole bottom instrument panel.
function drawInstruments(ctx, plane) {
  const P = PALETTE;
  const y0 = VIEW_H - PANEL_H;
  ctx.save();
  // Panel body.
  ctx.fillStyle = P.panel;
  ctx.fillRect(0, y0, VIEW_W, PANEL_H);
  ctx.fillStyle = '#2a2333';
  ctx.fillRect(0, y0, VIEW_W, 4);
  ctx.strokeStyle = P.panelEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y0 + 1);
  ctx.lineTo(VIEW_W, y0 + 1);
  ctx.stroke();

  const cy = y0 + 46;
  drawAttitude(ctx, 92, cy, 36, plane);
  drawDial(ctx, 218, cy, 36, 'AIRSPEED', planeSpeedKnots(plane) + ' KT', plane.speed / FLIGHT.maxSpeed, { needle: P.dialGreen });
  drawDial(ctx, 344, cy, 36, 'ALTITUDE', planeAltitudeFeet(plane) + ' FT', Math.min(1, planeAltitudeFeet(plane) / 2200), { needle: P.dialAmber });
  drawCompass(ctx, 420, y0 + 18, 300, plane);

  // Fuel gauge, right of the compass.
  const fx = 760;
  const fy = y0 + 14;
  ctx.fillStyle = '#ffb347';
  ctx.font = '700 10px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('FUEL', fx + 26, fy + 8);
  ctx.fillStyle = P.dialFace;
  ctx.fillRect(fx, fy + 14, 52, 56);
  ctx.strokeStyle = P.panelEdge;
  ctx.strokeRect(fx + 1, fy + 15, 50, 54);
  const frac = Math.max(0, plane.fuel / FLIGHT.fuelCapacity);
  ctx.fillStyle = frac > 0.25 ? P.dialGreen : P.dialRed;
  const barH = 50 * frac;
  ctx.fillRect(fx + 3, fy + 17 + (50 - barH), 46, barH);
  ctx.fillStyle = P.hudText;
  ctx.font = '700 12px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(Math.round(plane.fuel) + '', fx + 26, fy + 82);
  ctx.textAlign = 'left';

  // Throttle lever.
  const tx = 850;
  ctx.fillStyle = '#ffb347';
  ctx.font = '700 10px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('THROTTLE', tx + 26, fy + 8);
  ctx.fillStyle = P.dialFace;
  ctx.fillRect(tx, fy + 14, 52, 56);
  ctx.strokeStyle = P.panelEdge;
  ctx.strokeRect(tx + 1, fy + 15, 50, 54);
  const leverY = fy + 17 + 50 * (1 - plane.throttle);
  ctx.strokeStyle = P.dialAmber;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tx + 8, leverY);
  ctx.lineTo(tx + 44, leverY);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(tx + 26, leverY, 6, 0, Math.PI * 2);
  ctx.fillStyle = P.dialAmber;
  ctx.fill();
  ctx.fillStyle = P.hudText;
  ctx.font = '700 12px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(Math.round(plane.throttle * 100) + '%', tx + 26, fy + 82);
  ctx.textAlign = 'left';

  // Warning lights.
  const wx = 940;
  const lights = [
    { label: 'FUEL', on: plane.fuel < 25, color: P.dialRed },
    { label: 'STALL', on: plane.stallWarning, color: P.dialAmber },
    { label: 'RING', on: plane.ringsPassed >= SCORE.ringsToWin, color: P.dialGreen },
  ];
  ctx.font = '700 10px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  lights.forEach((lamp, i) => {
    const lx = wx + i * 62;
    ctx.beginPath();
    ctx.arc(lx + 14, y0 + 34, 11, 0, Math.PI * 2);
    ctx.fillStyle = lamp.on ? lamp.color : '#241f2e';
    ctx.fill();
    if (lamp.on) {
      ctx.save();
      ctx.shadowColor = lamp.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(lx + 14, y0 + 34, 7, 0, Math.PI * 2);
      ctx.fillStyle = lamp.color;
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = P.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(lx + 14, y0 + 34, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffb347';
    ctx.fillText(lamp.label, lx + 14, y0 + 62);
  });
  ctx.textAlign = 'left';
  ctx.restore();
}

const Hud = {
  drawHud,
  drawInstruments,
  formatTime,
};
