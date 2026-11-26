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
    `<div class="legend-item" data-pid="${pid}" tabindex="0"><div class="legend-color" style="background:${col}33;border:2px solid ${col}"></div><span style="color:${col}">${pid}</span></div>`
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
      bar.style.color       = col;
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
    bar.style.color = col;
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
    snapshot.map((pid, i) => `<span class="rq-pill${i === 0 ? ' next' : ''}" style="--pc:${colorMap[pid] || '#38BDF8'}">${pid}</span>`)
      .join('<span class="q-arrow" aria-hidden="true">&rarr;</span>') + '</span>';
}
