'use strict';

// Exercises you add yourself: creating, editing and deleting them. The form
// opens from the exercise picker, the Tools page and an exercise's progress
// page; `back` remembers which, so closing it returns there.

// How an exercise is logged: [kind, label]
const EX_KINDS = [['', 'Weight and reps'], ['hold', 'Timed hold'], ['cardio', 'Cardio']];

const customIndex = name => state.customExercises.findIndex(e => norm(e.name) === norm(name));

// index: the exercise to edit, or null for a new one starting from the values given
function openExerciseForm({ index = null, back = 'page', name = '', kind = '', muscles = [] } = {}) {
  const e = index == null ? null : state.customExercises[index];
  ui.exForm = e
    ? { index, back, name: e.name, kind: exerciseInfo(e.name).kind || '', muscles: exerciseInfo(e.name).muscles.filter(m => MUSCLES.includes(m)), equipment: e.equipment || '' }
    : { index: null, back, name, kind, muscles: [...muscles], equipment: '' };
  // Locked: a stray tap outside must not throw away what was typed
  openModal('<div class="ex-form" id="ex-form"></div>', 'ex-form-modal', true);
  renderExForm();
  if (!e && matchMedia('(hover: hover)').matches) $('#exform-name').focus();
}

function exFormHint() {
  const { muscles } = ui.exForm;
  if (!muscles.length) return 'Tap every muscle group it works. With none picked it is filed under Other.';
  const names = muscles.map(m => m.toLowerCase());
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${lastOf(names)}` : names[0];
  return `Its sets count towards ${list}.`;
}

function renderExForm() {
  const f = ui.exForm;
  const editing = f.index != null;
  const chips = MUSCLES.map(m => {
    const on = f.muscles.includes(m);
    return `<button class="chip ${on ? 'on' : ''}" data-action="exform-muscle" data-value="${m}" aria-pressed="${on}">${m}</button>`;
  }).join('');
  const equipment = [['', 'None or other'], ...EQUIPMENT.map(e => [e, e])]
    .map(([value, label]) => `<option value="${value}" ${f.equipment === value ? 'selected' : ''}>${label}</option>`).join('');
  $('#ex-form').innerHTML = `<div class="modal-head">
      <h2>${editing ? 'Edit exercise' : 'New exercise'}</h2>
      <button class="icon-btn" data-action="exform-cancel" aria-label="Close">${icon('x')}</button>
    </div>
    <label class="field">Name
      <input type="text" id="exform-name" maxlength="80" data-input="exform-field" data-key="name" value="${esc(f.name)}" placeholder="e.g. Cable twist" autocomplete="off">
    </label>
    <div class="field"><span>How it is logged</span>${segmented('exform-kind', EX_KINDS, f.kind)}</div>
    ${f.kind === 'cardio' ? '<p class="muted small">Cardio is logged as a time, with a distance if you want one. It is kept out of the muscle groups.</p>' : `<div class="field">
      <span>Muscles worked</span>
      <div class="exform-muscles">
        <div class="chips">${chips}</div>
        <div id="exform-body">${bodyHighlight(f.muscles, 'small')}</div>
      </div>
      <span class="muted small" id="exform-hint">${exFormHint()}</span>
    </div>`}
    <label class="field">Equipment<select data-change="exform-field" data-key="equipment">${equipment}</select></label>
    <div class="row between gap-s wrap">
      ${editing ? `<button class="btn danger" data-action="exform-delete">${icon('trash', 16)} Delete</button>` : '<span></span>'}
      <span class="row gap-s">
        <button class="btn" data-action="exform-cancel">Cancel</button>
        <button class="btn primary" data-action="exform-save">${icon('check', 16)} ${editing ? 'Save' : f.back === 'picker' ? 'Add to workout' : 'Add exercise'}</button>
      </span>
    </div>`;
}

// Close the form and go back to wherever it was opened from
function leaveExForm() {
  const back = ui.exForm ? ui.exForm.back : 'page';
  ui.exForm = null;
  if (back !== 'picker' || !state.active) closeModal();
  render();
  if (back === 'picker' && state.active) openPicker(true);
}

Inputs['exform-field'] = el => {
  ui.exForm[el.dataset.key] = el.value;
};
Changes['exform-field'] = Inputs['exform-field'];

Actions['exform-kind'] = el => {
  ui.exForm.kind = el.dataset.value;
  renderExForm();
};

// Tick or untick a muscle group, updating the chip, the figure and the hint in place
Actions['exform-muscle'] = el => {
  const f = ui.exForm;
  const m = el.dataset.value;
  f.muscles = f.muscles.includes(m) ? f.muscles.filter(x => x !== m) : [...f.muscles, m];
  const on = f.muscles.includes(m);
  el.classList.toggle('on', on);
  el.setAttribute('aria-pressed', on);
  $('#exform-body').innerHTML = bodyHighlight(f.muscles, 'small');
  $('#exform-hint').textContent = exFormHint();
};

Actions['exform-cancel'] = () => leaveExForm();

Actions['exform-save'] = () => {
  const f = ui.exForm;
  const name = f.name.trim().replace(/\s+/g, ' ');
  if (!name) return toast('Give the exercise a name', 'bad');
  const editing = f.index != null;
  const old = editing ? state.customExercises[f.index] : null;
  const clash = exerciseIndex().get(norm(name));
  if (clash && !(old && norm(old.name) === norm(name))) return toast(`There is already an exercise called ${clash.name}`, 'bad');

  const cardio = f.kind === 'cardio';
  const entry = { name, muscle: cardio ? 'Cardio' : f.muscles[0] || 'Other', muscles: cardio ? [] : [...f.muscles], equipment: f.equipment };
  if (f.kind === 'hold') entry.kind = 'hold';
  if (editing) {
    if (old.name !== name) renameExercise(old.name, name);
    state.customExercises[f.index] = entry;
  } else {
    state.customExercises.push(entry);
  }
  save();
  // A new one made from the picker goes straight into the workout
  if (!editing && f.back === 'picker' && state.active) {
    ui.exForm = null;
    return addExerciseToActive(name);
  }
  leaveExForm();
  toast(editing ? 'Exercise updated' : `${name} added to your exercises`, 'good');
};

// Carry a new name through everything already logged or planned under the old one
function renameExercise(from, to) {
  const key = norm(from);
  const fix = list => list.forEach(x => x.exercises.forEach(ex => { if (norm(ex.name) === key) ex.name = to; }));
  fix(state.workouts);
  fix(state.routines);
  if (state.active) fix([state.active]);
  if (ui.exercise.key === key) ui.exercise.key = norm(to);
}

// ---------- deleting ----------

function exerciseUse(name) {
  const key = norm(name);
  const has = x => x.exercises.some(ex => norm(ex.name) === key);
  return { workouts: state.workouts.filter(has).length, routines: state.routines.filter(has).length };
}

// Never logged: one question. Logged: ask what should happen to those sets.
function askDeleteExercise(index, back) {
  const e = state.customExercises[index];
  const use = exerciseUse(e.name);
  const routines = use.routines ? ` It will also be taken out of ${plural(use.routines, 'routine')}.` : '';
  if (!use.workouts) {
    if (confirm(`Delete “${e.name}”?${routines}`)) deleteExercise(index, false, back);
    return;
  }
  ui.exForm = null;
  openModal(`<div class="modal-head">
      <h2>Delete “${esc(e.name)}”?</h2>
      <button class="icon-btn" data-action="exdel-cancel" data-back="${back}" aria-label="Close">${icon('x')}</button>
    </div>
    <p class="muted">You have logged it in ${plural(use.workouts, 'workout')}.${routines} What should happen to what you logged?</p>
    <div class="col gap-s">
      <button class="btn wide" data-action="exdel" data-i="${index}" data-back="${back}">Delete the exercise, keep what I logged</button>
      <button class="btn danger wide" data-action="exdel" data-i="${index}" data-back="${back}" data-history="1">${icon('trash', 16)} Delete it and everything logged for it</button>
      <button class="btn wide" data-action="exdel-cancel" data-back="${back}">Cancel</button>
    </div>
    <p class="muted small">Kept sets stay in your history and on the Exercises page. Deleting them can’t be undone.</p>`);
}

function deleteExercise(index, withHistory, back) {
  const [gone] = state.customExercises.splice(index, 1);
  const key = norm(gone.name);
  const without = exercises => exercises.filter(ex => norm(ex.name) !== key);
  // A routine or workout left with nothing in it goes too
  const strip = list => list.map(x => ({ ...x, exercises: without(x.exercises) })).filter(x => x.exercises.length);
  state.routines = strip(state.routines);
  if (withHistory) state.workouts = strip(state.workouts);
  const a = state.active;
  if (a && (withHistory || a.mode === 'routine')) a.exercises = without(a.exercises);
  save();
  ui.exForm = { back };
  leaveExForm();
  toast(`${gone.name} deleted`);
}

Actions['exform-delete'] = () => askDeleteExercise(ui.exForm.index, ui.exForm.back);

Actions.exdel = el => deleteExercise(Number(el.dataset.i), !!el.dataset.history, el.dataset.back);

Actions['exdel-cancel'] = el => {
  ui.exForm = { back: el.dataset.back };
  leaveExForm();
};

// ---------- where they are listed ----------

// From the picker (by name), or from Tools and the Exercises page
Actions['edit-custom'] = el => {
  const index = el.dataset.i != null ? Number(el.dataset.i) : customIndex(el.dataset.name);
  if (index >= 0) openExerciseForm({ index, back: $('#picker-list') ? 'picker' : 'page' });
};

Actions['new-custom'] = () => openExerciseForm();

Actions['del-custom'] = el => askDeleteExercise(Number(el.dataset.i), 'page');

// The card on the Tools page
function customExercisesCard() {
  const a = analyse();
  const rows = state.customExercises.map((e, i) => {
    const info = exerciseInfo(e.name);
    const entry = a.exercises.get(norm(e.name));
    return `<li>
      <span class="stack"><strong>${esc(e.name)}</strong>
        <span class="muted small">${esc(musclesLabel(info))}${info.equipment ? ` · ${esc(info.equipment)}` : ''}${info.kind ? ' · timed' : ''} · ${entry ? `logged ${entry.sessions.length === 1 ? 'once' : `${entry.sessions.length} times`}` : 'not logged yet'}</span></span>
      <span class="row gap-xs">
        <button class="icon-btn" data-action="edit-custom" data-i="${i}" aria-label="Edit ${esc(e.name)}">${icon('edit', 16)}</button>
        <button class="icon-btn danger" data-action="del-custom" data-i="${i}" aria-label="Delete ${esc(e.name)}">${icon('trash', 16)}</button>
      </span>
    </li>`;
  }).join('');
  return `<section class="card">
    <div class="card-head"><h3>My exercises</h3><button class="btn sm" data-action="new-custom">${icon('plus', 14)} New exercise</button></div>
    ${rows ? `<ul class="list">${rows}</ul>`
      : '<p class="muted small">Exercises you add yourself are listed here, to edit or delete. Each one can work more than one muscle group, such as biceps and back.</p>'}
  </section>`;
}
