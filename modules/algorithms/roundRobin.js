export function simulateRR(procs, quantum) {
  const ps     = procs.map(p => ({ ...p, rem: p.bt, wt: 0, tat: 0, rt: -1 }));
  const sorted = [...ps].sort((a, b) => a.at - b.at || procs.indexOf(procs.find(x => x.pid === a.pid)) - procs.indexOf(procs.find(x => x.pid === b.pid)));
  let timeline = [], time = 0, queue = [], done = 0, idx = 0;
  const n = sorted.length;
  let queueSnapshot = [];

  if (sorted[0].at > 0) time = sorted[0].at;

  while (done < n) {
    while (idx < n && sorted[idx].at <= time) queue.push(sorted[idx++]);

    if (!queue.length) {
      time = sorted[idx].at;
      continue;
    }

    const curr = queue.shift();
    if (curr.rt === -1) curr.rt = time - curr.at;

    const run = Math.min(quantum, curr.rem);
    timeline.push({ pid: curr.pid, start: time, end: time + run });
    time    += run;
    curr.rem -= run;

    while (idx < n && sorted[idx].at <= time) queue.push(sorted[idx++]);

    if (curr.rem > 0) {
      queue.push(curr);
    } else {
      curr.tat = time - curr.at;
      curr.wt  = curr.tat - curr.bt;
      done++;
    }

    if (!queueSnapshot.length && queue.length) queueSnapshot = queue.map(p => p.pid);
  }

  const metrics = sorted.map(p => ({ pid:p.pid, at:p.at, bt:p.bt, pr:p.pr, wt:p.wt, tat:p.tat, rt:p.rt }));
  const avgWt  = metrics.reduce((s,p) => s + p.wt,  0) / n;
  const avgTat = metrics.reduce((s,p) => s + p.tat, 0) / n;
  const avgRt  = metrics.reduce((s,p) => s + p.rt,  0) / n;

  return { timeline, metrics, avgWt, avgTat, avgRt, queueSnapshot };
}