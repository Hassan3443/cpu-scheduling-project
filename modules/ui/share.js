// Shareable setups: the whole workload fits in the URL hash.
// Format: #q=4&p=P1.0.8.3~P2.1.4.1   (pid.arrival.burst.priority)
const PID = /^[A-Za-z0-9_-]{1,12}$/;

export function encodeSetup(procs, quantum) {
  return 'q=' + quantum + '&p=' + procs.map(p => [p.pid, p.at, p.bt, p.pr].join('.')).join('~');
}

// Returns { procs, quantum } or null when the text is not a valid setup.
export function decodeSetup(text) {
  try {
    const params = new URLSearchParams(String(text).replace(/^#/, ''));
    const quantum = Number(params.get('q'));
    const raw = params.get('p');
    if (!raw || !Number.isInteger(quantum) || quantum < 1 || quantum > 99) return null;
    const rows = raw.split('~');
    if (rows.length > 30) return null;
    const seen = new Set();
    const procs = [];
    for (const r of rows) {
      const [pid, at, bt, pr, extra] = r.split('.');
      if (extra !== undefined || !PID.test(pid || '') || seen.has(pid)) return null;
      const n = [at, bt, pr].map(Number);
      if (![at, bt, pr].every(v => /^\d+$/.test(v || ''))) return null;
      if (n[0] > 999 || n[1] < 1 || n[1] > 999 || n[2] < 1 || n[2] > 99) return null;
      seen.add(pid);
      procs.push({ pid, at: n[0], bt: n[1], pr: n[2] });
    }
    return { procs, quantum };
  } catch { return null; }
}
