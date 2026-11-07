// Arka planda yavaşça yükselen G ve T harfli kalpler.
// Verimlilik: yalnızca CSS animasyonu (transform/opacity, JS döngüsü yok); sekme gizlenince durur;
// "hareketi azalt" ayarında hareketsiz görünür; profilden kapatılabilir; sayı küçük ekranda azalır.
const KEY = 'gonulmax:hearts';
const NS = 'http://www.w3.org/2000/svg';
const PATH = 'M16 28C5 19 1 13 1 8.5 1 4 4.5 1 8.5 1c3 0 6 1.6 7.5 4.5C17.5 2.6 20.5 1 23.5 1 27.5 1 31 4 31 8.5 31 13 27 19 16 28z';

let layer = null;

export function heartsEnabled() {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

function heart(letter, i, total) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 32 29');
  svg.setAttribute('class', 'heart');
  // Sabit, tekrarlanabilir dağılım (rastgelelik yok): yan yana yığılmaz.
  const frac = (i + 0.5) / total;
  const size = 30 + ((i * 7) % 5) * 9; // 30-66px
  svg.style.setProperty('--x', `${Math.round(frac * 100)}%`);
  svg.style.setProperty('--s', `${size}px`);
  svg.style.setProperty('--d', `${20 + ((i * 5) % 7) * 3}s`);
  svg.style.setProperty('--delay', `${-((i * 37) % 31)}s`); // eksi gecikme: sayfa açılır açılmaz havada
  svg.style.setProperty('--sway', `${(i % 2 ? 1 : -1) * (12 + ((i * 3) % 5) * 6)}px`);
  svg.style.setProperty('--o', `${0.22 + ((i * 3) % 4) * 0.05}`);
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', PATH);
  const text = document.createElementNS(NS, 'text');
  text.setAttribute('x', '16');
  text.setAttribute('y', '18');
  text.setAttribute('text-anchor', 'middle');
  text.textContent = letter;
  svg.append(path, text);
  return svg;
}

function build() {
  const total = window.matchMedia('(max-width: 600px)').matches ? 10 : 16;
  const el = document.createElement('div');
  el.className = 'hearts';
  el.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < total; i += 1) el.append(heart(i % 2 === 0 ? 'G' : 'T', i, total));
  return el;
}

export function setHearts(on) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* depolama kapalıysa tercih bu oturumda geçerli kalır */
  }
  if (on && !layer) {
    layer = build();
    document.body.prepend(layer);
  } else if (!on && layer) {
    layer.remove();
    layer = null;
  }
}

export function initHearts() {
  setHearts(heartsEnabled());
  // Görünmeyen sekmede animasyon durur: pil ve işlemci harcanmaz.
  document.addEventListener('visibilitychange', () => {
    document.documentElement.classList.toggle('fx-paused', document.hidden);
  });
}
