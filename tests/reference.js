// Independent reference simulator used only by the tests. It advances one time
// unit at a time and shares no code with modules/algorithms. Its output is a
// per-tick schedule (who ran in [t, t+1)), which is compared to the real timelines.
export function reference(procs, algo, quantum = 1) {
  const P = procs.map((p, idx) => ({ ...p, idx, rem: p.bt, first: -1, ct: -1 }));
  const ticks = [];
  let t = 0, left = P.length;
  const arrived = () => P.filter(p => p.at <= t && p.rem > 0);
  const by = cmp => list => [...list].sort(cmp)[0];
  const rules = {
    fcfs: by((a, b) => a.at - b.at || a.idx - b.idx),
    sjf: by((a, b) => a.bt - b.bt || a.at - b.at || a.idx - b.idx),
    srtf: by((a, b) => a.rem - b.rem || a.at - b.at || a.idx - b.idx),
    pr: by((a, b) => a.pr - b.pr || a.at - b.at || a.idx - b.idx)
  };
  const run = (p) => {
    if (p.first < 0) p.first = t;
    p.rem--; ticks.push(p.pid); t++;
    if (p.rem === 0) { p.ct = t; left--; }
  };
  if (algo === 'rr') {
    const q = [];
    let admitted = new Set();
    let cur = null, used = 0;
    while (left > 0) {
      for (const p of P) if (p.at === t && !admitted.has(p.idx)) { q.push(p); admitted.add(p.idx); }
      // a late first arrival (t jumped) is covered because we step one tick at a time
      if (cur && used === quantum && cur.rem > 0) { q.push(cur); cur = null; used = 0; }
      if (cur && cur.rem === 0) { cur = null; used = 0; }
      if (!cur && q.length) { cur = q.shift(); used = 0; }
      if (!cur) { ticks.push('IDLE'); t++; continue; }
      run(cur); used++;
      if (cur.rem === 0) { cur = null; used = 0; }
    }
  } else {
    const pick = rules[algo];
    let cur = null;
    while (left > 0) {
      const av = arrived();
      if (!av.length) { ticks.push('IDLE'); t++; continue; }
      if (algo === 'fcfs' || algo === 'sjf') { if (!cur || cur.rem === 0) cur = pick(av); }
      else cur = pick(av);
      run(cur);
    }
  }
  // trim leading IDLE: the real timelines start at the first arrival
  const lead = ticks.findIndex(x => x !== 'IDLE');
  const start = lead < 0 ? 0 : lead;
  const metrics = P.map(p => ({ pid: p.pid, tat: p.ct - p.at, wt: p.ct - p.at - p.bt, rt: p.first - p.at, ct: p.ct }));
  return { ticks: ticks.slice(start), start, metrics };
}

// Expand a real timeline into the same per-tick form.
export function expand(timeline) {
  const out = [];
  for (const s of timeline) for (let i = s.start; i < s.end; i++) out.push(s.pid);
  return out;
}

export function rng(seed) { return () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; }

export function randomWorkload(rand, maxN = 8, maxAt = 12, maxBt = 9) {
  const n = 1 + Math.floor(rand() * maxN);
  return Array.from({ length: n }, (_, k) => ({
    pid: 'P' + (k + 1), at: Math.floor(rand() * (maxAt + 1)), bt: 1 + Math.floor(rand() * maxBt), pr: 1 + Math.floor(rand() * 5)
  }));
}
