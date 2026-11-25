import { runGeneric } from './common.js';

// Preemptive priority scheduling: the lowest number is the most urgent.
// Ties go to the earlier arrival, then to input order. Idle gaps appear in the
// timeline like in every other algorithm.
export function simulatePriority(procs) {
  return runGeneric(
    procs,
    av => [...av].sort((a, b) => a.pr - b.pr || a.at - b.at || a.idx - b.idx)[0],
    true
  );
}
