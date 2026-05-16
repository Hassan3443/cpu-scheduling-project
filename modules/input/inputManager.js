import { showErr, clearErr } from '../ui/inputUI.js';

export let processes = [];

export function getProcesses() {
  return processes;
}

export function setProcesses(newProcs) {
  processes = newProcs;
}

export function removeProcess(pid) {
  processes = processes.filter(p => p.pid !== pid);
}

export function clearAllProcesses() {
  processes = [];
}

export function loadDemoData() {
  processes = [
    { pid:'P1', at:0, bt:8, pr:3 },
    { pid:'P2', at:1, bt:4, pr:1 },
    { pid:'P3', at:2, bt:9, pr:4 },
    { pid:'P4', at:3, bt:5, pr:2 },
  ];
}

export function handleAddProcess() {
  ['err-pid','err-at','err-bt','err-pr'].forEach(clearErr);
  document.getElementById('global-err').classList.remove('show');

  const pidInput = document.getElementById('inp-pid');
  const atInput  = document.getElementById('inp-at');
  const btInput  = document.getElementById('inp-bt');
  const prInput  = document.getElementById('inp-pr');

  const pid = pidInput.value.trim();
  const at  = atInput.value.trim();
  const bt  = btInput.value.trim();
  const pr  = prInput.value.trim();

  let valid = true;

  if (!pid) { showErr('err-pid','Process ID cannot be empty.'); valid = false; }
  else if (processes.some(p => p.pid.toLowerCase() === pid.toLowerCase())) { showErr('err-pid','Duplicate Process ID.'); valid = false; }
  else if (!/^[A-Za-z0-9_-]+$/.test(pid)) { showErr('err-pid','Use only letters, numbers, _, -'); valid = false; }

  if (at === '') { showErr('err-at','Required.'); valid = false; }
  else if (isNaN(at) || !Number.isInteger(+at)) { showErr('err-at','Must be an integer.'); valid = false; }
  else if (+at < 0) { showErr('err-at','Cannot be negative.'); valid = false; }

  if (bt === '') { showErr('err-bt','Required.'); valid = false; }
  else if (isNaN(bt) || !Number.isInteger(+bt)) { showErr('err-bt','Must be an integer.'); valid = false; }
  else if (+bt <= 0) { showErr('err-bt','Must be > 0.'); valid = false; }

  if (pr === '') { showErr('err-pr','Required.'); valid = false; }
  else if (isNaN(pr) || !Number.isInteger(+pr)) { showErr('err-pr','Must be an integer.'); valid = false; }
  else if (+pr < 1 || +pr > 99) { showErr('err-pr','Must be 1–99.'); valid = false; }

  if (!valid) return false;

  processes.push({ pid, at: +at, bt: +bt, pr: +pr });
  
  // Clear inputs
  pidInput.value = '';
  atInput.value = '';
  btInput.value = '';
  prInput.value = '';
  pidInput.focus();

  return true;
}