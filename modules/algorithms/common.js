// Shared helpers for the time-stepped algorithms (FCFS, SJF, SRTF).

export function prepare(procs) {
  return procs.map((p, idx) => ({ ...p, rem: p.bt, wt: 0, tat: 0, rt: -1, idx }));
}

// Merge consecutive one-unit slices of the same process into one segment.
export function pushSlice(timeline, pid, start, end) {
  const last = timeline[timeline.length - 1];
  if (last && last.pid === pid && last.end === start) last.end = end;
  else timeline.push({ pid, start, end });
}

export function finish(ps, timeline) {
  const metrics = [...ps]
    .sort((a, b) => a.at - b.at || a.idx - b.idx)
    .map(p => ({ pid: p.pid, at: p.at, bt: p.bt, pr: p.pr, wt: p.wt, tat: p.tat, rt: p.rt }));
  const n = metrics.length;
  const avg = key => metrics.reduce((s, p) => s + p[key], 0) / n;
  const busy = timeline.reduce((s, t) => s + (t.pid === 'IDLE' ? 0 : t.end - t.start), 0);
  const total = timeline.length ? timeline[timeline.length - 1].end - timeline[0].start : 0;
  return {
    timeline,
    metrics,
    avgWt: avg('wt'),
    avgTat: avg('tat'),
    avgRt: avg('rt'),
    cpuUtilization: total ? busy / total : 0,
    contextSwitches: Math.max(0, timeline.filter(t => t.pid !== 'IDLE').length - 1)
  };
}

// Generic run loop. `pick(available, time)` chooses the next process.
// preemptive = true re-picks every time unit, false runs the pick to completion.
export function runGeneric(procs, pick, preemptive) {
  const ps = prepare(procs);
  const timeline = [];
  let time = Math.min(...ps.map(p => p.at));
  let done = 0;
  while (done < ps.length) {
    const available = ps.filter(p => p.at <= time && p.rem > 0);
    if (!available.length) {
      const next = Math.min(...ps.filter(p => p.rem > 0).map(p => p.at));
      pushSlice(timeline, 'IDLE', time, next);
      time = next;
      continue;
    }
    const cur = pick(available, time);
    if (cur.rt === -1) cur.rt = time - cur.at;
    const run = preemptive ? 1 : cur.rem;
    pushSlice(timeline, cur.pid, time, time + run);
    time += run;
    cur.rem -= run;
    if (cur.rem === 0) {
      done++;
      cur.tat = time - cur.at;
      cur.wt = cur.tat - cur.bt;
    }
  }
  return finish(ps, timeline);
}
