// Skylark Ridge — audio: a tiny synthesizer, no audio files.
// One job: every sound the game makes, generated live with WebAudio.
// Everything is guarded: no AudioContext, no sound, no crash.

'use strict';

const AudioSys = {
  ctx: null,
  master: null,
  engineOsc: null,
  engineGain: null,
  muted: false,
  started: false,
};

// Start the audio graph. Call from the first user gesture.
function initAudio() {
  if (AudioSys.started) return;
  AudioSys.started = true;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    AudioSys.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    AudioSys.master = master;
    // The engine hum: a low sawtooth through a low-pass filter.
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start();
    AudioSys.engineOsc = osc;
    AudioSys.engineGain = gain;
  } catch (err) {
    AudioSys.ctx = null;
  }
}

// The engine follows the throttle: faster hum, a little louder.
function setEngineSound(throttle, airborne) {
  if (!AudioSys.ctx || !AudioSys.engineOsc || AudioSys.muted) return;
  try {
    const t = AudioSys.ctx.currentTime;
    AudioSys.engineOsc.frequency.setTargetAtTime(52 + throttle * 95, t, 0.08);
    AudioSys.engineGain.gain.setTargetAtTime(airborne ? 0.045 + throttle * 0.05 : 0.02 + throttle * 0.02, t, 0.1);
  } catch (err) {
    // Sound is garnish; never let it break the game.
  }
}

// A short beep: frequency, seconds, shape, volume.
function beep(freq, dur, type, vol, when) {
  if (!AudioSys.ctx || AudioSys.muted) return;
  try {
    const ctx = AudioSys.ctx;
    const t0 = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol || 0.16, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(AudioSys.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch (err) {
    // Ignore audio failures.
  }
}

// Two-note chime for a ring. A perfect pass rings a third note higher.
function playRingChime(perfect) {
  beep(880, 0.16, 'sine', 0.18, 0);
  beep(1318, 0.22, 'sine', 0.16, 0.09);
  if (perfect) beep(1760, 0.26, 'sine', 0.14, 0.18);
}

// A low thud for a touchdown.
function playLandThud() {
  beep(150, 0.22, 'sine', 0.3, 0);
  beep(90, 0.3, 'sine', 0.22, 0.05);
}

// A burst of noise for a crash.
function playCrash() {
  if (!AudioSys.ctx || AudioSys.muted) return;
  try {
    const ctx = AudioSys.ctx;
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.4;
    src.connect(gain);
    gain.connect(AudioSys.master);
    src.start();
  } catch (err) {
    // Ignore audio failures.
  }
  beep(70, 0.5, 'sine', 0.3, 0);
}

// A soft click for menus.
function playClick() {
  beep(660, 0.07, 'triangle', 0.12, 0);
}
