// Press-and-hold steppers and drag-to-scrub for number fields.
// Works on any .nf wrapper: [data-nf="-1"|"1"] buttons around one number input.
const clamp = (inp, v) => {
  const min = inp.min === '' ? -Infinity : +inp.min, max = inp.max === '' ? Infinity : +inp.max;
  return Math.max(min, Math.min(max, v));
};
export function setField(inp, v) {
  v = clamp(inp, v);
  if (String(v) === inp.value) return;
  inp.value = String(v);
  inp.dispatchEvent(new Event('input', { bubbles: true }));
}

export function initNumberFields() {
  if (typeof document === 'undefined') return;
  // single step on click
  document.addEventListener('click', e => {
    const b = e.target.closest('.nf-b[data-nf]');
    if (!b) return;
    if (b.dataset.skip) { delete b.dataset.skip; return; }
    const inp = b.parentElement.querySelector('input');
    setField(inp, (parseInt(inp.value, 10) || 0) + (+b.dataset.nf));
  });
  // hold to repeat (also for the quantum buttons, which have their own click handlers)
  let t1 = null, t2 = null, held = null;
  const stop = () => { clearTimeout(t1); clearInterval(t2); if (held) { held.dataset.skip = '1'; setTimeout(() => { if (held) delete held.dataset.skip; held = null; }, 0); } t1 = t2 = null; };
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('.nf-b');
    if (!b || b.disabled) return;
    t1 = setTimeout(() => {
      let n = 0; held = b;
      t2 = setInterval(() => { n++; b.dataset.skip = ''; delete b.dataset.skip; b.click(); if (n === 12) { clearInterval(t2); t2 = setInterval(() => b.click(), 40); } }, 100);
    }, 420);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => document.addEventListener(ev, e => { if (t1 || t2) stop(); }, true));
  // drag the value left or right to change it
  let drag = null;
  document.addEventListener('pointerdown', e => {
    const inp = e.target.closest('.nf input');
    if (!inp || e.button > 0) return;
    drag = { inp, x: e.clientX, base: parseInt(inp.value, 10) || 0, on: false, id: e.pointerId };
  });
  document.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.on && Math.abs(dx) > 6) { drag.on = true; drag.inp.blur(); document.body.classList.add('nf-scrub'); }
    if (drag.on) setField(drag.inp, drag.base + Math.round(dx / 10));
  });
  const end = () => { if (drag && drag.on) document.body.classList.remove('nf-scrub'); drag = null; };
  document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
}
