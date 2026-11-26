import { compareAll, best, bestRows } from '../analysis/compareAll.js';

const COLS = [
  ['avgWt', 'Avg wait', 'Average waiting time: time spent ready but not running. Lower is better.'],
  ['avgTat', 'Avg turnaround', 'Average turnaround time: from arrival until finished. Lower is better.'],
  ['avgRt', 'Avg response', 'Average response time: from arrival until first time on the CPU. Lower is better.'],
  ['contextSwitches', 'Switches', 'Context switches: times the CPU changed to a different process. Fewer means less overhead.']
];

let prev = null;

export function renderGlance(procs, quantum) {
  const rows = compareAll(procs, quantum);
  const win = {};
  COLS.forEach(([k]) => { win[k] = bestRows(rows, k).map(r => r.key); });
  const f = (k, v) => (k === 'contextSwitches' ? v : v.toFixed(2));
  const cur = {};
  const cards = [
    ['avgWt', 'Lowest average wait'], ['avgTat', 'Lowest average turnaround'],
    ['avgRt', 'Lowest average response'], ['contextSwitches', 'Fewest context switches']
  ].map(([k, label]) => {
    const w = best(rows, k);
    const tied = rows.filter(r => r[k] === w[k]).map(r => r.name.replace(' (preemptive)', ''));
    const now = f(k, w[k]);
    const changed = prev && prev[k] !== undefined && prev[k] !== now;
    cur[k] = now;
    return `<div class="kpi${changed ? ' flash' : ''}"><span class="kpi-l">${label}</span><b class="kpi-v">${now}</b><span class="kpi-w">${tied.join(', ')}</span>${changed ? `<span class="kpi-was">was ${prev[k]}, now ${now}</span>` : ''}</div>`;
  }).join('');
  prev = cur;
  document.getElementById('glance').innerHTML = `<div class="kpi-strip">${cards}</div>
    <details class="glance-more"><summary>Show all five algorithms side by side</summary><div class="cmp-wrap"><table class="cmp-table">
    <thead><tr><th>Algorithm</th>${COLS.map(c => `<th title="${c[2]}">${c[1]}</th>`).join('')}
    <th title="Share of the time span in which the CPU was busy">CPU busy</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td><strong>${r.name}</strong></td>
      ${COLS.map(([k]) => `<td class="${win[k].includes(r.key) ? 'best' : ''}">${f(k, r[k])}</td>`).join('')}
      <td>${Math.round(r.cpuUtilization * 100)}%</td></tr>`).join('')}</tbody></table></div></details>`;
}
