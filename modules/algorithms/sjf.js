import { runGeneric } from './common.js';

// Shortest Job First (non-preemptive): smallest burst among arrived processes.
export function simulateSJF(procs) {
  return runGeneric(
    procs,
    av => [...av].sort((a, b) => a.bt - b.bt || a.at - b.at || a.idx - b.idx)[0],
    false
  );
}

// Shortest Remaining Time First (preemptive SJF).
export function simulateSRTF(procs) {
  return runGeneric(
    procs,
    av => [...av].sort((a, b) => a.rem - b.rem || a.at - b.at || a.idx - b.idx)[0],
    true
  );
}
