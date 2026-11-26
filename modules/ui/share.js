// Shareable setups: the whole workload fits in the URL hash.
// Format: #q=4&p=P1.0.8.3~P2.1.4.1   (pid.arrival.burst.priority)
import { LIMITS, validateProcesses, validatePriorities } from '../algorithms/common.js';

export function encodeSetup(procs, quantum) {
  return 'q=' + quantum + '&p=' + procs.map(p => [p.pid, p.at, p.bt, p.pr].join('.')).join('~');
}

// Returns { procs, quantum } or null when the text is not a valid setup.
export function decodeSetup(text) {
  try {
    const params = new URLSearchParams(String(text).replace(/^#/, ''));
    const q = params.get('q'), raw = params.get('p');
    if (!raw || !/^\d{1,3}$/.test(q || '')) return null;
    const quantum = Number(q);
    if (quantum < 1 || quantum > LIMITS.maxQuantum) return null;
    const rows = raw.split('~');
    if (rows.length > LIMITS.maxProcs) return null;
    const procs = [];
    for (const r of rows) {
      const [pid, at, bt, pr, extra] = r.split('.');
      if (extra !== undefined || ![at, bt, pr].every(v => /^\d{1,4}$/.test(v || ''))) return null;
      procs.push({ pid, at: +at, bt: +bt, pr: +pr });
    }
    // the same rules as the editor and the engine: ids, limits, reserved IDLE, case-insensitive uniqueness
    validateProcesses(procs); validatePriorities(procs);
    return { procs, quantum };
  } catch { return null; }
}
