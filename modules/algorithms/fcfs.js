import { runGeneric } from './common.js';

// First Come First Served: non-preemptive, earliest arrival first.
export function simulateFCFS(procs) {
  return runGeneric(procs, av => [...av].sort((a, b) => a.at - b.at || a.idx - b.idx)[0], false);
}
