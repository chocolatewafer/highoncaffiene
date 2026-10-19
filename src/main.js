import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createScene } from './scene.js';
import { createSound } from './sound.js';
import { mountCardArt, mountWireCup } from './art.js';
import { NAME, ROLES, WORK, REPOS_FALLBACK } from './data.js';

gsap.registerPlugin(ScrollTrigger);
history.scrollRestoration = 'manual';
scrollTo(0, 0);
document.body.classList.add('loading');

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/* ---------------- loader gauge ---------------- */
const ld = $('#loader');
const ticks = $('.ld-ticks');
const A0 = -135, SWEEP = 270, MAXBAR = 12;
for (let v = 0; v <= MAXBAR; v += 0.5) {
  const a = ((A0 + (v / MAXBAR) * SWEEP - 90) * Math.PI) / 180;
  const major = v % 2 === 0;
  const r1 = major ? 80 : 86, r2 = 93;
  ticks.insertAdjacentHTML('beforeend', `<line class="${major ? 'mj' : ''}" x1="${Math.cos(a) * r1}" y1="${Math.sin(a) * r1}" x2="${Math.cos(a) * r2}" y2="${Math.sin(a) * r2}"/>`);
  if (major) ticks.insertAdjacentHTML('beforeend', `<text x="${Math.cos(a) * 68}" y="${Math.sin(a) * 68}">${v}</text>`);
}
const needle = $('.ld-needle'), arc = $('.ld-arc');
let shown = 0, loaded = 0;
function drawGauge(bar) {
  const deg = A0 + (bar / MAXBAR) * SWEEP;
  needle.style.transform = `rotate(${deg}deg)`;
  const a0 = ((A0 - 90) * Math.PI) / 180, a1 = ((deg - 90) * Math.PI) / 180, r = 99;
  const large = deg - A0 > 180 ? 1 : 0;
  arc.setAttribute('d', `M ${Math.cos(a0) * r} ${Math.sin(a0) * r} A ${r} ${r} 0 ${large} 1 ${Math.cos(a1) * r} ${Math.sin(a1) * r}`);
  $('#ldBar').textContent = bar.toFixed(1);
}
drawGauge(0);

/* ---------------- scene ---------------- */
const scene = createScene($('#gl'), { onProgress: (f) => (loaded = Math.max(loaded, f * 0.9)) });
const sound = createSound();
if (import.meta.env.DEV) window.__s = scene;
const fontsReady = document.fonts.ready.then(() =>
  Promise.all([document.fonts.load('600 100px "Schibsted Grotesk"'), document.fonts.load('500 20px "Geist Mono"')]).catch(() => {})
);

let isReady = false;
(function tickLoader() {
  const goal = isReady ? 1 : loaded;
  shown += (goal - shown) * 0.08;
  drawGauge(shown * 9);
  $('#ldPct').textContent = Math.round(shown * 100) + '%';
  if (isReady && shown > 0.995) {
    drawGauge(9);
    ld.classList.add('ready');
    $('.ld-label').textContent = 'READY TO BREW';
    return;
  }
  requestAnimationFrame(tickLoader);
})();

Promise.all([scene.ready, fontsReady]).then(() => {
  scene.setWallName(NAME);
  scene.start();
  isReady = true;
});

function enter(withSound) {
  if (withSound) {
    sound.enable();
    $('#soundBtn').classList.add('on');
  }
  ld.classList.add('gone');
  document.body.classList.remove('loading');
  document.body.classList.add('entered');
  lenis.start();
  // opening pull-focus, then the title rises
  const o = { v: 0 };
  gsap.to(o, { v: 1, duration: 3.2, ease: 'power2.inOut', onUpdate: () => scene.setIntro(o.v) });
  gsap.fromTo('.b-title .ln > span', { yPercent: 105 }, { yPercent: 0, duration: 1.6, ease: 'expo.out', stagger: 0.12, delay: 0.9 });
  gsap.fromTo(['.b-title .t-meta', '.badge-circle', '.t-cue'], { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', stagger: 0.1, delay: 1.4 });
}
$('#enterSound').addEventListener('click', () => enter(true));
$('#enterQuiet').addEventListener('click', () => enter(false));
$('#soundBtn').addEventListener('click', () => $('#soundBtn').classList.toggle('on', sound.toggle()));

/* ---------------- smooth scroll ---------------- */
const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
lenis.stop();
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
$$('[data-link]').forEach((a) =>
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const id = a.getAttribute('href');
    lenis.scrollTo(id === '#top' ? 0 : id, { duration: 2.2, offset: id === '#contact' ? 0 : 0 });
  })
);

/* ---------------- film: scroll drives the shot ---------------- */
let filmP = 0, filmOn = true;
ScrollTrigger.create({
  trigger: '#film',
  start: 'top top',
  end: 'bottom bottom',
  onUpdate: (st) => {
    filmP = st.progress;
    scene.setProgress(filmP);
  },
  onToggle: (st) => (filmOn = st.isActive),
});

const beats = $$('.beat').map((el) => ({ el, a: +el.dataset.a, b: +el.dataset.b, first: el.hasAttribute('data-first'), lines: $$('.ln > span', el), items: $$('.bl-items li', el) }));
const ro = { bar: $('#roBar'), time: $('#roTime'), yield: $('#roYield'), prog: $('#roProg'), box: $('.readout'), hint: $('.hint-click') };

const filmEl = $('#film');
function updateFilm() {
  const p = scene.progress; // smoothed, in sync with the camera
  for (const b of beats) {
    const u = (p - b.a) / (b.b - b.a);
    const inn = b.first ? 1 : sstep(0, 0.16, u);
    const out = 1 - sstep(0.8, 1, u);
    const o = Math.min(inn, out);
    const vis = o > 0.002 && u > -0.05 && u < 1.05;
    b.el.style.visibility = vis ? 'visible' : 'hidden';
    if (!vis) continue;
    b.el.style.opacity = o.toFixed(3);
    b.el.style.filter = out < 1 ? `blur(${((1 - out) * 10).toFixed(2)}px)` : 'none';
    b.el.style.transform = `translateY(${((1 - out) * -40).toFixed(1)}px) scale(${(1 + (1 - out) * 0.03).toFixed(4)})`;
    if (!b.first) b.lines.forEach((s, i) => s.style.setProperty('--lift', (1 - sstep(i * 0.05, 0.14 + i * 0.05, u)).toFixed(3)));
    if (b.items.length) {
      const f = clamp01((u - 0.12) / 0.7) * (b.items.length - 1);
      b.items.forEach((li, i) => li.style.setProperty('--on', clamp01(1 - Math.abs(f - i) * 0.9).toFixed(3)));
    }
  }
  // the shot readout follows the same beats as the machine
  const bar = 9 * sstep(0.36, 0.45, p) * (1 - sstep(0.62, 0.68, p));
  const flow = seg(p, 0.4, 0.62);
  ro.bar.textContent = bar.toFixed(1) + ' bar';
  ro.time.textContent = '00:' + String(Math.round(flow * 27)).padStart(2, '0');
  ro.yield.textContent = Math.round(sstep(0, 1, flow) * 36) + ' g';
  ro.prog.style.width = (p * 100).toFixed(1) + '%';
  const inFilm = filmEl.getBoundingClientRect().bottom > innerHeight * 0.5;
  ro.box.classList.toggle('on', inFilm && p > 0.06 && p < 0.97);
  ro.hint.classList.toggle('on', inFilm && p > 0.06 && p < 0.97);
  // sound follows the brew
  const pouring = p > 0.39 && p < 0.63 ? 1 : 0;
  sound.update({ pump: pouring * (0.6 + bar / 22), pour: pouring * sstep(0.4, 0.43, p), steam: steamLevel() });
}
let burstT = 0;
const steamLevel = () => Math.max(0, burstT - performance.now()) / 2200;

/* run the canvas only when it is on screen */
let contactOn = false;
ScrollTrigger.create({
  trigger: '#contact',
  start: 'top bottom',
  end: 'bottom top',
  onToggle: (st) => (contactOn = st.isActive),
  onUpdate: (st) => scene.setContact(sstep(0, 0.45, st.progress)),
});
gsap.ticker.add(() => {
  scene.setRunning(filmOn || contactOn || !document.body.classList.contains('entered'));
  updateFilm();
});

/* click the machine for steam */
addEventListener('click', (e) => {
  if (!(filmOn || contactOn) || e.target.closest('a,button,iframe')) return;
  if (scene.pick(e.clientX, e.clientY)) {
    scene.steamBurst();
    burstT = performance.now() + 2200;
  }
});

/* ---------------- pause: frame opens to full bleed, words spread ---------------- */
{
  const stage = $('.pause-stage');
  const words = $$('.pause-text span');
  ScrollTrigger.create({
    trigger: '#pause',
    start: 'top bottom',
    end: 'bottom bottom',
    onUpdate: (st) => {
      const p = st.progress;
      const open = sstep(0.25, 0.75, p);
      stage.style.setProperty('--w', (0.42 + 0.58 * open).toFixed(4));
      stage.style.setProperty('--h', (0.5 + 0.5 * open).toFixed(4));
      stage.style.setProperty('--z', (1.18 - 0.14 * p).toFixed(4));
      stage.style.setProperty('--gap', sstep(0.45, 0.95, p).toFixed(3));
      stage.style.setProperty('--o', sstep(0.4, 0.6, p).toFixed(3));
      words.forEach((w, i) => w.style.setProperty('--o', sstep(0.4 + i * 0.05, 0.55 + i * 0.05, p).toFixed(3)));
    },
  });
}

/* ---------------- nav colour + rail ---------------- */
$$('.paper').forEach((sec) =>
  ScrollTrigger.create({ trigger: sec, start: 'top top+=56', end: 'bottom top+=56', toggleClass: { targets: document.body, className: 'on-paper' } })
);
$$('.rail-list li').forEach((li) => {
  const sec = document.getElementById(li.dataset.sec);
  ScrollTrigger.create({ trigger: sec, start: 'top center', end: 'bottom center', onToggle: (st) => li.classList.toggle('on', st.isActive) });
});

/* ---------------- headings: word reveal ---------------- */
$$('.reveal').forEach((el) => {
  el.classList.add('split');
  let i = 0;
  const wrap = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((w) => {
          if (!w) return;
          if (/^\s+$/.test(w)) return frag.append(' ');
          const o = document.createElement('span');
          o.className = 'w';
          o.innerHTML = `<span style="--i:${i++}">${w}</span>`;
          frag.append(o);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) wrap(n);
    });
  };
  wrap(el);
  ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => el.classList.add('in') });
});

/* ---------------- about: wireframe cup ---------------- */
mountWireCup($('#wire'));

/* ---------------- brew log ---------------- */
$('#logList').innerHTML = ROLES.map(
  (r, i) => `
  <div class="row${r.open ? ' open' : ''}">
    <button class="row-head" aria-expanded="${!!r.open}">
      <span class="row-date">${r.date}</span>
      <span class="row-role">${r.role}</span>
      <span class="row-co">${r.co}</span>
      <span class="row-city">${r.city}</span>
      <span class="row-x">+</span>
    </button>
    <div class="row-body"><div><ul>${r.points.map((p) => `<li>${p}</li>`).join('')}</ul></div></div>
  </div>`
).join('');
$$('.row-head').forEach((b) =>
  b.addEventListener('click', () => {
    const row = b.parentElement;
    row.classList.toggle('open');
    b.setAttribute('aria-expanded', row.classList.contains('open'));
    setTimeout(() => ScrollTrigger.refresh(), 650);
  })
);
gsap.utils.toArray('.row').forEach((row, i) =>
  gsap.from(row, { opacity: 0, y: 30, duration: 1, ease: 'power3.out', delay: (i % 4) * 0.06, scrollTrigger: { trigger: row, start: 'top 92%' } })
);

/* ---------------- work cards ---------------- */
$('#cards').innerHTML = WORK.map(
  (w, i) => `
  <article class="card${w.wide ? ' wide' : ''}">
    <div class="card-art"><canvas data-art="${w.art}"></canvas><span class="card-num">${String(i + 1).padStart(2, '0')}</span><span class="card-tag${w.hot ? ' hot' : ''}">${w.tag}</span></div>
    <div class="card-meta">
      <div class="card-top"><h3>${w.title}</h3><span class="card-year">${w.year}</span></div>
      <p>${w.text}</p>
      <div class="chips">${w.chips.map((c) => `<span>${c}</span>`).join('')}</div>
    </div>
    ${w.link ? `<a class="card-link" href="${w.link}" target="_blank" rel="noopener" aria-label="Open ${w.title}"></a><span class="go">↗</span>` : ''}
  </article>`
).join('') + `
  <a class="card cta" href="#contact" data-link>
    <span class="card-num">10</span>
    <div class="cta-body">
      <span class="kicker dark">Your project here</span>
      <h3>Need someone who ships the whole thing?</h3>
      <span class="cta-go">Let’s grab a coffee <b>→</b></span>
    </div>
  </a>`;
$('#cards .cta').addEventListener('click', (e) => { e.preventDefault(); lenis.scrollTo('#contact', { duration: 2.2 }); });
$$('.card:not(.cta)').forEach((card) => {
  mountCardArt($('canvas', card), $('canvas', card).dataset.art);
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--x', e.clientX - r.left + 'px');
    card.style.setProperty('--y', e.clientY - r.top + 'px');
  });
});
gsap.utils.toArray('.card').forEach((c, i) =>
  gsap.from(c, { opacity: 0, y: 60, duration: 1.2, ease: 'power3.out', delay: (i % 3) * 0.08, scrollTrigger: { trigger: c, start: 'top 94%' } })
);

/* ---------------- GitHub menu (live) ---------------- */
const HIDE_REPOS = ['chocolatewafer', 'chocolatewafer.github.io', 'hello-world', 'sparshni', 'webpage', 'myName', 'queue'];
function renderMenu(repos, live) {
  $('#menuList').innerHTML = repos
    .filter((r) => !r.fork && !HIDE_REPOS.includes(r.name))
    .slice(0, 10)
    .map(
      (r) => `<li><a href="${r.html_url}" target="_blank" rel="noopener">
        <span class="mi-name">${r.name}</span><span class="mi-lang">${r.language || 'Misc'}</span>
        ${r.description ? `<span class="mi-desc">${r.description.replace(/</g, '&lt;')}</span>` : ''}
      </a></li>`
    )
    .join('');
  $('#menuStatus').textContent = live ? 'Live · ' + new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'House menu';
}
const menuObs = new IntersectionObserver(
  ([e]) => {
    if (!e.isIntersecting) return;
    menuObs.disconnect();
    fetch('https://api.github.com/users/chocolatewafer/repos?sort=updated&per_page=30')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((repos) => renderMenu(repos, true))
      .catch(() => renderMenu(REPOS_FALLBACK, false))
      .finally(() => ScrollTrigger.refresh());
  },
  { rootMargin: '600px' }
);
menuObs.observe($('.menu'));

/* ---------------- lab ---------------- */
const frame = $('#labFrame');
// Show only the figure card (drawing + its buttons), scaled to fit the window. No page, tabs or legend.
let fitFigure = () => {};
function prepFrame() {
  try {
    const d = frame.contentDocument;
    const st = d.createElement('style');
    st.textContent = `
      html, body { margin: 0 !important; padding: 0 !important; height: 100%; overflow: hidden !important; background: transparent !important; }
      .em-tabs, .iso-legend { display: none !important; }
      .iso-page { margin: 0 !important; padding: 0 !important; min-height: 0 !important; display: block !important; background: transparent !important; }
      .iso-figure { position: absolute !important; left: 0; top: 0; margin: 0 !important; width: 860px !important; max-width: none !important; transform-origin: 0 0; }
      /* one button only: brew / pull a shot. Panel and take-apart are taps on the drawing. */
      .em-controls > :not([data-action]):not([data-shot]) { display: none !important; }
      .em-controls { justify-content: center !important; }
      .em-controls [data-action], .em-controls [data-shot] { font-size: 13px !important; padding: 12px 26px !important; }
      .iso-stage .it { cursor: pointer; }`;
    d.head.append(st);
    const fig = d.querySelector('.iso-figure');
    fitFigure = () => {
      if (!fig) return;
      fig.style.transform = 'none';
      const fw = fig.offsetWidth, fh = fig.offsetHeight;
      const W = frame.clientWidth, H = frame.clientHeight, pad = 24;
      const k = Math.min((W - pad * 2) / fw, (H - pad * 2) / fh, 1.25);
      fig.style.transform = `translate(${(W - fw * k) / 2}px, ${(H - fh * k) / 2}px) scale(${k})`;
    };
    fitFigure();
    setTimeout(fitFigure, 300);
    // one tap on the panel (or the see-through shell) opens it; one tap anywhere else on the machine takes it apart
    const apartBtn = d.querySelector('[data-apart]');
    const stage = d.querySelector('.iso-stage');
    stage?.addEventListener('click', (e) => {
      const isApart = /put together/i.test(apartBtn?.textContent || '');
      const onPanel = e.target.closest('[data-ghost], [data-part="panel"]');
      if (!e.target.closest('.it') || (onPanel && !isApart)) return; // the page's own panel handler runs
      apartBtn?.click();
    });
    // nothing scrolls inside: pass the wheel to the main page as a real wheel event, so the smooth scroll stays smooth
    d.addEventListener('wheel', (e) => {
      e.preventDefault();
      window.dispatchEvent(new WheelEvent('wheel', { deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode, bubbles: true, cancelable: true }));
    }, { passive: false });
  } catch (_) {}
  frame.classList.remove('swap');
}
new ResizeObserver(() => fitFigure()).observe(frame);
frame.addEventListener('load', prepFrame);
const labObs = new IntersectionObserver(([e]) => {
  if (e.isIntersecting) {
    frame.src = frame.dataset.src;
    labObs.disconnect();
  }
}, { rootMargin: '400px' });
labObs.observe(frame);
$$('#labTabs button').forEach((b) =>
  b.addEventListener('click', () => {
    $$('#labTabs button').forEach((x) => x.setAttribute('aria-selected', x === b));
    const src = `./lab/${b.dataset.src}.html`;
    frame.classList.add('swap');
    setTimeout(() => (frame.src = src), 250);
    $('#labPath').textContent = `lab / ${b.dataset.src}.html`;
    $('#labOpen').href = src;
  })
);

/* ---------------- contact heading ---------------- */
gsap.from('.contact-links .cl', { opacity: 0, y: 24, duration: 1, stagger: 0.08, ease: 'power3.out', scrollTrigger: { trigger: '.contact-links', start: 'top 90%' } });

/* ---------------- cursor ---------------- */
const cur = $('.cursor'), curLabel = $('.cursor-label');
let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy, lastPick = 0;
addEventListener('pointermove', (e) => {
  tx = e.clientX;
  ty = e.clientY;
  const t = e.target;
  let label = '';
  if (t.closest?.('.card a, .menu-list a, .cl, .btn-line, .btn-solid, .lab-open')) label = 'Open';
  else if (t.closest?.('.row-head')) label = 'Pour';
  else if ((filmOn || contactOn) && !t.closest?.('a,button,.lab') && performance.now() - lastPick > 60) {
    lastPick = performance.now();
    if (scene.pick(e.clientX, e.clientY)) label = 'Steam';
  }
  cur.classList.toggle('big', !!label);
  if (label) curLabel.textContent = label;
});
frame.addEventListener('mouseenter', () => (cur.style.opacity = 0));
frame.addEventListener('mouseleave', () => (cur.style.opacity = 1));
gsap.ticker.add(() => {
  cx += (tx - cx) * 0.2;
  cy += (ty - cy) * 0.2;
  cur.style.transform = `translate(${cx}px, ${cy}px)`;
});

addEventListener('load', () => ScrollTrigger.refresh());

/* ---------------- dev helpers: ?dev skips the loader, go(p) jumps the film ---------------- */
if (import.meta.env.DEV) {
  window.go = async (p, hideText = false) => {
    const f = $('#film');
    lenis.scrollTo(f.offsetTop + p * (f.offsetHeight - innerHeight), { immediate: true, force: true });
    await new Promise((r) => setTimeout(r, 300));
    scene.setProgress(p);
    scene.snap();
    $$('.beat').forEach((b) => (b.style.display = hideText ? 'none' : ''));
    await new Promise((r) => setTimeout(r, 1800));
    return p;
  };
  if (location.search.includes('dev')) {
    Promise.all([scene.ready, fontsReady]).then(() => setTimeout(() => { enter(false); scene.setIntro(1); }, 300));
  }
}
