'use strict';

function welcomeView() {
  return `<div class="grid">
    <section class="card hero c-12">
      <div class="hero-icon">🏋️</div>
      <h2>Welcome to GymLog</h2>
      <p class="muted">Log your sets, weigh in once a week, and see at a glance whether you're moving forward.</p>
      <ol class="steps">
        <li><strong>Log a workout</strong><span class="muted small">Reps, sets and weight for each exercise, with last time's numbers beside you</span></li>
        <li><strong>Weigh in weekly</strong><span class="muted small">Track bodyweight against a goal and a target</span></li>
        <li><strong>Watch the colours</strong><span class="muted small"><span class="delta up">▲ Green</span> is progress, <span class="delta down">▼ red</span> is a decline, <span class="delta flat">■ grey</span> is no change</span></li>
      </ol>
      <div class="row gap-s center wrap">
        <button class="btn primary lg" data-action="start-empty">${icon('plus', 18)} Start your first workout</button>
        <button class="btn lg" data-action="load-demo">Try it with sample data</button>
      </div>
    </section>
    <div class="c-12">
      <h3 class="section-title">Or start from a ready-made routine</h3>
      <div class="cards">${TEMPLATES.map(templateCard).join('')}</div>
    </div>
  </div>`;
}

function upNextCard() {
  const a = state.active;
  if (a && a.mode === 'workout') {
    return `<section class="card accent-card">
      <div class="card-head"><h3>Workout in progress</h3><span class="muted small" data-elapsed></span></div>
      <p class="up-next-name">${esc(a.name || 'Untitled workout')}</p>
      <p class="muted small">${plural(a.exercises.length, 'exercise')} so far</p>
      <button class="btn primary wide" data-action="nav" data-view="workout">${icon('play', 16)} Resume</button>
    </section>`;
  }
  const next = nextRoutine();
  const today = isoDate();
  if (isRestDay(today)) {
    return `<section class="card accent-card">
      <div class="card-head"><h3>Today</h3><span class="muted small">${fmtDate(today, 'weekday')}</span></div>
      <p class="up-next-name">😴 Rest day</p>
      <p class="muted small">Recovery is part of training.${next ? ` Up next: ${esc(next.routine.name)}.` : ''}</p>
      <div class="row gap-s">
        <button class="btn grow" data-action="rest-toggle" data-date="today">Undo rest day</button>
        ${next ? `<button class="btn grow" data-action="start-routine" data-id="${next.routine.id}">Train anyway</button>` : ''}
      </div>
    </section>`;
  }
  // Offered until something is logged today
  const restButton = analyse().days.has(today) ? '' : '<button class="btn wide" data-action="rest-toggle" data-date="today">Take a rest day today</button>';
  if (!next) {
    return `<section class="card accent-card">
      <div class="card-head"><h3>Up next</h3></div>
      <p class="muted small">Save a routine and GymLog will suggest which one to do next.</p>
      <button class="btn primary wide" data-action="nav" data-view="workout">${icon('plus', 16)} Start workout</button>
      ${restButton}
    </section>`;
  }
  const r = next.routine;
  return `<section class="card accent-card">
    <div class="card-head"><h3>Up next</h3><span class="muted small">${next.last ? `Last done ${relDay(next.last).toLowerCase()}` : 'Not done yet'}</span></div>
    <p class="up-next-name">${esc(r.name)}</p>
    <p class="muted small">${r.exercises.map(e => esc(e.name)).join(' · ')}</p>
    <button class="btn primary wide" data-action="start-routine" data-id="${r.id}">${icon('play', 16)} Start ${esc(r.name)}</button>
    ${restButton}
  </section>`;
}

function insightsCard() {
  const mark = { good: '▲', bad: '▼', flat: '■', info: '●' };
  const items = insights().map(i =>
    `<li class="insight ${i.tone}${i.key ? ' clickable' : ''}" ${i.key ? `data-action="open-ex" data-key="${esc(i.key)}"` : ''}>
      <span class="insight-mark">${mark[i.tone]}</span><span>${i.html}</span>
    </li>`).join('');
  return `<section class="card grow">
    <div class="card-head"><h3>Insights</h3></div>
    <ul class="insights">${items}</ul>
  </section>`;
}

function exerciseTable(exercises, limit) {
  const rows = exercises.slice(0, limit).map(e => {
    const s = lastOf(e.sessions);
    return `<tr class="clickable" data-action="open-ex" data-key="${esc(e.key)}">
      <td><strong>${esc(e.name)}</strong><span class="muted small block">${e.info.muscle} · ${relDay(s.date)}</span></td>
      <td class="hide-s">${sparkline(e.sessions.slice(-12).map(x => x.best), s.status)}</td>
      <td>${fmtSet(s.bestSet)}</td>
      <td class="num hide-s">${s.weighted ? num(s.best) : '–'}</td>
      <td class="num">${delta(s.deltaPct, s.status, '%')}</td>
      <td class="right">${badge(s.status, s.pr)}</td>
    </tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="table">
    <thead><tr><th>Exercise</th><th class="hide-s">Trend</th><th>Last best set</th><th class="num hide-s">Est. 1RM</th><th class="num">vs last</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

// " · 15 sets · 4,274 kg · 20 min cardio", leaving out whatever a workout didn't have
function workoutSize(t, exact) {
  return (t.sets ? ` · ${plural(t.sets, 'set')}` : '')
    + (t.volume ? ` · ${exact ? big(t.volume) : compact(t.volume)} ${unit()}` : '')
    + (t.cardio ? ` · ${Math.round(t.cardio / 60)} min cardio` : '');
}

// Cardio is logged inside workouts (pick anything under Cardio when adding an
// exercise); this card pulls it together.
function cardioCard(cur7, prev7) {
  const a = analyse();
  const du = distUnit();
  const sessions = [...a.exercises.values()].flatMap(e => e.sessions.filter(s => s.kind === 'cardio'))
    .sort((x, y) => y.date.localeCompare(x.date));
  const head = `<div class="card-head"><h3>Cardio</h3><span class="muted small">Minutes a week</span></div>`;
  if (!sessions.length) {
    return `<section class="card c-5">${head}
      <p class="muted small">No cardio logged yet. When you add an exercise to a workout, pick one under <strong>Cardio</strong> (treadmill, bike, rowing machine and more) and enter the time. Distance is optional.</p>
      <button class="btn" data-action="nav" data-view="workout">${icon('plus', 16)} Start a workout</button>
    </section>`;
  }
  const minutes = Math.round(cur7.cardio / 60);
  const before = Math.round(prev7.cardio / 60);
  const recent = sessions.slice(0, 3).map(s => `<li class="clickable" data-action="open-ex" data-key="${esc(s.key)}">
      <span class="stack"><strong>${esc(s.name)}</strong><span class="muted small">${fmtSets(s.sets)} · ${relDay(s.date)}</span></span>
      ${badge(s.status, s.pr)}
    </li>`).join('');
  return `<section class="card c-5">${head}
    <div class="row between wrap">
      <div><span class="big-num">${count(minutes)}</span> <span class="muted">min in the last 7 days</span></div>
      <span class="muted small">${cur7.distance ? `${num(cur7.distance)} ${du} · ` : ''}${before} min the week before</span>
    </div>
    ${cardioBars(8)}
    <ul class="list">${recent}</ul>
  </section>`;
}

function dashboardBodyCard(body) {
  const u = unit();
  const l = body.latest;
  const head = `<div class="card-head"><h3>Bodyweight</h3>
    <button class="link" data-action="nav" data-view="body">Details ${icon('right', 14)}</button></div>`;
  const form = `<div class="row gap-s">
      <input type="number" id="bw-weight" class="grow" inputmode="decimal" step="0.1" min="0" placeholder="Today's weight (${u})" aria-label="Bodyweight">
      <input type="hidden" id="bw-date" value="${isoDate()}">
      <button class="btn primary" data-action="save-bw">Log weight</button>
    </div>`;
  if (!l) return `<section class="card c-5">${head}<p class="muted small">Weigh in once a week to see your trend against your goal.</p>${form}</section>`;

  const points = body.list.slice(-16).map(e => ({
    date: e.date, value: e.weight, status: e.status,
    tip: `${num(e.weight)} ${u}|${fmtDate(e.date, 'weekday')}${e.status === 'new' ? '' : `|${signed(e.delta)} ${u} on the entry before`}`,
  }));
  const goalLine = body.target ? `<div class="goal-line">
      <div class="progress"><span style="width:${(body.pct * 100).toFixed(0)}%"></span></div>
      <span class="small muted">${Math.abs(body.remaining) < 0.05 ? 'Target reached' : `${num(Math.abs(body.remaining))} ${u} to ${num(body.target)} ${u}`}${body.eta ? ` · about ${fmtDate(body.eta, 'short')}` : ''}</span>
    </div>` : '';
  return `<section class="card c-5">${head}
    <div class="row between wrap">
      <div><span class="big-num">${count(l.weight)}</span> <span class="muted">${u}</span>
        ${l.status === 'new' ? '' : delta(l.delta, l.status, ` ${u}`)}</div>
      ${body.rate != null ? `<span class="muted small">${signed(body.rate, 2)} ${u} a week</span>` : ''}
    </div>
    ${goalLine}
    ${chartSlot({ points, unit: u, height: 150, label: 'Bodyweight over time' })}
    ${body.weighedThisWeek
      ? `<p class="muted small">✓ Weighed in this week (${fmtDate(l.date, 'weekday')})</p>`
      : `<div class="due"><strong class="small">This week's weigh-in is due</strong>${form}</div>`}
  </section>`;
}

Views.dashboard = {
  title: 'Dashboard',
  render() {
    if (!state.workouts.length && !state.bodyweights.length) return welcomeView();

    const a = analyse();
    const s = state.settings;
    const u = unit();
    const today = isoDate();
    const week = a.weeks.get(weekStart()) || { workouts: 0 };
    const st = streaks();
    const cur7 = windowTotals(addDays(today, -6), today);
    const prev7 = windowTotals(addDays(today, -13), addDays(today, -7));
    const body = bodyStats();
    const exercises = [...a.exercises.values()].sort((x, y) => lastOf(y.sessions).date.localeCompare(lastOf(x.sessions).date));
    const tracked = exercises.filter(e => e.sessions.length > 1);
    const improving = tracked.filter(e => lastOf(e.sessions).status === 'up').length;
    const prs = a.prFeed.filter(p => p.pr);
    const recentPrs = prs.filter(p => p.date >= addDays(today, -30)).length;

    // --- stat tiles ---
    const left = s.weeklyGoal - week.workouts;
    const useVolume = cur7.volume > 0 || prev7.volume > 0;
    const loadNow = useVolume ? cur7.volume : cur7.sets;
    const loadPrev = useVolume ? prev7.volume : prev7.sets;
    const loadPct = loadPrev ? (loadNow - loadPrev) / loadPrev * 100 : null;
    const l = body.latest;
    const declined = tracked.filter(e => lastOf(e.sessions).status === 'down').length;
    const stalled = tracked.length - improving - declined;
    const notImproving = [
      declined ? `<span class="delta down">▼ ${declined} down</span>` : '',
      stalled ? `<span class="delta flat">■ ${stalled} stalled</span>` : '',
    ].filter(Boolean).join(' · ');
    const tiles = [
      tile('This week', `${count(week.workouts)}<small> / ${s.weeklyGoal}</small>`,
        left <= 0 ? '<span class="delta up">✓ Goal hit</span>' : `${plural(left, 'workout')} to go`,
        ring(week.workouts / s.weeklyGoal, 46, 5, left <= 0 ? 'good' : '')),
      tile('Week streak', `${count(st.current)}${st.current ? ' <span class="flame">🔥</span>' : ''}`, `Best: ${plural(st.best, 'week')}`),
      tile(useVolume ? 'Volume, last 7 days' : 'Sets, last 7 days',
        `${count(Math.round(loadNow))}${useVolume ? `<small> ${u}</small>` : ''}`,
        loadPct == null ? 'Nothing earlier yet' : `${delta(loadPct, loadPct >= 0 ? 'up' : 'down', '%', 0)} vs prior 7`),
      tile('Bodyweight', l ? `${count(l.weight)}<small> ${u}</small>` : '–',
        !l ? 'No weigh-ins yet' : l.status === 'new' ? fmtDate(l.date, 'short') : `${delta(l.delta, l.status, ` ${u}`)} since ${fmtDate(body.list[body.list.length - 2].date, 'short')}`),
      tile('Exercises improving', `${count(improving)}<small> / ${tracked.length}</small>`,
        !tracked.length ? 'Needs two sessions' : notImproving || '<span class="delta up">▲ All moving up</span>'),
      tile('PRs, last 30 days', count(recentPrs),
        prs.length ? `Latest: ${esc(lastOf(prs).name)}` : 'None yet'),
    ].map(t => `<div class="c-2">${t}</div>`).join('');

    // --- lists ---
    const recent = sortedWorkouts().reverse().slice(0, 5).map(w => {
      const t = a.byWorkout.get(w.id);
      return `<li class="clickable" data-action="hist-open" data-date="${w.date}">
        <span class="stack"><strong>${esc(w.name)}</strong>
          <span class="muted small">${relDay(w.date)}${w.duration >= 60 ? ` · ${fmtDuration(w.duration)}` : ''}${workoutSize(t)}</span></span>
        <span class="tally">${t.prs ? `<span class="badge up pr">★ ${t.prs}</span>` : ''}${tallyHtml(t)}</span>
      </li>`;
    }).join('');

    const feed = prs.slice(-6).reverse().map(p => {
      return `<li class="clickable" data-action="open-ex" data-key="${esc(p.key)}">
        <span class="stack"><strong>${esc(p.name)}</strong><span class="muted small">${PR_LABEL[mainPr(p)](p)}${p.timed ? '' : ` · ${fmtSet(p.bestSet)}`}</span></span>
        <span class="muted small nowrap">${fmtDate(p.date, 'short')}</span>
      </li>`;
    }).join('');

    const badges = achievements();
    const unlocked = badges.filter(b => b.done).length;
    const shelf = [...badges].sort((x, y) => y.done - x.done || y.progress - x.progress).map(b =>
      `<div class="ach ${b.done ? 'done' : ''}" data-tip="${esc(b.title)}|${esc(b.desc)}${b.done ? '|Unlocked' : `|${Math.floor(b.progress * 100)}% there`}">
        <span class="ach-icon">${b.icon}</span>
        <span class="ach-title">${b.title}</span>
        ${b.done ? '<span class="small delta up">✓ Unlocked</span>' : `<span class="progress"><span style="width:${(b.progress * 100).toFixed(0)}%"></span></span>`}
      </div>`).join('');

    const bars = weeklyBars(8);

    return `<div class="grid">
      ${state.demo ? `<section class="card banner c-12 row between wrap">
        <span>You're looking at <strong>sample data</strong>. Clear it when you're ready to log your own.</span>
        <button class="btn sm" data-action="clear-demo">Clear and start fresh</button>
      </section>` : ''}
      ${tiles}

      <section class="card c-5">
        <div class="card-head"><h3>Activity</h3><span class="muted small">Last 16 weeks</span></div>
        ${heatmap(16)}
      </section>
      <section class="card c-4">
        <div class="card-head"><h3>${bars.useVolume ? 'Weekly volume' : 'Weekly sets'}</h3><span class="muted small">${bars.useVolume ? `${u} lifted` : 'sets'}</span></div>
        ${bars.html}
        <p class="legend"><span class="key up"></span>Matched or beat the week before <span class="key down"></span>Fell short</p>
      </section>
      <section class="card c-3">
        <div class="card-head"><h3>Muscle groups</h3><span class="muted small">Sets, 7 days</span></div>
        ${muscleBars(cur7.muscles, prev7.muscles)}
        <p class="legend"><span class="key mark"></span>The 7 days before</p>
      </section>

      <section class="card c-8">
        <div class="card-head"><h3>Exercise progress</h3>
          <button class="link" data-action="nav" data-view="exercises">All ${exercises.length} ${icon('right', 14)}</button></div>
        ${exercises.length ? exerciseTable(exercises, 8) : '<p class="muted small">Log a workout to start tracking exercises.</p>'}
      </section>
      <div class="c-4 col">
        ${upNextCard()}
        ${insightsCard()}
      </div>

      ${dashboardBodyCard(body)}
      <section class="card c-4">
        <div class="card-head"><h3>Recent workouts</h3>
          <button class="link" data-action="nav" data-view="history">History ${icon('right', 14)}</button></div>
        ${recent ? `<ul class="list">${recent}</ul>` : '<p class="muted small">No workouts yet.</p>'}
      </section>
      <section class="card c-3">
        <div class="card-head"><h3>Latest records</h3></div>
        ${feed ? `<ul class="list">${feed}</ul>` : '<p class="muted small">Beat a previous best and it shows up here.</p>'}
      </section>

      ${cardioCard(cur7, prev7)}
      <section class="card c-7">
        <div class="card-head"><h3>Achievements</h3><span class="muted small">${unlocked} of ${badges.length} unlocked</span></div>
        <div class="ach-grid">${shelf}</div>
      </section>
    </div>`;
  },
};
