export const SCENARIOS = [
  {
    name:    'Scenario 1 – Basic Workload',
    quantum: 4,
    desc:    'A normal mixed workload with 4 processes of varying burst and priority. Tests fundamental behaviour of both algorithms.',
    expected:'RR rotates fairly; Priority runs P2→P4→P1→P3. Priority likely shows better avg WT for high-priority processes. RR shows better avg WT for low-priority ones.',
    procs: [
      { pid:'P1', at:0, bt:8, pr:3 },
      { pid:'P2', at:1, bt:4, pr:1 },
      { pid:'P3', at:2, bt:9, pr:4 },
      { pid:'P4', at:3, bt:5, pr:2 },
    ]
  },
  {
    name:    'Scenario 2 – Urgency Case',
    quantum: 3,
    desc:    'Contains P_urgent (priority 1). In Priority Scheduling it runs as soon as P1\'s burst ends. In Round Robin it must wait its turn.',
    expected:'P_urgent has highest priority. Priority executes it immediately after P1 finishes. RR makes P_urgent wait for a full rotation, showing the urgency advantage of Priority Scheduling.',
    procs: [
      { pid:'P1',      at:0,  bt:12, pr:3 },
      { pid:'P2',      at:2,  bt:6,  pr:3 },
      { pid:'P3',      at:4,  bt:4,  pr:2 },
      { pid:'P_urgent',at:12, bt:2,  pr:1 },
    ]
  },
  {
    name:    'Scenario 3 – Fairness Case',
    quantum: 5,
    desc:    'RR gives every process a slice in each rotation. Priority forces P4 (lowest priority) to wait until P1, P2, P3 all finish.',
    expected:'RR distributes service fairly. Priority may cause P4 (priority 4) to wait a long time. Starvation may be detected for P4 under Priority Scheduling.',
    procs: [
      { pid:'P1', at:0,  bt:20, pr:1 },
      { pid:'P2', at:0,  bt:15, pr:2 },
      { pid:'P3', at:0,  bt:10, pr:3 },
      { pid:'P4', at:0,  bt:5,  pr:4 },
    ]
  },
  {
    name:    'Scenario 4 – Starvation Case',
    quantum: 4,
    desc:    'P_low (priority 10) is bypassed by every high-priority arrival. In Priority it waits through all 4 hi-priority jobs. In RR it gets its first slice after one rotation.',
    expected:'P_low will be starved under Priority Scheduling. RR guarantees P_low runs within the first rotation despite low priority. Starvation detection should fire for P_low in Priority.',
    procs: [
      { pid:'P_low',  at:0, bt:5, pr:10 },
      { pid:'P_hi1',  at:1, bt:8, pr:1  },
      { pid:'P_hi2',  at:2, bt:8, pr:2  },
      { pid:'P_hi3',  at:3, bt:7, pr:1  },
      { pid:'P_hi4',  at:4, bt:6, pr:2  },
    ]
  },
  {
    name:    'Scenario 5 – Validation / Invalid Input',
    quantum: null,   
    desc:    'Tests that the input validation layer catches all error types.',
    expected:'InputManager must catch ALL 7 errors plus the invalid quantum. No algorithm should execute. This scenario is shown as a validation demo only — use the Input tab to test live validation.',
    procs:   null,
    isValidationScenario: true,
    validationErrors: [
      '[P1] Arrival Time cannot be negative.',
      '[P2] Burst Time must be greater than 0.',
      '[P3] Priority must be between 1 and 99.',
      '[P1] Duplicate process ID "P1".',
      '[P4] Arrival Time must be a numeric value.',
      '[ ]  Process ID is required (non-empty string).',
      '[P5] Burst Time is required.',
      '[Quantum] Time Quantum must be a positive integer.',
    ]
  },
  {
    name:    'Scenario 6 – Tie-Breaking & CPU Idle Gap',
    quantum: 3,
    desc:    'CPU is idle from t=0 to t=3. Tests tie-breaking: P4 (priority 1) runs before P3 despite same arrival. P1 before P2 via FCFS. Both algorithms must handle the idle gap without crashing.',
    expected:'Priority: P1 runs before P2 (FCFS); P4 runs before P3 (higher priority). RR: queues by arrival. Idle gap t=0→3 must not cause infinite loop.',
    procs: [
      { pid:'P1', at:3, bt:4, pr:2 },
      { pid:'P2', at:3, bt:3, pr:2 },
      { pid:'P3', at:5, bt:2, pr:2 },
      { pid:'P4', at:5, bt:6, pr:1 },
    ]
  },
  {
    name:    'Scenario 7 – Single Process (Edge Case)',
    quantum: 5,
    desc:    'Boundary test with only one process. WT and RT should both be 0; TAT equals burst time for both algorithms.',
    expected:'Both algorithms produce WT=0, RT=0, TAT=7. Gantt chart shows one bar: [P1: 0→7]. No starvation detected.',
    procs: [
      { pid:'P1', at:0, bt:7, pr:1 },
    ]
  },
];

export function buildScenariosTab() {
  const list = document.getElementById('scenario-list');
  list.innerHTML = SCENARIOS.map((sc, idx) => {
    const bodyId  = `sc-body-${idx}`;
    const toggleId = `sc-toggle-${idx}`;

    if (sc.isValidationScenario) {
      return `
        <div class="scenario-card">
          <div class="scenario-card-header" data-action="toggle" data-idx="${idx}">
            <div>
              <div class="scenario-number">Scenario ${idx+1}</div>
              <div class="scenario-name">${sc.name}</div>
            </div>
            <div class="winner-chip invalid">⚠ Validation Only</div>
            <span class="scenario-toggle" id="${toggleId}">▼</span>
          </div>
          <div class="scenario-body" id="${bodyId}">
            <div class="scenario-expected">${sc.desc}</div>
            <p style="color:var(--muted);font-size:.82rem;margin-bottom:.75rem">${sc.expected}</p>
            <div class="validation-result">
              <div class="validation-ok-line" style="margin-bottom:.5rem">✗ Input validation FAILED — algorithms were NOT run.</div>
              <div style="margin-top:.5rem;display:flex;flex-direction:column;gap:4px">
                ${sc.validationErrors.map(e => `<div class="validation-error-line">${e}</div>`).join('')}
              </div>
            </div>
          </div>
        </div>`;
    }

    return `
      <div class="scenario-card">
        <div class="scenario-card-header" data-action="toggle" data-idx="${idx}">
          <div>
            <div class="scenario-number">Scenario ${idx+1} · Quantum = ${sc.quantum}</div>
            <div class="scenario-name">${sc.name}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <span class="scenario-toggle" id="${toggleId}">▼</span>
          </div>
        </div>
        <div class="scenario-body" id="${bodyId}">
          <div class="scenario-expected">${sc.desc}</div>
          <p style="color:var(--muted);font-size:.82rem;margin-bottom:1rem"><strong style="color:var(--accent)">Expected:</strong> ${sc.expected}</p>
          <div style="overflow-x:auto;margin-bottom:1rem">
          <table style="min-width:360px">
            <thead><tr><th>PID</th><th>AT</th><th>BT</th><th>Priority</th></tr></thead>
            <tbody>${sc.procs.map(p=>`<tr><td><span class="pid-badge">${p.pid}</span></td><td>${p.at}</td><td>${p.bt}</td><td>${p.pr}</td></tr>`).join('')}</tbody>
          </table></div>
          <button class="btn-load-scenario" data-action="load-run" data-idx="${idx}">▶ Load &amp; Run</button>
          <div id="sc-result-${idx}" class="scenario-results" style="display:none"></div>
        </div>
      </div>`;
  }).join('');
}

export function renderScenarioResultsHtml(idx, rrRes, prRes, rrStarv, prStarv) {
  const rrWinner = rrRes.avgWt < prRes.avgWt ? 'rr' : prRes.avgWt < rrRes.avgWt ? 'pr' : 'tie';
  const overallWinner = (rrRes.avgWt + rrRes.avgTat) < (prRes.avgWt + prRes.avgTat) ? 'rr' : 'pr';
  const winLabel = overallWinner === 'rr' ? 'Round Robin' : 'Priority';

  return `
    <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:1rem">
        <span style="font-size:.72rem;color:var(--muted);font-family:monospace">RESULTS</span>
        <span class="winner-chip ${overallWinner}">🏆 ${winLabel} wins overall</span>
        ${rrStarv.length ? `<span class="winner-chip invalid">⚠ RR Starvation</span>` : ''}
        ${prStarv.length ? `<span class="winner-chip invalid">⚠ Priority Starvation: ${prStarv.map(p=>p.pid).join(', ')}</span>` : ''}
      </div>
      <div style="margin-bottom:.5rem;font-size:.72rem;color:var(--rr);font-family:monospace;letter-spacing:.08em">ROUND ROBIN GANTT</div>
      <div class="scenario-gantt-mini" id="sg-rr-${idx}" style="position:relative;height:36px"></div>
      <div style="margin-top:.75rem;margin-bottom:.5rem;font-size:.72rem;color:var(--pr);font-family:monospace;letter-spacing:.08em">PRIORITY GANTT</div>
      <div class="scenario-gantt-mini" id="sg-pr-${idx}" style="position:relative;height:36px"></div>
      <div class="scenario-side-by-side" style="margin-top:1rem">
        <div>
          <div style="font-size:.68rem;color:var(--rr);font-family:monospace;margin-bottom:.5rem">⬡ ROUND ROBIN</div>
          <div class="metric-mini"><span class="mkey">Avg WT</span><span class="mval" style="color:var(--rr)">${rrRes.avgWt.toFixed(2)}</span></div>
          <div class="metric-mini"><span class="mkey">Avg TAT</span><span class="mval" style="color:var(--rr)">${rrRes.avgTat.toFixed(2)}</span></div>
          <div class="metric-mini"><span class="mkey">Avg RT</span><span class="mval" style="color:var(--rr)">${rrRes.avgRt.toFixed(2)}</span></div>
          <div class="metric-mini"><span class="mkey">Starvation</span><span class="mval" style="color:${rrStarv.length?'var(--warn)':'var(--accent)'}">${rrStarv.length?'YES ⚠':'No ✓'}</span></div>
        </div>
        <div>
          <div style="font-size:.68rem;color:var(--pr);font-family:monospace;margin-bottom:.5rem">◆ PRIORITY</div>
          <div class="metric-mini"><span class="mkey">Avg WT</span><span class="mval" style="color:var(--pr)">${prRes.avgWt.toFixed(2)}</span></div>
          <div class="metric-mini"><span class="mkey">Avg TAT</span><span class="mval" style="color:var(--pr)">${prRes.avgTat.toFixed(2)}</span></div>
          <div class="metric-mini"><span class="mkey">Avg RT</span><span class="mval" style="color:var(--pr)">${prRes.avgRt.toFixed(2)}</span></div>
          <div class="metric-mini"><span class="mkey">Starvation</span><span class="mval" style="color:${prStarv.length?'var(--warn)':'var(--accent)'}">${prStarv.length?'YES ⚠':'No ✓'}</span></div>
        </div>
      </div>
      <div style="margin-top:1rem;display:flex;gap:10px;flex-wrap:wrap">
        ${['WT','TAT','RT'].map(m => {
          const rrV = m==='WT'?rrRes.avgWt:m==='TAT'?rrRes.avgTat:rrRes.avgRt;
          const prV = m==='WT'?prRes.avgWt:m==='TAT'?prRes.avgTat:prRes.avgRt;
          const w   = rrV < prV ? 'rr' : prV < rrV ? 'pr' : 'tie';
          const lbl = w==='rr'?'RR':w==='pr'?'PRI':'Tie';
          return `<span style="font-family:monospace;font-size:.72rem;color:var(--muted)">${m}: <span style="color:var(--${w==='tie'?'accent':w})">${lbl} (${Math.min(rrV,prV).toFixed(2)})</span></span>`;
        }).join('')}
      </div>
    </div>
  `;
}