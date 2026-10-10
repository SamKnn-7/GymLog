'use strict';

// ---------- plate calculator (also shown beside the workout editor) ----------

function plateOut() {
  const target = Number(ui.tools.plateTarget);
  return target > 0
    ? plateVisual(target, Number(state.settings.barWeight) || 0)
    : '<p class="muted small">Type the weight you want on the bar to see which plates to load on each side.</p>';
}

function plateCard() {
  return `<section class="card">
    <div class="card-head"><h3>Plate calculator</h3><span class="muted small">${num(Number(state.settings.barWeight) || 0)} ${unit()} bar</span></div>
    <input type="number" inputmode="decimal" step="0.5" min="0" placeholder="Target weight (${unit()})" data-input="plate-target" value="${esc(ui.tools.plateTarget)}" aria-label="Target weight">
    <div id="plate-out">${plateOut()}</div>
  </section>`;
}

Inputs['plate-target'] = el => {
  ui.tools.plateTarget = el.value;
  $('#plate-out').innerHTML = plateOut();
};

// ---------- one-rep max calculator ----------

function rmOut() {
  const w = Number(ui.tools.rmWeight);
  const r = Number(ui.tools.rmReps);
  if (!(w > 0 && r > 0)) return '<p class="muted small">Enter a weight and the reps you did with it to estimate your one-rep max and working weights.</p>';
  const oneRm = r === 1 ? w : w * (1 + r / 30);
  const rows = [100, 95, 90, 85, 80, 75, 70, 65, 60].map(pct => `<tr>
      <td>${pct}%</td>
      <td class="num"><strong>${num(oneRm * pct / 100)} ${unit()}</strong></td>
      <td class="num muted">${plural(pct === 100 ? 1 : Math.round(30 * (100 / pct - 1)), 'rep')}</td>
    </tr>`).join('');
  return `<p class="rm-result"><span class="big-num">${num(oneRm)}</span> <span class="muted">${unit()} estimated one-rep max</span></p>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Intensity</th><th class="num">Weight</th><th class="num">About</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

Inputs['rm-field'] = el => {
  ui.tools[el.dataset.key] = el.value;
  $('#rm-out').innerHTML = rmOut();
};

// ---------- settings ----------

const select = (key, options) => `<select data-change="setting" data-key="${key}">${options.map(([v, label]) =>
  `<option value="${v}" ${String(state.settings[key]) === String(v) ? 'selected' : ''}>${label}</option>`).join('')}</select>`;

Views.tools = {
  title: 'Tools',
  render() {
    const s = state.settings;
    const u = unit();
    const custom = state.customExercises.map((e, i) => `<li>
        <span class="stack"><strong>${esc(e.name)}</strong><span class="muted small">${e.muscle}</span></span>
        <button class="icon-btn danger" data-action="del-custom" data-i="${i}" aria-label="Delete exercise">${icon('trash', 16)}</button>
      </li>`).join('');
    const empty = !state.workouts.length && !state.bodyweights.length;
    return `<div class="grid">
      <div class="c-6 col">
        ${plateCard()}
        <section class="card">
          <div class="card-head"><h3>Preferences</h3></div>
          <div class="form-grid">
            <label class="field">Weight unit${select('unit', [['kg', 'Kilograms (kg)'], ['lb', 'Pounds (lb)']])}</label>
            <label class="field">Theme${select('theme', [['light', 'Light'], ['dark', 'Dark']])}</label>
            <label class="field">Animations${select('motion', [['on', 'On'], ['auto', 'Follow system setting'], ['off', 'Off']])}</label>
            <label class="field">Workouts per week goal<input type="number" inputmode="numeric" min="1" max="14" data-change="setting" data-key="weeklyGoal" value="${esc(s.weeklyGoal)}"></label>
            <label class="field">Barbell weight (${u})<input type="number" inputmode="decimal" min="0" step="0.5" data-change="setting" data-key="barWeight" value="${esc(s.barWeight)}"></label>
            <label class="field">Default rest${select('restSeconds', [[45, '0:45'], [60, '1:00'], [90, '1:30'], [120, '2:00'], [180, '3:00'], [240, '4:00']])}</label>
          </div>
          <label class="check"><input type="checkbox" data-change="setting" data-key="autoRest" ${s.autoRest ? 'checked' : ''}> Start the rest timer when I tick off a set</label>
          <div><button class="btn" data-action="setup-open">Run the intro setup again</button></div>
        </section>
        ${custom ? `<section class="card">
          <div class="card-head"><h3>My exercises</h3><span class="muted small">Added by you</span></div>
          <ul class="list">${custom}</ul>
        </section>` : ''}
      </div>
      <div class="c-6 col">
        <section class="card">
          <div class="card-head"><h3>One-rep max calculator</h3></div>
          <div class="row gap-s">
            <label class="field grow">Weight (${u})<input type="number" inputmode="decimal" min="0" step="0.5" data-input="rm-field" data-key="rmWeight" value="${esc(ui.tools.rmWeight)}"></label>
            <label class="field grow">Reps<input type="number" inputmode="numeric" min="1" step="1" data-input="rm-field" data-key="rmReps" value="${esc(ui.tools.rmReps)}"></label>
          </div>
          <div id="rm-out">${rmOut()}</div>
        </section>
        <section class="card">
          <div class="card-head"><h3>Your data</h3></div>
          <p class="muted small">Everything is stored in this browser on this device. Export a backup now and then, and use it to move to another device.</p>
          <div class="row gap-s wrap">
            <button class="btn" data-action="export-json">${icon('download', 16)} Export backup</button>
            <label class="btn">${icon('upload', 16)} Import backup<input type="file" accept="application/json,.json" data-change="import-json" hidden></label>
            <button class="btn" data-action="export-csv">${icon('download', 16)} Workouts as CSV</button>
          </div>
          <hr>
          <div class="row gap-s wrap">
            ${empty ? '<button class="btn" data-action="load-demo">Load sample data</button>' : ''}
            ${empty ? '' : `<button class="btn danger" data-action="clear-all">${icon('trash', 16)} ${state.demo ? 'Clear sample data' : 'Erase everything'}</button>`}
          </div>
        </section>
      </div>
    </div>`;
  },
};

const NUMERIC_SETTINGS = new Set(['weeklyGoal', 'barWeight', 'restSeconds', 'targetWeight', 'height']);

Changes.setting = el => {
  const key = el.dataset.key;
  const s = state.settings;
  if (key === 'unit') {
    if (el.value !== s.unit) convertUnits(el.value);
  } else if (el.type === 'checkbox') {
    s[key] = el.checked;
  } else if (NUMERIC_SETTINGS.has(key)) {
    s[key] = el.value === '' ? '' : Math.max(0, Number(el.value) || 0);
    if (key === 'weeklyGoal') s[key] = clamp(Math.round(s[key]) || 1, 1, 14);
  } else {
    s[key] = el.value;
  }
  save();
  render();
};

Actions['del-custom'] = el => {
  const e = state.customExercises[Number(el.dataset.i)];
  if (!confirm(`Remove “${e.name}” from your exercises? Workouts that used it are kept.`)) return;
  state.customExercises.splice(Number(el.dataset.i), 1);
  save();
  render();
};

// ---------- data ----------

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

Actions['export-json'] = () => {
  const { active, ...data } = state;
  download(`gymlog-backup-${isoDate()}.json`, JSON.stringify(data, null, 2), 'application/json');
};

Actions['export-csv'] = () => {
  const cell = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v;
  const lines = [['date', 'started', 'workout', 'exercise', 'set', 'type', `weight_${unit()}`, 'reps', 'time_seconds', `distance_${distUnit()}`].join(',')];
  for (const w of sortedWorkouts()) {
    for (const ex of w.exercises) {
      ex.sets.forEach((s, i) => lines.push((ex.kind
        ? [w.date, workoutTime(w), cell(w.name), cell(ex.name), i + 1, ex.kind, '', '', s.seconds, s.distance || '']
        : [w.date, workoutTime(w), cell(w.name), cell(ex.name), i + 1, s.type, s.weight, s.reps, '', '']).join(',')));
    }
  }
  download(`gymlog-workouts-${isoDate()}.csv`, lines.join('\n'), 'text/csv');
};

Changes['import-json'] = el => {
  const file = el.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.workouts) || !Array.isArray(data.bodyweights)) throw new Error('not a backup');
      if (!confirm('Replace everything in the app with this backup?')) return;
      state = cleanImport(data.version === 2 ? data : migrateV1(data));
      save();
      go('dashboard');
      toast('Backup imported', 'good');
    } catch {
      toast('That file is not a GymLog backup', 'bad');
    }
  };
  reader.readAsText(file);
  el.value = '';
};

Actions['load-demo'] = () => {
  ui.setup = null;
  closeModal();
  const keep = { theme: state.settings.theme, motion: state.settings.motion };
  const demo = demoData();
  state = withDefaults({ ...demo, settings: { ...demo.settings, ...keep }, demo: true });
  save();
  go('dashboard');
};

function clearAll(question) {
  if (!confirm(question)) return;
  const keep = { theme: state.settings.theme, motion: state.settings.motion, unit: state.settings.unit };
  state = withDefaults({ settings: keep });
  if (keep.unit === 'lb') state.settings.barWeight = 45;
  stopTimer();
  save();
  go('dashboard');
  // A clean slate gets the intro again
  if (needsSetup()) openSetup();
}

Actions['clear-demo'] = () => clearAll('Remove the sample data, including anything you logged on top of it?');
Actions['clear-all'] = () => clearAll(state.demo
  ? 'Remove the sample data, including anything you logged on top of it?'
  : 'Erase every workout, weigh-in and routine? Export a backup first if you might want them back.');
