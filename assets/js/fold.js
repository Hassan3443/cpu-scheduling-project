// Animated open/close for the styled details bars (height + fade). Falls back to instant when reduced motion is on.
const SEL = '.glance-more,.glossary,.scenarios-fold,.more-fold';
document.addEventListener('click', e => {
  const sum = e.target.closest('summary');
  if (!sum) return;
  const d = sum.parentElement;
  if (!d || !d.matches(SEL)) return;
  e.preventDefault();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !d.animate) { d.open = !d.open; return; }
  if (d._anim) { d._anim.cancel(); d._anim = null; d.style.overflow = ''; }
  const kids = [...d.children].filter(c => c !== sum);
  if (!d.open) {
    const h1 = d.offsetHeight;
    d.open = true;
    const h0 = d.offsetHeight;
    d.style.overflow = 'hidden';
    d._anim = d.animate({ height: [h1 + 'px', h0 + 'px'] }, { duration: 280, easing: 'cubic-bezier(.2,.7,.2,1)' });
    kids.forEach(k => k.animate({ opacity: [0, 1] }, { duration: 280, easing: 'ease-out' }));
    const fin = () => { d.style.overflow = ''; d._anim = null; }; d._anim.onfinish = fin; setTimeout(fin, 340);
  } else {
    const h0 = d.offsetHeight;
    d.open = false;
    const h1 = d.offsetHeight;
    d.open = true;
    d.style.overflow = 'hidden';
    d._anim = d.animate({ height: [h0 + 'px', h1 + 'px'] }, { duration: 220, easing: 'ease-in-out' });
    kids.forEach(k => k.animate({ opacity: [1, 0] }, { duration: 160, easing: 'ease-in' }));
    const tok = d._anim; const fin = () => { if (d._anim !== tok) return; d.open = false; d.style.overflow = ''; d._anim = null; }; d._anim.onfinish = fin; setTimeout(fin, 280);
  }
});
