import { compareAll, best } from '../analysis/compareAll.js';
import { renderMiniGantt } from './ganttChart.js';
import { COLORS } from './tableRenderer.js';

const METRICS = [
  ['avgWt', 'Avg waiting time'],
  ['avgTat', 'Avg turnaround time'],
  ['avgRt', 'Avg response time']
];

export function renderCompareAll(procs, quantum) {
  const rows = compareAll(procs, quantum);
  const colorMap = {};
  procs.forEach((p, i) => { colorMap[p.pid] = COLORS[i % COLORS.length]; });

  const winners = {};
  METRICS.forEach(([k]) => { winners[k] = best(rows, k).key; });
  const fewest = best(rows, 'contextSwitches').key;

  const table = `<div class="cmp-wrap">
    <table class="cmp-table">
      <thead><tr><th>Algorithm</th>${METRICS.map(m => `<th title="${m[1]}">${m[1].replace(/^Avg\w*\s/i, '').length ? `<span class="long">${m[1]}</span><span class="short">${shortName(m[1])}</span>` : m[1]}</th>`).join('')}<th title="Context switches: times the CPU changed to a different process. Fewer is cheaper."><span class="long">Context switches</span><span class="short">Switches</span></th><th title="CPU utilisation: share of the time the CPU was busy."><span class="long">CPU utilisation</span><span class="short">CPU busy</span></th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><strong>${r.name}</strong></td>
        ${METRICS.map(([k]) => `<td class="${winners[k] === r.key ? 'best' : ''}">${r[k].toFixed(2)}</td>`).join('')}
        <td class="${fewest === r.key ? 'best' : ''}">${r.contextSwitches}</td>
        <td>${(r.cpuUtilization * 100).toFixed(0)}%</td></tr>`).join('')}
      </tbody></table></div>
    <p class="cmp-note">Green = best value in that column. Round Robin uses q = ${quantum}. Context switches count changes between two different processes.</p>`;

  const maxWt = Math.max(...rows.map(r => r.avgWt), 1);
  const bars = `<div class="cmp-bars"><div class="cmp-bars-title">Average waiting time</div>${rows.map(r => `
    <div class="cmp-bar-row"><span>${r.name}</span>
    <div class="cmp-bar-track"><div class="cmp-bar-fill${winners.avgWt === r.key ? ' best' : ''}" style="width:${(r.avgWt / maxWt * 100).toFixed(1)}%"></div></div>
    <b>${r.avgWt.toFixed(2)}</b></div>`).join('')}</div>`;

  const ganttBlocks = rows.map(r => `
    <div class="cmp-gantt"><div class="cmp-gantt-name">${r.name}</div>
    <div class="cmp-gantt-bar" id="cmp-g-${r.key}"></div></div>`).join('');

  document.getElementById('compare-content').innerHTML = `${table}${bars}<h3 class="cmp-h">Gantt charts</h3>${ganttBlocks}`;
  rows.forEach(r => renderMiniGantt(document.getElementById(`cmp-g-${r.key}`), r.result.timeline, colorMap));
  document.getElementById('compare-placeholder').style.display = 'none';
  document.getElementById('compare-content').style.display = 'block';
}

function shortName(label) {
  const l = label.toLowerCase();
  return l.includes('wait') ? 'Avg WT' : l.includes('turn') ? 'Avg TAT' : l.includes('resp') ? 'Avg RT' : label;
}
