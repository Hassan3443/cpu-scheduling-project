import { 
  getProcesses, setProcesses, handleAddProcess, removeProcess, clearAllProcesses, loadDemoData 
} from '../../modules/input/inputManager.js';
import { switchTab } from '../../modules/ui/inputUI.js';
import { renderTable, renderResults, COLORS } from '../../modules/ui/tableRenderer.js';
import { renderGantt, renderMiniGantt } from '../../modules/ui/ganttChart.js';
import { detectStarvation, renderSummary } from '../../modules/analysis/analysis.js';
import { simulateRR } from '../../modules/algorithms/roundRobin.js';
import { simulatePriority } from '../../modules/algorithms/priority.js';
import { SCENARIOS, buildScenariosTab, renderScenarioResultsHtml } from '../../modules/testing/testScenarios.js';

// Setup Initialization
document.addEventListener('DOMContentLoaded', () => {
  buildScenariosTab();
  renderTable(getProcesses());
  attachEventListeners();
});

function attachEventListeners() {
  // Global Delegate Listener
  document.addEventListener('click', (e) => {
    // Tabs
    const tabEl = e.target.closest('.tab');
    if (tabEl) switchTab(tabEl.dataset.tab);

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
    if (handleAddProcess()) refreshTableState();
  });

  document.getElementById('btn-load-demo').addEventListener('click', () => {
    loadDemoData();
    document.getElementById('quantum').value = '4';
    refreshTableState();
  });

  document.getElementById('btn-clear-all').addEventListener('click', () => {
    clearAllProcesses();
    refreshTableState();
    ['gantt-placeholder','results-placeholder','summary-placeholder'].forEach(id => document.getElementById(id).style.display = '');
    ['gantt-content','results-content','summary-content'].forEach(id => document.getElementById(id).style.display = 'none');
  });

  document.getElementById('btn-run').addEventListener('click', runSimulation);
}

function refreshTableState() {
  const procs = getProcesses();
  renderTable(procs);
  document.getElementById('btn-run').disabled = procs.length < 1;
}

function runSimulation() {
  const procs = getProcesses();
  const qVal = document.getElementById('quantum').value.trim();
  const gErr = document.getElementById('global-err');
  gErr.classList.remove('show');

  if (!qVal || isNaN(qVal) || !Number.isInteger(+qVal) || +qVal < 1) {
    gErr.textContent = 'Invalid Time Quantum. Must be a positive integer ≥ 1.';
    gErr.classList.add('show');
    switchTab('input');
    return;
  }

  if (!procs.length) {
    gErr.textContent = 'Add at least one process before running.';
    gErr.classList.add('show');
    return;
  }

  const quantum = +qVal;
  const rrResult = simulateRR(procs, quantum);
  const prResult = simulatePriority(procs);

  const colorMap = {};
  procs.forEach((p, i) => { colorMap[p.pid] = COLORS[i % COLORS.length]; });

  // Gantt rendering
  document.getElementById('gantt-placeholder').style.display = 'none';
  document.getElementById('gantt-content').style.display = 'block';
  renderGantt('gantt-rr', 'times-rr', 'legend-rr', rrResult.timeline, colorMap);
  renderGantt('gantt-pr', 'times-pr', 'legend-pr', prResult.timeline, colorMap);

  // Queue snapshot
  const q = document.getElementById('rr-queue');
  if (rrResult.queueSnapshot.length) {
    q.innerHTML = '<span style="color:var(--muted);font-size:.72rem;margin-right:4px">Queue snapshot:</span>' +
      rrResult.queueSnapshot.map(pid => `<span class="queue-tag">${pid}</span>`).join('<span style="color:var(--muted)">→</span>');
  } else {
    q.textContent = 'All processes complete — queue empty at end.';
  }

  // Results & Summary
  document.getElementById('results-placeholder').style.display = 'none';
  document.getElementById('results-content').style.display = 'block';
  renderResults(rrResult, prResult, detectStarvation);

  document.getElementById('summary-placeholder').style.display = 'none';
  document.getElementById('summary-content').style.display = 'block';
  renderSummary(rrResult, prResult, quantum);

  switchTab('gantt');
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
  renderGantt('gantt-pr','times-pr','legend-pr', prRes.timeline, colorMap);

  const qEl = document.getElementById('rr-queue');
  qEl.textContent = rrRes.queueSnapshot.length
    ? 'Queue: ' + rrRes.queueSnapshot.join(' → ')
    : 'All processes complete — queue empty at end.';

  renderResults(rrRes, prRes, detectStarvation);
  renderSummary(rrRes, prRes, quantum);
}