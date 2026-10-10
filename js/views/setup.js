'use strict';

// First-run setup: a short series of steps that collects the settings the
// rest of the app leans on. Nothing is saved until Finish, apart from the
// theme, which switches straight away so it can be previewed. Every answer
// is optional and can be changed later in Tools.

// Groups of built-in templates offered as starter routines: [title, blurb, template names]
const STARTER_SETS = [
  ['Push / Pull / Legs', 'Three workouts that rotate', ['Push', 'Pull', 'Legs']],
  ['Upper / Lower', 'Two workouts you alternate', ['Upper body', 'Lower body']],
  ['Full body', 'One workout, repeated', ['Full body']],
  ['Strength 5×5', 'Two simple barbell workouts', ['Strength 5×5 A', 'Strength 5×5 B']],
  ['Calisthenics basics', 'No equipment needed', ['Calisthenics basics']],
  ['Smith machine full body', 'Everything on one machine', ['Smith machine full body']],
];

const SETUP_STEPS = ['welcome', 'body', 'goal', 'training', 'routines'];

// Shown automatically only on a completely fresh app
function needsSetup() {
  return !state.settings.setupDone && !state.demo && !state.active
    && !state.workouts.length && !state.bodyweights.length && !state.routines.length;
}

// Which starter set suits a weekly target, for the "Suggested" tag
const suggestedSet = perWeek => perWeek <= 2 ? 'Full body' : perWeek === 4 ? 'Upper / Lower' : 'Push / Pull / Legs';

function openSetup() {
  const s = state.settings;
  const latest = bodyStats().latest;
  ui.setup = {
    step: 0,
    unit: s.unit,
    weight: latest ? String(latest.weight) : '',
    height: s.height === '' ? '' : String(s.height),
    goal: s.goal,
    target: s.targetWeight === '' ? '' : String(s.targetWeight),
    weeklyGoal: s.weeklyGoal,
    rest: s.restSeconds,
    routines: [],
  };
  openModal('<div class="setup" id="setup"></div>', 'setup-modal', true);
  renderSetup(true);
}

const option = (key, value, title, blurb, on) =>
  `<button class="option ${on ? 'on' : ''}" data-action="setup-pick" data-key="${key}" data-value="${value}" aria-pressed="${on}">
    <strong>${title}</strong>${blurb ? `<span class="muted small">${blurb}</span>` : ''}
  </button>`;

const pickChip = (key, value, label, on) =>
  `<button class="chip big ${on ? 'on' : ''}" data-action="setup-pick" data-key="${key}" data-value="${value}" aria-pressed="${on}">${label}</button>`;

function setupStepHtml(s) {
  const u = s.unit;
  const len = u === 'kg' ? 'cm' : 'in';
  switch (SETUP_STEPS[s.step]) {
    case 'welcome':
      return `<div class="hero-icon">🏋️</div>
        <h2>Welcome to GymLog</h2>
        <p class="muted">A minute of setup so the app fits you. Everything here is optional and can be changed later in Tools.</p>
        <p class="setup-label">Which units do you use?</p>
        <div class="options two">
          ${option('unit', 'kg', 'Kilograms', 'kg and km', u === 'kg')}
          ${option('unit', 'lb', 'Pounds', 'lb and miles', u === 'lb')}
        </div>
        <p class="setup-label">How should it look?</p>
        <div class="options two">
          ${option('theme', 'light', 'Light', 'White background', state.settings.theme === 'light')}
          ${option('theme', 'dark', 'Dark', 'Easier on the eyes at night', state.settings.theme === 'dark')}
        </div>
        <button class="link" data-action="load-demo">Just looking? Try it with sample data</button>`;
    case 'body':
      return `<h2>About you</h2>
        <p class="muted">Your weight today is the starting point of your bodyweight chart. Leave either box empty to skip it.</p>
        <label class="field big">Bodyweight (${u})
          <input type="number" inputmode="decimal" step="0.1" min="0" data-input="setup-field" data-key="weight" value="${esc(s.weight)}" placeholder="e.g. ${u === 'kg' ? '80' : '176'}">
        </label>
        <label class="field big">Height (${len})
          <input type="number" inputmode="decimal" step="0.1" min="0" data-input="setup-field" data-key="height" value="${esc(s.height)}" placeholder="e.g. ${u === 'kg' ? '178' : '70'}">
        </label>
        <p class="muted small">Height is only used to show your BMI.</p>`;
    case 'goal':
      return `<h2>Your bodyweight goal</h2>
        <p class="muted">This decides which way is “good”: weigh-ins that move toward your goal show green.</p>
        <div class="options">
          ${option('goal', 'lose', 'Lose weight', 'Going down is progress', s.goal === 'lose')}
          ${option('goal', 'gain', 'Gain weight', 'Going up is progress, for building muscle', s.goal === 'gain')}
          ${option('goal', 'maintain', 'Stay the same', 'Staying steady is progress', s.goal === 'maintain')}
        </div>
        ${s.goal === 'maintain' ? '' : `<label class="field big">Target weight (${u})
          <input type="number" inputmode="decimal" step="0.1" min="0" data-input="setup-field" data-key="target" value="${esc(s.target)}" placeholder="Optional">
        </label>
        <p class="muted small">With a target, the app shows how far you have to go and roughly when you'll get there.</p>`}`;
    case 'training':
      return `<h2>Your training</h2>
        <p class="setup-label">How many workouts a week are you aiming for?</p>
        <div class="chips">${[1, 2, 3, 4, 5, 6, 7].map(n => pickChip('weeklyGoal', n, n, s.weeklyGoal === n)).join('')}</div>
        <p class="muted small">The dashboard tracks this each week. Pick what you can keep up, not your best week.</p>
        <p class="setup-label">How long do you rest between sets?</p>
        <div class="chips">${[60, 90, 120, 180].map(sec => pickChip('rest', sec, fmtClock(sec), s.rest === sec)).join('')}</div>
        <p class="muted small">The rest timer starts with this when you tick off a set. Lighter work needs less, heavy lifts more.</p>`;
    default: {
      const suggested = suggestedSet(s.weeklyGoal);
      return `<h2>Starter routines</h2>
        <p class="muted">A routine is a saved workout you can start with one tap. Pick any you like, or none and build your own later.</p>
        <div class="options">${STARTER_SETS.map(([title, blurb, names], i) => {
          const on = s.routines.includes(i);
          return `<button class="option row-option ${on ? 'on' : ''}" data-action="setup-routine" data-i="${i}" aria-pressed="${on}">
            <span class="tick">${on ? icon('check', 16) : ''}</span>
            <span class="stack"><strong>${title}${title === suggested ? ` <span class="tag">Suggested for ${s.weeklyGoal} a week</span>` : ''}</strong>
              <span class="muted small">${blurb} · ${names.length === 1 ? '1 routine' : `${names.length} routines`}</span></span>
          </button>`;
        }).join('')}</div>`;
    }
  }
}

function renderSetup(animate) {
  const s = ui.setup;
  const last = s.step === SETUP_STEPS.length - 1;
  $('#setup').innerHTML = `<div class="row between">
      <span class="muted small">Step ${s.step + 1} of ${SETUP_STEPS.length}</span>
      <button class="link" data-action="setup-skip">Skip setup</button>
    </div>
    <div class="progress"><span style="width:${((s.step + 1) / SETUP_STEPS.length * 100).toFixed(0)}%"></span></div>
    <div class="setup-body" id="setup-body">${setupStepHtml(s)}</div>
    <div class="row between">
      ${s.step ? '<button class="btn lg" data-action="setup-back">Back</button>' : '<span></span>'}
      <button class="btn primary lg" data-action="${last ? 'setup-finish' : 'setup-next'}">${last ? `${icon('check', 18)} Finish` : 'Next'}</button>
    </div>`;
  if (!animate) return;
  animateIn($('#setup-body'));
  const first = $('#setup-body input');
  if (first && matchMedia('(hover: hover)').matches) first.focus();
}

Actions['setup-open'] = () => openSetup();

Actions['setup-next'] = () => {
  ui.setup.step = Math.min(ui.setup.step + 1, SETUP_STEPS.length - 1);
  renderSetup(true);
};

Actions['setup-back'] = () => {
  ui.setup.step = Math.max(ui.setup.step - 1, 0);
  renderSetup(true);
};

Actions['setup-pick'] = el => {
  const s = ui.setup;
  const { key, value } = el.dataset;
  if (key === 'theme') {
    state.settings.theme = value;
    persist();
    applyAppearance();
    renderNav();
    renderTopbar();
  } else if (key === 'unit') {
    // Numbers already in the boxes were in the old unit: carry them across
    if (value !== s.unit) {
      const toLb = value === 'lb';
      const carry = (v, factor, steps) => Number(v) > 0 ? String(Math.round(Number(v) * factor * steps) / steps) : v;
      s.weight = carry(s.weight, toLb ? LB_PER_KG : 1 / LB_PER_KG, 10);
      s.target = carry(s.target, toLb ? LB_PER_KG : 1 / LB_PER_KG, 10);
      s.height = carry(s.height, toLb ? 1 / 2.54 : 2.54, toLb ? 10 : 2);
    }
    s.unit = value;
  } else {
    s[key] = key === 'weeklyGoal' || key === 'rest' ? Number(value) : value;
  }
  renderSetup(false);
};

Actions['setup-routine'] = el => {
  const s = ui.setup;
  const i = Number(el.dataset.i);
  s.routines = s.routines.includes(i) ? s.routines.filter(x => x !== i) : [...s.routines, i];
  renderSetup(false);
};

Inputs['setup-field'] = el => {
  ui.setup[el.dataset.key] = el.value;
};

function endSetup() {
  state.settings.setupDone = true;
  ui.setup = null;
  closeModal();
}

Actions['setup-skip'] = () => {
  endSetup();
  persist();
};

Actions['setup-finish'] = () => {
  const s = ui.setup;
  const st = state.settings;
  const positive = v => Number(v) > 0 ? Number(v) : '';
  // Switch units first, so everything typed in the setup is taken in the unit it was asked in
  if (s.unit !== st.unit) convertUnits(s.unit);
  st.goal = s.goal;
  st.targetWeight = s.goal === 'maintain' ? '' : positive(s.target);
  st.height = positive(s.height);
  st.weeklyGoal = s.weeklyGoal;
  st.restSeconds = s.rest;

  const weight = positive(s.weight);
  const latest = bodyStats().latest;
  if (weight && !(latest && latest.weight === weight)) {
    const today = isoDate();
    state.bodyweights = state.bodyweights.filter(e => e.date !== today);
    state.bodyweights.push({ date: today, weight });
  }

  const stamp = Date.now();
  let added = 0;
  for (const i of s.routines) {
    for (const name of STARTER_SETS[i][2]) {
      if (hasRoutine(name)) continue;
      state.routines.push({ ...routineFrom(TEMPLATES.find(t => t.name === name)), id: stamp + added });
      added++;
    }
  }

  endSetup();
  save();
  go('dashboard');
  toast(added ? `All set. ${plural(added, 'routine')} ready to start.` : 'All set. Time to train!', 'good');
  confetti(40);
};
