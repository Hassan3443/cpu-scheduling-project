// Shared helpers for the time-stepped algorithms (FCFS, SJF, SRTF).

// One set of limits for the engine, the editor, and shared links, so every setup a person
// can build also opens from its link and can never make the engine run for ages.
export const LIMITS = { maxProcs: 30, maxTime: 999, maxPriority: 99, maxQuantum: 99, maxPidLen: 12 };
export const PID_RE = /^[A-Za-z0-9_-]{1,12}$/;
const isInt = v => Number.isSafeInteger(v);

// Throws a RangeError on input that would make a simulation wrong or endless.
export function validateProcesses(procs) {
  if (!Array.isArray(procs) || !procs.length) throw new RangeError('add at least one process');
  if (procs.length > LIMITS.maxProcs) throw new RangeError(`at most ${LIMITS.maxProcs} processes`);
  const seen = new Set();
  for (const p of procs) {
    if (typeof p.pid !== 'string' || !PID_RE.test(p.pid)) throw new RangeError('process ids must be 1 to 12 letters, digits, _ or -');
    const key = p.pid.toLowerCase();
    if (key === 'idle') throw new RangeError('IDLE is reserved for idle time and cannot be a process id');
    if (seen.has(key)) throw new RangeError('process ids must be unique (case does not matter)');
    seen.add(key);
    if (!isInt(p.at) || p.at < 0 || p.at > LIMITS.maxTime) throw new RangeError(`${p.pid}: arrival must be a whole number from 0 to ${LIMITS.maxTime}`);
    if (!isInt(p.bt) || p.bt < 1 || p.bt > LIMITS.maxTime) throw new RangeError(`${p.pid}: burst must be a whole number from 1 to ${LIMITS.maxTime}`);
  }
}

// Priority is only used by the priority algorithm, so only that one requires it.
export function validatePriorities(procs) {
  for (const p of procs) {
    if (!isInt(p.pr) || p.pr < 1 || p.pr > LIMITS.maxPriority) throw new RangeError(`${p.pid}: priority must be a whole number from 1 to ${LIMITS.maxPriority}`);
  }
}

// Times the CPU moved from one process to a different one. Idle gaps do not count,
// and consecutive slices of the same process (Round Robin) are not a switch.
export function countSwitches(timeline) {
  let n = 0, last = null;
  for (const seg of timeline) {
    if (seg.pid === 'IDLE') continue;
    if (last !== null && seg.pid !== last) n++;
    last = seg.pid;
  }
  return n;
}

export function prepare(procs) {
  validateProcesses(procs);
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
    contextSwitches: countSwitches(timeline)
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
