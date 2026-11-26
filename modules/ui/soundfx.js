/* ============================================================
   SoundFX: soft UI sound palette (Web Audio API only)
   Key: C major pentatonic (C D E G A). Every pitch is in key.
   Usage:
     SoundFX.init();           // call from any click/keydown handler (lazy, safe to repeat)
     SoundFX.setVolume(0.5);   // 0..1
     SoundFX.arrive(); SoundFX.dispatch(); SoundFX.preempt();
     SoundFX.done();   SoundFX.finish();   SoundFX.barTick(i);
   ============================================================ */
const SoundFX = (() => {
  'use strict';

  // ---------- Pitches (Hz, equal temperament, A4 = 440) ----------
  const N = {
    C3: 130.81, D3: 146.83, E3: 164.81, G3: 196.00, A3: 220.00,
    C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.00, A4: 440.00,
    C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00,
    C6: 1046.50
  };
  // barTick scale: 10 notes, C4..A5 (two octaves of pentatonic)
  const TICK_SCALE = [N.C4, N.D4, N.E4, N.G4, N.A4, N.C5, N.D5, N.E5, N.G5, N.A5];

  // ---------- State ----------
  let ctx = null, master = null, comp = null, dryBus = null, reverbIn = null;
  let enabled = true, volume = 0.5;      // master gain default 0.5
  let pendingResume = false, lastTick = -1, activeVoices = 0;
  const MAX_VOICES = 24;                 // hard cap so rapid calls can never pile up
  const UNLOCK_EVENTS = ['pointerdown', 'touchend', 'keydown', 'click'];

  // ---------- Generated reverb impulse response ----------
  // 1.6 s stereo, 10 ms pre-delay, exponential decay (~ -60 dB at the end),
  // one-pole lowpassed noise so the tail is dark and soft, not hissy.

  function makeImpulse(ac, seconds = 1.6) {
    const rate = ac.sampleRate, len = Math.floor(seconds * rate);
    const pre = Math.floor(0.010 * rate), fade = Math.floor(0.004 * rate);
    const buf = ac.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = pre; i < len; i++) {
        const t = (i - pre) / (len - pre);
        lp += ((Math.random() * 2 - 1) - lp) * 0.30;            // one-pole lowpass
        const env = Math.exp(-7 * t) * Math.min(1, (i - pre) / fade);
        d[i] = lp * env;
      }
    }
    return buf;
  }

  // ---------- init: lazy, single AudioContext + master chain ----------
  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }

    // voices -> dryBus (0.9) --------------------------------\
    //        -> per-voice send -> reverbIn -> convolver -> HP -> LP -> return (0.8) -> master
    master = ctx.createGain();
    master.gain.value = enabled ? volume : 0;

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;   // dB
    comp.knee.value      = 18;    // dB (soft knee)

    comp.ratio.value     = 6;     // 6:1
    comp.attack.value    = 0.003; // 3 ms
    comp.release.value   = 0.200; // 200 ms

    dryBus = ctx.createGain();
    dryBus.gain.value = 0.9;

    reverbIn = ctx.createGain();
    const convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse(ctx, 1.6);
    const rvHP = ctx.createBiquadFilter();
    rvHP.type = 'highpass'; rvHP.frequency.value = 160; rvHP.Q.value = 0.707;   // no mud
    const rvLP = ctx.createBiquadFilter();
    rvLP.type = 'lowpass';  rvLP.frequency.value = 4200; rvLP.Q.value = 0.5;    // no fizz
    const rvOut = ctx.createGain();
    rvOut.gain.value = 0.8;

    dryBus.connect(master);
    reverbIn.connect(convolver);
    convolver.connect(rvHP); rvHP.connect(rvLP); rvLP.connect(rvOut); rvOut.connect(master);
    master.connect(comp);
    comp.connect(ctx.destination);

    // resume on first user gesture (autoplay policy)
    const unlock = () => {
      if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
      UNLOCK_EVENTS.forEach(ev => window.removeEventListener(ev, unlock, true));
    };
    UNLOCK_EVENTS.forEach(ev => window.addEventListener(ev, unlock, { capture: true, passive: true }));
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    return ctx;
  }


  // Gate for every cue. If the context is still suspended, one cue is allowed
  // through (it plays as soon as resume completes); extra cues are dropped so
  // nothing queues up and bursts out later.
  function ready() {
    if (!enabled || !init()) return false;
    if (ctx.state === 'running') { pendingResume = false; return true; }
    ctx.resume().catch(() => {});
    if (pendingResume) return false;
    pendingResume = true;
    return true;
  }

  // ---------- The one reusable voice ----------
  // tone({freq, type, start, dur, peak, attack, release, cutoff, detune,
  //       q, glideTo, glideTime, cutoffTo, send})
  //   start/dur/attack/release/glideTime in SECONDS; freq/glideTo/cutoff in Hz;
  //   detune in cents; peak is linear gain (0..1) before master.
  //   Envelope: gain 0.0001 -> exp ramp to peak over `attack`, hold, then
  //   setTargetAtTime decay with time-constant release/6 (≈ -52 dB after `release`).
  //   Only sine/triangle are allowed; lowpass cutoff is clamped to 5 kHz.
  function tone(o) {
    if (!ctx || activeVoices >= MAX_VOICES) return;
    const t0      = ctx.currentTime + (o.start || 0) + 0.005;   // 5 ms scheduling lookahead
    const attack  = Math.max(o.attack ?? 0.01, 0.003);
    const dur     = Math.max(o.dur ?? 0.2, attack + 0.02);
    const release = Math.max(o.release ?? 0.1, 0.02);
    const peak    = Math.min(o.peak ?? 0.1, 0.5);
    const tRel    = t0 + Math.max(attack, dur - release);
    const tEnd    = tRel + release;

    const osc = ctx.createOscillator();

    osc.type = o.type === 'triangle' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, t0 + (o.glideTime ?? dur));
    osc.detune.value = o.detune || 0;

    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(Math.min(o.cutoff ?? 3000, 5000), t0);
    flt.Q.value = o.q ?? 0.707;
    if (o.cutoffTo) flt.frequency.exponentialRampToValueAtTime(Math.min(o.cutoffTo, 5000), t0 + (o.glideTime ?? dur));

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);                          // never a hard jump from/to 0
    env.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    env.gain.setTargetAtTime(0.0001, tRel, release / 6);

    osc.connect(flt); flt.connect(env); env.connect(dryBus);
    let snd = null;
    if ((o.send ?? 0) > 0) {
      snd = ctx.createGain(); snd.gain.value = o.send;
      env.connect(snd); snd.connect(reverbIn);
    }

    activeVoices++;
    osc.onended = () => {
      activeVoices--;
      [osc, flt, env, snd].forEach(n => { if (n) try { n.disconnect(); } catch (e) {} });
    };
    osc.start(t0);
    osc.stop(tEnd + 0.05);   // gain is < -60 dBFS by now: no click
  }


  // Soft bell = sine fundamental + quiet sine octave (2f), plucked decay.
  function bell(freq, start, dur, peak, send) {
    tone({ freq, type: 'sine', start, dur, peak,
           attack: 0.005, release: dur - 0.005, cutoff: 4500, q: 0.5, send });
    tone({ freq: freq * 2, type: 'sine', start, dur: dur * 0.6, peak: peak * 0.18,
           attack: 0.004, release: dur * 0.6 - 0.004, cutoff: 5000, q: 0.5, send });
  }

  // ======================= CUES =======================

  // 1) arrive: tiny bubble pop, ~110 ms
  function arrive() {
    if (!ready()) return;
    tone({
      freq: N.D5,            // D5 587.33 Hz -> glides up to A5 (perfect fifth) in 50 ms
      glideTo: N.A5,         // A5 880.00 Hz
      glideTime: 0.050,
      type: 'sine', start: 0, dur: 0.110,
      peak: 0.26, attack: 0.004, release: 0.100,   // 4 ms in, ~100 ms out
      cutoff: 3200, q: 0.5,                        // lowpass 3.2 kHz
      send: 0.18
    });
  }

  // 2) dispatch: gentle upward swipe + soft landing blip, ~340 ms
  function dispatch() {
    if (!ready()) return;
    // swipe: two slightly detuned triangles, G3 -> G4 (octave up) in 220 ms, filter opens 600 -> 2600 Hz
    const swipe = { freq: N.G3, glideTo: N.G4, glideTime: 0.220,       // G3 196.00 -> G4 392.00 Hz
                    type: 'triangle', start: 0, dur: 0.300,
                    attack: 0.050, release: 0.140,                       // 50 ms in, 140 ms out
                    cutoff: 600, cutoffTo: 2600, q: 0.8, send: 0.22 };   // lowpass sweep, Q 0.8

    tone({ ...swipe, peak: 0.20 });
    tone({ ...swipe, peak: 0.12, detune: 8 });                           // +8 cents for width
    // landing blip: G5 783.99 Hz sine, starts at 180 ms
    tone({ freq: N.G5, type: 'sine', start: 0.180, dur: 0.160,
           peak: 0.12, attack: 0.006, release: 0.140,
           cutoff: 4000, q: 0.5, send: 0.30 });
  }

  // 3) preempt: soft, low, descending two-note bonk (E4 -> A3, a fifth down), ~410 ms
  function preempt() {
    if (!ready()) return;
    // note 1: E4 329.63 Hz, 0..170 ms (sine body + quiet triangle for presence on small speakers)
    tone({ freq: N.E4, type: 'sine',     start: 0, dur: 0.170, peak: 0.30,
           attack: 0.008, release: 0.140, cutoff: 1800, q: 0.5, send: 0.20 });
    tone({ freq: N.E4, type: 'triangle', start: 0, dur: 0.170, peak: 0.09,
           attack: 0.008, release: 0.140, cutoff: 900,  q: 0.5, send: 0.20 });
    // note 2: A3 220.00 Hz, 110..410 ms
    tone({ freq: N.A3, type: 'sine',     start: 0.110, dur: 0.300, peak: 0.32,
           attack: 0.010, release: 0.260, cutoff: 1400, q: 0.5, send: 0.25 });
    tone({ freq: N.A3, type: 'triangle', start: 0.110, dur: 0.300, peak: 0.10,
           attack: 0.010, release: 0.260, cutoff: 700,  q: 0.5, send: 0.25 });
  }

  // 4) done: rising 3-note chime C5 -> E5 -> G5, ~540 ms
  function done() {
    if (!ready()) return;
    bell(N.C5, 0.000, 0.260, 0.24, 0.30);   // C5 523.25 Hz, 0 ms,   260 ms
    bell(N.E5, 0.070, 0.260, 0.24, 0.30);   // E5 659.25 Hz, 70 ms,  260 ms
    bell(N.G5, 0.140, 0.400, 0.24, 0.35);   // G5 783.99 Hz, 140 ms, 400 ms
  }

  // 5) finish: warm 5-note arpeggio C5 E5 G5 A5 C6 over a soft C4+G4 pad, ~1.5 s + reverb tail

  function finish() {
    if (!ready()) return;
    const arp = [N.C5, N.E5, N.G5, N.A5, N.C6];   // 523.25, 659.25, 783.99, 880.00, 1046.50 Hz
    arp.forEach((f, i) => bell(f, i * 0.100, i < 4 ? 0.600 : 1.100, 0.18, 0.40));
    // warm pad underneath (triangles lowpassed at 700 Hz, slow 120 ms attack)
    tone({ freq: N.C4, type: 'triangle', start: 0,    dur: 1.450, peak: 0.07,
           attack: 0.120, release: 0.950, cutoff: 700, q: 0.5, send: 0.35 });   // C4 261.63 Hz
    tone({ freq: N.G4, type: 'triangle', start: 0.050, dur: 1.400, peak: 0.05,
           attack: 0.120, release: 0.950, cutoff: 700, q: 0.5, send: 0.35 });   // G4 392.00 Hz
  }

  // 6) barTick(i): very quiet 70 ms tick; pitch cycles C4..A5 (10 pentatonic notes) by index
  function barTick(i = 0) {
    if (!ready()) return;
    const now = ctx.currentTime;
    if (now - lastTick < 0.020) return;          // ignore ticks closer than 20 ms
    lastTick = now;
    const n = TICK_SCALE.length;
    const idx = (((Math.floor(Number(i)) || 0) % n) + n) % n;
    tone({ freq: TICK_SCALE[idx], type: 'triangle', start: 0, dur: 0.070,
           peak: 0.08, attack: 0.003, release: 0.065,
           cutoff: 2200, q: 0.5, send: 0.06 });
  }

  // ---------- Controls ----------
  function applyMaster() {
    if (master) master.gain.setTargetAtTime(enabled ? volume : 0, ctx.currentTime, 0.02);
  }
  function setVolume(v) {                       // 0..1, linear on the master GainNode
    volume = Math.min(1, Math.max(0, Number.isFinite(+v) ? +v : 0));
    applyMaster();
  }

  function setEnabled(on) {
    enabled = !!on;
    applyMaster();                              // 20 ms smooth fade so toggling never clicks
  }

  return { init, setVolume, setEnabled, arrive, dispatch, preempt, done, finish, barTick };
})();

export { SoundFX };
