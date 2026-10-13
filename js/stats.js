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

// The same verdict for timed exercises, plus the two numbers it was based on
// (`now` against `before`, bigger is better) so a change can be shown as a %.
//   Cardio with distance both times: further is better; same distance, faster is better.
//   Cardio without distance: longer is better.
//   Holds: longest single hold, then total time.
function compareTimed(cur, prev) {
  if (cur.kind === 'cardio') {
    if (cur.distance > 0 && prev.distance > 0) {
      if (Math.abs(cur.distance - prev.distance) > EPS) {
        return { status: cur.distance > prev.distance ? 'up' : 'down', now: cur.distance, before: prev.distance };
      }
      const status = cur.seconds === prev.seconds ? 'flat' : cur.seconds < prev.seconds ? 'up' : 'down';
      return { status, now: prev.seconds, before: cur.seconds };
    }
    const status = cur.seconds === prev.seconds ? 'flat' : cur.seconds > prev.seconds ? 'up' : 'down';
    return { status, now: cur.seconds, before: prev.seconds };
  }
  const key = cur.best !== prev.best ? 'best' : 'seconds';
  const status = cur[key] === prev[key] ? 'flat' : cur[key] > prev[key] ? 'up' : 'down';
  return { status, now: cur.best, before: prev.best };
}

// Parts of the day a workout can start in: [key, label, hours]
const DAY_PARTS = [
  ['morning', 'Morning', '5am to noon'],
  ['afternoon', 'Afternoon', 'Noon to 5pm'],
  ['evening', 'Evening', '5pm to 9pm'],
  ['night', 'Night', '9pm to 5am'],
];

function dayPart(time) {
  const h = Number(time.slice(0, 2));
  return h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 21 ? 'evening' : 'night';
}

// When a workout started, as 'HH:MM' on the device's own clock, or '' if unknown.
// Workouts logged live before start times were stored still carry the moment
// they were finished as their id, so the start can be worked back from that.
function workoutTime(w) {
  if (isClock(w.time)) return w.time;
  if (w.id > 1e12) {
    const start = new Date(w.id - (w.duration || 0) * 1000);
    if (isoDate(start) === w.date) return clockOf(start);
  }
  return '';
}

// One pass over every workout. Returns:
//   exercises  key -> { key, name, info, sessions[], max, records }
//   bySession  'workoutId:exerciseIndex' -> session
//   byWorkout  workoutId -> { sets, volume, cardio, distance, prs, up, flat, down, compared, muscles, sessions[] }
//   weeks      Monday ISO date -> { workouts, sets, volume, duration, cardio, distance, muscles }
//   days       ISO date -> { workouts, sets, cardio }
//   prFeed     every session that set a record, oldest first
//   rest       ISO date -> note, for days marked as rest days
//   parts      part of day -> { workouts, up, compared }, for workouts with a known start time
//   weekdays   workouts per weekday, Monday first
// Cardio is kept out of set counts and volume and tracked as time and distance instead.
function analyse() {
  if (_analysis) return _analysis;
  const exercises = new Map();
  const bySession = new Map();
  const byWorkout = new Map();
  const weeks = new Map();
  const days = new Map();
  const prFeed = [];
  const parts = Object.fromEntries(DAY_PARTS.map(([key]) => [key, { workouts: 0, up: 0, compared: 0 }]));
  const weekdays = [0, 0, 0, 0, 0, 0, 0];

  for (const w of sortedWorkouts()) {
    const ws = weekStartOf(w.date);
    if (!weeks.has(ws)) weeks.set(ws, { workouts: 0, sets: 0, volume: 0, duration: 0, cardio: 0, distance: 0, muscles: {} });
    const week = weeks.get(ws);
    week.workouts++;
    week.duration += w.duration || 0;
    if (!days.has(w.date)) days.set(w.date, { workouts: 0, sets: 0, cardio: 0 });
    const day = days.get(w.date);
    day.workouts++;
    const total = { sets: 0, volume: 0, cardio: 0, distance: 0, prs: 0, up: 0, flat: 0, down: 0, compared: 0, muscles: {}, sessions: [] };
    total.time = workoutTime(w);
    total.part = total.time ? dayPart(total.time) : null;
    byWorkout.set(w.id, total);

    w.exercises.forEach((ex, exIdx) => {
      const key = norm(ex.name);
      if (!exercises.has(key)) {
        exercises.set(key, { key, name: ex.name, info: exerciseInfo(ex.name), sessions: [], max: { best: 0, weight: 0, load: 0, seconds: 0, distance: 0 }, records: {} });
      }
      const entry = exercises.get(key);
      entry.name = ex.name;
      const kind = ex.kind || null;
      const prev = entry.sessions[entry.sessions.length - 1] || null;
      // Only compare like with like: a timed session never follows on from a reps one
      const comparable = prev && prev.kind === kind ? prev : null;
      let session;

      if (kind) {
        const work = ex.sets;
        const seconds = sum(work, s => s.seconds);
        const distance = sum(work, s => s.distance || 0);
        let bestSet = work[0];
        for (const s of work) {
          if ((s.distance || 0) > (bestSet.distance || 0) || ((s.distance || 0) === (bestSet.distance || 0) && s.seconds > bestSet.seconds)) bestSet = s;
        }
        // The headline number: distance for cardio when logged, else time; longest hold for holds
        const best = kind === 'hold' ? Math.max(...work.map(s => s.seconds)) : distance > 0 ? distance : seconds;
        session = {
          wid: w.id, exIdx, key, name: ex.name, date: w.date, kind, timed: true, sets: work, work, warm: [],
          bestSet, best, seconds, distance, speed: distance > 0 && seconds > 0 ? distance / (seconds / 3600) : 0,
          volume: 0, reps: 0, maxWeight: 0, maxReps: 0, weighted: false, load: seconds, prs: [],
        };
        const verdict = comparable ? compareTimed(session, comparable) : null;
        session.status = verdict ? verdict.status : 'new';
        session.delta = verdict ? verdict.now - verdict.before : 0;
        session.deltaPct = verdict && verdict.before ? session.delta / verdict.before * 100 : 0;
        if (comparable) {
          if (kind === 'cardio' && distance > entry.max.distance + EPS) session.prs.push('distance');
          if (kind === 'cardio' ? seconds > entry.max.seconds : best > entry.max.best) session.prs.push('time');
        }
        session.pr = session.prs.length > 0;
      } else {
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
        session = {
          wid: w.id, exIdx, key, name: ex.name, date: w.date, kind: null, timed: false, sets: ex.sets, work, warm,
          bestSet, best: setScore(bestSet), seconds: 0, distance: 0, speed: 0,
          volume, reps, maxWeight, maxReps, weighted, load, prs: [],
        };
        session.status = comparable ? compare(session, comparable) : 'new';
        session.delta = comparable ? session.best - comparable.best : 0;
        session.deltaPct = comparable && comparable.best ? session.delta / comparable.best * 100 : 0;
        // Records. 'best' and 'weight' are strength PRs and earn the star;
        // a volume record is noted in the feed but is easier to come by.
        if (comparable) {
          if (session.best > entry.max.best + EPS) session.prs.push('best');
          if (weighted && maxWeight > entry.max.weight + EPS) session.prs.push('weight');
          if (load > entry.max.load + EPS) session.prs.push('volume');
        }
        session.pr = session.prs.includes('best') || session.prs.includes('weight');
      }
      session.prev = comparable;
      // A record is progress even when the tie-breakers say otherwise
      // (heavier weight for fewer reps, a longer run over less distance)
      if (session.pr) session.status = 'up';

      const rec = entry.records;
      if (!rec.best || session.best > rec.best.best) rec.best = session;
      if (!rec.weight || session.maxWeight > rec.weight.maxWeight) rec.weight = session;
      if (!rec.volume || session.load > rec.volume.load) rec.volume = session;
      if (!rec.reps || session.maxReps > rec.reps.maxReps) rec.reps = session;
      if (!rec.time || session.seconds > rec.time.seconds) rec.time = session;
      if (session.distance > 0 && (!rec.distance || session.distance > rec.distance.distance)) rec.distance = session;
      if (session.speed > 0 && (!rec.speed || session.speed > rec.speed.speed)) rec.speed = session;
      entry.max.best = Math.max(entry.max.best, session.best);
      entry.max.weight = Math.max(entry.max.weight, session.maxWeight);
      entry.max.load = Math.max(entry.max.load, session.load);
      entry.max.seconds = Math.max(entry.max.seconds, session.seconds);
      entry.max.distance = Math.max(entry.max.distance, session.distance);
      if (session.prs.length) prFeed.push(session);

      entry.sessions.push(session);
      bySession.set(`${w.id}:${exIdx}`, session);
      total.sessions.push(session);
      if (session.pr) total.prs++;
      if (comparable) total.compared++;
      if (session.status !== 'new') total[session.status]++;

      if (kind === 'cardio') {
        total.cardio += session.seconds;
        total.distance += session.distance;
        week.cardio += session.seconds;
        week.distance += session.distance;
        day.cardio += session.seconds;
        return;
      }
      const count = session.work.length;
      total.sets += count;
      total.volume += session.volume;
      // An exercise that works several muscle groups counts its sets towards each of them
      for (const muscle of entry.info.muscles) {
        total.muscles[muscle] = (total.muscles[muscle] || 0) + count;
        week.muscles[muscle] = (week.muscles[muscle] || 0) + count;
      }
      week.sets += count;
      week.volume += session.volume;
      day.sets += count;
    });

    weekdays[(parseDate(w.date).getDay() + 6) % 7]++;
    if (total.part) {
      const part = parts[total.part];
      part.workouts++;
      part.up += total.up;
      part.compared += total.compared;
    }
  }
  const rest = new Map(state.restDays.map(r => [r.date, r.note || '']));
  return (_analysis = { exercises, bySession, byWorkout, weeks, days, prFeed, rest, parts, weekdays });
}

const PR_LABEL = {
  best: s => s.weighted ? `Est. 1RM ${num(s.best)} ${unit()}` : `${s.best} reps in a set`,
  weight: s => `Heaviest weight ${num(s.maxWeight)} ${unit()}`,
  volume: s => s.weighted ? `Session volume ${big(s.volume)} ${unit()}` : `${s.reps} total reps`,
  time: s => s.kind === 'hold' ? `Longest hold ${fmtTime(s.best)}` : `Longest session ${fmtTime(s.seconds)}`,
  distance: s => `Furthest ${num(s.distance, 2)} ${distUnit()}`,
};

// The record a session is best known for (a volume record only if nothing else)
const mainPr = s => s.prs.find(p => p !== 'volume') || s.prs[0];

// Totals for workouts dated from..to (inclusive)
function windowTotals(from, to) {
  const { byWorkout } = analyse();
  const out = { workouts: 0, sets: 0, volume: 0, duration: 0, cardio: 0, distance: 0, muscles: {} };
  for (const w of state.workouts) {
    if (w.date < from || w.date > to) continue;
    const t = byWorkout.get(w.id);
    out.workouts++;
    out.sets += t.sets;
    out.volume += t.volume;
    out.cardio += t.cardio;
    out.distance += t.distance;
    out.duration += w.duration || 0;
    for (const [m, n] of Object.entries(t.muscles)) out.muscles[m] = (out.muscles[m] || 0) + n;
  }
  return out;
}

// How each muscle group is doing, for the muscle map. Takes the latest session
// of every exercise that works the group and was done in the last `days` days:
//   'up'    more of them improved than declined
//   'down'  more declined than improved
//   'flat'  level, or nothing changed
//   'new'   trained, but only first entries so far, so nothing to compare
//   'none'  not trained in that time
function muscleStatus(days = 28) {
  const from = addDays(isoDate(), -days);
  const out = {};
  for (const m of MUSCLES) out[m] = { muscle: m, up: 0, flat: 0, down: 0, fresh: 0, exercises: [], last: '' };
  for (const e of analyse().exercises.values()) {
    const s = lastOf(e.sessions);
    if (s.kind === 'cardio') continue;
    for (const m of e.info.muscles) {
      const g = out[m];
      if (!g) continue;
      if (s.date > g.last) g.last = s.date;
      if (s.date < from) continue;
      g.exercises.push(e);
      g[s.status === 'new' ? 'fresh' : s.status]++;
    }
  }
  for (const g of Object.values(out)) {
    g.status = !g.exercises.length ? 'none'
      : g.up > g.down ? 'up' : g.down > g.up ? 'down' : g.up + g.down + g.flat ? 'flat' : 'new';
  }
  return out;
}

// A rest day only counts on a day with no workout logged
const isRestDay = date => { const a = analyse(); return a.rest.has(date) && !a.days.has(date); };

// Training days in a row, counting back from today (or yesterday if today is still open)
function trainingRun() {
  const { days } = analyse();
  let date = isoDate();
  if (!days.has(date)) date = addDays(date, -1);
  let n = 0;
  while (days.has(date)) { n++; date = addDays(date, -1); }
  return n;
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
      if (s.timed) continue;
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

// Short plain-language observations for the dashboard.
// tone: 'good' (green), 'bad' (red), 'flat' (a stall, neutral) or 'info'
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

  const run = trainingRun();
  if (run >= 5 && !isRestDay(today)) {
    out.push({ tone: 'info', html: `You've trained <strong>${run} days in a row</strong>. A rest day would help you recover.` });
  }

  const recent = [...a.exercises.values()].filter(e => daysBetween(e.sessions[e.sessions.length - 1].date, today) <= 21);

  let top = null;
  for (const e of recent) {
    const span = e.sessions.filter(x => daysBetween(x.date, today) <= 42);
    // Cardio is left out: its headline number can switch between time and distance
    if (span.length < 3 || !span[0].best || span.some(x => x.kind === 'cardio')) continue;
    const pct = (span[span.length - 1].best - span[0].best) / span[0].best * 100;
    if (!top || pct > top.pct) top = { e, pct, n: span.length };
  }
  if (top && top.pct > 0) {
    out.push({ tone: 'good', key: top.e.key, html: `<strong>${esc(top.e.name)}</strong> is up ${num(top.pct)}% over your last ${top.n} sessions.` });
  }

  const stalls = recent.map(e => {
    let n = 0, dropped = false;
    for (let i = e.sessions.length - 1; i > 0 && e.sessions[i].status !== 'up'; i--) {
      n++;
      if (e.sessions[i].status === 'down') dropped = true;
    }
    return { e, n, dropped };
  }).filter(x => x.n >= 2).sort((x, y) => y.n - x.n);
  for (const { e, n, dropped } of stalls.slice(0, 2)) {
    out.push({
      tone: dropped ? 'bad' : 'flat', key: e.key,
      html: `<strong>${esc(e.name)}</strong> hasn't improved in ${n} sessions. ${e.info.kind ? 'A small push next time gets it moving again.' : 'Drop the weight slightly and build back up.'}`,
    });
  }

  // Which part of the day goes best, once there is enough to compare
  const rated = DAY_PARTS.map(([key, label]) => ({ label, ...a.parts[key] }))
    .filter(p => p.workouts >= 3 && p.compared >= 6)
    .map(p => ({ ...p, rate: p.up / p.compared * 100 }))
    .sort((x, y) => y.rate - x.rate);
  if (rated.length >= 2 && rated[0].rate - rated[rated.length - 1].rate >= 10) {
    const best = rated[0];
    const worst = rated[rated.length - 1];
    out.push({ tone: 'info', html: `You progress most in <strong>${best.label.toLowerCase()}</strong> workouts: ${Math.round(best.rate)}% of exercises improved, against ${Math.round(worst.rate)}% in the ${worst.label.toLowerCase()}.` });
  }

  const lastTrained = {};
  for (const e of a.exercises.values()) {
    const d = e.sessions[e.sessions.length - 1].date;
    for (const m of e.info.muscles) {
      if (m !== 'Other' && (!lastTrained[m] || d > lastTrained[m])) lastTrained[m] = d;
    }
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
  const allWeeks = [...a.weeks.values()];
  const volume = sum(allWeeks, w => w.volume);
  const prs = a.prFeed.filter(s => s.pr).length;
  const streak = streaks().best;
  const body = bodyStats().latest;
  const ratio = (name, mult) => {
    const e = a.exercises.get(name);
    return e && body ? e.max.best / (body.weight * mult) : 0;
  };
  const muscleSpread = Math.max(0, ...allWeeks.map(w => Object.keys(w.muscles).filter(m => m !== 'Other').length));
  const cardioWeek = Math.max(0, ...allWeeks.map(w => w.cardio));
  const distance = sum(allWeeks, w => w.distance);
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
    ['🏃', 'Cardio hour', 'Do 60 minutes of cardio in one week', cardioWeek / 3600],
    ['🛣️', 'Distance club', `Cover 50 ${distUnit()} of cardio in total`, distance / 50],
    ['🛋️', 'Bodyweight bench', 'Bench press your bodyweight (est. 1RM)', ratio('bench press', 1)],
    ['🦵', 'Squat 1.5×', 'Squat 1.5× your bodyweight (est. 1RM)', ratio('squat', 1.5)],
    ['🏋️', 'Deadlift 2×', 'Deadlift 2× your bodyweight (est. 1RM)', ratio('deadlift', 2)],
  ].map(([icon, title, desc, progress]) => ({ icon, title, desc, progress: clamp(progress, 0, 1), done: progress >= 1 }));
}
