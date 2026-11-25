import test from 'node:test';
import assert from 'node:assert/strict';
import { stateAt } from '../modules/ui/cpuDiagram.js';
import { simulateRR } from '../modules/algorithms/roundRobin.js';

const P = [{ pid: 'P1', at: 0, bt: 5, pr: 1 }, { pid: 'P2', at: 2, bt: 3, pr: 1 }];
test('diagram state follows the real timeline (RR q=2)', () => {
  const tl = simulateRR(P, 2).timeline;   // A 0-2, B 2-4, A 4-6, B 6-7, A 7-8
  const at = t => Object.fromEntries(stateAt(P, tl, t).map(s => [s.pid, s.status + ':' + s.rem]));
  assert.deepEqual(at(0), { P1: 'running:5', P2: 'incoming:3' });
  assert.deepEqual(at(2), { P1: 'ready:3', P2: 'running:3' });
  assert.deepEqual(at(5), { P1: 'running:2', P2: 'ready:1' });
  assert.deepEqual(at(8), { P1: 'done:0', P2: 'done:0' });
});
