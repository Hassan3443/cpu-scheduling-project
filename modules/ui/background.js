// Slowly drifting CPU outlines behind the page. Pure decoration: monochrome, very faint,
// positions come from a fixed list so the layout is the same on every load.
const SPOTS = [[6,12],[18,64],[30,28],[42,82],[54,8],[63,46],[74,76],[86,22],[93,58],[12,90],[48,50],[80,92],[26,46],[68,16]];

export function glyphSvg(size, variant) {
  const pins = [];
  for (let i = 0; i < 4; i++) {
    const p = 14 + i * 12;
    pins.push(`M${p} 4V12M${p} 52V60M4 ${p}H12M52 ${p}H60`);
  }
  const core = variant % 2 ? '<rect x="24" y="24" width="16" height="16" rx="2"/>' : '<path d="M22 32H42M32 22V42"/><circle cx="32" cy="32" r="5"/>';
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="12" y="12" width="40" height="40" rx="5"/><path d="${pins.join('')}"/>${core}</svg>`;
}

export function buildBackground(root = document.querySelector('.bg-fx')) {
  if (!root) return;
  root.querySelectorAll('i').forEach(n => n.remove());
  const small = window.matchMedia && window.matchMedia('(max-width:560px)').matches;
  SPOTS.slice(0, small ? 6 : SPOTS.length).forEach(([x, y], i) => {
    const el = document.createElement('i');
    el.className = 'cpu-glyph';
    el.style.cssText = `--x:${x}%;--y:${y}%;--d:${70 + (i * 13) % 50}s;--dl:${-(i * 9) % 60}s;--r:${(i * 37) % 40 - 20}deg;--o:${(0.09 + (i % 4) * 0.02).toFixed(3)}`;
    el.innerHTML = glyphSvg(26 + (i * 11) % 30, i);
    root.appendChild(el);
  });
}
