'use strict';

// Each page registers itself here: Views.name = { title, render() }.
// Clicks, typing and changes are routed by attribute:
//   data-action="x"  -> Actions.x(element, event)
//   data-input="x"   -> Inputs.x(element)      (fires on every keystroke)
//   data-change="x"  -> Changes.x(element)     (fires when a value is committed)
// Handlers save and re-render themselves, so typing never loses focus.
const Views = {};
const Actions = {};
const Inputs = {};
const Changes = {};

const NAV = [
  ['dashboard', 'Dashboard', 'dashboard'],
  ['workout', 'Workout', 'dumbbell'],
  ['history', 'History', 'history'],
  ['exercises', 'Exercises', 'trend'],
  ['body', 'Body', 'scale'],
  ['tools', 'Tools', 'tools'],
];

// View state that is not worth saving between visits
const ui = {
  view: 'dashboard',
  exercise: { key: null, metric: 'best', range: 'all', q: '' },
  history: { month: null, day: null, q: '', scope: 'month' },
  body: { range: 'all' },
  picker: { q: '', muscle: 'All', equipment: 'Any' },
  tools: { plateTarget: '', rmWeight: '', rmReps: '' },
  setup: null, // answers so far while the first-run setup is open
};

// A workout counts as live (clock running, rest timer auto-starts) when it
// is new and dated today; past workouts and edits take a typed duration.
const isLive = a => !!a && a.mode === 'workout' && !a.editingId && a.date === isoDate();

function renderNav() {
  const live = state.active && state.active.mode === 'workout';
  const items = NAV.map(([id, label, ic]) =>
    `<button class="nav-item ${ui.view === id ? 'on' : ''}" data-action="nav" data-view="${id}">
      ${icon(ic, 20)}<span>${label}</span>${id === 'workout' && live ? '<i class="live-dot" title="Workout in progress"></i>' : ''}
    </button>`).join('');
  $('#sidenav').innerHTML = items;
  $('#tabbar').innerHTML = items;
  const dark = state.settings.theme === 'dark';
  $('#theme-toggle').innerHTML = `${icon(dark ? 'sun' : 'moon', 16)}<span>${dark ? 'Light mode' : 'Dark mode'}</span>`;
}

function renderTopbar() {
  const view = Views[ui.view];
  const live = state.active && state.active.mode === 'workout';
  const cta = ui.view === 'workout' ? ''
    : live ? `<button class="btn primary" data-action="nav" data-view="workout">${icon('play', 16)} Resume <span class="hide-s">workout</span> <span data-elapsed></span></button>`
      : `<button class="btn primary" data-action="nav" data-view="workout">${icon('plus', 16)} Start workout</button>`;
  const dark = state.settings.theme === 'dark';
  const themeLabel = dark ? 'Switch to light mode' : 'Switch to dark mode';
  $('#topbar').innerHTML = `<div>
      <h1>${view.title}</h1>
      <p class="muted small">${fmtDate(isoDate(), 'weekday')}${state.demo ? ' · sample data' : ''}</p>
    </div>
    <div class="row gap-s">
      <button class="icon-btn theme-btn" data-action="toggle-theme" aria-label="${themeLabel}" data-tip="${themeLabel}">${icon(dark ? 'sun' : 'moon', 20)}</button>
      ${cta}
    </div>`;
}

// Entrance animations only play when `animate` is set, so small edits
// (ticking a set, adding a row) don't replay them.
function render(animate = false) {
  applyAppearance();
  document.body.dataset.view = ui.view;
  renderNav();
  renderTopbar();
  _chartSpecs.length = 0;
  const app = $('#app');
  clearTimeout(app._enterTimer);
  app.classList.remove('enter');
  app.innerHTML = Views[ui.view].render();
  mountCharts(app);
  if (animate) animateIn(app);
  renderTimer();
  tickClock();
}

function go(view) {
  ui.view = view;
  render(true);
  scrollTo(0, 0);
}

// Elapsed time of the workout in progress, shown wherever [data-elapsed] appears
function tickClock() {
  const a = state.active;
  const text = isLive(a) ? fmtClock((Date.now() - a.startedAt) / 1000) : '';
  for (const el of $$('[data-elapsed]')) el.textContent = text;
}

Actions.nav = el => go(el.dataset.view);
Actions['close-modal'] = () => closeModal();
Actions['toggle-theme'] = () => {
  state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
  persist();
  render();
};
Actions['timer-start'] = el => {
  state.settings.restSeconds = Number(el.dataset.sec);
  persist();
  startTimer(state.settings.restSeconds);
};
Actions['timer-adjust'] = el => adjustTimer(Number(el.dataset.sec));
Actions['timer-stop'] = () => stopTimer();
