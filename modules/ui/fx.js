// Optional sound and visual effects for the CPU animation. Sounds are synthesized with WebAudio
// (no audio files). Audio only starts after a user gesture, because the animation only moves
// after a click on Play, Step or Watch. Visual effects are skipped under prefers-reduced-motion.
const KEY = 'cpu-sound', VOL = 'cpu-volume';
let ac = null, master = null;
const state = { on: localStorage.getItem(KEY) !== 'off', vol: Number(localStorage.getItem(VOL) || 30) };
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function ctxAudio() {
  if (!state.on) return null;
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC(); master = ac.createGain(); master.connect(ac.destination);
  }
  master.gain.value = Math.pow(state.vol / 100, 2) * 0.6;
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(freq, start, dur, type = 'sine', gain = 0.5, slideTo) {
  const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + start;
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
}
function whoosh() {
  const len = Math.floor(ac.sampleRate * 0.22), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), t0 = ac.currentTime;
  src.buffer = buf; f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(400, t0); f.frequency.exponentialRampToValueAtTime(2400, t0 + 0.2);
  g.gain.value = 0.5; src.connect(f); f.connect(g); g.connect(master); src.start(t0);
}
const SOUND = {
  arrive: () => tone(880, 0, 0.07, 'sine', 0.35),
  dispatch: () => { whoosh(); tone(330, 0.08, 0.12, 'triangle', 0.3, 520); },
  preempt: () => { tone(240, 0, 0.09, 'square', 0.22, 110); tone(160, 0.05, 0.1, 'square', 0.15, 90); },
  done: () => { tone(660, 0, 0.14, 'sine', 0.4); tone(990, 0.1, 0.22, 'sine', 0.4); },
  finish: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle', 0.4)),
};

function burst(cls) { // particle burst at the Done lane / chip, in SVG space
  const svg = document.getElementById('cd-svg'); if (!svg) return;
  const [cx, cy] = cls === 'done' ? [825, 130] : [655, 130];
  const col = getComputedStyle(document.documentElement).getPropertyValue('--ring').trim() || '#38BDF8';
  for (let i = 0; i < 12; i++) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('r', 3.5); c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('fill', i % 2 ? col : '#F59E0B'); c.setAttribute('class', 'fx-p');
    svg.appendChild(c);
    const a = (i / 12) * Math.PI * 2, r = 40 + Math.random() * 25;
    c.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r}px) scale(.2)`, opacity: 0 }], { duration: 650, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => c.remove();
  }
}
function flash(el, cls) { if (!el) return; el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 700); }
function confetti() {
  const host = document.querySelector('.cd-panel'); if (!host) return;
  const colors = ['#38BDF8', '#F59E0B', '#10B981', '#F472B6', '#A5B0FF'], box = host.getBoundingClientRect();
  for (let i = 0; i < 36; i++) {
    const p = document.createElement('i'); p.className = 'fx-confetti';
    p.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % 5]}`;
    host.appendChild(p);
    p.animate([{ transform: 'translateY(0) rotate(0)', opacity: 1 }, { transform: `translate(${(Math.random() - .5) * 120}px,${box.height * (0.6 + Math.random() * 0.4)}px) rotate(${Math.random() * 540}deg)`, opacity: 0 }], { duration: 1400 + Math.random() * 700, easing: 'ease-in', delay: Math.random() * 250 }).onfinish = () => p.remove();
  }
}
function visuals(cue) {
  if (reduce()) return;
  if (cue === 'dispatch') flash(document.querySelector('.cd-chip'), 'fx-pulse');
  if (cue === 'preempt') { flash(document.querySelector('.cd-panel'), 'fx-flash'); flash(document.querySelector('.cd-chip'), 'fx-pulse'); }
  if (cue === 'done') burst('done');
  if (cue === 'finish') confetti();
}

document.addEventListener('cpu-fx', e => {
  const cues = e.detail.cues;
  cues.forEach(c => visuals(c));
  if (!ctxAudio()) return;
  // one main sound per step so they never pile up: finish > done > preempt > dispatch > arrive
  const pick = ['finish', 'done', 'preempt', 'dispatch', 'arrive'].find(c => cues.includes(c));
  if (pick) { try { SOUND[pick](); } catch (_) { /* audio is optional */ } }
});

document.addEventListener('card-fx', e => {
  if (!ctxAudio()) return;
  const c = e.detail.cue;
  try { (c === 'tick' ? SOUND.arrive : SOUND[c])(); } catch (_) { /* audio is optional */ }
});

function sync() {
  const b = document.getElementById('sound-toggle'); if (!b) return;
  b.setAttribute('aria-pressed', String(state.on));
  b.querySelector('.st-label').textContent = state.on ? 'Sound on' : 'Sound off';
  const r = document.getElementById('sound-vol'); if (r) { r.value = state.vol; r.disabled = !state.on; r.style.setProperty('--v', state.vol + '%'); }
}
document.addEventListener('click', e => {
  if (e.target.closest('#sound-toggle')) {
    state.on = !state.on; localStorage.setItem(KEY, state.on ? 'on' : 'off'); sync();
    if (state.on && ctxAudio()) SOUND.arrive();
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'sound-vol') { state.vol = Number(e.target.value); e.target.style.setProperty('--v', state.vol + '%'); localStorage.setItem(VOL, String(state.vol)); if (master) master.gain.value = Math.pow(state.vol / 100, 2) * 0.6; }
});
document.addEventListener('change', e => { if (e.target.id === 'sound-vol' && ctxAudio()) SOUND.arrive(); });
sync();
window.__cpuFx = state; // read-only handle for tests
