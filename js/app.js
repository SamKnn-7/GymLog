'use strict';

// ---------- event routing ----------

document.addEventListener('click', e => {
  if (e.target.matches('[data-overlay]')) return closeModal();
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const handler = Actions[el.dataset.action];
  if (handler) handler(el, e);
});

document.addEventListener('input', e => {
  const handler = Inputs[e.target.dataset.input];
  if (handler) handler(e.target);
});

document.addEventListener('change', e => {
  const handler = Changes[e.target.dataset.change];
  if (handler) handler(e.target);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalOpen()) return ui.setup ? Actions['setup-skip']() : $('#ex-form') ? leaveExForm() : closeModal();
  if (e.key !== 'Enter') return;
  const el = e.target;

  // Picker: Enter takes the first match, or creates the exercise
  if (el.id === 'picker-q') {
    const first = $('#picker-list .picker-pick') || $('#picker-list [data-action="create-exercise"]');
    if (first) first.click();
    return;
  }
  if (el.id === 'exform-name') return Actions['exform-save']();
  if (el.dataset.input === 'setup-field') return $('#setup .btn.primary').click();
  if (el.id === 'bw-weight') return Actions['save-bw']();
  if (el.id === 'measure-value') return Actions['save-measure']();

  // Logger: Enter moves to the next box in the set, then ticks it and drops to the next set
  if (el.dataset.input === 'set-field') {
    const row = el.closest('tr');
    const boxes = $$('[data-input="set-field"]', row);
    const after = boxes[boxes.indexOf(el) + 1];
    if (after) return after.focus();
    const { ei, si } = row.dataset;
    const done = $('.done-btn', row);
    if (done && done.getAttribute('aria-pressed') !== 'true') done.click();
    const next = $(`tr[data-ei="${ei}"][data-si="${Number(si) + 1}"] [data-input="set-field"]`);
    if (next) next.focus();
  }
});

let resizeTimer;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => mountCharts(), 150);
});

// ---------- phone support ----------

// Once the app is on a real web address (https), keep an offline copy so it
// works without signal and can be added to the home screen.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* the app still works online */ });
}

// Ask the browser not to clear logged data when the phone runs low on space
function keepStorage() {
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
if (!state.demo && (state.workouts.length || state.bodyweights.length)) keepStorage();

// ---------- start ----------

initTooltips();
setInterval(tickClock, 1000);
render(true);
if (needsSetup()) openSetup();
