export function renderGantt(containerId, timesId, legendId, timeline, colorMap) {
  const container = document.getElementById(containerId);
  const timesEl   = document.getElementById(timesId);
  const legendEl  = document.getElementById(legendId);

  if (!timeline.length) {
    container.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:.8rem">No data.</div>';
    return;
  }

  const totalTime = timeline[timeline.length - 1].end;
  container.innerHTML = '';
  const timeSet = new Set();
  const seen    = {};

  timeline.forEach(seg => {
    const bar  = document.createElement('div');
    bar.className = 'gantt-bar' + (seg.pid === 'IDLE' ? ' idle' : '');
    const pct  = ((seg.end - seg.start) / totalTime * 100).toFixed(2);
    const left = (seg.start  / totalTime * 100).toFixed(2);
    bar.style.left  = left + '%';
    bar.style.width = pct  + '%';
    const col = colorMap[seg.pid] || '#555';
    if (seg.pid !== 'IDLE') {
      bar.style.background  = col + '33';
      bar.style.borderLeft  = `3px solid ${col}`;
      bar.style.color       = col;
    }
    bar.innerHTML = `<span class="bar-pid">${seg.pid}</span><span class="bar-dur">${seg.end - seg.start}u</span>`;
    bar.title = `${seg.pid}: [${seg.start} → ${seg.end}]`;
    bar.style.animationDelay = (seg.start / totalTime * 1.6).toFixed(2) + 's';
    bar.style.animationDuration = Math.max(0.15, (seg.end - seg.start) / totalTime * 1.6).toFixed(2) + 's';
    container.appendChild(bar);
    timeSet.add(seg.start);
    timeSet.add(seg.end);
    if (seg.pid !== 'IDLE' && !seen[seg.pid]) seen[seg.pid] = col;
  });

  const times = [...timeSet].sort((a,b) => a - b);
  // Place each time label at its true position on the bar. Skip labels that
  // would overlap the previous one, but always keep the first and the last.
  let lastPct = -100;
  timesEl.innerHTML = times.map((t, i) => {
    const pct = t / totalTime * 100;
    const isLast = i === times.length - 1;
    if (!isLast && (pct - lastPct < 2.5 || 100 - pct < 2.5)) return '';
    lastPct = pct;
    const shift = i === 0 ? '0' : isLast ? '-100%' : '-50%';
    return `<span style="left:${pct.toFixed(2)}%;transform:translateX(${shift})">${t}</span>`;
  }).join('');
  legendEl.innerHTML = Object.entries(seen).map(([pid, col]) =>
    `<div class="legend-item"><div class="legend-color" style="background:${col}33;border:2px solid ${col}"></div><span style="color:${col}">${pid}</span></div>`
  ).join('');
}

export function renderMiniGantt(container, timeline, colorMap) {
  if (!timeline.length) { container.innerHTML = '<div style="color:var(--muted);font-size:.75rem;padding:4px">Empty</div>'; return; }
  const total = timeline[timeline.length - 1].end;
  container.innerHTML = '';
  timeline.forEach(seg => {
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