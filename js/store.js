'use strict';

const STORE_KEY = 'gymlog.v2';
const LEGACY_KEY = 'gymlog.v1';
const LB_PER_KG = 2.20462;

function defaultSettings() {
  return {
    unit: 'kg',
    theme: 'light',
    motion: 'on',        // 'on' | 'off' | 'auto' (follow the system setting)
    goal: 'gain',        // bodyweight goal: 'gain' | 'lose' | 'maintain'
    targetWeight: '',
    height: '',
    weeklyGoal: 3,
    barWeight: 20,
    restSeconds: 90,
    autoRest: true,
  };
}

function defaults() {
  return {
    version: 2,
    settings: defaultSettings(),
    workouts: [],        // { id, date, name, notes, duration (s), exercises: [{ name, notes, sets: [{ reps, weight, type }] }] }
    bodyweights: [],     // { date, weight }
    measurements: [],    // { date, type, value }
    routines: [],        // { id, name, exercises: [{ name, sets: [{ reps, weight, type }] }] }
    customExercises: [], // { name, muscle, equipment }
    restDays: [],        // { date, note }: days deliberately taken off
    active: null,        // the workout or routine being edited right now
    demo: false,
  };
}

function withDefaults(data) {
  return { ...defaults(), ...data, settings: { ...defaultSettings(), ...data.settings } };
}

function migrateV1(old) {
  if (old.demo) return withDefaults({ ...demoData(), demo: true });
  const s = defaults();
  s.settings.unit = old.unit || 'kg';
  s.settings.goal = old.goal || 'gain';
  s.bodyweights = old.bodyweights || [];
  s.workouts = (old.workouts || []).map(w => ({
    id: w.id, date: w.date, name: w.name || 'Workout', notes: '', duration: 0,
    exercises: w.exercises.map(ex => ({ name: ex.name, notes: '', sets: ex.sets.map(x => ({ reps: x.reps, weight: x.weight, type: 'normal' })) })),
  }));
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return withDefaults(JSON.parse(raw));
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) return migrateV1(JSON.parse(legacy));
  } catch { /* fall through to a clean start */ }
  return defaults();
}

// A backup is a file from outside the app, so nothing in it is trusted:
// keep only well-formed records and force every field to its expected type.
function cleanImport(data) {
  const list = v => Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : [];
  const isDate = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const text = (v, max) => String(v ?? '').slice(0, max);
  const n = v => Math.max(0, Number(v) || 0);
  const optional = v => Number(v) > 0 ? Number(v) : '';
  const pick = (v, allowed, fallback) => allowed.includes(v) ? v : fallback;
  const kindOf = ex => ex.kind === 'cardio' || ex.kind === 'hold' ? ex.kind : null;
  const sets = v => list(v).map(s => ({ reps: Math.floor(n(s.reps)), weight: n(s.weight), type: SET_TYPES[s.type] ? s.type : 'normal' }));
  const timedSets = v => list(v).map(s => ({ seconds: Math.round(n(s.seconds)), distance: n(s.distance), type: 'normal' }));
  const logged = v => list(v).map(ex => {
    const kind = kindOf(ex);
    const out = { name: text(ex.name, 80).trim(), notes: text(ex.notes, 500) };
    if (kind) Object.assign(out, { kind, sets: timedSets(ex.sets).filter(s => s.seconds > 0) });
    else out.sets = sets(ex.sets).filter(s => s.reps > 0);
    return out;
  }).filter(ex => ex.name && ex.sets.length);
  const planned = v => list(v).map(ex => {
    const kind = kindOf(ex);
    const out = { name: text(ex.name, 80).trim() };
    if (kind) Object.assign(out, { kind, sets: timedSets(ex.sets).map(s => ({ ...s, seconds: s.seconds || '', distance: s.distance || '' })) });
    else out.sets = sets(ex.sets).map(s => ({ ...s, reps: s.reps || '', weight: s.weight || '' }));
    return out;
  }).filter(ex => ex.name && ex.sets.length);
  const s = { ...defaultSettings(), ...(data.settings || {}) };
  const ids = new Set();
  const uniqueId = v => {
    let id = Number(v) || 1;
    while (ids.has(id)) id++;
    ids.add(id);
    return id;
  };
  return withDefaults({
    demo: !!data.demo,
    settings: {
      unit: pick(s.unit, ['kg', 'lb'], 'kg'),
      theme: pick(s.theme, ['light', 'dark'], 'light'),
      motion: pick(s.motion, ['on', 'off', 'auto'], 'on'),
      goal: pick(s.goal, ['gain', 'lose', 'maintain'], 'gain'),
      targetWeight: optional(s.targetWeight),
      height: optional(s.height),
      weeklyGoal: clamp(Math.round(n(s.weeklyGoal)) || 3, 1, 14),
      barWeight: n(s.barWeight),
      restSeconds: clamp(Math.round(n(s.restSeconds)) || 90, 10, 900),
      autoRest: !!s.autoRest,
    },
    workouts: list(data.workouts).filter(w => isDate(w.date))
      .map(w => ({ id: uniqueId(w.id), date: w.date, time: isClock(w.time) ? w.time : '', name: text(w.name, 80).trim() || 'Workout', notes: text(w.notes, 1000), duration: Math.round(n(w.duration)), exercises: logged(w.exercises) }))
      .filter(w => w.exercises.length),
    bodyweights: list(data.bodyweights).filter(e => isDate(e.date) && Number(e.weight) > 0).map(e => ({ date: e.date, weight: Number(e.weight) })),
    measurements: list(data.measurements).filter(m => isDate(m.date) && MEASUREMENTS.includes(m.type) && Number(m.value) > 0)
      .map(m => ({ date: m.date, type: m.type, value: Number(m.value) })),
    routines: list(data.routines).map(r => ({ id: uniqueId(r.id), name: text(r.name, 80).trim() || 'Routine', exercises: planned(r.exercises) }))
      .filter(r => r.exercises.length),
    customExercises: list(data.customExercises).filter(e => text(e.name, 80).trim())
      .map(e => ({ name: text(e.name, 80).trim(), muscle: CATEGORIES.includes(e.muscle) ? e.muscle : 'Other', equipment: '' })),
    // One entry per date; a later duplicate wins
    restDays: [...new Map(list(data.restDays).filter(r => isDate(r.date)).map(r => [r.date, { date: r.date, note: text(r.note, 200) }])).values()],
  });
}

// Write to disk without touching the stats cache (used while typing in the logger)
function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    toast('Could not save. Browser storage is full or blocked.', 'bad');
  }
}

function save() {
  invalidate();
  persist();
}

let state = load();

// ---------- exercises ----------

let _exIndex = null;

function exerciseIndex() {
  if (!_exIndex) {
    _exIndex = new Map(EXERCISE_LIBRARY.map(e => [norm(e.name), e]));
    for (const e of state.customExercises) {
      _exIndex.set(norm(e.name), { ...e, kind: e.muscle === 'Cardio' ? 'cardio' : null, custom: true });
    }
  }
  return _exIndex;
}

function exerciseInfo(name) {
  return exerciseIndex().get(norm(name)) || { name, muscle: 'Other', equipment: '', kind: null };
}

// ---------- units ----------

const KM_PER_MILE = 1.609344;
const unit = () => state.settings.unit;
const distUnit = () => unit() === 'kg' ? 'km' : 'mi';
const lengthUnit = () => unit() === 'kg' ? 'cm' : 'in';
const measureUnit = type => type === 'Body fat' ? '%' : lengthUnit();
const plateSizes = () => unit() === 'kg' ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5];

// Switch between kg and lb, converting everything already stored
function convertUnits(to) {
  const f = to === 'lb' ? LB_PER_KG : 1 / LB_PER_KG;
  const blank = v => v === '' || v == null;
  const lift = v => blank(v) ? v : Math.round(Number(v) * f * 2) / 2;
  const body = v => blank(v) ? v : Math.round(Number(v) * f * 10) / 10;
  // Centimetres snap to the nearest half so a round trip lands back where it started
  const length = v => to === 'lb' ? Math.round(Number(v) / 2.54 * 10) / 10 : Math.round(Number(v) * 2.54 * 2) / 2;
  // Kilometres snap to the nearest 0.05 so a round trip lands back where it started
  const distance = v => blank(v) || !(Number(v) > 0) ? v
    : to === 'lb' ? Math.round(Number(v) / KM_PER_MILE * 100) / 100 : Math.round(Number(v) * KM_PER_MILE * 20) / 20;
  const convertSets = exercises => exercises.forEach(ex => ex.sets.forEach(s => {
    if (ex.kind) {
      s.distance = distance(s.distance);
      if (s.target) s.target.distance = distance(s.target.distance);
      return;
    }
    s.weight = lift(s.weight);
    if (s.target) s.target.weight = lift(s.target.weight);
  }));
  state.workouts.forEach(w => convertSets(w.exercises));
  state.routines.forEach(r => convertSets(r.exercises));
  if (state.active) convertSets(state.active.exercises);
  state.bodyweights.forEach(e => { e.weight = body(e.weight); });
  state.measurements.forEach(e => { if (e.type !== 'Body fat') e.value = length(e.value); });
  const s = state.settings;
  s.targetWeight = body(s.targetWeight);
  if (!blank(s.height)) s.height = length(s.height);
  s.barWeight = to === 'lb' ? 45 : 20;
  s.unit = to;
}

// ---------- sample data ----------

// Ten weeks of Push / Pull / Legs with realistic ups, downs and one stalled
// lift, so a new user can see what the app looks like with data in it.
function demoData() {
  const rand = seededRandom(11);
  const today = isoDate();
  const weeks = weeksBack(10);
  // [exercise, starting weight, weight step, low reps, high reps]
  const plan = [
    ['Push', 0, [['Bench press', 57.5, 2.5, 7, 8], ['Overhead press', 35, 2.5, 7, 8], ['Incline dumbbell press', 20, 2, 9, 10],
      ['Lateral raise', 8, 1, 12, 14], ['Triceps pushdown', 25, 2.5, 11, 12]]],
    ['Pull', 2, [['Deadlift', 100, 5, 4, 5], ['Pull-ups', 0, 0, 6, 30], ['Barbell row', 50, 2.5, 7, 8],
      ['Face pull', 17.5, 2.5, 13, 15], ['Barbell curl', 25, 2.5, 9, 10]]],
    ['Legs', 4, [['Squat', 80, 2.5, 5, 6], ['Romanian deadlift', 70, 5, 7, 8], ['Leg press', 120, 10, 9, 10],
      ['Leg curl', 35, 2.5, 11, 12], ['Calf raise', 40, 5, 11, 12]]],
  ];
  const skipped = new Set(['3:Legs', '6:Pull']);
  const progress = {};
  const workouts = [];
  const bodyweights = [];

  weeks.forEach((monday, wi) => {
    if (monday <= today) bodyweights.push({ date: monday, weight: Math.round((73.2 + wi * 0.27 + (rand() - 0.5) * 0.5) * 10) / 10 });
    for (const [name, offset, exercises] of plan) {
      const date = addDays(monday, offset);
      if (date > today || skipped.has(`${wi}:${name}`)) continue;
      // A run after pulling and a plank after legs, to show timed exercises
      const extra = name === 'Pull' ? [{
        name: 'Treadmill run', notes: '', kind: 'cardio',
        sets: [{ seconds: 1200 + (wi % 3 === 2 ? -60 : wi * 20), distance: Math.round((3 + wi * 0.12 - (wi === 5 ? 0.3 : 0)) * 10) / 10, type: 'normal' }],
      }] : name === 'Legs' ? [{
        name: 'Plank', notes: '', kind: 'hold',
        sets: [45 + wi * 5 - (wi === 4 ? 10 : 0), 40 + wi * 5].map(seconds => ({ seconds, distance: 0, type: 'normal' })),
      }] : [];
      // Pull days before work, the rest in the evening, with the odd lunchtime or late session
      const hour = name === 'Pull' ? 6 : name === 'Push' && wi % 4 === 1 ? 12 : name === 'Legs' && wi === 7 ? 21 : name === 'Push' ? 18 : 17;
      const time = `${String(hour).padStart(2, '0')}:${String(10 + (wi * 7 + offset * 3) % 45).padStart(2, '0')}`;
      workouts.push({
        id: workouts.length + 1,
        date,
        time,
        name,
        notes: '',
        duration: Math.round(2700 + rand() * 1500),
        exercises: exercises.map(([exName, start, step, lo, hi], i) => {
          const st = progress[exName] || (progress[exName] = { w: start, r: lo, n: 0 });
          const roll = rand();
          const stalled = exName === 'Overhead press' && wi >= 6;
          let reps = st.r;
          let good = true;
          if (st.n > 0 && (stalled || roll < 0.26)) {
            // An off day: repeat last time's reps or fall short of them
            reps = st.r - (roll < 0.12 ? 2 : 1);
            good = false;
          }
          reps = Math.max(1, reps);
          const sets = [reps, reps, Math.max(1, reps - 1)].map(r => ({ reps: r, weight: st.w, type: 'normal' }));
          if (i === 0) sets.unshift({ reps: 10, weight: Math.round(st.w * 0.5 / 2.5) * 2.5, type: 'warmup' });
          if (i === 4) sets[sets.length - 1].type = 'failure';
          st.n++;
          if (good) {
            st.r++;
            if (st.r > hi) { st.w += step; st.r = lo; }
          }
          return { name: exName, notes: '', sets };
        }).concat(extra),
      });
    }
  });
  if (workouts.length) workouts[workouts.length - 1].notes = 'Felt strong today. Slept well and ate a big breakfast.';

  const routines = plan.map(([name, , exercises], i) => ({
    id: 1001 + i,
    name,
    exercises: exercises.map(([exName, , , lo]) => ({
      name: exName,
      sets: [lo, lo, lo].map(r => ({ reps: r, weight: progress[exName] ? progress[exName].w || '' : '', type: 'normal' })),
    })),
  }));

  const measurements = [];
  [[0, 17.1, 83.5, 99, 35.5], [4, 16.8, 83, 100, 36], [8, 16.4, 82.5, 101, 36.5]].forEach(([wi, fat, waist, chest, arms]) => {
    const date = weeks[wi];
    measurements.push({ date, type: 'Body fat', value: fat }, { date, type: 'Waist', value: waist },
      { date, type: 'Chest', value: chest }, { date, type: 'Arms', value: arms });
  });

  // Sundays off for the last few weeks, plus the two sessions that were skipped above
  const restDays = [
    { date: addDays(weeks[3], 4), note: 'Sore knee, skipped legs' },
    { date: addDays(weeks[6], 2), note: 'Travelling for work' },
  ];
  weeks.forEach((monday, wi) => {
    const sunday = addDays(monday, 6);
    if (wi >= 4 && sunday <= today) restDays.push({ date: sunday, note: '' });
  });

  return { workouts, bodyweights, measurements, routines, restDays, settings: { ...defaultSettings(), targetWeight: 77, height: 178 } };
}
