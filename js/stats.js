'use strict';

const EPS = 0.01;
const REP_MAX_ROWS = [1, 2, 3, 5, 8, 10, 12, 15];

let _analysis = null;

// Called by save(): throw away everything derived from the stored data
function invalidate() {
  _analysis = null;
  _exIndex = null;
}

// Strength score for one set: estimated one-rep max (Epley) for weighted
// sets, plain rep count for bodyweight sets.
function setScore(set) {
  return set.weight > 0 ? set.weight * (1 + set.reps / 30) : set.reps;
}

function sortedWorkouts() {
  return [...state.workouts].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
}

// 'up' if the best set improved (ties broken by volume, then total reps),
// 'down' if it got worse, 'flat' if nothing changed.
function compare(cur, prev) {
  for (const key of ['best', 'volume', 'reps']) {
    const d = cur[key] - prev[key];
    if (Math.abs(d) > EPS) return d > 0 ? 'up' : 'down';
  }
  return 'flat';
}

// One pass over every workout. Returns:
//   exercises  key -> { key, name, info, sessions[], max, records }
//   bySession  'workoutId:exerciseIndex' -> session
//   byWorkout  workoutId -> { sets, volume, prs, up, compared, muscles, sessions[] }
//   weeks      Monday ISO date -> { workouts, sets, volume, duration, muscles }
//   days       ISO date -> { workouts, sets }
//   prFeed     every session that set a record, oldest first
function analyse() {
  if (_analysis) return _analysis;
  const exercises = new Map();
  const bySession = new Map();
  const byWorkout = new Map();
  const weeks = new Map();
  const days = new Map();
  const prFeed = [];

  for (const w of sortedWorkouts()) {
    const ws = weekStartOf(w.date);
    if (!weeks.has(ws)) weeks.set(ws, { workouts: 0, sets: 0, volume: 0, duration: 0, muscles: {} });
    const week = weeks.get(ws);
    week.workouts++;
    week.duration += w.duration || 0;
    if (!days.has(w.date)) days.set(w.date, { workouts: 0, sets: 0 });
    const day = days.get(w.date);
    day.workouts++;
    const total = { sets: 0, volume: 0, prs: 0, up: 0, compared: 0, muscles: {}, sessions: [] };
    byWorkout.set(w.id, total);

    w.exercises.forEach((ex, exIdx) => {
      const key = norm(ex.name);
      if (!exercises.has(key)) {
        exercises.set(key, { key, name: ex.name, info: exerciseInfo(ex.name), sessions: [], max: { best: 0, weight: 0, load: 0 }, records: {} });
      }
      const entry = exercises.get(key);
      entry.name = ex.name;

      // Warm-ups are logged but never count towards progress
      const warm = ex.sets.filter(s => s.type === 'warmup');
      let work = ex.sets.filter(s => s.type !== 'warmup');
      if (!work.length) work = ex.sets;
      let bestSet = work[0];
      let volume = 0, reps = 0, maxWeight = 0, maxReps = 0;
      for (const s of work) {
        volume += s.reps * s.weight;
        reps += s.reps;
        maxWeight = Math.max(maxWeight, s.weight);
        maxReps = Math.max(maxReps, s.reps);
        if (setScore(s) > setScore(bestSet)) bestSet = s;
      }
      const weighted = maxWeight > 0;
      const load = weighted ? volume : reps;
      const session = {
        wid: w.id, exIdx, key, name: ex.name, date: w.date, sets: ex.sets, work, warm,
        bestSet, best: setScore(bestSet), volume, reps, maxWeight, maxReps, weighted, load, prs: [],
      };
      const prev = entry.sessions[entry.sessions.length - 1] || null;
      session.prev = prev;
      session.status = prev ? compare(session, prev) : 'new';
      session.delta = prev ? session.best - prev.best : 0;
      session.deltaPct = prev && prev.best ? session.delta / prev.best * 100 : 0;

      // Records. 'best' and 'weight' are strength PRs and earn the star;
      // a volume record is noted in the feed but is easier to come by.
      if (prev) {
        if (session.best > entry.max.best + EPS) session.prs.push('best');
        if (weighted && maxWeight > entry.max.weight + EPS) session.prs.push('weight');
        if (load > entry.max.load + EPS) session.prs.push('volume');
      }
      session.pr = session.prs.includes('best') || session.prs.includes('weight');
      // A heavier top weight is progress even when the reps (and so the volume) drop
      if (session.pr) session.status = 'up';
      const rec = entry.records;
      if (!rec.best || session.best > rec.best.best) rec.best = session;
      if (!rec.weight || maxWeight > rec.weight.maxWeight) rec.weight = session;
      if (!rec.volume || load > rec.volume.load) rec.volume = session;
      if (!rec.reps || maxReps > rec.reps.maxReps) rec.reps = session;
      entry.max.best = Math.max(entry.max.best, session.best);
      entry.max.weight = Math.max(entry.max.weight, maxWeight);
      entry.max.load = Math.max(entry.max.load, load);
      if (session.prs.length) prFeed.push(session);

      entry.sessions.push(session);
      bySession.set(`${w.id}:${exIdx}`, session);
      total.sessions.push(session);
      total.sets += work.length;
      total.volume += volume;
      if (session.pr) total.prs++;
      if (prev) total.compared++;
      if (session.status === 'up') total.up++;
      const muscle = entry.info.muscle;
      total.muscles[muscle] = (total.muscles[muscle] || 0) + work.length;
      week.muscles[muscle] = (week.muscles[muscle] || 0) + work.length;
      week.sets += work.length;
      week.volume += volume;
      day.sets += work.length;
    });
  }
  return (_analysis = { exercises, bySession, byWorkout, weeks, days, prFeed });
}

const PR_LABEL = {
  best: s => s.weighted ? `Est. 1RM ${num(s.best)} ${unit()}` : `${s.best} reps in a set`,
  weight: s => `Heaviest weight ${num(s.maxWeight)} ${unit()}`,
  volume: s => s.weighted ? `Session volume ${big(s.volume)} ${unit()}` : `${s.reps} total reps`,
};

// Totals for workouts dated from..to (inclusive)
function windowTotals(from, to) {
  const { byWorkout } = analyse();
  const out = { workouts: 0, sets: 0, volume: 0, duration: 0, muscles: {} };
  for (const w of state.workouts) {
    if (w.date < from || w.date > to) continue;
    const t = byWorkout.get(w.id);
    out.workouts++;
    out.sets += t.sets;
    out.volume += t.volume;
    out.duration += w.duration || 0;
    for (const [m, n] of Object.entries(t.muscles)) out.muscles[m] = (out.muscles[m] || 0) + n;
  }
  return out;
}

// Consecutive weeks with at least one workout: the run ending now, and the best ever
function streaks() {
  const { weeks } = analyse();
  let current = 0;
  let ws = weekStart();
  if (!weeks.has(ws)) ws = addDays(ws, -7);
  while (weeks.has(ws)) { current++; ws = addDays(ws, -7); }
  let best = 0, run = 0, prev = null;
  for (const k of [...weeks.keys()].sort()) {
    run = prev && addDays(prev, 7) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return { current, best };
}

// Best weight actually lifted for at least n reps, next to the Epley estimate
function repMaxes(entry) {
  const oneRm = entry.max.best;
  return REP_MAX_ROWS.map(n => {
    let actual = null;
    for (const s of entry.sessions) {
      for (const set of s.work) {
        if (set.reps >= n && set.weight > 0 && (!actual || set.weight > actual.weight)) actual = { weight: set.weight, reps: set.reps, date: s.date };
      }
    }
    return { reps: n, actual, estimate: n === 1 ? oneRm : oneRm / (1 + n / 30) };
  });
}

// ---------- bodyweight ----------

function judgeBodyChange(delta, from) {
  const goal = state.settings.goal;
  if (goal === 'maintain') return Math.abs(delta) <= from * 0.005 ? 'up' : 'down';
  if (Math.abs(delta) < EPS) return 'flat';
  return (delta > 0) === (goal === 'gain') ? 'up' : 'down';
}

function bodyStats() {
  const list = [...state.bodyweights].sort((a, b) => a.date.localeCompare(b.date)).map(e => ({ ...e }));
  list.forEach((e, i) => {
    const prev = list[i - 1];
    // Smoothed trend, so one heavy or light day doesn't swing the picture
    e.trend = prev ? prev.trend + 0.5 * (e.weight - prev.trend) : e.weight;
    e.delta = prev ? e.weight - prev.weight : 0;
    e.status = prev ? judgeBodyChange(e.delta, prev.weight) : 'new';
  });
  const first = list[0] || null;
  const latest = list[list.length - 1] || null;

  // Rate per week: straight-line fit through the last six entries
  let rate = null;
  const tail = list.slice(-6);
  if (tail.length >= 2) {
    const xs = tail.map(e => daysBetween(tail[0].date, e.date));
    const mx = sum(xs) / xs.length;
    const my = sum(tail, e => e.weight) / tail.length;
    const den = sum(xs, x => (x - mx) ** 2);
    if (den > 0) rate = sum(tail, (e, i) => (xs[i] - mx) * (e.weight - my)) / den * 7;
  }

  let change30 = null;
  if (latest) {
    const cutoff = addDays(latest.date, -30);
    const base = [...list].reverse().find(e => e.date <= cutoff);
    if (base) change30 = latest.weight - base.weight;
  }

  const target = Number(state.settings.targetWeight) || null;
  let remaining = null, pct = null, eta = null;
  if (target && latest) {
    remaining = target - latest.weight;
    const span = target - first.weight;
    pct = Math.abs(span) < EPS ? 1 : clamp((latest.weight - first.weight) / span, 0, 1);
    if (Math.abs(remaining) < 0.05) pct = 1;
    else if (rate && remaining / rate > 0 && remaining / rate < 520) eta = addDays(latest.date, Math.round(remaining / rate * 7));
  }

  let bmi = null;
  const height = Number(state.settings.height);
  if (latest && height > 0) {
    bmi = unit() === 'kg' ? latest.weight / (height / 100) ** 2 : latest.weight / height ** 2 * 703;
  }

  const weighedThisWeek = !!latest && latest.date >= weekStart();
  return { list, first, latest, rate, change30, target, remaining, pct, eta, bmi, weighedThisWeek };
}

// Is the current rate of change what the goal asks for?
function bodyOnTrack(rate) {
  const goal = state.settings.goal;
  if (goal === 'maintain') return Math.abs(rate) < 0.15;
  return Math.abs(rate) >= 0.05 && (rate > 0) === (goal === 'gain');
}

// ---------- suggestions ----------

// The routine you did longest ago (or never) is the one to do next
function nextRoutine() {
  if (!state.routines.length) return null;
  const last = {};
  for (const w of state.workouts) {
    const k = norm(w.name);
    if (!last[k] || w.date > last[k]) last[k] = w.date;
  }
  return state.routines
    .map(routine => ({ routine, last: last[norm(routine.name)] || '' }))
    .sort((a, b) => a.last.localeCompare(b.last))[0];
}

// Short plain-language observations for the dashboard. tone: 'good' | 'bad' | 'info'
function insights() {
  const out = [];
  const a = analyse();
  const today = isoDate();
  const s = state.settings;

  const done = (a.weeks.get(weekStart()) || { workouts: 0 }).workouts;
  const left = s.weeklyGoal - done;
  const daysLeft = 7 - (new Date().getDay() + 6) % 7;
  if (left <= 0) out.push({ tone: 'good', html: `Weekly goal hit: <strong>${done} of ${s.weeklyGoal}</strong> workouts done.` });
  else if (left > daysLeft) out.push({ tone: 'bad', html: `<strong>${plural(left, 'workout')}</strong> short of your weekly goal with ${plural(daysLeft, 'day')} left.` });
  else out.push({ tone: 'info', html: `<strong>${plural(left, 'more workout')}</strong> this week to hit your goal of ${s.weeklyGoal}.` });

  const recent = [...a.exercises.values()].filter(e => daysBetween(e.sessions[e.sessions.length - 1].date, today) <= 21);

  let top = null;
  for (const e of recent) {
    const span = e.sessions.filter(x => daysBetween(x.date, today) <= 42);
    if (span.length < 3 || !span[0].best) continue;
    const pct = (span[span.length - 1].best - span[0].best) / span[0].best * 100;
    if (!top || pct > top.pct) top = { e, pct, n: span.length };
  }
  if (top && top.pct > 0) {
    out.push({ tone: 'good', key: top.e.key, html: `<strong>${esc(top.e.name)}</strong> is up ${num(top.pct)}% over your last ${top.n} sessions.` });
  }

  const stalls = recent.map(e => {
    let n = 0;
    for (let i = e.sessions.length - 1; i > 0 && e.sessions[i].status !== 'up'; i--) n++;
    return { e, n };
  }).filter(x => x.n >= 2).sort((x, y) => y.n - x.n);
  for (const { e, n } of stalls.slice(0, 2)) {
    out.push({ tone: 'bad', key: e.key, html: `<strong>${esc(e.name)}</strong> hasn't improved in ${n} sessions. Drop the weight slightly and build back up.` });
  }

  const lastTrained = {};
  for (const e of a.exercises.values()) {
    const m = e.info.muscle;
    const d = e.sessions[e.sessions.length - 1].date;
    if (m !== 'Other' && (!lastTrained[m] || d > lastTrained[m])) lastTrained[m] = d;
  }
  const stale = Object.entries(lastTrained).map(([m, d]) => [m, daysBetween(d, today)])
    .filter(([, n]) => n >= 10 && n <= 60).sort((x, y) => y[1] - x[1])[0];
  if (stale) out.push({ tone: 'bad', html: `No <strong>${stale[0].toLowerCase()}</strong> work for ${stale[1]} days.` });

  const b = bodyStats();
  if (b.rate != null && b.list.length >= 3) {
    const ok = bodyOnTrack(b.rate);
    const tail = !ok ? ', which is away from your goal.'
      : b.eta ? `, on course for ${num(b.target)} ${unit()} around ${fmtDate(b.eta, 'short')}.` : ', in line with your goal.';
    out.push({ tone: ok ? 'good' : 'bad', html: `Bodyweight is trending <strong>${signed(b.rate, 2)} ${unit()} a week</strong>${tail}` });
  }
  return out.slice(0, 6);
}

// ---------- achievements ----------

function achievements() {
  const a = analyse();
  const total = state.workouts.length;
  const volume = sum([...a.weeks.values()], w => w.volume);
  const prs = a.prFeed.filter(s => s.pr).length;
  const streak = streaks().best;
  const body = bodyStats().latest;
  const ratio = (name, mult) => {
    const e = a.exercises.get(name);
    return e && body ? e.max.best / (body.weight * mult) : 0;
  };
  const muscleSpread = Math.max(0, ...[...a.weeks.values()].map(w => Object.keys(w.muscles).filter(m => m !== 'Other').length));
  const u = unit();
  return [
    ['🎯', 'First rep', 'Log your first workout', total / 1],
    ['🔟', 'Ten down', 'Log 10 workouts', total / 10],
    ['💪', 'Regular', 'Log 25 workouts', total / 25],
    ['🏅', 'Fifty club', 'Log 50 workouts', total / 50],
    ['💯', 'Centurion', 'Log 100 workouts', total / 100],
    ['🔥', 'On a roll', 'Train 4 weeks in a row', streak / 4],
    ['🌋', 'Unstoppable', 'Train 12 weeks in a row', streak / 12],
    ['⭐', 'Record breaker', 'Set 10 personal records', prs / 10],
    ['🌟', 'PR machine', 'Set 50 personal records', prs / 50],
    ['🏗️', 'Heavy lifter', `Lift 50,000 ${u} in total`, volume / 50000],
    ['🚚', 'Truck mover', `Lift 250,000 ${u} in total`, volume / 250000],
    ['⚖️', 'Weigh-in habit', 'Log 8 weigh-ins', state.bodyweights.length / 8],
    ['🧩', 'All-rounder', 'Train 8 muscle groups in one week', muscleSpread / 8],
    ['🛋️', 'Bodyweight bench', 'Bench press your bodyweight (est. 1RM)', ratio('bench press', 1)],
    ['🦵', 'Squat 1.5×', 'Squat 1.5× your bodyweight (est. 1RM)', ratio('squat', 1.5)],
    ['🏋️', 'Deadlift 2×', 'Deadlift 2× your bodyweight (est. 1RM)', ratio('deadlift', 2)],
  ].map(([icon, title, desc, progress]) => ({ icon, title, desc, progress: clamp(progress, 0, 1), done: progress >= 1 }));
}
