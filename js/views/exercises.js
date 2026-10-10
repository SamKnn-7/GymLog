'use strict';

const EX_RANGES = [['1m', '1M'], ['3m', '3M'], ['6m', '6M'], ['1y', '1Y'], ['all', 'All']];
const EX_RANGE_DAYS = { '1m': 30, '3m': 91, '6m': 182, '1y': 365 };

// The list on the left, re-rendered on its own while typing in the search box
function exerciseListHtml() {
  const q = norm(ui.exercise.q);
  const list = [...analyse().exercises.values()]
    .filter(e => !q || e.key.includes(q) || norm(e.info.muscle).includes(q))
    .sort((x, y) => lastOf(y.sessions).date.localeCompare(lastOf(x.sessions).date));
  if (!list.length) return '<p class="muted small pad">No exercises match.</p>';
  return list.map(e => {
    const s = lastOf(e.sessions);
    return `<button class="ex-row ${s.status}${e.key === ui.exercise.key ? ' on' : ''}" data-action="ex-select" data-key="${esc(e.key)}">
      <span class="stack"><strong>${esc(e.name)}</strong><span class="muted small">${e.info.muscle} · ${relDay(s.date)}</span></span>
      ${sparkline(e.sessions.slice(-12).map(x => x.best), s.status, 64, 24)}
      <span class="delta ${s.status === 'new' ? 'same' : s.status}">${s.pr ? '★' : { up: '▲', down: '▼', flat: '■', new: '●' }[s.status]}</span>
    </button>`;
  }).join('');
}

function exerciseDetail(entry) {
  const e = ui.exercise;
  const u = unit();
  const weighted = entry.sessions.some(s => s.weighted);
  const metrics = weighted
    ? [['best', 'Est. 1RM'], ['maxWeight', 'Top weight'], ['volume', 'Volume'], ['reps', 'Total reps']]
    : [['best', 'Best set'], ['reps', 'Total reps']];
  if (!metrics.some(([k]) => k === e.metric)) e.metric = 'best';
  const metricUnit = e.metric === 'reps' || !weighted ? 'reps' : u;
  const metricLabel = metrics.find(([k]) => k === e.metric)[1];

  const days = EX_RANGE_DAYS[e.range];
  const sessions = days ? entry.sessions.filter(s => s.date >= addDays(isoDate(), -days)) : entry.sessions;
  const points = sessions.map((s, i) => {
    const v = s[e.metric];
    const before = i ? sessions[i - 1][e.metric] : null;
    // Est. 1RM uses the session's own verdict; other metrics compare point to point
    const status = e.metric === 'best' ? s.status
      : before == null ? 'new' : v > before + EPS ? 'up' : v < before - EPS ? 'down' : 'flat';
    return { date: s.date, value: v, status, tip: `${v >= 1000 ? big(v) : num(v)} ${metricUnit}|${fmtDate(s.date, 'weekday')}|${fmtSets(s.work)}` };
  });

  const rec = entry.records;
  const first = entry.sessions[0];
  const latest = lastOf(entry.sessions);
  const change = first.best ? (latest.best - first.best) / first.best * 100 : 0;
  const tiles = [
    tile('Best set', fmtSet(rec.best.bestSet), `${weighted ? `${num(rec.best.best)} ${u} est. 1RM · ` : ''}${fmtDate(rec.best.date, 'short')}`),
    weighted ? tile('Heaviest weight', `${num(rec.weight.maxWeight, 2)}<small> ${u}</small>`, fmtDate(rec.weight.date, 'short')) : '',
    tile(weighted ? 'Biggest session' : 'Most reps in a session', weighted ? `${big(rec.volume.volume)}<small> ${u}</small>` : `${rec.volume.reps}`, fmtDate(rec.volume.date, 'short')),
    tile('Most reps in a set', `${rec.reps.maxReps}`, fmtDate(rec.reps.date, 'short')),
    tile('Since first session', entry.sessions.length > 1 ? `${signed(change)}%` : '–',
      entry.sessions.length > 1 ? `${delta(latest.best - first.best, change > 0 ? 'up' : 'down', weighted ? ` ${u}` : ' reps')} over ${plural(entry.sessions.length, 'session')}` : 'One session so far'),
  ].filter(Boolean).map(t => `<div class="c-fit">${t}</div>`).join('');

  const repRows = !weighted ? '' : repMaxes(entry).map(r => `<tr>
      <td>${r.reps} rep${r.reps === 1 ? '' : 's'}</td>
      <td class="num">${r.actual ? `<strong>${num(r.actual.weight, 2)} ${u}</strong>` : '<span class="muted">–</span>'}</td>
      <td class="muted small nowrap">${r.actual ? `× ${r.actual.reps} · ${fmtDate(r.actual.date, 'short')}` : ''}</td>
      <td class="num muted">${num(r.estimate)} ${u}</td>
    </tr>`).join('');

  const rows = [...entry.sessions].reverse().slice(0, 20).map(s => `<tr>
      <td class="nowrap">${fmtDate(s.date, 'short')}</td>
      <td>${fmtSets(s.sets)}</td>
      <td class="num nowrap">${num(s.best)} ${delta(s.delta, s.status)}</td>
      <td class="num hide-s">${s.weighted ? big(s.volume) : s.reps}</td>
      <td class="right">${badge(s.status, s.pr)}</td>
    </tr>`).join('');

  return `<section class="card">
      <div class="card-head wrap">
        <div><h2>${esc(entry.name)}</h2><span class="muted small">${entry.info.muscle}${entry.info.equipment ? ` · ${entry.info.equipment}` : ''} · ${plural(entry.sessions.length, 'session')}</span></div>
        ${badge(latest.status, latest.pr)}
      </div>
      <div class="toolbar">
        ${segmented('ex-metric', metrics, e.metric)}
        ${segmented('ex-range', EX_RANGES, e.range)}
      </div>
      ${chartSlot({ points, unit: metricUnit, height: 260, label: `${entry.name}: ${metricLabel}` })}
      <p class="legend">
        <span class="key shape up">▲</span>Better than the session before
        <span class="key shape down">▼</span>Worse
        <span class="key shape down">■</span>No change
      </p>
    </section>
    <div class="tile-row">${tiles}</div>
    <div class="grid">
      ${weighted ? `<section class="card c-5">
        <div class="card-head"><h3>Rep maxes</h3></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Reps</th><th class="num">Best lifted</th><th></th><th class="num">Estimated</th></tr></thead>
          <tbody>${repRows}</tbody>
        </table></div>
      </section>` : ''}
      <section class="card ${weighted ? 'c-7' : 'c-12'}">
        <div class="card-head"><h3>Sessions</h3><span class="muted small">Newest first</span></div>
        <div class="table-wrap scroll-y"><table class="table">
          <thead><tr><th>Date</th><th>Sets</th><th class="num">${weighted ? 'Est. 1RM' : 'Best reps'}</th><th class="num hide-s">${weighted ? 'Volume' : 'Reps'}</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </section>
    </div>`;
}

Views.exercises = {
  title: 'Exercises',
  render() {
    const { exercises } = analyse();
    if (!exercises.size) {
      return emptyState('📈', 'Log a workout to see how each exercise is progressing.', `<button class="btn primary" data-action="nav" data-view="workout">${icon('plus', 16)} Start a workout</button>`);
    }
    const e = ui.exercise;
    if (!exercises.has(e.key)) {
      e.key = [...exercises.values()].sort((x, y) => lastOf(y.sessions).date.localeCompare(lastOf(x.sessions).date))[0].key;
    }
    return `<div class="grid">
      <aside class="c-4 col side">
        <section class="card">
          <div class="search">${icon('search', 16)}<input type="search" placeholder="Search ${exercises.size} exercises" data-input="ex-q" value="${esc(e.q)}" aria-label="Search exercises"></div>
          <div class="ex-list" id="ex-list">${exerciseListHtml()}</div>
        </section>
      </aside>
      <div class="c-8 col" id="ex-detail">${exerciseDetail(exercises.get(e.key))}</div>
    </div>`;
  },
};

Inputs['ex-q'] = el => {
  ui.exercise.q = el.value;
  $('#ex-list').innerHTML = exerciseListHtml();
};

// Switching exercise or chart re-animates the detail side only
function refreshExercise() {
  render();
  animateIn($('#ex-detail'));
}

Actions['ex-select'] = el => {
  ui.exercise.key = el.dataset.key;
  refreshExercise();
};

Actions['ex-metric'] = el => {
  ui.exercise.metric = el.dataset.value;
  refreshExercise();
};

Actions['ex-range'] = el => {
  ui.exercise.range = el.dataset.value;
  refreshExercise();
};

// From anywhere: jump to one exercise's progress page
Actions['open-ex'] = el => {
  closeModal();
  ui.exercise.key = el.dataset.key;
  ui.exercise.q = '';
  go('exercises');
};
