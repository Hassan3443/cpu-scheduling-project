export const COLORS = [
  '#0E9AD0','#1AA564','#D63D95','#F2A100','#7C5CE6',
  '#0F9D9A','#E4572E','#6B8E23','#B5651D','#4361EE'
];

// Dark readable text colour for a process colour (about 7:1 on its pale tint).
export function inkOf(hex) {
  const n = parseInt(hex.slice(1), 16), ink = [16, 35, 58], k = 0.66;
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v * (1 - k) + ink[i] * k));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

export function renderTable(processes) {
  const tbody = document.getElementById('process-tbody');
  if (!processes.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No processes yet. Pick an example above or press Add a process.</td></tr>';
    return;
  }
  const LAB = { at: 'Arrives', bt: 'Burst', pr: 'Priority' };
  const cell = (p, f, min, max) => `<td data-label="${LAB[f]}"><div class="nf"><button type="button" class="nf-b" data-nf="-1" tabindex="-1" aria-label="Decrease ${p.pid} ${f}">&minus;</button><input class="cell-input" type="number" step="1" min="${min}"${max ? ` max="${max}"` : ''} value="${p[f]}" data-pid="${p.pid}" data-field="${f}" aria-label="${p.pid} ${f}"/><button type="button" class="nf-b" data-nf="1" tabindex="-1" aria-label="Increase ${p.pid} ${f}">+</button></div></td>`;
  tbody.innerHTML = processes.map(p => `
    <tr>
      <td><span class="pid-badge">${p.pid}</span></td>
      ${cell(p, 'at', 0)}${cell(p, 'bt', 1)}${cell(p, 'pr', 1, 99)}
      <td><button class="btn-del" data-action="remove" data-pid="${p.pid}" title="Remove ${p.pid}" aria-label="Remove ${p.pid}">✕</button></td>
    </tr>
  `).join('');
}

export function renderResults(rr, pr, detectStarvationCb) {
  const rrStarv = detectStarvationCb(rr.metrics);
  const prStarv = detectStarvationCb(pr.metrics);
  const sb      = document.getElementById('starvation-banner');

  if (rrStarv.length || prStarv.length) {
    const msgs = [];
    if (rrStarv.length) msgs.push(`⚠ RR Starvation: ${rrStarv.map(p => `${p.pid} (WT=${p.wt})`).join(', ')}`);
    if (prStarv.length) msgs.push(`⚠ Priority Starvation: ${prStarv.map(p => `${p.pid} (WT=${p.wt})`).join(', ')}`);
    sb.innerHTML = msgs.map(m => `<div class="starv-banner">${m}</div>`).join('');
  } else {
    sb.innerHTML = '';
  }

  const metrics = [
    { label:'Avg Waiting Time',     rrV: rr.avgWt,  prV: pr.avgWt  },
    { label:'Avg Turnaround Time',  rrV: rr.avgTat, prV: pr.avgTat },
    { label:'Avg Response Time',    rrV: rr.avgRt,  prV: pr.avgRt  },
  ];
  
  document.getElementById('metrics-row').innerHTML = metrics.map(m => {
    const better = m.rrV < m.prV ? 'rr' : m.prV < m.rrV ? 'pr' : 'tie';
    const badge  = better === 'rr' ? '↓ Round Robin wins' : better === 'pr' ? '↓ Priority wins' : '= Tie';
    const lo = Math.min(m.rrV, m.prV), hi = Math.max(m.rrV, m.prV);
    const delta = better !== 'tie' && hi > 0 ? ` <span class="delta">-${((hi - lo) / hi * 100).toFixed(1)}%</span>` : '';
    return `<div class="metric-card">
      <div class="metric-label">${m.label}</div>
      <div class="metric-compare">
        <span class="metric-val rr${better === 'pr' ? ' loser' : ''}">${m.rrV.toFixed(2)}</span>
        <span class="vs">vs</span>
        <span class="metric-val pr${better === 'rr' ? ' loser' : ''}">${m.prV.toFixed(2)}</span>
      </div>
      <div><span class="winner-badge ${better}">${badge}${delta}</span></div>
    </div>`;
  }).join('');

  const makeTable = (result, cls) => {
    const rows = result.metrics.map(p =>
      `<tr><td><span class="pid-badge">${p.pid}</span></td><td>${p.at}</td><td>${p.bt}</td><td>${p.pr}</td><td>${p.wt}</td><td>${p.tat}</td><td>${p.rt}</td></tr>`
    ).join('');
    const avgs = `<tr class="avg-row"><td colspan="4">Average</td><td>${result.avgWt.toFixed(2)}</td><td>${result.avgTat.toFixed(2)}</td><td>${result.avgRt.toFixed(2)}</td></tr>`;
    const other = cls === 'rr' ? pr : rr;
    const win = result.avgWt < other.avgWt ? ' is-winner' : '';
    return `<div class="results-card${win}">
      <div class="results-card-header ${cls}">${cls === 'rr' ? 'Round Robin' : 'Priority Scheduling'}${win ? '<span class="win-chip">Lower avg WT</span>' : ''}</div>
      <div style="overflow-x:auto">
      <table><thead><tr><th title="Process">PID</th><th title="Arrival time">AT</th><th title="Burst time: total CPU time needed">BT</th><th title="Priority, 1 = most urgent">PRI</th><th title="Waiting time: ready but not running">WT</th><th title="Turnaround time: arrival until finished">TAT</th><th title="Response time: arrival until first CPU time">RT</th></tr></thead>
      <tbody>${rows}${avgs}</tbody></table></div>
    </div>`;
  };

  document.getElementById('results-grid').innerHTML = makeTable(rr,'rr') + makeTable(pr,'pr');
}