export function simulatePriority(procs) {
  const ps = procs.map((p, i) => ({
    ...p,
    rem: p.bt,
    wt: 0,
    tat: 0,
    rt: -1,
    idx: i
  }));

  const sorted = [...ps].sort(
    (a, b) => a.at - b.at || a.idx - b.idx
  );

  let timeline = [];
  let time = 0;
  let done = 0;
  const n = sorted.length;

  while (done < n) {
    const available = sorted.filter(
      p => p.at <= time && p.rem > 0
    );

    if (!available.length) {
      time++;
      continue;
    }

    available.sort(
      (a, b) =>
        a.pr - b.pr ||
        a.at - b.at ||
        a.idx - b.idx
    );

    const curr = available[0];

    if (curr.rt === -1) {
      curr.rt = time - curr.at;
    }

    const last = timeline[timeline.length - 1];

    if (last && last.pid === curr.pid) {
      last.end++;
    } else {
      timeline.push({
        pid: curr.pid,
        start: time,
        end: time + 1
      });
    }

    curr.rem--;
    time++;

    if (curr.rem === 0) {
      done++;
      curr.tat = time - curr.at;
      curr.wt = curr.tat - curr.bt;
    }
  }

  const metrics = sorted.map(p => ({
    pid: p.pid,
    at: p.at,
    bt: p.bt,
    pr: p.pr,
    wt: p.wt,
    tat: p.tat,
    rt: p.rt
  }));

  const avgWt =
    metrics.reduce((s, p) => s + p.wt, 0) / n;

  const avgTat =
    metrics.reduce((s, p) => s + p.tat, 0) / n;

  const avgRt =
    metrics.reduce((s, p) => s + p.rt, 0) / n;

  return {
    timeline,
    metrics,
    avgWt,
    avgTat,
    avgRt
  };
}