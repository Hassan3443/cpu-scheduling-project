import { 
  getProcesses, setProcesses, handleAddProcess, removeProcess, clearAllProcesses, loadDemoData 
} from '../../modules/input/inputManager.js';
import { switchTab } from '../../modules/ui/inputUI.js';
import { renderTable, renderResults, COLORS } from '../../modules/ui/tableRenderer.js';
import { renderGantt, renderMiniGantt, renderQueue, renderLanes } from '../../modules/ui/ganttChart.js';
import { detectStarvation, renderSummary } from '../../modules/analysis/analysis.js';
import { simulateRR } from '../../modules/algorithms/roundRobin.js';
import { simulatePriority } from '../../modules/algorithms/priority.js';
import { renderCompareAll } from '../../modules/ui/compareView.js';
import { initNumberFields } from '../../modules/ui/numberField.js';
import { PRESETS } from '../../modules/input/presets.js';
import { renderCpuDiagram } from '../../modules/ui/cpuDiagram.js';
import { encodeSetup, decodeSetup } from '../../modules/ui/share.js';
import { initHelp } from '../../modules/ui/help.js';
import { buildBackground } from '../../modules/ui/background.js';
import { renderGlance } from '../../modules/ui/glance.js';
import { SCENARIOS, buildScenariosTab, renderScenarioResultsHtml } from '../../modules/testing/testScenarios.js';

// Setup Initialization
document.addEventListener('DOMContentLoaded', () => {
  buildBackground();
  initHelp();
  document.getElementById('btn-watch').addEventListener('click', () => {
    switchTab('gantt');
    const host = document.getElementById('cd-diagram');
    host.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const play = document.getElementById('cd-play');
    if (play && play.getAttribute('aria-pressed') !== 'true') play.click();
  });
  // Hover or focus a process (legend chip or bar) to light it up in both charts.
  const lit = pid => document.querySelectorAll('#sec-gantt [data-pid]').forEach(el => el.classList.toggle('hl', !!pid && el.dataset.pid === pid));
  const secG = document.getElementById('sec-gantt');
  secG.addEventListener('pointerover', e => { const t = e.target.closest('[data-pid]'); secG.classList.toggle('pid-focus', !!t); lit(t ? t.dataset.pid : null); });
  secG.addEventListener('pointerleave', () => { secG.classList.remove('pid-focus'); lit(null); });
  secG.addEventListener('focusin', e => { const t = e.target.closest('.legend-item'); if (t) { secG.classList.add('pid-focus'); lit(t.dataset.pid); } });
  secG.addEventListener('focusout', () => { secG.classList.remove('pid-focus'); lit(null); });
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-goto]');
    if (g) { switchTab(g.dataset.goto); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (e.target.closest('[data-load-example]')) { applyPreset(0); }
  });
  try {
    const w = document.getElementById('welcome');
    if (w && localStorage.getItem('cpu-lab-welcome') !== 'seen') w.hidden = false;
    document.getElementById('welcome-close').addEventListener('click', () => { w.hidden = true; try { localStorage.setItem('cpu-lab-welcome', 'seen'); } catch (e) {} });
  } catch (e) { /* storage blocked: the note simply stays hidden */ }
  buildScenariosTab();
  buildPresets();
  attachEventListeners();
  const shared = decodeSetup(location.hash);
  if (shared) {
    setProcesses(shared.procs);
    document.getElementById('quantum').value = shared.quantum;
    refreshTableState();
    runSimulation({ jump: false });
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* file:// */ }
  } else {
    // A plain open or refresh always starts with P1 to P3; more are added with "Add a process".
    setProcesses([{ pid: 'P1', at: 0, bt: 5, pr: 2 }, { pid: 'P2', at: 1, bt: 3, pr: 1 }, { pid: 'P3', at: 2, bt: 4, pr: 3 }]);
    document.getElementById('quantum').value = 2;
    refreshTableState();
    runSimulation({ jump: false });
  }
});

function buildPresets() {
  document.getElementById('presets').innerHTML = PRESETS.map((p, i) =>
    { const mx = Math.max(...p.procs.map(x => x.bt)); const bars = p.procs.map((x, k) => `<i style="width:${Math.max(6, x.bt / mx * 100).toFixed(0)}%;background:${COLORS[k % COLORS.length]}"></i>`).join('');
      return `<button class="preset" data-preset="${i}"><b>${p.name}</b><span>${p.note}</span><em class="pbars" aria-hidden="true" title="Burst lengths">${bars}</em></button>`; }).join('');
}

function applyPreset(i) {
  const p = PRESETS[i];
  setProcesses(p.procs.map(x => ({ ...x })));
  document.getElementById('quantum').value = p.quantum;
  document.querySelectorAll('.preset').forEach((b, k) => b.classList.toggle('on', k === i));
  refreshTableState();
  runSimulation({ jump: false });
}

function attachEventListeners() {
  // Global Delegate Listener
  document.addEventListener('click', (e) => {
    // Tabs
    const tabEl = e.target.closest('.tab');
    if (tabEl) switchTab(tabEl.dataset.tab);

    const pre = e.target.closest('.preset');
    if (pre) applyPreset(+pre.dataset.preset);

    // Remove Process
    const btnDel = e.target.closest('.btn-del[data-action="remove"]');
    if (btnDel) {
      removeProcess(btnDel.dataset.pid);
      refreshTableState();
    }

    // Toggle Scenario
    const scToggle = e.target.closest('.scenario-card-header[data-action="toggle"]');
    if (scToggle) {
      const idx = scToggle.dataset.idx;
      const body = document.getElementById(`sc-body-${idx}`);
      const toggle = document.getElementById(`sc-toggle-${idx}`);
      const open = body.classList.toggle('open');
      toggle.classList.toggle('open', open);
    }

    // Load & Run Scenario
    const scLoadRun = e.target.closest('.btn-load-scenario[data-action="load-run"]');
    if (scLoadRun) {
      loadAndRunScenario(scLoadRun.dataset.idx);
    }
  });

  // Direct Button Listeners
  document.getElementById('btn-add-process').addEventListener('click', () => {
    const procs = getProcesses();
    let n = procs.length + 1;
    while (procs.some(p => p.pid === 'P' + n)) n++;
    procs.push({ pid: 'P' + n, at: 0, bt: 3, pr: 1 });
    document.querySelectorAll('.preset').forEach(b => b.classList.remove('on'));
    refreshTableState();
  });
  const bump = d => { const q = document.getElementById('quantum'); q.value = Math.max(1, (parseInt(q.value, 10) || 1) + d); liveRun(); };
  document.getElementById('q-minus').addEventListener('click', () => bump(-1));
  document.getElementById('q-plus').addEventListener('click', () => bump(1));

  document.getElementById('btn-clear-all').addEventListener('click', () => {
    clearAllProcesses();
    refreshTableState();
    ['gantt-placeholder','results-placeholder','summary-placeholder'].forEach(id => document.getElementById(id).style.display = '');
    ['gantt-content','results-content','summary-content'].forEach(id => document.getElementById(id).style.display = 'none');
    document.getElementById('glance').innerHTML = '<p class="live-note">Add a process to see results.</p>';
  });

  document.getElementById('btn-run').addEventListener('click', () => runSimulation());

  // Live mode: editing a cell or the quantum recomputes everything.
  let timer;
  const live = () => { clearTimeout(timer); timer = setTimeout(liveRun, 150); };
  document.addEventListener('input', (e) => {
    const c = e.target.closest('.cell-input');
    if (c) {
      const p = getProcesses().find(x => x.pid === c.dataset.pid);
      const v = c.value.trim();
      const n = Number(v);
      const min = c.dataset.field === 'bt' || c.dataset.field === 'pr' ? 1 : 0;
      const ok = v !== '' && Number.isInteger(n) && n >= min && (c.dataset.field !== 'pr' || n <= 99);
      c.classList.toggle('invalid', !ok);
      if (ok && p) { p[c.dataset.field] = n; live(); }
    } else if (e.target.id === 'quantum') live();
  });
  const cp = document.getElementById('btn-copy-link');
  if (cp) cp.addEventListener('click', async () => {
    try { const link = location.origin + location.pathname + location.search + '#' + encodeSetup(getProcesses(), +document.getElementById('quantum').value);
      await navigator.clipboard.writeText(link); cp.textContent = '✓ Link copied'; }
    catch (e) { cp.textContent = 'Copy the address bar'; }
    setTimeout(() => { cp.textContent = 'Copy link to this setup'; }, 2000);
  });
  document.getElementById('btn-replay').addEventListener('click', replayGantt);
}

function refreshTableState() {
  const procs = getProcesses();
  renderTable(procs);
  document.getElementById('btn-run').disabled = procs.length < 1;
  if (!procs.length) document.getElementById('glance').innerHTML = '<p class="live-note">Add a process to see results.</p>';
  if (document.getElementById('gantt-content').style.display !== 'none') liveRun();
}

// Re-run quietly (stay on the current tab) once a first simulation exists.
function liveRun() {
  if (!getProcesses().length) return;
  const q = document.getElementById('quantum').value.trim();
  if (!/^\d+$/.test(q) || +q < 1) return;
  runSimulation({ jump: false });
}

function replayGantt() {
  document.querySelectorAll('.gantt-chart').forEach(c => {
    const html = c.innerHTML; c.innerHTML = ''; void c.offsetWidth; c.innerHTML = html;
  });
}

function runSimulation(opts = {}) {
  const { jump = true } = opts;
  const procs = getProcesses();
  const qVal = document.getElementById('quantum').value.trim();
  const gErr = document.getElementById('global-err');
  gErr.classList.remove('show');

  if (!qVal || isNaN(qVal) || !Number.isInteger(+qVal) || +qVal < 1) {
    gErr.textContent = 'The time slice (quantum) must be a whole number, 1 or more.';
    gErr.classList.add('show');
    if (jump) switchTab('input');
    return;
  }

  if (!procs.length) {
    gErr.textContent = 'Add at least one process before running.';
    gErr.classList.add('show');
    return;
  }

  const quantum = +qVal;
  renderGlance(procs, quantum);
  renderCpuDiagram(procs.map(p => ({ ...p })), quantum);
  const rrResult = simulateRR(procs, quantum);
  const prResult = simulatePriority(procs);

  const colorMap = {};
  procs.forEach((p, i) => { colorMap[p.pid] = COLORS[i % COLORS.length]; });

  // Gantt rendering
  document.getElementById('gantt-placeholder').style.display = 'none';
  document.getElementById('gantt-content').style.display = 'block';
  renderGantt('gantt-rr', 'times-rr', 'legend-rr', rrResult.timeline, colorMap);
  renderGantt('gantt-pr', 'times-pr', null, prResult.timeline, colorMap);
  renderLanes('lanes-rr', procs, rrResult.timeline, colorMap);
  renderLanes('lanes-pr', procs, prResult.timeline, colorMap);

  renderQueue(document.getElementById('rr-queue'), rrResult.queueSnapshot, colorMap);

  // Results & Summary
  document.getElementById('results-placeholder').style.display = 'none';
  document.getElementById('results-content').style.display = 'block';
  renderResults(rrResult, prResult, detectStarvation);

  document.getElementById('summary-placeholder').style.display = 'none';
  document.getElementById('summary-content').style.display = 'block';
  renderSummary(rrResult, prResult, quantum);

  renderCompareAll(procs, quantum);
  if (jump) switchTab('gantt');
}

function loadAndRunScenario(idx) {
  const sc = SCENARIOS[idx];
  if (sc.isValidationScenario) return;

  setProcesses(sc.procs.map(p => ({ ...p })));
  document.getElementById('quantum').value = sc.quantum;
  refreshTableState();

  const quantum  = sc.quantum;
  const procs = getProcesses();
  const rrRes    = simulateRR(procs, quantum);
  const prRes    = simulatePriority(procs);

  const colorMap = {};
  procs.forEach((p, i) => { colorMap[p.pid] = COLORS[i % COLORS.length]; });

  const rrStarv  = detectStarvation(rrRes.metrics);
  const prStarv  = detectStarvation(prRes.metrics);

  const resEl = document.getElementById(`sc-result-${idx}`);
  resEl.style.display = 'block';
  resEl.innerHTML = renderScenarioResultsHtml(idx, rrRes, prRes, rrStarv, prStarv);

  requestAnimationFrame(() => {
    renderMiniGantt(document.getElementById(`sg-rr-${idx}`), rrRes.timeline, colorMap);
    renderMiniGantt(document.getElementById(`sg-pr-${idx}`), prRes.timeline, colorMap);
  });

  // Make available to global tabs
  document.getElementById('gantt-placeholder').style.display   = 'none';
  document.getElementById('gantt-content').style.display       = 'block';
  document.getElementById('results-placeholder').style.display = 'none';
  document.getElementById('results-content').style.display     = 'block';
  document.getElementById('summary-placeholder').style.display = 'none';
  document.getElementById('summary-content').style.display     = 'block';

  renderGantt('gantt-rr','times-rr','legend-rr', rrRes.timeline, colorMap);
  renderGantt('gantt-pr','times-pr',null, prRes.timeline, colorMap);
  renderLanes('lanes-rr', procs, rrRes.timeline, colorMap);
  renderLanes('lanes-pr', procs, prRes.timeline, colorMap);

  renderQueue(document.getElementById('rr-queue'), rrRes.queueSnapshot, colorMap);

  renderResults(rrRes, prRes, detectStarvation);
  renderSummary(rrRes, prRes, quantum);
  renderCompareAll(procs, quantum);
  renderGlance(procs, quantum);
  renderCpuDiagram(procs.map(p => ({ ...p })), quantum);
}
(function () {
  const pane = document.getElementById('sec-input'), t = document.getElementById('pane-toggle');
  if (!pane || !t) return;
  t.addEventListener('click', () => {
    const c = pane.classList.toggle('collapsed');
    t.setAttribute('aria-expanded', String(!c));
    t.lastElementChild.textContent = c ? '▾' : '▴';
  });
})();

initNumberFields();
(function () {
  const q = document.getElementById('quantum'), r = document.getElementById('q-range');
  if (!q || !r) return;
  const sync = () => { const v = parseInt(q.value, 10); if (v >= 1) r.value = Math.min(12, v); };
  r.addEventListener('input', () => { q.value = r.value; q.dispatchEvent(new Event('input', { bubbles: true })); });
  q.addEventListener('input', sync);
  document.addEventListener('click', e => { if (e.target.closest('#q-minus,#q-plus,.preset')) setTimeout(sync, 0); });
  sync();
})();
