export function showErr(id, msg) {
  const el  = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  const inp = document.getElementById(id.replace('err-','inp-'));
  if (inp) inp.classList.add('invalid');
}

export function clearErr(id) {
  const el  = document.getElementById(id);
  if (!el) return;
  el.classList.remove('show');
  const inp = document.getElementById(id.replace('err-','inp-'));
  if (inp) inp.classList.remove('invalid');
}

export function switchTab(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('sec-' + name).classList.add('active');
  const tabs = ['input','gantt','results','summary','scenarios'];
  document.querySelectorAll('.tab')[tabs.indexOf(name)].classList.add('active');
}