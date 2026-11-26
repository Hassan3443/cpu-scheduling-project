import { overallWinner } from '../analysis/analysis.js';
export const SCENARIOS = [
  {
    name:    'Scenario 1 – Basic Workload',
    quantum: 4,
    desc: 'A normal mixed workload with 4 processes of varying burst and priority. Tests fundamental behaviour of both algorithms.',
    expected: 'Priority is preemptive, so P1 runs first (0-1), then P2 (1-5), P4 (5-10), the rest of P1 (10-17) and P3 (17-26). Round Robin rotates P1, P2, P3, P4 in slices of 4. Priority has the lower average wait (6.50 vs 11.75) and waits less or the same for every process (P1 9 vs 12, P2 0 vs 3, P3 15 vs 15, P4 2 vs 17).',
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
    desc: 'Contains P_urgent (priority 1), which arrives at t=12. Under Priority it takes the CPU the moment it arrives, even though P1 still has 4 units left. In Round Robin it queues behind P2 and P1 and waits its turn.',
    expected: 'Priority: P1 0-4, P3 4-8, P1 8-12, P_urgent 12-14 (waits 0), P1 14-18, P2 18-24. Round Robin: P_urgent waits 6 units and runs 18-20. Priority has the lower average wait (5.50 vs 9.50), but P2 waits longer under Priority (16 vs 7).',
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
    desc: 'All four processes arrive at t=0. Round Robin gives each a slice per rotation. Priority runs them one after another in priority order, so the lowest priority waits for all the others.',
    expected: 'The two algorithms tie exactly on average wait (25.00) and average turnaround (37.50). Priority is much less even: P1 waits 0 and P4 waits 45. Under Priority, P3 and P4 wait more than 20 units. Under Round Robin, P1, P2 and P3 also exceed 20, because this workload is long (50 units in total).',
    procs: [
      { pid:'P1', at:0,  bt:20, pr:1 },
      { pid:'P2', at:0,  bt:15, pr:2 },
      { pid:'P3', at:0,  bt:10, pr:3 },
      { pid:'P4', at:0,  bt:5,  pr:4 },
    ]
  },
  {
    name:    'Scenario 4 – Low-Priority Starvation Case',
    quantum: 4,
    desc: 'P_low (priority 10) arrives first and runs for one unit, then every high-priority arrival goes ahead of it. Under Priority it resumes only after all four high-priority jobs finish.',
    expected: 'Priority: P_low runs 0-1, then waits until t=30 and finishes at 34 (wait 29, over the 20-unit line). Round Robin: P_low gets its slices at 0-4 and 20-21 (wait 16), but P_hi3 and P_hi4 wait 22 and 24. Priority has the lower averages (average wait 13.80 vs 19.40).',
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
    name:    'Scenario 6 – Tie-Breaking & Late First Arrival',
    quantum: 3,
    desc: 'Tie-breaking with a late first arrival: nothing arrives before t=3, so the timeline starts at t=3 and no idle bar is drawn. P1 and P2 arrive together with equal priority. P3 and P4 arrive together at t=5, and P4 has the higher priority.',
    expected: 'Priority: P1 runs before P2 (same priority, earlier in the list), and P4 preempts P1 at t=5 and finishes first (5-11). Round Robin queues by arrival order: P1, P2, P3, P4. Round Robin has the lower averages here (average wait 5.50 vs 6.75).',
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
    expected: 'Both algorithms produce WT=0, RT=0, TAT=7 and tie overall. The chart shows one bar [P1: 0→7] (Round Robin runs it as two slices of 5 and 2, drawn merged). No long wait.',
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
  const overall = overallWinner(rrRes, prRes);
  const winText = overall === 'rr' ? '🏆 Round Robin wins overall' : overall === 'pr' ? '🏆 Priority wins overall' : '⚖ Tied overall';

  return `
    <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:1rem">
        <span style="font-size:.72rem;color:var(--muted);font-family:monospace">RESULTS</span>
        <span class="winner-chip ${overall === 'tie' ? 'invalid' : overall}">${winText}</span>
        ${rrStarv.length ? `<span class="winner-chip invalid">⚠ RR long waits: ${rrStarv.map(p=>p.pid).join(', ')}</span>` : ''}
        ${prStarv.length ? `<span class="winner-chip invalid">⚠ Priority long waits: ${prStarv.map(p=>p.pid).join(', ')}</span>` : ''}
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
          <div class="metric-mini"><span class="mkey">Long wait (&gt;20)</span><span class="mval" style="color:${rrStarv.length?'var(--warn)':'var(--accent)'}">${rrStarv.length?'YES ⚠':'No ✓'}</span></div>
        </div>
        <div>
          <div style="font-size:.68rem;color:var(--pr);font-family:monospace;margin-bottom:.5rem">◆ PRIORITY</div>
          <div class="metric-mini"><span class="mkey">Avg WT</span><span class="mval" style="color:var(--pr)">${prRes.avgWt.toFixed(2)}</span></div>
          <div class="metric-mini"><span class="mkey">Avg TAT</span><span class="mval" style="color:var(--pr)">${prRes.avgTat.toFixed(2)}</span></div>
          <div class="metric-mini"><span class="mkey">Avg RT</span><span class="mval" style="color:var(--pr)">${prRes.avgRt.toFixed(2)}</span></div>
          <div class="metric-mini"><span class="mkey">Long wait (&gt;20)</span><span class="mval" style="color:${prStarv.length?'var(--warn)':'var(--accent)'}">${prStarv.length?'YES ⚠':'No ✓'}</span></div>
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