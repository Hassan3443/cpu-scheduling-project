import { simulateRR } from '../algorithms/roundRobin.js';
import { simulatePriority } from '../algorithms/priority.js';
import { simulateFCFS } from '../algorithms/fcfs.js';
import { simulateSJF, simulateSRTF } from '../algorithms/sjf.js';

export const ALGORITHMS = [
  { key: 'fcfs', name: 'FCFS', run: (p) => simulateFCFS(p) },
  { key: 'sjf', name: 'SJF', run: (p) => simulateSJF(p) },
  { key: 'srtf', name: 'SRTF', run: (p) => simulateSRTF(p) },
  { key: 'rr', name: 'Round Robin', run: (p, q) => simulateRR(p, q) },
  { key: 'pr', name: 'Priority (preemptive)', run: (p) => simulatePriority(p) }
];

// Context switches and utilisation are computed from the timeline for every
// algorithm, so Round Robin and Priority are measured the same way as the rest.
export function summarise(result) {
  const segs = result.timeline.filter(t => t.pid !== 'IDLE');
  const busy = segs.reduce((s, t) => s + t.end - t.start, 0);
  const total = result.timeline.length
    ? result.timeline[result.timeline.length - 1].end - result.timeline[0].start : 0;
  let switches = 0;
  for (let i = 1; i < segs.length; i++) if (segs[i].pid !== segs[i - 1].pid) switches++;
  return {
    avgWt: result.avgWt, avgTat: result.avgTat, avgRt: result.avgRt,
    cpuUtilization: total ? busy / total : 0,
    contextSwitches: switches
  };
}

export function compareAll(procs, quantum) {
  return ALGORITHMS.map(a => {
    const result = a.run(procs, quantum);
    return { key: a.key, name: a.name, result, ...summarise(result) };
  });
}

export function best(rows, key) {
  return rows.reduce((b, r) => (r[key] < b[key] ? r : b), rows[0]);
}
