import { countSwitches } from '../algorithms/common.js';
export { countSwitches };

// A "long wait" is a waiting time above this many units. It is a plain threshold on waiting time,
// not proof of starvation (a long workload makes everyone wait), so the text says "long wait".
export const STARVATION_THRESHOLD = 20;

export function detectStarvation(metrics, threshold = STARVATION_THRESHOLD) {
  return metrics.filter(p => p.wt > threshold).map(p => ({ pid: p.pid, wt: p.wt }));
}

// One computed sentence about who waits least and who waits longest.
export function plainVerdict(rr, pr) {
  const maxWt = r => Math.max(...r.metrics.map(m => m.wt));
  const fmt = v => (Number.isInteger(v) ? String(v) : v.toFixed(2));
  const faster = rr.avgTat < pr.avgTat ? 'Round Robin' : pr.avgTat < rr.avgTat ? 'Priority' : null;
  const a = faster ? `${faster} finishes the average process sooner (average turnaround ${fmt(faster === 'Round Robin' ? rr.avgTat : pr.avgTat)} vs ${fmt(faster === 'Round Robin' ? pr.avgTat : rr.avgTat)}).` : `Both give the same average turnaround (${fmt(rr.avgTat)}).`;
  const wr = maxWt(rr), wp = maxWt(pr);
  const b = wr === wp ? `The longest any process waits is ${wr} under both.`
    : `The longest any process waits is ${wr} under Round Robin and ${wp} under Priority, so ${wr < wp ? 'Round Robin' : 'Priority'} treats the unluckiest process better.`;
  return `${a} ${b}`;
}

// Who is ahead overall: the lower WT + TAT wins; equal is a tie. Returns 'rr', 'pr' or 'tie'.
export function overallWinner(rr, pr) {
  const a = rr.avgWt + rr.avgTat, b = pr.avgWt + pr.avgTat;
  return a < b ? 'rr' : b < a ? 'pr' : 'tie';
}

// Pure text builder (no DOM) so the wording can be tested.
export function buildSummary(rr, pr, quantum) {
  const rrWins = [], prWins = [], ties = [];
  const cmp = (label, rrV, prV) => {
    if (rrV < prV)      rrWins.push(`Better ${label} (${rrV.toFixed(2)} vs ${prV.toFixed(2)})`);
    else if (prV < rrV) prWins.push(`Better ${label} (${prV.toFixed(2)} vs ${rrV.toFixed(2)})`);
    else                ties.push(label);
  };
  cmp('Avg WT',  rr.avgWt,  pr.avgWt);
  cmp('Avg TAT', rr.avgTat, pr.avgTat);
  cmp('Avg RT',  rr.avgRt,  pr.avgRt);
  const maxWt = r => Math.max(...r.metrics.map(m => m.wt));
  const rrMax = maxWt(rr), prMax = maxWt(pr);
  if (rrMax < prMax) rrWins.push(`Shorter longest wait (${rrMax} vs ${prMax})`);
  else if (prMax < rrMax) prWins.push(`Shorter longest wait (${prMax} vs ${rrMax})`);
  else ties.push('Longest wait');
  const rrLong = detectStarvation(rr.metrics);
  const prLong = detectStarvation(pr.metrics);
  if (!rrLong.length) rrWins.push(`No process waited longer than ${STARVATION_THRESHOLD} units`);
  if (!prLong.length) prWins.push(`No process waited longer than ${STARVATION_THRESHOLD} units`);
  prWins.push('By design: urgent processes are served first');
  const rrSw = countSwitches(rr.timeline), prSw = countSwitches(pr.timeline);
  if (prSw < rrSw) prWins.push(`Fewer context switches (${prSw} vs ${rrSw})`);
  else if (rrSw < prSw) rrWins.push(`Fewer context switches (${rrSw} vs ${prSw})`);
  else ties.push('Context switches');

  const who = overallWinner(rr, pr);
  const score = r => +(r.avgWt + r.avgTat).toFixed(2);
  let verdict;
  if (who === 'tie') {
    verdict = `<p>On the tested workload both scored the same on combined average metrics (WT + TAT = ${score(rr)}), so neither is ahead overall.</p>
    <p>The difference shows up elsewhere: ${ties.length ? `they are equal on ${ties.join(', ')}; ` : ''}see the strengths lists above for where they differ.</p>`;
  } else {
    const overall = who === 'rr' ? 'Round Robin' : 'Priority Scheduling';
    const other   = who === 'rr' ? 'Priority Scheduling' : 'Round Robin';
    verdict = `<p>On the tested workload, <strong>${overall}</strong> achieved better combined average metrics
    (WT + TAT: ${score(who === 'rr' ? rr : pr)} vs ${score(who === 'rr' ? pr : rr)}), making it more efficient for this dataset.</p>
    <p><strong>${other}</strong> ${other === 'Priority Scheduling'
      ? 'serves urgent processes first by design, which matters in real-time or time-sensitive systems, even at the cost of fairness.'
      : 'rotates the CPU between processes, so no process waits for another to finish completely.'}</p>`;
  }
  const warn = (name, list) => list.length
    ? `<p style="color:var(--warn)">⚠ Long waits (over ${STARVATION_THRESHOLD} units) under ${name}: ${list.map(p => `${p.pid} (WT=${p.wt})`).join(', ')}.</p>` : '';
  const conclusionHtml = `
    <h3>Final Conclusion</h3>
    <p class="plain-verdict"><strong>In plain words:</strong> ${plainVerdict(rr, pr)}</p>
    ${verdict}
    <p>The main trade-off: <em>fairness vs urgency</em>. Round Robin gives every process a turn
    (quantum = ${quantum}), while Priority Scheduling serves the most urgent first and can leave low-priority processes waiting a long time.</p>
    ${warn('Round Robin', rrLong)}${warn('Priority Scheduling', prLong)}
    <p style="color:var(--muted);font-size:.82rem">
      For interactive multi-user systems → <span class="c-rr">Round Robin</span>. &nbsp;
      For real-time / mission-critical tasks → <span class="c-pr">Priority Scheduling</span>.
    </p>
  `;
  const gridHtml = `
    <div class="summary-block rr">
      <h4>⬡ Round Robin Strengths</h4>
      <ul>${rrWins.length ? rrWins.map(t => `<li>${t}</li>`).join('') : '<li>No clear advantage on this workload</li>'}</ul>
    </div>
    <div class="summary-block pr">
      <h4>◆ Priority Scheduling Strengths</h4>
      <ul>${prWins.map(t => `<li>${t}</li>`).join('')}</ul>
    </div>
  `;
  return { gridHtml, conclusionHtml, rrWins, prWins, ties, winner: who };
}

export function renderSummary(rr, pr, quantum) {
  const { gridHtml, conclusionHtml } = buildSummary(rr, pr, quantum);
  document.getElementById('summary-grid').innerHTML = gridHtml;
  document.getElementById('conclusion-area').innerHTML = conclusionHtml;
}
