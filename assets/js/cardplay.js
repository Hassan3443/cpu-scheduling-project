// Per-card playback for the Round Robin and Priority Gantt cards.
// Idle cards are fully drawn. Play animates only that card; starting one stops the others
// and the top "Watch the CPU work" player. Reduced motion: bars appear whole, no sweep.
(function () {
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cards = [];
  let active = null;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const fx = (cue, i) => document.dispatchEvent(new CustomEvent('card-fx', { detail: { cue, i } }));

  function parts(card) {
    const chart = card.sec.querySelector('.gantt-chart');
    const items = [];
    card.sec.querySelectorAll('.gantt-bar, .ln-run, .ln-wait, .ln-arr, .ln-done').forEach(el => {
      const l = parseFloat(el.style.left) / 100;
      if (isNaN(l)) return;
      const w = parseFloat(el.style.width) / 100 || 0;
      items.push({ el, l, w, kind: el.classList.contains('gantt-bar') ? 'bar' : el.classList.contains('ln-done') ? 'done' : el.classList.contains('ln-arr') ? 'mark' : 'seg' });
    });
    return { chart, items };
  }
  function clear(card) {
    card.sec.querySelectorAll('.gantt-bar, .ln-run, .ln-wait, .ln-arr, .ln-done').forEach(el => { el.style.clipPath = ''; el.style.opacity = ''; });
    card.sec.querySelectorAll('.cp-head').forEach(h => h.remove());
    card.sec.querySelectorAll('.ln-head').forEach(h => { h.hidden = true; });
    card.sec.classList.remove('cp-playing');
  }
  function label(card) {
    const b = card.play;
    b.textContent = card.state === 'playing' ? '❚❚ Pause' : card.state === 'paused' ? '▶ Resume' : card.state === 'done' ? '↻ Replay' : '▶ Play';
    b.setAttribute('aria-pressed', String(card.state === 'playing'));
    card.reset.hidden = card.state === 'idle';
  }
  function stop(card) {
    if (!card) return;
    clearTimeout(card.raf); card.state = 'idle'; card.f = 0;
    clear(card); label(card);
    if (active === card) active = null;
  }
  function draw(card) {
    const f = card.f, { chart, items } = card.parts;
    items.forEach(it => {
      if (!it.el.isConnected) return;
      if (it.kind === 'bar' || it.kind === 'seg') {
        const p = reduce() ? (f >= it.l ? 1 : 0) : clamp((f - it.l) / (it.w || 1));
        it.el.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(1)}% 0 0)`;
        it.el.style.opacity = p > 0 ? '1' : '0';
        if (it.kind === 'bar' && p > 0 && !it.fired) { it.fired = true; fx('tick', card.n++); }
      } else {
        it.el.style.opacity = f >= it.l ? '1' : '0';
        if (it.kind === 'done' && f >= it.l && !it.fired) { it.fired = true; fx('done'); }
      }
    });
    let head = chart && chart.querySelector('.cp-head');
    if (chart && !head) { head = document.createElement('i'); head.className = 'cp-head'; chart.appendChild(head); }
    if (head) head.style.left = (f * 100) + '%';
    card.sec.querySelectorAll('.ln-head').forEach(h => { h.hidden = false; h.style.left = (f * 100) + '%'; });
  }
  function frame(card, now) {
    if (card.state !== 'playing') return;
    if (card.parts.items.some(i => !i.el.isConnected)) { stop(card); return; } // setup edited mid-play
    card.f = clamp(card.f + (now - card.last) / card.dur); card.last = now;
    draw(card);
    if (card.f >= 1) { card.state = 'done'; clear(card); label(card); active = null; fx('finish'); return; }
    card.raf = setTimeout(() => frame(card, performance.now()), 16);
  }
  function play(card) {
    if (active && active !== card) stop(active);
    const topPlay = document.getElementById('cd-play');
    if (topPlay && topPlay.getAttribute('aria-pressed') === 'true') topPlay.click();
    if (card.state === 'idle' || card.state === 'done') {
      card.parts = parts(card); if (!card.parts.items.length) return;
      card.f = 0; card.n = 0; card.parts.items.forEach(i => { i.fired = false; });
      const span = Math.max(...card.parts.items.map(i => i.l + i.w), 0.0001); // already 0..1
      card.dur = reduce() ? 4000 : Math.min(14000, Math.max(5000, (card.sec.querySelector('.ln-body') ? +card.sec.querySelector('.ln-body').dataset.total : 20) * 450 * span));
    }
    card.state = 'playing'; card.sec.classList.add('cp-playing'); active = card;
    card.last = performance.now(); label(card);
    draw(card);
    card.raf = setTimeout(() => frame(card, performance.now()), 16);
  }
  function pause(card) { card.state = 'paused'; clearTimeout(card.raf); label(card); }

  function init() {
    document.querySelectorAll('#gantt-content .gantt-section').forEach(sec => {
      const lab = sec.querySelector('.gantt-label'); if (!lab) return;
      const card = { sec, state: 'idle', f: 0 };
      const bar = document.createElement('div'); bar.className = 'cp-ctl';
      bar.innerHTML = '<button type="button" class="btn btn-outline cp-play">▶ Play</button><button type="button" class="btn btn-outline cp-reset" hidden>Reset</button>';
      lab.insertAdjacentElement('afterend', bar);
      card.play = bar.querySelector('.cp-play'); card.reset = bar.querySelector('.cp-reset');
      card.play.addEventListener('click', () => card.state === 'playing' ? pause(card) : play(card));
      card.reset.addEventListener('click', () => stop(card));
      cards.push(card);
    });
    // The top player or Step stops any card, so only one thing moves at a time.
    document.addEventListener('click', e => { if (active && e.target.closest('#cd-play, #cd-step')) stop(active); }, true);
    window.__cardPlay = cards;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
