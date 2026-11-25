// One-click example workloads. Every note is something you can check on the Timeline tab.
export const PRESETS = [
  { name: 'Classic example', note: '4 processes, mixed lengths and priorities', quantum: 4,
    procs: [{ pid: 'P1', at: 0, bt: 8, pr: 3 }, { pid: 'P2', at: 1, bt: 4, pr: 1 }, { pid: 'P3', at: 2, bt: 9, pr: 4 }, { pid: 'P4', at: 3, bt: 5, pr: 2 }] },
  { name: 'Long job first', note: 'Short jobs queue behind one long job (FCFS suffers)', quantum: 3,
    procs: [{ pid: 'P1', at: 0, bt: 20, pr: 3 }, { pid: 'P2', at: 1, bt: 2, pr: 2 }, { pid: 'P3', at: 2, bt: 3, pr: 2 }, { pid: 'P4', at: 3, bt: 2, pr: 1 }] },
  { name: 'Urgent job arrives late', note: 'Priority and SRTF preempt the running process', quantum: 2,
    procs: [{ pid: 'P1', at: 0, bt: 10, pr: 3 }, { pid: 'P2', at: 2, bt: 3, pr: 1 }, { pid: 'P3', at: 4, bt: 2, pr: 2 }] },
  { name: 'CPU sits idle', note: 'A gap between jobs shows as IDLE', quantum: 2,
    procs: [{ pid: 'P1', at: 0, bt: 3, pr: 1 }, { pid: 'P2', at: 10, bt: 4, pr: 2 }, { pid: 'P3', at: 11, bt: 2, pr: 1 }] },
  { name: 'All arrive together', note: 'Same arrival time, different burst and priority', quantum: 3,
    procs: [{ pid: 'P1', at: 0, bt: 6, pr: 2 }, { pid: 'P2', at: 0, bt: 3, pr: 1 }, { pid: 'P3', at: 0, bt: 8, pr: 4 }, { pid: 'P4', at: 0, bt: 2, pr: 3 }] },
  { name: 'Low priority waits', note: 'P4 is least urgent and runs last under Priority', quantum: 2,
    procs: [{ pid: 'P1', at: 0, bt: 4, pr: 1 }, { pid: 'P2', at: 1, bt: 4, pr: 1 }, { pid: 'P3', at: 2, bt: 4, pr: 1 }, { pid: 'P4', at: 0, bt: 2, pr: 5 }] }
];
