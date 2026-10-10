'use strict';

// The workout page has two states. With nothing in progress it is a launcher
// (routines and templates). Otherwise state.active holds the thing being
// edited: a workout (new or old) or a routine, all through the same editor.

// ---------- building state.active ----------

function blankSet(target) {
  const s = { reps: '', weight: '', type: 'normal', done: false };
  if (target) s.target = target;
  return s;
}

function replaceActiveOk() {
  const a = state.active;
  if (!a || !a.exercises.length) return true;
  return confirm(a.mode === 'routine' ? 'Discard the routine you are editing?' : 'Discard the workout in progress?');
}

// source: a routine, template or past workout. Its sets become greyed-out
// targets; the inputs stay empty until the set is done.
function startWorkout(source) {
  if (!replaceActiveOk()) return;
  state.active = {
    mode: 'workout',
    date: isoDate(),
    name: source ? source.name : '',
    notes: '',
    startedAt: Date.now(),
    exercises: !source ? [] : source.exercises.map(ex => ({
      name: ex.name,
      notes: '',
      sets: ex.sets.map(s => ({ ...blankSet({ reps: s.reps, weight: s.weight }), type: s.type || 'normal' })),
    })),
  };
  stopTimer();
  persist();
  go('workout');
}

function editWorkout(w) {
  if (!replaceActiveOk()) return;
  state.active = {
    mode: 'workout',
    editingId: w.id,
    date: w.date,
    name: w.name,
    notes: w.notes || '',
    durationMin: w.duration ? Math.round(w.duration / 60) : '',
    exercises: w.exercises.map(ex => ({
      name: ex.name,
      notes: ex.notes || '',
      sets: ex.sets.map(s => ({ reps: s.reps, weight: s.weight || '', type: s.type || 'normal', done: true })),
    })),
  };
  persist();
  go('workout');
}

function editRoutine(r) {
  if (!replaceActiveOk()) return;
  state.active = {
    mode: 'routine',
    routineId: r ? r.id : null,
    name: r ? r.name : '',
    exercises: !r ? [] : r.exercises.map(ex => ({
      name: ex.name,
      notes: '',
      sets: ex.sets.map(s => ({ reps: s.reps || '', weight: s.weight || '', type: s.type || 'normal', done: false })),
    })),
  };
  persist();
  go('workout');
}

function routineFrom(source) {
  return {
    id: Date.now(),
    name: source.name,
    exercises: source.exercises.map(ex => ({
      name: ex.name,
      sets: ex.sets.map(s => ({ reps: s.reps || '', weight: s.weight || '', type: s.type || 'normal' })),
    })),
  };
}

const hasRoutine = name => state.routines.some(r => norm(r.name) === norm(name));

// ---------- comparing against last time ----------

// The session to beat: the latest one before the workout being logged
function prevFor(name) {
  const entry = analyse().exercises.get(norm(name));
  if (!entry) return null;
  const a = state.active;
  if (a.editingId) {
    const cur = entry.sessions.find(s => s.wid === a.editingId);
    if (cur) return cur.prev;
  }
  for (let i = entry.sessions.length - 1; i >= 0; i--) {
    const s = entry.sessions[i];
    if (s.wid !== a.editingId && (a.editingId ? s.date < a.date : s.date <= a.date)) return s;
  }
  return null;
}

// Set 2 is compared with last time's set 2; warm-ups with warm-ups
function matchPrev(prev, sets, si) {
  if (!prev) return null;
  const warm = sets[si].type === 'warmup';
  let rank = 0;
  for (let i = 0; i < si; i++) if ((sets[i].type === 'warmup') === warm) rank++;
  return (warm ? prev.warm : prev.work)[rank] || null;
}

function compareSet(s, p) {
  if (!p || !(Number(s.reps) > 0)) return null;
  const cur = { reps: Number(s.reps), weight: Number(s.weight) || 0 };
  const d = setScore(cur) - setScore(p);
  const dw = cur.weight - p.weight;
  const dr = cur.reps - p.reps;
  const parts = [];
  if (Math.abs(dw) > EPS) parts.push(`${signed(dw, 2)} ${unit()}`);
  if (dr) parts.push(`${signed(dr, 0)} rep${Math.abs(dr) === 1 ? '' : 's'}`);
  return { status: d > EPS ? 'up' : d < -EPS ? 'down' : 'same', text: parts.join(', ') || 'Matched' };
}

const CMP_MARK = { up: '▲', down: '▼', same: '=' };
const cmpHtml = c => c ? `<span class="delta ${c.status}">${CMP_MARK[c.status]} ${c.text}</span>` : '';

// ---------- the editor ----------

function setRowHtml(a, ex, ei, si, prev, label) {
  const s = ex.sets[si];
  const routine = a.mode === 'routine';
  const p = matchPrev(prev, ex.sets, si);
  const hint = p || s.target || {};
  const cmp = routine ? null : compareSet(s, p);
  return `<tr class="set-row t-${s.type}${s.done ? ' done' : ''}${cmp ? ` ${cmp.status}` : ''}" data-ei="${ei}" data-si="${si}">
    <td><button class="set-type" data-action="set-type" data-tip="${SET_TYPES[s.type].title}|Tap to change the set type">${label}</button></td>
    ${routine ? '' : `<td class="prev">${p ? fmtSetShort(p) : '–'}</td>`}
    <td><input type="number" inputmode="decimal" step="0.5" min="0" data-input="set-field" data-key="weight" value="${esc(s.weight)}" placeholder="${esc(hint.weight || '')}" aria-label="Weight"></td>
    <td><input type="number" inputmode="numeric" step="1" min="0" data-input="set-field" data-key="reps" value="${esc(s.reps)}" placeholder="${esc(hint.reps || '')}" aria-label="Reps"></td>
    ${routine ? '' : `<td class="cmp">${cmpHtml(cmp)}</td>
    <td><button class="done-btn" data-action="set-done" aria-pressed="${s.done}" aria-label="Mark set as done">${icon('check', 16)}</button></td>`}
    <td><button class="icon-btn" data-action="rm-set" aria-label="Remove set">${icon('x', 14)}</button></td>
  </tr>`;
}

function exerciseCardHtml(a, ex, ei) {
  const routine = a.mode === 'routine';
  const info = exerciseInfo(ex.name);
  const entry = analyse().exercises.get(norm(ex.name));
  const prev = routine ? null : prevFor(ex.name);
  let n = 0;
  const rows = ex.sets.map((s, si) => setRowHtml(a, ex, ei, si, prev, s.type === 'normal' ? ++n : SET_TYPES[s.type].label)).join('');
  const meta = routine ? ''
    : prev ? `<p class="muted small ex-meta">Last time (${fmtDate(prev.date, 'short')}): ${fmtSets(prev.work)} · Record ${fmtSet(entry.records.best.bestSet)}</p>`
      : '<p class="muted small ex-meta">First time logging this exercise.</p>';
  return `<section class="card ex-card" data-ei="${ei}">
    <div class="card-head">
      <div><h3>${esc(ex.name)}</h3><span class="muted small">${info.muscle}${info.equipment ? ` · ${info.equipment}` : ''}</span></div>
      <div class="row gap-xs">
        ${entry ? `<button class="icon-btn" data-action="ex-history" data-tip="Past sessions">${icon('chart', 16)}</button>` : ''}
        <button class="icon-btn" data-action="move-ex" data-dir="-1" ${ei === 0 ? 'disabled' : ''} aria-label="Move up">${icon('up', 16)}</button>
        <button class="icon-btn" data-action="move-ex" data-dir="1" ${ei === a.exercises.length - 1 ? 'disabled' : ''} aria-label="Move down">${icon('down', 16)}</button>
        <button class="icon-btn danger" data-action="rm-ex" aria-label="Remove exercise">${icon('trash', 16)}</button>
      </div>
    </div>
    ${meta}
    <table class="sets">
      <thead><tr><th>Set</th>${routine ? '' : '<th>Previous</th>'}<th>${unit()}</th><th>Reps</th>${routine ? '' : '<th class="cmp">vs last time</th><th>Done</th>'}<th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="row gap-s wrap">
      <button class="btn sm" data-action="add-set">${icon('plus', 14)} Add set</button>
      ${routine ? '' : `<input class="note-input grow" placeholder="Note for this exercise" data-input="ex-note" value="${esc(ex.notes)}" aria-label="Exercise note">`}
    </div>
  </section>`;
}

function liveStats(a) {
  const t = { total: 0, done: 0, volume: 0, up: 0, same: 0, down: 0 };
  for (const ex of a.exercises) {
    const prev = prevFor(ex.name);
    ex.sets.forEach((s, si) => {
      if (s.type === 'warmup') return;
      const reps = Number(s.reps) || 0;
      t.total++;
      if (s.done) t.done++;
      if (reps > 0) t.volume += reps * (Number(s.weight) || 0);
      const c = compareSet(s, matchPrev(prev, ex.sets, si));
      if (c) t[c.status]++;
    });
  }
  return t;
}

function liveSummaryHtml(a) {
  const t = liveStats(a);
  return `<div class="card-head"><h3>This workout</h3><span class="muted small">${t.done} of ${t.total} sets done</span></div>
    <div class="progress"><span style="width:${t.total ? (t.done / t.total * 100).toFixed(0) : 0}%"></span></div>
    <div class="mini-stats">
      <div><strong>${a.exercises.length}</strong><span>Exercises</span></div>
      <div><strong>${compact(t.volume)}</strong><span>${unit()} lifted</span></div>
      <div><strong><span class="delta up">▲ ${t.up}</span> <span class="delta same">= ${t.same}</span> <span class="delta down">▼ ${t.down}</span></strong><span>Sets vs last time</span></div>
    </div>`;
}

function refreshLive() {
  const el = $('#live-summary');
  if (el && state.active) el.innerHTML = liveSummaryHtml(state.active);
}

function activeView(a) {
  const routine = a.mode === 'routine';
  const head = routine
    ? `<section class="card workout-head">
        <div class="card-head"><h3>${a.routineId ? 'Edit routine' : 'New routine'}</h3></div>
        <input class="title-input" placeholder="Routine name, e.g. Push day" data-input="active-field" data-key="name" value="${esc(a.name)}" aria-label="Routine name">
        <p class="muted small">Add exercises and the sets you plan to do. Reps and weight are optional targets. When you start the routine you'll also see what you did last time.</p>
        <div class="row end gap-s">
          <button class="btn" data-action="discard-active">Cancel</button>
          <button class="btn primary" data-action="save-routine">${icon('check', 16)} Save routine</button>
        </div>
      </section>`
    : `<section class="card workout-head">
        <div class="row gap-s wrap">
          <input class="title-input grow" placeholder="Workout name" data-input="active-field" data-key="name" value="${esc(a.name)}" aria-label="Workout name">
          <label class="field">Date<input type="date" data-change="active-date" value="${esc(a.date)}" max="${isoDate()}"></label>
          ${isLive(a)
            ? '<div class="field"><span>Elapsed</span><span class="elapsed" data-elapsed></span></div>'
            : `<label class="field">Minutes<input type="number" inputmode="numeric" min="0" data-input="active-field" data-key="durationMin" value="${esc(a.durationMin ?? '')}" placeholder="–"></label>`}
        </div>
        <input class="note-input" placeholder="Notes: how it felt, sleep, anything worth remembering" data-input="active-field" data-key="notes" value="${esc(a.notes)}" aria-label="Workout notes">
        <div class="row end gap-s">
          <button class="btn danger" data-action="discard-active">${a.editingId ? 'Cancel edit' : 'Discard'}</button>
          <button class="btn primary" data-action="finish-workout">${icon('check', 16)} ${a.editingId ? 'Save changes' : 'Finish workout'}</button>
        </div>
      </section>`;

  const cards = a.exercises.map((ex, ei) => exerciseCardHtml(a, ex, ei)).join('');
  const side = routine ? '' : `<aside class="c-4 col side">
      ${timerCard()}
      <section class="card" id="live-summary">${liveSummaryHtml(a)}</section>
      ${plateCard()}
    </aside>`;
  return `<div class="grid">
    <div class="${routine ? 'c-12 narrow' : 'c-8'} col">
      ${head}
      ${a.exercises.length ? cards : emptyState('🏋️', 'No exercises yet. Add your first one to get going.')}
      <button class="btn dashed wide lg" data-action="open-picker">${icon('plus', 18)} Add exercise</button>
    </div>
    ${side}
  </div>`;
}

// ---------- the launcher ----------

function routineLines(exercises, max = 6) {
  const lines = exercises.slice(0, max).map(ex => `<li><span class="muted">${ex.sets.length} ×</span> ${esc(ex.name)}</li>`).join('');
  return `<ul class="routine-lines">${lines}${exercises.length > max ? `<li class="muted">+ ${exercises.length - max} more</li>` : ''}</ul>`;
}

function lastDone(name) {
  let last = '';
  for (const w of state.workouts) if (norm(w.name) === norm(name) && w.date > last) last = w.date;
  return last;
}

function routineCard(r) {
  const last = lastDone(r.name);
  return `<section class="card routine">
    <div class="card-head"><h3>${esc(r.name)}</h3>
      <div class="row gap-xs">
        <button class="icon-btn" data-action="edit-routine" data-id="${r.id}" aria-label="Edit routine">${icon('edit', 16)}</button>
        <button class="icon-btn danger" data-action="del-routine" data-id="${r.id}" aria-label="Delete routine">${icon('trash', 16)}</button>
      </div></div>
    <span class="muted small">${last ? `Last done ${relDay(last).toLowerCase()}` : 'Not done yet'}</span>
    ${routineLines(r.exercises)}
    <button class="btn primary wide" data-action="start-routine" data-id="${r.id}">${icon('play', 16)} Start</button>
  </section>`;
}

function templateCard(t, i) {
  const saved = hasRoutine(t.name);
  return `<section class="card routine">
    <div class="card-head"><h3>${esc(t.name)}</h3><span class="tag">${t.tag}</span></div>
    ${routineLines(t.exercises)}
    <div class="row gap-s">
      <button class="btn primary grow" data-action="start-template" data-i="${i}">${icon('play', 16)} Start</button>
      <button class="btn" data-action="save-template" data-i="${i}" ${saved ? 'disabled' : ''} data-tip="${saved ? 'Already in your routines' : 'Save to my routines'}" aria-label="Save to my routines">${icon(saved ? 'check' : 'bookmark', 16)}</button>
    </div>
  </section>`;
}

function launcherView() {
  const next = nextRoutine();
  const routines = state.routines.map(routineCard).join('');
  return `<div class="grid">
    <section class="card c-8 launch">
      <div>
        <h2>Ready to train?</h2>
        <p class="muted">Start from a routine below, or begin with a blank workout and add exercises as you go.</p>
      </div>
      <div class="row gap-s wrap">
        <button class="btn primary lg" data-action="start-empty">${icon('plus', 18)} Start empty workout</button>
        <button class="btn lg" data-action="new-routine">${icon('bookmark', 18)} New routine</button>
      </div>
    </section>
    <div class="c-4 col">${next ? upNextCard() : `<section class="card accent-card">
      <div class="card-head"><h3>Tip</h3></div>
      <p class="muted small">Finish a workout and save it as a routine. Next time, last session's numbers are filled in for you to beat.</p></section>`}</div>

    <div class="c-12">
      <h3 class="section-title">My routines</h3>
      ${routines ? `<div class="cards">${routines}</div>` : '<p class="muted small">No routines yet. Save one of the templates below, or build your own with “New routine”.</p>'}
    </div>
    <div class="c-12">
      <h3 class="section-title">Templates</h3>
      <div class="cards">${TEMPLATES.map(templateCard).join('')}</div>
    </div>
  </div>`;
}

Views.workout = {
  get title() {
    const a = state.active;
    return !a ? 'Workout' : a.mode === 'routine' ? 'Routine' : a.editingId ? 'Edit workout' : 'Workout in progress';
  },
  render() {
    return state.active ? activeView(state.active) : launcherView();
  },
};

// ---------- exercise picker ----------

function pickerChips() {
  return ['All', ...MUSCLES].map(m =>
    `<button class="chip ${ui.picker.muscle === m ? 'on' : ''}" data-action="picker-muscle" data-value="${m}">${m}</button>`).join('');
}

function pickerList() {
  const { q, muscle } = ui.picker;
  const a = analyse();
  const nq = norm(q);
  const inWorkout = new Set(state.active.exercises.map(e => norm(e.name)));
  let list = [...exerciseIndex().values()];
  // Names that only exist in old workouts still deserve a row
  for (const e of a.exercises.values()) if (!exerciseIndex().has(e.key)) list.push(e.info);
  if (muscle !== 'All') list = list.filter(e => e.muscle === muscle);
  if (nq) list = list.filter(e => norm(e.name).includes(nq));
  const lastDate = e => a.exercises.has(norm(e.name)) ? lastOf(a.exercises.get(norm(e.name)).sessions).date : '';
  list.sort((x, y) => lastDate(y).localeCompare(lastDate(x)) || x.name.localeCompare(y.name));

  const rows = list.map(e => `<button class="picker-row" data-action="pick-exercise" data-name="${esc(e.name)}">
      <span class="stack"><strong>${esc(e.name)}</strong><span class="muted small">${e.muscle}${e.equipment ? ` · ${e.equipment}` : ''}</span></span>
      <span class="muted small nowrap">${inWorkout.has(norm(e.name)) ? '✓ Added' : lastDate(e) ? relDay(lastDate(e)) : ''}</span>
    </button>`).join('');
  const known = exerciseIndex().has(nq) || a.exercises.has(nq);
  const create = nq && !known ? `<div class="picker-create">
      <span>Add <strong>“${esc(q.trim())}”</strong> as a new exercise</span>
      <select id="picker-new-muscle" aria-label="Muscle group">${[...MUSCLES, 'Other'].map(m => `<option ${m === muscle ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <button class="btn primary sm" data-action="create-exercise">Add</button>
    </div>` : '';
  return (rows || (create ? '' : '<p class="muted small pad">No exercises match.</p>')) + create;
}

function addExerciseToActive(name) {
  const prev = state.active.mode === 'workout' ? prevFor(name) : null;
  const sets = Array.from({ length: prev ? clamp(prev.work.length, 1, 8) : 3 }, () => blankSet());
  state.active.exercises.push({ name, notes: '', sets });
  closeModal();
  persist();
  render();
  const card = lastOf($$('.ex-card'));
  if (card) card.scrollIntoView({ block: 'center', behavior: motionOn() ? 'smooth' : 'auto' });
}

Actions['open-picker'] = () => {
  ui.picker = { q: '', muscle: 'All' };
  openModal(`<div class="modal-head"><h2>Add exercise</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">${icon('x')}</button></div>
    <div class="search">${icon('search', 16)}<input id="picker-q" type="search" placeholder="Search or type a new exercise" data-input="picker-q" autocomplete="off"></div>
    <div class="chips" id="picker-chips">${pickerChips()}</div>
    <div class="picker-list" id="picker-list">${pickerList()}</div>`, 'picker');
  $('#picker-q').focus();
};

Inputs['picker-q'] = el => {
  ui.picker.q = el.value;
  $('#picker-list').innerHTML = pickerList();
};

Actions['picker-muscle'] = el => {
  ui.picker.muscle = el.dataset.value;
  $('#picker-chips').innerHTML = pickerChips();
  $('#picker-list').innerHTML = pickerList();
};

Actions['pick-exercise'] = el => addExerciseToActive(el.dataset.name);

Actions['create-exercise'] = () => {
  const name = ui.picker.q.trim();
  state.customExercises.push({ name, muscle: $('#picker-new-muscle').value, equipment: '' });
  save();
  addExerciseToActive(name);
};

// ---------- launcher actions ----------

const routineById = el => state.routines.find(r => r.id === Number(el.dataset.id));
const workoutById = el => state.workouts.find(w => w.id === Number(el.dataset.id));

Actions['start-empty'] = () => startWorkout(null);
Actions['start-routine'] = el => startWorkout(routineById(el));
Actions['start-template'] = el => startWorkout(TEMPLATES[Number(el.dataset.i)]);
Actions['repeat-workout'] = el => startWorkout(workoutById(el));
Actions['edit-workout'] = el => editWorkout(workoutById(el));
Actions['new-routine'] = () => editRoutine(null);
Actions['edit-routine'] = el => editRoutine(routineById(el));

Actions['del-routine'] = el => {
  const r = routineById(el);
  if (!confirm(`Delete the routine “${r.name}”? Your logged workouts stay.`)) return;
  state.routines = state.routines.filter(x => x !== r);
  save();
  render();
};

Actions['save-template'] = el => {
  const t = TEMPLATES[Number(el.dataset.i)];
  state.routines.push(routineFrom(t));
  save();
  render();
  toast(`${t.name} saved to your routines`, 'good');
};

// From History or the finish summary: turn a logged workout into a routine
Actions['save-as-routine'] = el => {
  const w = workoutById(el);
  const routine = routineFrom({ name: w.name, exercises: w.exercises.map(ex => ({ name: ex.name, sets: ex.sets })) });
  const existing = state.routines.findIndex(r => norm(r.name) === norm(w.name));
  if (existing >= 0) {
    if (!confirm(`You already have a routine called “${w.name}”. Replace it with this workout?`)) return;
    routine.id = state.routines[existing].id;
    state.routines[existing] = routine;
  } else {
    state.routines.push(routine);
  }
  save();
  if (!modalOpen()) render();
  else el.outerHTML = '<span class="delta up">✓ Saved as a routine</span>';
  toast(`“${w.name}” saved as a routine`, 'good');
};

// ---------- editor actions ----------

const eiOf = el => Number(el.closest('[data-ei]').dataset.ei);
const siOf = el => Number(el.closest('[data-si]').dataset.si);

function rerenderActive() {
  persist();
  render();
}

Actions['add-set'] = el => {
  const sets = state.active.exercises[eiOf(el)].sets;
  const prev = lastOf(sets);
  // A new set repeats the one above it: same type and target, values left to fill in
  const s = blankSet(prev && prev.target ? { ...prev.target } : prev && Number(prev.reps) > 0 ? { reps: prev.reps, weight: prev.weight } : null);
  if (prev && prev.type !== 'warmup') s.type = prev.type;
  if (state.active.mode === 'routine' && prev) { s.reps = prev.reps; s.weight = prev.weight; }
  sets.push(s);
  rerenderActive();
};

Actions['rm-set'] = el => {
  state.active.exercises[eiOf(el)].sets.splice(siOf(el), 1);
  rerenderActive();
};

Actions['set-type'] = el => {
  const s = state.active.exercises[eiOf(el)].sets[siOf(el)];
  const order = Object.keys(SET_TYPES);
  s.type = order[(order.indexOf(s.type) + 1) % order.length];
  rerenderActive();
};

Actions['move-ex'] = el => {
  const list = state.active.exercises;
  const i = eiOf(el);
  const j = i + Number(el.dataset.dir);
  [list[i], list[j]] = [list[j], list[i]];
  rerenderActive();
};

Actions['rm-ex'] = el => {
  const ex = state.active.exercises[eiOf(el)];
  if (ex.sets.some(s => s.reps !== '') && !confirm(`Remove ${ex.name} and its sets?`)) return;
  state.active.exercises.splice(eiOf(el), 1);
  rerenderActive();
};

Actions['set-done'] = el => {
  const a = state.active;
  const ei = eiOf(el);
  const si = siOf(el);
  const ex = a.exercises[ei];
  const s = ex.sets[si];
  if (!s.done) {
    // Ticking an empty set accepts the greyed-out numbers
    const hint = matchPrev(prevFor(ex.name), ex.sets, si) || s.target || {};
    if (s.reps === '' && hint.reps) s.reps = hint.reps;
    if (s.weight === '' && hint.weight) s.weight = hint.weight;
    if (!(Number(s.reps) > 0)) return toast('Enter the reps for this set first', 'bad');
  }
  s.done = !s.done;
  rerenderActive();
  if (!s.done) return;
  const row = $(`tr[data-ei="${ei}"][data-si="${si}"]`);
  if (row) row.classList.add('just-done');
  if (isLive(a) && state.settings.autoRest) startTimer(state.settings.restSeconds);
  announcePr(ex, s);
};

// Celebrate the moment a set beats the all-time best, once per new high
function announcePr(ex, s) {
  const entry = analyse().exercises.get(norm(ex.name));
  if (!entry || state.active.editingId || s.type === 'warmup') return;
  const sc = setScore({ reps: Number(s.reps), weight: Number(s.weight) || 0 });
  if (sc <= Math.max(entry.max.best, ex.prShown || 0) + EPS) return;
  ex.prShown = sc;
  persist();
  toast(`★ New personal record on ${ex.name}!`, 'good');
  confetti(40);
}

Actions['ex-history'] = el => {
  const entry = analyse().exercises.get(norm(state.active.exercises[eiOf(el)].name));
  const rec = entry.records;
  const rows = [...entry.sessions].reverse().slice(0, 8).map(s => `<tr>
      <td class="nowrap">${fmtDate(s.date, 'short')}</td>
      <td>${fmtSets(s.sets)}</td>
      <td class="right">${badge(s.status, s.pr)}</td>
    </tr>`).join('');
  openModal(`<div class="modal-head">
      <div><h2>${esc(entry.name)}</h2><span class="muted small">${plural(entry.sessions.length, 'session')} logged</span></div>
      <button class="icon-btn" data-action="close-modal" aria-label="Close">${icon('x')}</button>
    </div>
    <div class="mini-stats">
      <div><strong>${fmtSet(rec.best.bestSet)}</strong><span>Best set</span></div>
      <div><strong>${rec.best.weighted ? `${num(rec.best.best)} ${unit()}` : '–'}</strong><span>Est. 1RM</span></div>
      <div><strong>${sparkline(entry.sessions.slice(-12).map(s => s.best), lastOf(entry.sessions).status, 110, 30)}</strong><span>Trend</span></div>
    </div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Sets</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <button class="btn wide" data-action="open-ex" data-key="${esc(entry.key)}">Open the full progress page</button>`);
};

Inputs['active-field'] = el => {
  state.active[el.dataset.key] = el.value;
  persist();
};

Inputs['ex-note'] = el => {
  state.active.exercises[eiOf(el)].notes = el.value;
  persist();
};

// Typing a weight or reps recolours the row in place; no re-render, so focus stays put
Inputs['set-field'] = el => {
  const a = state.active;
  const ex = a.exercises[eiOf(el)];
  const si = siOf(el);
  const s = ex.sets[si];
  s[el.dataset.key] = el.value;
  persist();
  if (a.mode !== 'workout') return;
  const cmp = compareSet(s, matchPrev(prevFor(ex.name), ex.sets, si));
  const row = el.closest('tr');
  row.classList.remove('up', 'down', 'same');
  if (cmp) row.classList.add(cmp.status);
  $('.cmp', row).innerHTML = cmpHtml(cmp);
  refreshLive();
};

Changes['active-date'] = el => {
  state.active.date = el.value || isoDate();
  rerenderActive();
};

Actions['discard-active'] = () => {
  const a = state.active;
  const what = a.mode === 'routine' ? 'routine' : a.editingId ? 'changes' : 'workout';
  if (a.exercises.length && !confirm(`Discard this ${what}? Nothing will be saved.`)) return;
  state.active = null;
  stopTimer();
  persist();
  render(true);
};

Actions['save-routine'] = () => {
  const a = state.active;
  const name = a.name.trim();
  const exercises = a.exercises.filter(ex => ex.sets.length).map(ex => ({
    name: ex.name,
    sets: ex.sets.map(s => ({ reps: Math.floor(Number(s.reps)) || '', weight: Number(s.weight) || '', type: s.type })),
  }));
  if (!name) return toast('Give the routine a name', 'bad');
  if (!exercises.length) return toast('Add at least one exercise with a set', 'bad');
  const routine = { id: a.routineId || Date.now(), name, exercises };
  if (a.routineId) state.routines = state.routines.map(r => r.id === a.routineId ? routine : r);
  else state.routines.push(routine);
  state.active = null;
  save();
  render(true);
  toast('Routine saved', 'good');
};

function defaultWorkoutName() {
  const h = new Date().getHours();
  return `${h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'} workout`;
}

Actions['finish-workout'] = () => {
  const a = state.active;
  const exercises = a.exercises.map(ex => ({
    name: ex.name,
    notes: (ex.notes || '').trim(),
    sets: ex.sets
      .map(s => ({ reps: Math.floor(Number(s.reps)) || 0, weight: Math.max(0, Number(s.weight) || 0), type: s.type }))
      .filter(s => s.reps > 0),
  })).filter(ex => ex.sets.length);
  if (!exercises.length) return toast('Enter the reps for at least one set first', 'bad');

  const workout = {
    id: a.editingId || Date.now(),
    date: a.date || isoDate(),
    name: a.name.trim() || defaultWorkoutName(),
    notes: a.notes.trim(),
    duration: isLive(a) ? Math.round((Date.now() - a.startedAt) / 1000) : Math.round((Number(a.durationMin) || 0) * 60),
    exercises,
  };
  if (a.editingId) state.workouts = state.workouts.map(w => w.id === a.editingId ? workout : w);
  else state.workouts.push(workout);
  state.active = null;
  stopTimer();
  save();
  keepStorage();
  ui.history.month = workout.date.slice(0, 7);
  ui.history.day = null;
  go('history');
  if (a.editingId) toast('Workout updated', 'good');
  else showSummary(workout);
};

// Shown after finishing a workout
function showSummary(w) {
  const t = analyse().byWorkout.get(w.id);
  const down = t.compared - t.up;
  const headline = t.prs ? `${plural(t.prs, 'new personal record')}!`
    : t.compared ? `You improved on ${t.up} of ${plural(t.compared, 'exercise')}.`
      : 'First entries logged. Next time you’ll see how you compare.';
  const rows = t.sessions.map(s => `<li class="${s.status}">
      <span class="stack"><strong>${esc(s.name)}</strong>
        <span class="muted small">Best set ${fmtSet(s.bestSet)}${s.prs.length ? ` · ${s.prs.map(p => PR_LABEL[p](s)).join(' · ')}` : ''}</span></span>
      ${badge(s.status, s.pr)}
    </li>`).join('');
  openModal(`<div class="summary">
      <div class="hero-icon">${t.prs ? '🏆' : down > t.up ? '💪' : '✅'}</div>
      <h2>${esc(w.name)} complete</h2>
      <p class="muted">${headline}</p>
      <div class="mini-stats">
        <div><strong>${w.duration ? fmtDuration(w.duration) : '–'}</strong><span>Duration</span></div>
        <div><strong>${count(t.sets)}</strong><span>Sets</span></div>
        <div><strong>${count(Math.round(t.volume))}</strong><span>${unit()} lifted</span></div>
        <div><strong><span class="delta up">▲ ${t.up}</span> <span class="delta down">▼ ${down}</span></strong><span>vs last time</span></div>
      </div>
      <ul class="list status-list">${rows}</ul>
      <div class="row gap-s">
        ${hasRoutine(w.name) ? '' : `<button class="btn grow" data-action="save-as-routine" data-id="${w.id}">${icon('bookmark', 16)} Save as routine</button>`}
        <button class="btn primary grow" data-action="close-modal">Done</button>
      </div>
    </div>`);
  countUp($('#modal'));
  if (t.prs) confetti();
}
