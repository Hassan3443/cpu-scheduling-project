import { ALGORITHMS } from '../analysis/compareAll.js';
import { COLORS } from './tableRenderer.js';
import { mergeSlices, referenceTicks } from './ganttChart.js';

const NS = 'http://www.w3.org/2000/svg';
const reduce = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// State of every process at time t (the instant before unit [t, t+1) runs).
export function stateAt(procs, timeline, t) {
  const ran = {}, lastEnd = {};
  for (const s of timeline) {
    if (s.pid === 'IDLE') continue;
    const upto = Math.min(s.end, t);
    if (upto > s.start) { ran[s.pid] = (ran[s.pid] || 0) + (upto - s.start); lastEnd[s.pid] = upto; }
  }
  const cur = timeline.find(s => s.pid !== 'IDLE' && s.start <= t && t < s.end);
  return procs.map(p => {
    const done = (ran[p.pid] || 0) >= p.bt;
    let status = 'incoming';
    if (done) status = 'done';
    else if (cur && cur.pid === p.pid) status = 'running';
    else if (p.at <= t) status = 'ready';
    return { pid: p.pid, status, rem: p.bt - (ran[p.pid] || 0), ran: (ran[p.pid] || 0) > 0, since: lastEnd[p.pid] ?? p.at, at: p.at };
  });
}

let ctx = null;   // { procs, quantum, key, timeline, total, t, timer, nodes, speed }
const SPEEDS = [['0.5×', 1400], ['1×', 700], ['2×', 350], ['4×', 175]];
const stepMs = () => (reduce() ? 0 : SPEEDS[ctx.speed][1]);

export function renderCpuDiagram(procs, quantum) {
  const host = document.getElementById('cd-diagram');
  if (!host) return;
  const prev = ctx || { key: 'rr', speed: 1 };
  if (ctx && ctx.timer) clearInterval(ctx.timer);
  ctx = { procs, quantum, key: prev.key, speed: prev.speed, t: 0, timer: null, nodes: {} };
  host.innerHTML = `
    <div class="cd-controls">
      <label class="cd-field">Algorithm <select id="cd-algo">${ALGORITHMS.map(a => `<option value="${a.key}"${a.key === ctx.key ? ' selected' : ''}>${a.name}</option>`).join('')}</select></label>
      <label class="cd-field">Speed <select id="cd-speed">${SPEEDS.map((s, i) => `<option value="${i}"${i === ctx.speed ? ' selected' : ''}>${s[0]}</option>`).join('')}</select></label>
    </div>
    <div class="cd-controls">
      <button class="btn btn-outline" id="cd-back" aria-label="Step back one time unit">◀ Back</button>
      <button class="btn btn-accent" id="cd-play" aria-pressed="false">▶ Play</button>
      <button class="btn btn-outline" id="cd-step" aria-label="Step forward one time unit">Step ▶</button>
      <button class="btn btn-outline" id="cd-reset" aria-label="Back to the start">⟲ Reset</button>
      <input type="range" id="cd-scrub" min="0" value="0" step="1" aria-label="Time"/>
      <span class="cd-time" id="cd-time" role="status" aria-live="polite">t = 0</span>
    </div>
    <svg id="cd-svg" viewBox="0 0 900 266" role="img" aria-labelledby="cd-title">
      <title id="cd-title">Processes move from the ready queue to the CPU, then to done</title>
      <defs><linearGradient id="chipg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b4763"/><stop offset="1" stop-color="#2a3347"/></linearGradient></defs>
      <text class="cd-cap" x="30" y="30">INCOMING</text><text class="cd-cap" x="290" y="30">READY QUEUE</text>
      <text class="cd-cap" x="600" y="30">CPU</text><text class="cd-cap" x="780" y="30">DONE</text>
      <rect class="cd-lane" x="20" y="45" width="110" height="170" rx="12"/>
      <rect class="cd-lane" x="170" y="95" width="360" height="70" rx="35"/>
      <path class="cd-arrow" d="M535 130 H586 M578 122 L587 130 L578 138"/>
      <polygon id="cd-latch" class="cd-latch" points="596,70 714,70 722,78 722,182 714,190 596,190 588,182 588,78 596,70" fill="none"/>
      <path class="cd-trace" d="M130 130 H168"/><path class="cd-trace" d="M710 130 H768"/><path class="cd-arrow sm" d="M160 123 L168 130 L160 137"/><path class="cd-arrow sm" d="M760 123 L768 130 L760 137"/>
      <path class="cd-bus" id="cd-bus" d="M655 192 V236 H350 V168" fill="none"/><path class="cd-arrow sm" d="M343 177 L350 168 L357 177"/><text class="cd-buslabel" x="500" y="231" text-anchor="middle">PREEMPT / SLICE END</text>
      <g class="cd-chip"><polygon points="614,75 696,75 710,89 710,171 696,185 614,185 600,171 600,89" fill="url(#chipg)" stroke="#323B4D" stroke-width="1.5"/>
        ${[0,1,2,3].map(i => `<path class="cd-pin" d="M${618 + i * 25} 75 v-14 M${618 + i * 25} 185 v14 M600 ${93 + i * 25} h-14 M710 ${93 + i * 25} h14"/>`).join('')}
        <rect x="620" y="95" width="70" height="70" rx="8" fill="#202533" stroke="#4a566f"/><path class="cd-die-trace" d="M626 108 H640 V100 M684 108 H670 V100 M626 152 H640 V160 M684 152 H670 V160"/><circle cx="627" cy="102" r="1.8" class="cd-die-dot"/><circle cx="683" cy="102" r="1.8" class="cd-die-dot"/><circle cx="627" cy="158" r="1.8" class="cd-die-dot"/><circle cx="683" cy="158" r="1.8" class="cd-die-dot"/></g>
      <g transform="translate(655 130) rotate(-90)"><circle id="cd-ring" r="32" pathLength="100" fill="none" stroke="#38BDF8" stroke-width="3" stroke-linecap="round" stroke-dasharray="100" stroke-dashoffset="100" opacity="0"/></g>
      <rect class="cd-lane" x="770" y="45" width="110" height="170" rx="12"/>
      <g id="cd-procs"></g>
      <text class="cd-idle" id="cd-idle" x="655" y="260" text-anchor="middle"></text>
    </svg>
    <div class="cd-strip" id="cd-strip" aria-hidden="true"></div><div class="cd-ticks" id="cd-ticks" aria-hidden="true"></div>
    <p class="cd-note" id="cd-ringnote"></p>
    <p class="cd-note">Press Play, or Step one time unit at a time. The arc around each process shows how much of its work is still left. Processes arrive on the left, wait in the ready queue (oldest first), run on the CPU, then move to Done. The number inside is the time still needed.</p>`;
  const layer = host.querySelector('#cd-procs');
  procs.forEach((p, i) => {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'cd-proc');
    const col = COLORS[i % COLORS.length];
    g.innerHTML = `<circle r="25" fill="${col}22" stroke="${col}55" stroke-width="1.5"/><circle class="cd-prog" r="29" pathLength="100" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-dasharray="100" transform="rotate(-90)"/><text class="cd-pid" y="-2" text-anchor="middle">${p.pid}</text><text class="cd-rem" y="14" text-anchor="middle"></text>`;
    layer.appendChild(g); ctx.nodes[p.pid] = g;
  });
  ctx.colors = Object.fromEntries(procs.map((p, i) => [p.pid, COLORS[i % COLORS.length]]));
  const $ = id => host.querySelector(id);
  $('#cd-algo').addEventListener('change', e => { ctx.key = e.target.value; load(); });
  $('#cd-speed').addEventListener('change', e => { ctx.speed = +e.target.value; if (ctx.timer) { stop(); toggle(); } });
  $('#cd-play').addEventListener('click', toggle);
  $('#cd-step').addEventListener('click', () => { stop(); if (ctx.t < ctx.total) setT(ctx.t + 1); });
  $('#cd-back').addEventListener('click', () => { stop(); if (ctx.t > 0) setT(ctx.t - 1); });
  $('#cd-reset').addEventListener('click', () => { stop(); setT(0); });
  $('#cd-scrub').addEventListener('input', e => { stop(); setT(+e.target.value); });
  load();
}

function load() {
  const algo = ALGORITHMS.find(a => a.key === ctx.key);
  ctx.timeline = algo.run(ctx.procs, ctx.quantum).timeline;
  ctx.total = ctx.timeline.length ? ctx.timeline[ctx.timeline.length - 1].end : 0;
  document.getElementById('cd-scrub').max = ctx.total;
  document.getElementById('cd-strip').innerHTML = mergeSlices(ctx.timeline).map(s => s.pid === 'IDLE' ? '' :
    `<span style="left:${s.start / ctx.total * 100}%;width:${(s.end - s.start) / ctx.total * 100}%;background:${ctx.colors[s.pid]}55;border-color:${ctx.colors[s.pid]}" title="${s.pid}: ${s.start} to ${s.end}">${s.pid}</span>`).join('') + '<i id="cd-head"></i>';
  const evs = [...new Set(ctx.timeline.flatMap(x => [x.start, x.end]))].sort((a, b) => a - b);
  const labels = evs.map(t => ({ t, ref: false })).concat(referenceTicks(ctx.total, evs).map(t => ({ t, ref: true }))).sort((a, b) => a.t - b.t);
  let lastP = -100;
  document.getElementById('cd-ticks').innerHTML = labels.map((o, i) => {
    const p = ctx.total ? o.t / ctx.total * 100 : 0, last = i === labels.length - 1;
    if (!last && (p - lastP < 5 || 100 - p < 4)) return '';
    lastP = p;
    return `<span class="${o.ref ? 'ref' : ''}" style="left:${p}%;transform:translateX(${i === 0 ? '0' : last ? '-100%' : '-50%'})">${o.t}</span>`;
  }).join('');
  document.getElementById('cd-ringnote').textContent = ctx.key === 'rr'
    ? `The ring on the CPU fills as the time slice (quantum ${ctx.quantum}) is used up and turns amber on its last tick. If a process arrives at the same moment a slice ends, the new arrival joins the queue before the preempted process.`
    : '';
  stop(); setT(ctx.timeline.length ? Math.min(ctx.timeline[0].start, ctx.total) : 0, true);
}

// Where a token sits. Incoming and Done use a 2-column grid of smaller tokens;
// the ready queue spaces tokens out and squeezes them only when it gets long.
export function slot(st, queueIdx, doneIdx, incIdx, n = {}) {
  if (st === 'running') return { x: 655, y: 130, k: 1 };
  if (st === 'ready') {
    const sp = Math.min(58, 300 / Math.max(1, (n.ready || 1) - 1));
    return { x: 490 - queueIdx * sp, y: 130, k: 1 };
  }
  const idx = st === 'done' ? doneIdx : incIdx, cnt = st === 'done' ? n.done || 1 : n.inc || 1;
  const x0 = st === 'done' ? 770 : 20, rows = Math.ceil(cnt / 2);
  const sp = Math.min(52, rows > 1 ? 118 / (rows - 1) : 52);
  const top = rows > 1 ? Math.max(76, 130 - sp * (rows - 1) / 2) : 130;
  return { x: x0 + (idx % 2 ? 82 : 28), y: top + Math.floor(idx / 2) * sp, k: 0.78 };
}

function setT(t, snap = false) {
  ctx.t = t;
  const st = stateAt(ctx.procs, ctx.timeline, t);
  const ready = st.filter(s => s.status === 'ready').sort((a, b) => a.since - b.since || (a.ran - b.ran) || a.at - b.at);
  const done = st.filter(s => s.status === 'done');
  const inc = st.filter(s => s.status === 'incoming');
  const ms = snap ? 0 : stepMs();
  document.getElementById('cd-svg').style.setProperty('--cd-ms', Math.min(ms, 450) + 'ms');
  st.forEach(s => {
    const g = ctx.nodes[s.pid];
    const { x, y, k } = slot(s.status, ready.findIndex(r => r.pid === s.pid), done.findIndex(r => r.pid === s.pid), inc.findIndex(r => r.pid === s.pid), { ready: ready.length, done: done.length, inc: inc.length });
    g.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
    g.setAttribute('data-status', s.status);
    g.querySelector('.cd-prog').style.strokeDashoffset = String(100 - 100 * s.rem / ctx.procs.find(q => q.pid === s.pid).bt);
    g.querySelector('.cd-rem').textContent = s.status === 'done' ? '✓' : String(s.rem);
  });
  const cur = ctx.timeline.find(s => s.pid !== 'IDLE' && s.start <= t && t < s.end);
  const ring = document.getElementById('cd-ring');
  if (ctx.key === 'rr' && cur) {
    ring.style.transition = `stroke-dashoffset ${snap ? 0 : stepMs()}ms linear`;
    ring.setAttribute('opacity', '1');
    ring.style.strokeDashoffset = String(100 - 100 * (t - cur.start) / ctx.quantum);
  } else { ring.setAttribute('opacity', '0'); ring.style.strokeDashoffset = '100'; }
  // signature moments: die latch on a new dispatch, amber ring on the last tick of a slice
  const latch = document.getElementById('cd-latch');
  const prevPid = ctx.lastPid, nowPid = cur ? cur.pid : null;
  if (!snap && !reduce() && nowPid && nowPid !== prevPid) {
    const preempt = ctx.key !== 'fcfs' && ctx.key !== 'sjf' && prevPid && st.some(s => s.pid === prevPid && s.status === 'ready');
    latch.setAttribute('class', 'cd-latch ' + (preempt ? 'is-preempt' : 'is-dispatch'));
    void latch.getBoundingClientRect(); latch.classList.add('go');
    const bus = document.getElementById('cd-bus'); bus.classList.remove('go'); if (preempt) { void bus.getBoundingClientRect(); bus.classList.add('go'); }
  } else latch.setAttribute('class', 'cd-latch');
  ctx.lastPid = nowPid;
  ring.setAttribute('data-quantum', ctx.key === 'rr' && cur && (t - cur.start) >= ctx.quantum - 1 && ctx.quantum > 1 ? 'critical' : '');
  document.getElementById('cd-idle').textContent = !cur && t < ctx.total ? 'CPU idle' : '';
  document.getElementById('cd-time').textContent = `t = ${t} of ${ctx.total}`;
  document.getElementById('cd-scrub').value = t;
  document.getElementById('cd-head').style.left = (ctx.total ? t / ctx.total * 100 : 0) + '%';
  document.querySelector('.cd-chip').classList.toggle('busy', !!cur);
  document.getElementById('cd-back').disabled = t <= 0;
  document.getElementById('cd-step').disabled = t >= ctx.total;
}

function stop() {
  if (ctx.timer) clearInterval(ctx.timer);
  ctx.timer = null;
  const b = document.getElementById('cd-play');
  if (b) { b.textContent = '▶ Play'; b.setAttribute('aria-pressed', 'false'); }
}
function toggle() {
  if (ctx.timer) { stop(); return; }
  if (ctx.t >= ctx.total) setT(0, true);
  const b = document.getElementById('cd-play');
  b.textContent = '❚❚ Pause'; b.setAttribute('aria-pressed', 'true');
  ctx.timer = setInterval(() => { if (ctx.t >= ctx.total) { stop(); return; } setT(ctx.t + 1); }, Math.max(stepMs(), 250));
}
