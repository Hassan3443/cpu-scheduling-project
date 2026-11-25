import { ALGORITHMS } from '../analysis/compareAll.js';
import { COLORS } from './tableRenderer.js';

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
    return { pid: p.pid, status, rem: p.bt - (ran[p.pid] || 0), since: lastEnd[p.pid] ?? p.at, at: p.at };
  });
}

let ctx = null;   // { procs, quantum, key, timeline, total, t, timer, nodes }

export function renderCpuDiagram(procs, quantum) {
  const host = document.getElementById('cd-diagram');
  if (!host) return;
  const prevKey = ctx ? ctx.key : 'rr';
  if (ctx && ctx.timer) clearInterval(ctx.timer);
  ctx = { procs, quantum, key: prevKey, t: 0, timer: null, nodes: {} };
  host.innerHTML = `
    <div class="cd-controls">
      <label>Algorithm <select id="cd-algo">${ALGORITHMS.map(a => `<option value="${a.key}"${a.key === ctx.key ? ' selected' : ''}>${a.name}</option>`).join('')}</select></label>
      <button class="btn btn-outline" id="cd-play" aria-label="Play or pause">▶ Play</button>
      <button class="btn btn-outline" id="cd-reset" aria-label="Back to start">⟲</button>
      <input type="range" id="cd-scrub" min="0" value="0" step="1" aria-label="Time"/>
      <span class="cd-time" id="cd-time">t = 0</span>
    </div>
    <svg id="cd-svg" viewBox="0 0 900 250" role="img" aria-label="Processes moving from the ready queue to the CPU">
      <defs><linearGradient id="chipg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b4763"/><stop offset="1" stop-color="#2a3347"/></linearGradient></defs>
      <text class="cd-cap" x="30" y="30">INCOMING</text><text class="cd-cap" x="290" y="30">READY QUEUE</text>
      <text class="cd-cap" x="600" y="30">CPU</text><text class="cd-cap" x="780" y="30">DONE</text>
      <rect class="cd-lane" x="20" y="45" width="110" height="170" rx="14"/>
      <rect class="cd-lane" x="170" y="95" width="360" height="70" rx="35"/>
      <path class="cd-arrow" d="M535 130 H590" /><path class="cd-arrow" d="M540 124 L535 130 L540 136"/>
      <g class="cd-chip"><rect x="600" y="75" width="110" height="110" rx="16" fill="url(#chipg)" stroke="#79bfa5" stroke-width="2"/>
        ${[0,1,2,3].map(i => `<path class="cd-pin" d="M${618 + i * 25} 75 v-14 M${618 + i * 25} 185 v14 M600 ${93 + i * 25} h-14 M710 ${93 + i * 25} h14"/>`).join('')}
        <rect x="625" y="100" width="60" height="60" rx="8" fill="#202533" stroke="#4a566f"/></g>
      <rect class="cd-lane" x="770" y="45" width="110" height="170" rx="14"/>
      <g id="cd-procs"></g>
      <text class="cd-idle" id="cd-idle" x="655" y="235" text-anchor="middle"></text>
    </svg>
    <p class="cd-note">Press Play. Processes arrive on the left, wait in the ready queue, run on the CPU, then move to Done. The number inside is the time still needed.</p>`;
  const svg = host.querySelector('#cd-procs');
  procs.forEach((p, i) => {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'cd-proc');
    const col = COLORS[i % COLORS.length];
    g.innerHTML = `<circle r="25" fill="${col}33" stroke="${col}" stroke-width="3"/><text class="cd-pid" y="-2" text-anchor="middle">${p.pid}</text><text class="cd-rem" y="14" text-anchor="middle"></text>`;
    svg.appendChild(g); ctx.nodes[p.pid] = g;
  });
  host.querySelector('#cd-algo').addEventListener('change', e => { ctx.key = e.target.value; load(); });
  host.querySelector('#cd-play').addEventListener('click', toggle);
  host.querySelector('#cd-reset').addEventListener('click', () => { stop(); setT(0); });
  host.querySelector('#cd-scrub').addEventListener('input', e => { stop(); setT(+e.target.value); });
  load();
}

function load() {
  const algo = ALGORITHMS.find(a => a.key === ctx.key);
  ctx.timeline = algo.run(ctx.procs, ctx.quantum).timeline;
  ctx.total = ctx.timeline.length ? ctx.timeline[ctx.timeline.length - 1].end : 0;
  const sc = document.getElementById('cd-scrub');
  sc.max = ctx.total;
  stop(); setT(Math.min(ctx.total, ctx.timeline.length ? ctx.timeline[0].start : 0));
}

function slot(st, queueIdx, doneIdx, incIdx) {
  if (st === 'running') return [655, 130];
  if (st === 'ready') return [490 - queueIdx * 62, 130];
  if (st === 'done') return [825, 75 + (doneIdx % 4) * 45 - (doneIdx > 3 ? -22 : 0) + (doneIdx > 3 ? 0 : 0)];
  return [75, 80 + incIdx * 45];
}

function setT(t) {
  ctx.t = t;
  const st = stateAt(ctx.procs, ctx.timeline, t);
  const ready = st.filter(s => s.status === 'ready').sort((a, b) => a.since - b.since || a.at - b.at);
  const done = st.filter(s => s.status === 'done');
  const inc = st.filter(s => s.status === 'incoming');
  st.forEach(s => {
    const g = ctx.nodes[s.pid];
    const [x, y] = slot(s.status, ready.findIndex(r => r.pid === s.pid), done.findIndex(r => r.pid === s.pid), inc.findIndex(r => r.pid === s.pid));
    g.style.transform = `translate(${x}px, ${y}px)`;
    g.setAttribute('data-status', s.status);
    g.querySelector('.cd-rem').textContent = s.status === 'done' ? '✓' : String(s.rem);
  });
  const running = st.some(s => s.status === 'running');
  document.getElementById('cd-idle').textContent = !running && t < ctx.total && st.some(s => s.status !== 'done') ? 'CPU idle' : '';
  document.getElementById('cd-time').textContent = `t = ${t} of ${ctx.total}`;
  document.getElementById('cd-scrub').value = t;
  document.querySelector('.cd-chip').classList.toggle('busy', running);
}

function stop() {
  if (ctx.timer) clearInterval(ctx.timer);
  ctx.timer = null;
  const b = document.getElementById('cd-play'); if (b) b.textContent = '▶ Play';
}
function toggle() {
  if (ctx.timer) { stop(); return; }
  if (ctx.t >= ctx.total) setT(0);
  document.getElementById('cd-play').textContent = '❚❚ Pause';
  const step = reduce() ? 250 : 700;
  ctx.timer = setInterval(() => { if (ctx.t >= ctx.total) { stop(); return; } setT(ctx.t + 1); }, step);
}
