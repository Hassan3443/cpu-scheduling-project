import { compareAll, best } from '../analysis/compareAll.js';

const COLS = [
  ['avgWt', 'Avg wait', 'Average waiting time: time spent ready but not running. Lower is better.'],
  ['avgTat', 'Avg turnaround', 'Average turnaround time: from arrival until finished. Lower is better.'],
  ['avgRt', 'Avg response', 'Average response time: from arrival until first time on the CPU. Lower is better.'],
  ['contextSwitches', 'Switches', 'Context switches: times the CPU changed to a different process. Fewer means less overhead.']
];

export function renderGlance(procs, quantum) {
  const rows = compareAll(procs, quantum);
  const win = {};
  COLS.forEach(([k]) => { win[k] = best(rows, k).key; });
  const f = (k, v) => (k === 'contextSwitches' ? v : v.toFixed(2));
  document.getElementById('glance').innerHTML = `<div class="cmp-wrap"><table class="cmp-table">
    <thead><tr><th>Algorithm</th>${COLS.map(c => `<th title="${c[2]}">${c[1]} <span class="hint">?</span></th>`).join('')}
    <th title="Share of the time span in which the CPU was busy">CPU busy <span class="hint">?</span></th></tr></thead>
    <tbody>${rows.map(r => `<tr><td><strong>${r.name}</strong></td>
      ${COLS.map(([k]) => `<td class="${win[k] === r.key ? 'best' : ''}">${f(k, r[k])}</td>`).join('')}
      <td>${Math.round(r.cpuUtilization * 100)}%</td></tr>`).join('')}</tbody></table></div>`;
}
