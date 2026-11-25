export const COLORS = [
  '#8f9bd6','#d9899b','#79bfa5','#d6b073',
  '#7fb3cf','#a6c283','#d99a82','#8fc4c9','#b7a0d6','#cfa98a'
];

export function renderTable(processes) {
  const tbody = document.getElementById('process-tbody');
  if (!processes.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No processes yet. Pick an example above or press Add a process.</td></tr>';
    return;
  }
  const cell = (p, f, min, max) => `<td><input class="cell-input" type="number" step="1" min="${min}"${max ? ` max="${max}"` : ''} value="${p[f]}" data-pid="${p.pid}" data-field="${f}" aria-label="${p.pid} ${f}"/></td>`;
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
    return `<div class="metric-card">
      <div class="metric-label">${m.label}</div>
      <div class="metric-compare">
        <span class="metric-val rr">${m.rrV.toFixed(2)}</span>
        <span class="vs">vs</span>
        <span class="metric-val pr">${m.prV.toFixed(2)}</span>
      </div>
      <div><span class="winner-badge ${better}">${badge}</span></div>
    </div>`;
  }).join('');

  const makeTable = (result, cls) => {
    const rows = result.metrics.map(p =>
      `<tr><td><span class="pid-badge">${p.pid}</span></td><td>${p.at}</td><td>${p.bt}</td><td>${p.pr}</td><td>${p.wt}</td><td>${p.tat}</td><td>${p.rt}</td></tr>`
    ).join('');
    const avgs = `<tr class="avg-row"><td colspan="4">Average</td><td>${result.avgWt.toFixed(2)}</td><td>${result.avgTat.toFixed(2)}</td><td>${result.avgRt.toFixed(2)}</td></tr>`;
    return `<div class="results-card">
      <div class="results-card-header ${cls}">${cls === 'rr' ? '⬡ Round Robin' : '◆ Priority Scheduling'}</div>
      <div style="overflow-x:auto">
      <table><thead><tr><th title="Process">PID</th><th title="Arrival time">AT</th><th title="Burst time: total CPU time needed">BT</th><th title="Priority, 1 = most urgent">PRI</th><th title="Waiting time: ready but not running">WT</th><th title="Turnaround time: arrival until finished">TAT</th><th title="Response time: arrival until first CPU time">RT</th></tr></thead>
      <tbody>${rows}${avgs}</tbody></table></div>
    </div>`;
  };

  document.getElementById('results-grid').innerHTML = makeTable(rr,'rr') + makeTable(pr,'pr');
}