import { prepare, pushSlice, finish, LIMITS } from './common.js';

// Round Robin. A process that arrives while another one is running joins the
// queue before the preempted process goes back to its end (the usual textbook
// convention). `queueSnapshot` is the ready queue the first time it is non-empty.
export function simulateRR(procs, quantum) {
  if (!Number.isSafeInteger(quantum) || quantum < 1 || quantum > LIMITS.maxQuantum) throw new RangeError(`quantum must be a whole number from 1 to ${LIMITS.maxQuantum}`);
  const ps = prepare(procs);
  const sorted = [...ps].sort((a, b) => a.at - b.at || a.idx - b.idx);
  const n = sorted.length;
  const timeline = [];
  const queue = [];
  let time = sorted[0].at, done = 0, next = 0, queueSnapshot = [];
  const admit = () => { while (next < n && sorted[next].at <= time) queue.push(sorted[next++]); };

  while (done < n) {
    admit();
    if (!queue.length) {               // CPU idle until the next arrival
      pushSlice(timeline, 'IDLE', time, sorted[next].at);
      time = sorted[next].at;
      continue;
    }
    const cur = queue.shift();
    if (cur.rt === -1) cur.rt = time - cur.at;
    const run = Math.min(quantum, cur.rem);
    // slices are kept separate (not merged) so every quantum shows on the chart
    timeline.push({ pid: cur.pid, start: time, end: time + run });
    time += run;
    cur.rem -= run;
    admit();
    if (cur.rem > 0) queue.push(cur);
    else { cur.tat = time - cur.at; cur.wt = cur.tat - cur.bt; done++; }
    if (!queueSnapshot.length && queue.length) queueSnapshot = queue.map(p => p.pid);
  }
  return { ...finish(ps, timeline), queueSnapshot };
}
