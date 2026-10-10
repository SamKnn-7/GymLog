'use strict';

// ---------- icons ----------

const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.500"/><rect x="14" y="3" width="7" height="5" rx="1.500"/><rect x="14" y="12" width="7" height="9" rx="1.500"/><rect x="3" y="16" width="7" height="5" rx="1.500"/>',
  dumbbell: '<path d="M6.500 6.500v11M17.500 6.500v11M3 9.500v5M21 9.500v5M6.500 12h11"/>',
  history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  scale: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.500 10.500a4.500 4.500 0 0 1 7 0M12 8.500l1 2.500"/>',
  tools: '<path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h10M18 18h2"/><circle cx="14" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.500l4.500 4.500L19 7.500"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  left: '<path d="M15 6l-6 6 6 6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  edit: '<path d="M4 20l1-4L16.500 4.500a2.100 2.100 0 0 1 3 3L8 19l-4 1zM14.500 6.500l3 3"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  repeat: '<path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
  star: '<path d="M12 3l2.700 5.600 6.100.900-4.400 4.300 1 6.100-5.400-2.900-5.400 2.900 1-6.100L3.200 9.500l6.100-.900z"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.500 2M9 2h6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.900 4.900l1.400 1.400M17.700 17.700l1.400 1.400M4.900 19.100l1.400-1.400M17.700 6.300l1.400-1.400"/>',
  moon: '<path d="M20 14.500A8 8 0 0 1 9.500 4a8 8 0 1 0 10.500 10.500z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.500-3.500"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
};

function icon(name, size = 18) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

// ---------- status badges ----------

const BADGE = { up: '▲ Progress', down: '▼ Declined', flat: '■ No change', new: '● First entry' };

function badge(status, pr) {
  return pr
    ? '<span class="badge up pr">★ New PR</span>'
    : `<span class="badge ${status}">${BADGE[status]}</span>`;
}

// Signed change with an arrow, coloured by whether it is good or bad
function delta(value, status, suffix = '', digits = 1) {
  if (status === 'new') return '';
  const arrow = value > EPS ? '▲' : value < -EPS ? '▼' : '■';
  return `<span class="delta ${status}">${arrow} ${signed(value, digits)}${suffix}</span>`;
}

// A timed set (cardio or a hold) carries seconds instead of reps and weight
const isTimedSet = s => s.seconds != null;
const fmtTimedSet = s => fmtTime(s.seconds) + (s.distance > 0 ? ` · ${num(s.distance, 2)} ${distUnit()}` : '');

const fmtSet = s => isTimedSet(s) ? fmtTimedSet(s) : s.weight > 0 ? `${s.reps} × ${num(s.weight, 2)} ${unit()}` : `${s.reps} reps`;
const fmtSetShort = s => isTimedSet(s) ? fmtTimedSet(s) : s.weight > 0 ? `${num(s.weight, 2)} × ${s.reps}` : `${s.reps} reps`;

function fmtSets(sets) {
  if (sets.length && isTimedSet(sets[0])) return sets.map(fmtTimedSet).join(', ');
  const tag = s => s.type === 'warmup' ? 'W ' : '';
  return sets.map(s => tag(s) + (s.weight > 0 ? `${s.reps}×${num(s.weight, 2)}` : `${s.reps}`)).join(', ')
    + (sets.some(s => s.weight > 0) ? ` ${unit()}` : ' reps');
}

function tile(label, value, sub = '', extra = '') {
  return `<div class="tile">
    <div class="tile-main"><div class="tile-label">${label}</div><div class="tile-value">${value}</div>${sub ? `<div class="tile-sub">${sub}</div>` : ''}</div>
    ${extra}
  </div>`;
}

const count = (v, suffix = '') => `<span data-count="${v}">${Number.isInteger(v) ? big(v) : num(v)}</span>${suffix}`;

function segmented(name, options, current) {
  return `<div class="seg" role="group">${options.map(([value, label]) =>
    `<button class="${value === current ? 'on' : ''}" data-action="${name}" data-value="${value}">${label}</button>`).join('')}</div>`;
}

function emptyState(emoji, text, button = '') {
  return `<div class="empty"><div class="empty-icon">${emoji}</div><p>${text}</p>${button}</div>`;
}

// ---------- motion ----------

function motionOn() {
  const m = state.settings.motion;
  return m === 'on' || (m === 'auto' && !matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function applyAppearance() {
  const root = document.documentElement;
  root.dataset.theme = state.settings.theme;
  root.dataset.motion = motionOn() ? 'on' : 'off';
}

// Play the entrance animations of everything inside `el`
function animateIn(el) {
  if (!el || !motionOn()) return;
  el.classList.remove('enter');
  void el.offsetWidth; // restart the CSS animations
  el.classList.add('enter');
  countUp(el);
  // Drop the class once everything has played, so later partial updates
  // (typing in a search box, ticking a set) don't replay the entrance
  clearTimeout(el._enterTimer);
  el._enterTimer = setTimeout(() => el.classList.remove('enter'), 1700);
}

function countUp(root) {
  if (!motionOn()) return;
  for (const el of $$('[data-count]', root)) {
    const target = Number(el.dataset.count);
    const final = el.textContent;
    const decimals = Number.isInteger(target) ? 0 : 1;
    const t0 = performance.now();
    const step = t => {
      const p = Math.min(1, (t - t0) / 650);
      const v = target * (1 - (1 - p) ** 3);
      el.textContent = p < 1 ? (decimals ? v.toFixed(1) : big(v)) : final;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

function confetti(pieces = 80) {
  if (!motionOn()) return;
  const box = $('#confetti');
  const colours = ['#0ca30c', '#2a78d6', '#eda100', '#e87ba4', '#4a3aa7'];
  box.innerHTML = Array.from({ length: pieces }, (_, i) =>
    `<i style="left:${Math.random() * 100}%;background:${colours[i % colours.length]};`
    + `animation-delay:${Math.random() * 0.5}s;animation-duration:${1.6 + Math.random() * 1.2}s;`
    + `--spin:${Math.random() * 720 - 360}deg;--drift:${Math.random() * 120 - 60}px"></i>`).join('');
  clearTimeout(confetti.timer);
  confetti.timer = setTimeout(() => { box.innerHTML = ''; }, 3500);
}

// ---------- toast ----------

function toast(msg, tone = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `show ${tone}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.className = tone; }, 2600);
}

// ---------- modal ----------

// locked: tapping outside the dialog does not close it
function openModal(html, cls = '', locked = false) {
  $('#modal').innerHTML = `<div class="overlay" ${locked ? '' : 'data-overlay'}><div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div></div>`;
  document.body.classList.add('modal-open');
}

function closeModal() {
  $('#modal').innerHTML = '';
  document.body.classList.remove('modal-open');
}

const modalOpen = () => !!$('#modal').firstChild;

// ---------- tooltip ----------
// Any element with data-tip="Value|detail|detail" gets a hover tooltip.
// Text goes in with textContent because it can contain exercise names.

function showTip(el, x, y) {
  const tip = $('#tip');
  const [head, ...rest] = el.dataset.tip.split('|');
  tip.replaceChildren();
  const strong = document.createElement('strong');
  strong.textContent = head;
  tip.append(strong);
  for (const line of rest) {
    const div = document.createElement('div');
    div.textContent = line;
    tip.append(div);
  }
  tip.hidden = false;
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  tip.style.left = `${clamp(x - w / 2, 8, innerWidth - w - 8)}px`;
  tip.style.top = `${y - h - 14 < 8 ? y + 18 : y - h - 14}px`;
}

function initTooltips() {
  const hide = () => { $('#tip').hidden = true; };
  document.addEventListener('pointermove', e => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (el) showTip(el, e.clientX, e.clientY);
    else hide();
  });
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (el && e.pointerType !== 'mouse') showTip(el, e.clientX, e.clientY);
  });
  document.addEventListener('pointerleave', hide);
  addEventListener('scroll', hide, true);
}
