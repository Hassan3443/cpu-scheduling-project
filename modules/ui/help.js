// Tap, click, hover or keyboard-focus any table header with a title to read what it means.
// The browser's own tooltip never shows on touch screens, so the text is moved into a small popover.
export function initHelp() {
  const pop = document.createElement('div');
  pop.id = 'helppop'; pop.setAttribute('role', 'tooltip'); pop.hidden = true;
  document.body.appendChild(pop);
  let cur = null;
  const canHover = () => window.matchMedia('(hover:hover) and (pointer:fine)').matches;

  function upgrade(root) {
    root.querySelectorAll('th[title], .hint[title]').forEach(el => {
      el.dataset.tip = el.getAttribute('title'); el.removeAttribute('title');
      el.tabIndex = 0; el.classList.add('has-tip');
    });
  }
  function show(el) {
    if (!el.dataset.tip) return;
    cur = el; pop.textContent = el.dataset.tip; pop.hidden = false;
    el.setAttribute('aria-describedby', 'helppop');
    const r = el.getBoundingClientRect(), w = Math.min(300, window.innerWidth - 24);
    pop.style.maxWidth = w + 'px';
    const pw = pop.offsetWidth;
    pop.style.left = Math.max(12, Math.min(window.innerWidth - pw - 12, r.left + r.width / 2 - pw / 2)) + 'px';
    const below = r.bottom + 8, above = r.top - pop.offsetHeight - 8;
    pop.style.top = (below + pop.offsetHeight < window.innerHeight ? below : Math.max(8, above)) + 'px';
  }
  function hide() { if (cur) cur.removeAttribute('aria-describedby'); cur = null; pop.hidden = true; }

  upgrade(document);
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) upgrade(n); }))).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('pointerover', e => { if (canHover() && e.pointerType === 'mouse') { const t = e.target.closest('.has-tip'); if (t) show(t); } });
  document.addEventListener('pointerout', e => { if (canHover() && e.target.closest('.has-tip')) hide(); });
  document.addEventListener('click', e => {
    const t = e.target.closest('.has-tip');
    if (t) { cur === t ? hide() : show(t); } else hide();
  });
  document.addEventListener('focusin', e => { const t = e.target.closest('.has-tip'); if (t) show(t); });
  document.addEventListener('focusout', hide);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  window.addEventListener('scroll', hide, { passive: true });
}
