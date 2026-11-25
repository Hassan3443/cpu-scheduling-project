import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateFCFS } from '../modules/algorithms/fcfs.js';
import { simulateSJF, simulateSRTF } from '../modules/algorithms/sjf.js';
import { simulateRR } from '../modules/algorithms/roundRobin.js';
import { simulatePriority } from '../modules/algorithms/priority.js';
import { reference, expand, rng, randomWorkload } from './reference.js';

const ALGOS = [
  ['fcfs', 'FCFS', p => simulateFCFS(p)],
  ['sjf', 'SJF', p => simulateSJF(p)],
  ['srtf', 'SRTF', p => simulateSRTF(p)],
  ['pr', 'Priority', p => simulatePriority(p)],
  ['rr', 'Round Robin', (p, q) => simulateRR(p, q)]
];

for (const [key, name, run] of ALGOS) {
  test(`${name}: 1500 random workloads match the independent per-tick reference`, () => {
    const rand = rng(1000 + key.length * 7 + key.charCodeAt(0));
    for (let i = 0; i < 1500; i++) {
      const procs = randomWorkload(rand);
      const q = 1 + Math.floor(rand() * 6);
      const real = run(procs, q);
      const ref = reference(procs, key, q);
      const msg = `${name} workload ${JSON.stringify(procs)} q=${q}`;
      assert.deepEqual(expand(real.timeline), ref.ticks, `${msg}: schedule differs`);
      for (const m of real.metrics) {
        const r = ref.metrics.find(x => x.pid === m.pid);
        assert.equal(m.tat, r.tat, `${msg}: tat ${m.pid}`);
        assert.equal(m.wt, r.wt, `${msg}: wt ${m.pid}`);
        assert.equal(m.rt, r.rt, `${msg}: rt ${m.pid}`);
      }
    }
  });
}
