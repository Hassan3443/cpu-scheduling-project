export const STARVATION_THRESHOLD = 20;

export function detectStarvation(metrics, threshold = STARVATION_THRESHOLD) {
  return metrics.filter(p => p.wt > threshold).map(p => ({ pid: p.pid, wt: p.wt }));
}

export function renderSummary(rr, pr, quantum) {
  const rrWins = [], prWins = [], ties = [];
  const cmp = (label, rrV, prV) => {
    if (rrV < prV)      rrWins.push(`Better ${label} (${rrV.toFixed(2)} vs ${prV.toFixed(2)})`);
    else if (prV < rrV) prWins.push(`Better ${label} (${prV.toFixed(2)} vs ${rrV.toFixed(2)})`);
    else                ties.push(label);
  };
  cmp('Avg WT',  rr.avgWt,  pr.avgWt);
  cmp('Avg TAT', rr.avgTat, pr.avgTat);
  cmp('Avg RT',  rr.avgRt,  pr.avgRt);
  rrWins.push(`Fairer CPU distribution (Q=${quantum})`);
  rrWins.push('No starvation — every process gets CPU time');
  prWins.push('Urgent processes served first by priority');
  prWins.push('Lower context-switch overhead');

  const rrStarv = detectStarvation(rr.metrics);
  const prStarv = detectStarvation(pr.metrics);
  if (prStarv.length) prWins.push(`⚠ Starvation risk: ${prStarv.map(p=>p.pid).join(', ')} (WT > ${STARVATION_THRESHOLD})`);
  if (rrStarv.length) rrWins.push(`⚠ Starvation detected: ${rrStarv.map(p=>p.pid).join(', ')}`);

  document.getElementById('summary-grid').innerHTML = `
    <div class="summary-block rr">
      <h4>⬡ Round Robin Strengths</h4>
      <ul>${rrWins.map(s => `<li>${s}</li>`).join('')}</ul>
    </div>
    <div class="summary-block pr">
      <h4>◆ Priority Scheduling Strengths</h4>
      <ul>${prWins.map(s => `<li>${s}</li>`).join('')}</ul>
    </div>
  `;

  const rrScore = rr.avgWt  + rr.avgTat;
  const prScore = pr.avgWt  + pr.avgTat;
  const overall = rrScore < prScore ? 'Round Robin' : prScore < rrScore ? 'Priority Scheduling' : 'Tied';
  const other   = overall === 'Round Robin' ? 'Priority Scheduling' : 'Round Robin';

  document.getElementById('conclusion-area').innerHTML = `
    <h3>Final Conclusion</h3>
    <p>On the tested workload, <strong>${overall}</strong> achieved better combined average metrics
    (WT + TAT), making it more efficient for this dataset.</p>
    <p><strong>${other}</strong> ${other === 'Priority Scheduling'
      ? 'ensured urgent processes were handled first—critical in real-time or time-sensitive systems, even at the cost of fairness.'
      : 'provided more balanced CPU distribution across all processes, reducing starvation risk.'}</p>
    <p>The main trade-off: <em>fairness vs urgency</em>. Round Robin prevents starvation by rotating CPU
    time equally (quantum = ${quantum}), while Priority Scheduling optimises for high-priority tasks but
    risks neglecting low-priority ones.</p>
    ${prStarv.length ? `<p style="color:var(--warn)">⚠ Starvation likely detected for ${prStarv.map(p=>`${p.pid} (WT=${p.wt})`).join(', ')} under Priority Scheduling.</p>` : ''}
    <p style="color:var(--muted);font-size:.82rem">
      For interactive multi-user systems → <span style="color:#a5a0ff">Round Robin</span>. &nbsp;
      For real-time / mission-critical tasks → <span style="color:#ff9fb3">Priority Scheduling</span>.
    </p>
  `;
}