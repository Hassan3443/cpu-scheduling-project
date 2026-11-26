import { inkOf } from './tableRenderer.js';
// Join back-to-back slices of the same process (Round Robin with nobody else waiting)
// into one block. Each merged block remembers how many quantum slices it holds.
export function mergeSlices(timeline) {
  const out = [];
  for (const seg of timeline) {
    const last = out[out.length - 1];
    if (last && last.pid === seg.pid && last.pid !== 'IDLE' && last.end === seg.start) {
      last.end = seg.end; last.slices += 1;
    } else out.push({ ...seg, slices: 1 });
  }
  return out;
}

// Light scale ticks (every 5 or 10 units) that sit between the real event ticks.
export function referenceTicks(total, eventTimes) {
  const step = total > 60 ? 10 : 5;
  const ev = new Set(eventTimes), out = [];
  for (let t = step; t < total; t += step) if (!ev.has(t)) out.push(t);
  return out;
}

export function legendHtml(colorMap) {
  return Object.entries(colorMap).map(([pid, col]) =>
    `<div class="legend-item" data-pid="${pid}" tabindex="0"><div class="legend-color" style="background:${col}33;border:2px solid ${col}"></div><span style="color:${inkOf(col)}">${pid}</span></div>`
  ).join('');
}

export function renderGantt(containerId, timesId, legendId, timeline, colorMap) {
  const container = document.getElementById(containerId);
  const timesEl   = document.getElementById(timesId);
  const legendEl  = legendId ? document.getElementById(legendId) : null;

  if (!timeline.length) {
    container.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:.8rem">No data.</div>';
    return;
  }

  const totalTime = timeline[timeline.length - 1].end;
  container.innerHTML = '';
  const timeSet = new Set();

  mergeSlices(timeline).forEach(seg => {
    const bar  = document.createElement('div');
    bar.className = 'gantt-bar' + (seg.pid === 'IDLE' ? ' idle' : '') + (seg.slices > 1 ? ' merged' : '');
    const pct  = ((seg.end - seg.start) / totalTime * 100).toFixed(2);
    const left = (seg.start  / totalTime * 100).toFixed(2);
    bar.style.left  = left + '%';
    bar.style.width = pct  + '%';
    if (seg.pid !== 'IDLE') bar.dataset.pid = seg.pid;
    const col = colorMap[seg.pid] || '#555';
    if (seg.pid !== 'IDLE') {
      bar.style.background  = col + '33';
      bar.style.borderLeft  = `3px solid ${col}`;
      bar.style.color       = inkOf(col);
    }
    const dur = seg.end - seg.start;
    bar.innerHTML = `<span class="bar-pid">${seg.pid}</span><span class="bar-dur">${dur}u</span>` +
      (seg.slices > 1 && dur / totalTime > 0.25 ? `<span class="bar-sl">${seg.slices} slices</span>` : '');
    bar.title = seg.slices > 1
      ? `${seg.pid}: [${seg.start} → ${seg.end}], ${seg.slices} back-to-back time slices (no other process was waiting)`
      : `${seg.pid}: [${seg.start} → ${seg.end}]`;
    bar.style.animationDelay = (seg.start / totalTime * 1.6).toFixed(2) + 's';
    bar.style.animationDuration = Math.max(0.15, dur / totalTime * 1.6).toFixed(2) + 's';
    container.appendChild(bar);
    timeSet.add(seg.start);
    timeSet.add(seg.end);
  });

  const times = [...timeSet].sort((a,b) => a - b);
  const refs = referenceTicks(totalTime, times);
  // Place each time label at its true position. Event ticks win over scale ticks;
  // skip labels that would overlap the previous one, but keep the first and the last.
  const all = times.map(t => ({ t, ref: false })).concat(refs.map(t => ({ t, ref: true }))).sort((a, b) => a.t - b.t);
  let lastPct = -100;
  timesEl.innerHTML = all.map((o, i) => {
    const pct = o.t / totalTime * 100;
    const isLast = i === all.length - 1;
    if (!isLast && (pct - lastPct < 2.5 || 100 - pct < 2.5)) return '';
    lastPct = pct;
    const shift = i === 0 ? '0' : isLast ? '-100%' : '-50%';
    return `<span class="${o.ref ? 'ref' : ''}" style="left:${pct.toFixed(2)}%;transform:translateX(${shift})">${o.t}</span>`;
  }).join('');
  if (legendEl) legendEl.innerHTML = legendHtml(colorMap);
}

export function renderMiniGantt(container, timeline, colorMap) {
  if (!timeline.length) { container.innerHTML = '<div style="color:var(--muted);font-size:.75rem;padding:4px">Empty</div>'; return; }
  const total = timeline[timeline.length - 1].end;
  container.innerHTML = '';
  mergeSlices(timeline).forEach(seg => {
    const bar   = document.createElement('div');
    bar.style.cssText = `position:absolute;height:100%;left:${seg.start/total*100}%;width:${(seg.end-seg.start)/total*100}%;display:flex;align-items:center;justify-content:center;font-size:.62rem;font-family:monospace;font-weight:700;border-right:1px solid #0f0f13;`;
    const col = colorMap[seg.pid] || '#555';
    bar.style.background = col + '33';
    bar.style.borderLeft = `2px solid ${col}`;
    bar.style.color = inkOf(col);
    bar.textContent = seg.pid;
    bar.title = `${seg.pid}: [${seg.start}→${seg.end}]`;
    container.appendChild(bar);
  });
}
export function renderQueue(el, snapshot, colorMap) {
  if (!snapshot.length) {
    el.innerHTML = '<span class="q-note">Every process finished, so the queue is empty at the end.</span>';
    return;
  }
  el.innerHTML = '<span class="q-note">Front of the line first</span><span class="q-flow">' +
    snapshot.map((pid, i) => `<span class="rq-pill${i === 0 ? ' next' : ''}" style="--pc:${colorMap[pid] || '#0E9AD0'};--pi:${inkOf(colorMap[pid] || '#0E9AD0')}">${pid}</span>`)
      .join('<span class="q-arrow" aria-hidden="true">&rarr;</span>') + '</span>';
}

// Per-process view of one schedule: when it ran, when it sat waiting, when it arrived and finished.
// Waiting = arrived, not finished, not running. Its total equals finish - arrival - burst.
export function laneSegments(proc, timeline) {
  const runs = mergeSlices(timeline).filter(s => s.pid === proc.pid).map(s => ({ start: s.start, end: s.end, slices: s.slices }));
  if (!runs.length) return { runs, waits: [], finish: null, waitTotal: 0 };
  const finish = runs[runs.length - 1].end;
  const waits = [];
  let cursor = proc.at;
  for (const r of runs) { if (r.start > cursor) waits.push({ start: cursor, end: r.start }); cursor = r.end; }
  return { runs, waits, finish, waitTotal: waits.reduce((s, w) => s + (w.end - w.start), 0) };
}

export function renderLanes(containerId, procs, timeline, colorMap) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!timeline.length) { el.innerHTML = ''; return; }
  const total = timeline[timeline.length - 1].end;
  const pct = t => (t / total * 100).toFixed(3) + '%';
  const evs = [...new Set(timeline.flatMap(s => [s.start, s.end]))].sort((a, b) => a - b);
  const grid = evs.map(t => `<i style="left:${pct(t)}"></i>`).join('');
  const rows = procs.map(p => {
    const L = laneSegments(p, timeline), col = colorMap[p.pid] || '#0E9AD0';
    const tat = L.finish === null ? 0 : L.finish - p.at;
    const ctxLine = `Arrival ${p.at}, burst ${p.bt}, priority ${p.pr}`;
    const tot = `Total wait ${L.waitTotal}u, turnaround ${tat}u`;
    const waits = L.waits.map(w => `<b class="ln-wait" tabindex="0" style="left:${pct(w.start)};width:${((w.end - w.start) / total * 100).toFixed(3)}%" data-tip="${p.pid} waiting in the ready queue|t = ${w.start} to ${w.end} (${w.end - w.start}u)|${ctxLine}|${tot}"></b>`).join('');
    const runs = L.runs.map(r => `<b class="ln-run" tabindex="0" data-pid="${p.pid}" style="left:${pct(r.start)};width:${((r.end - r.start) / total * 100).toFixed(3)}%" data-tip="${p.pid} running on the CPU|t = ${r.start} to ${r.end} (${r.end - r.start}u${r.slices > 1 ? `, ${r.slices} slices` : ''})|${ctxLine}|${tot}"><span>${r.end - r.start}u</span></b>`).join('');
    const arrive = `<s class="ln-arr" style="left:${pct(p.at)}" title="${p.pid} arrives at ${p.at}"></s>`;
    const done = L.finish === null ? '' : `<u class="ln-done" style="left:${pct(L.finish)}" title="${p.pid} finishes at ${L.finish}">&#10003;</u>`;
    return `<div class="ln-row" style="--pc:${col};--pi:${inkOf(col)}" data-pid="${p.pid}"><div class="ln-name">${p.pid}</div><div class="ln-track">${waits}${runs}${arrive}${done}</div><div class="ln-stat" title="Time spent waiting in the ready queue">wait <b>${L.waitTotal}</b></div></div>`;
  }).join('');
  el.innerHTML = `<div class="ln-cap"><span class="k wait"></span>waiting <span class="k run"></span>running <span class="k arr"></span>arrives <span class="k done">&#10003;</span>finishes</div><div class="ln-body" data-total="${total}"><div class="ln-grid">${grid}</div><div class="ln-grid ln-hw"><em class="ln-head" hidden></em></div>${rows}</div>`;
}

// Rich hover / focus / tap popover for swimlane segments (text only, no HTML from data).
let tipEl = null;
function showTip(target) {
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'ln-tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
  const [title, ...rest] = target.dataset.tip.split('|');
  tipEl.textContent = '';
  const h = document.createElement('b'); h.textContent = title; tipEl.appendChild(h);
  rest.forEach(l => { const d = document.createElement('span'); d.textContent = l; tipEl.appendChild(d); });
  tipEl.hidden = false;
  const r = target.getBoundingClientRect(), tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
  let x = r.left + r.width / 2 - tw / 2;
  x = Math.max(8, Math.min(x, window.innerWidth - tw - 8));
  let y = r.top - th - 8; if (y < 8) y = r.bottom + 8;
  tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
}
function hideTip() { if (tipEl) tipEl.hidden = true; }
if (typeof document !== 'undefined') {
  const hit = e => e.target.closest && e.target.closest('.ln-run,.ln-wait');
  document.addEventListener('mouseover', e => { const t = hit(e); if (t) showTip(t); });
  document.addEventListener('mouseout', e => { if (hit(e)) hideTip(); });
  document.addEventListener('focusin', e => { const t = hit(e); if (t) showTip(t); });
  document.addEventListener('focusout', hideTip);
  document.addEventListener('click', e => { const t = hit(e); if (t) showTip(t); else hideTip(); });
  // Shared playhead: the CPU player publishes t; the lanes of the selected algorithm draw a line at t.
  document.addEventListener('cpu-t', e => {
    const { t, key } = e.detail;
    document.querySelectorAll('.ln-body').forEach(b => {
      const head = b.querySelector('.ln-head'); if (!head) return;
      const mine = b.closest('#lanes-rr') ? key === 'rr' : b.closest('#lanes-pr') ? key === 'pr' : false;
      const tot = +b.dataset.total;
      head.hidden = true; return; // the top player does not drive the cards; each card has its own Play
      head.hidden = !mine || !tot;
      if (mine && tot) head.style.left = (Math.min(t, tot) / tot * 100) + '%';
    });
  });
}
