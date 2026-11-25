import test from 'node:test';
import assert from 'node:assert/strict';
import { stateAt } from '../modules/ui/cpuDiagram.js';
import { simulateRR } from '../modules/algorithms/roundRobin.js';

const P = [{ pid: 'A', at: 0, bt: 5, pr: 1 }, { pid: 'B', at: 2, bt: 3, pr: 1 }];
test('diagram state follows the real timeline (RR q=2)', () => {
  const tl = simulateRR(P, 2).timeline;   // A 0-2, B 2-4, A 4-6, B 6-7, A 7-8
  const at = t => Object.fromEntries(stateAt(P, tl, t).map(s => [s.pid, s.status + ':' + s.rem]));
  assert.deepEqual(at(0), { A: 'running:5', B: 'incoming:3' });
  assert.deepEqual(at(2), { A: 'ready:3', B: 'running:3' });
  assert.deepEqual(at(5), { A: 'running:2', B: 'ready:1' });
  assert.deepEqual(at(8), { A: 'done:0', B: 'done:0' });
});
