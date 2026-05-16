export const COLORS = [
  '#6c63ff','#ff6b8a','#39e8b0','#ffb347',
  '#74c7ec','#a9e34b','#f9826c','#89dceb','#cba6f7','#fab387'
];

export function renderTable(processes) {
  const tbody = document.getElementById('process-tbody');
  if (!processes.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No processes added yet. Add at least 1 to simulate.</td></tr>';
    return;
  }
  tbody.innerHTML = processes.map(p => `
    <tr>
      <td><span class="pid-badge">${p.pid}</span></td>
      <td>${p.at}</td>
      <td>${p.bt}</td>
      <td>${p.pr}</td>
      <td><button class="btn-del" data-action="remove" data-pid="${p.pid}">Remove</button></td>
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
      <table><thead><tr><th>PID</th><th>AT</th><th>BT</th><th>PRI</th><th>WT</th><th>TAT</th><th>RT</th></tr></thead>
      <tbody>${rows}${avgs}</tbody></table></div>
    </div>`;
  };

  document.getElementById('results-grid').innerHTML = makeTable(rr,'rr') + makeTable(pr,'pr');
}