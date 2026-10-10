'use strict';

const HISTORY_PAGE = 30;

function historyMonth() {
  if (!ui.history.month) {
    ui.history.month = (state.workouts.length ? lastOf(sortedWorkouts()).date : isoDate()).slice(0, 7);
  }
  return ui.history.month;
}

function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  return isoDate(new Date(y, m - 1 + n, 1)).slice(0, 7);
}

function workoutCard(w, a) {
  const t = a.byWorkout.get(w.id);
  const rows = w.exercises.map((ex, i) => {
    const s = a.bySession.get(`${w.id}:${i}`);
    return `<li class="${s.status}">
      <span class="stack"><strong>${esc(ex.name)}</strong>
        <span class="muted small">${fmtSets(ex.sets)}${ex.notes ? ` · “${esc(ex.notes)}”` : ''}</span></span>
      ${badge(s.status, s.pr)}
    </li>`;
  }).join('');
  return `<section class="card workout-card">
    <div class="card-head">
      <div><h3>${esc(w.name)}</h3>
        <span class="muted small">${fmtDate(w.date, 'weekday')}${t.time ? ` · ${fmtClockTime(t.time)}` : ''}${w.duration >= 60 ? ` · ${fmtDuration(w.duration)}` : ''}${workoutSize(t, true)}</span></div>
      <div class="row gap-xs">
        <button class="icon-btn" data-action="repeat-workout" data-id="${w.id}" data-tip="Do this workout again" aria-label="Repeat workout">${icon('repeat', 16)}</button>
        <button class="icon-btn" data-action="save-as-routine" data-id="${w.id}" data-tip="Save as a routine" aria-label="Save as routine">${icon('bookmark', 16)}</button>
        <button class="icon-btn" data-action="edit-workout" data-id="${w.id}" data-tip="Edit" aria-label="Edit workout">${icon('edit', 16)}</button>
        <button class="icon-btn danger" data-action="del-workout" data-id="${w.id}" data-tip="Delete" aria-label="Delete workout">${icon('trash', 16)}</button>
      </div>
    </div>
    <div class="tally">
      ${t.prs ? `<span class="badge up pr">★ ${plural(t.prs, 'PR')}</span>` : ''}
      ${tallyHtml(t, true)}
    </div>
    ${w.notes ? `<p class="note">${esc(w.notes)}</p>` : ''}
    <ul class="list status-list">${rows}</ul>
  </section>`;
}

// What a day with no workout shows: mark it as a rest day, or fill in a workout
function dayCardHtml(date) {
  const { rest } = analyse();
  const isRest = rest.has(date);
  return `<section class="card">
    <div class="card-head"><h3>${isRest ? '😴 Rest day' : 'Nothing logged'}</h3><span class="muted small">${fmtDate(date, 'weekday')}</span></div>
    ${isRest
      ? `<input class="note-input" placeholder="Add a note: sore, travelling, under the weather…" data-change="rest-note" data-date="${date}" value="${esc(rest.get(date))}" aria-label="Rest day note">`
      : '<p class="muted small">No workout on this day. Mark it as a rest day, or fill in a workout you did.</p>'}
    <div class="row gap-s wrap">
      <button class="btn ${isRest ? '' : 'primary'}" data-action="rest-toggle" data-date="${date}">${isRest ? 'Remove rest day' : 'Mark as rest day'}</button>
      <button class="btn" data-action="log-on-date" data-date="${date}">${icon('plus', 16)} Log a workout for this day</button>
    </div>
  </section>`;
}

// The filtered list, re-rendered on its own while typing in the search box
function historyListHtml() {
  const a = analyse();
  const h = ui.history;
  const ym = historyMonth();
  const q = norm(h.q);
  let list = sortedWorkouts().reverse();
  let title;
  if (q) {
    list = list.filter(w => norm(w.name).includes(q) || norm(w.notes || '').includes(q) || w.exercises.some(ex => norm(ex.name).includes(q)));
    title = `${plural(list.length, 'workout')} matching “${esc(h.q.trim())}”`;
  } else if (h.day) {
    list = list.filter(w => w.date === h.day);
    title = `${fmtDate(h.day, 'weekday')} <button class="link" data-action="hist-clear">Show the whole month</button>`;
  } else if (h.scope === 'month') {
    list = list.filter(w => w.date.startsWith(ym));
    title = `${plural(list.length, 'workout')} in ${fmtDate(`${ym}-01`, 'month')}`;
  } else {
    title = `${plural(list.length, 'workout')} in total`;
  }
  const shown = list.slice(0, h.limit || HISTORY_PAGE);
  return `<p class="list-title">${title}</p>
    ${shown.length ? `<div class="cards wide-cards">${shown.map(w => workoutCard(w, a)).join('')}</div>`
      : h.day && !q ? dayCardHtml(h.day) : emptyState('🗓️', 'No workouts here.')}
    ${list.length > shown.length ? `<button class="btn wide" data-action="hist-more">Show ${Math.min(HISTORY_PAGE, list.length - shown.length)} more</button>` : ''}`;
}

Views.history = {
  title: 'History',
  render() {
    if (!state.workouts.length && !state.restDays.length) {
      return emptyState('📒', 'No workouts logged yet.', `<button class="btn primary" data-action="nav" data-view="workout">${icon('plus', 16)} Start a workout</button>`);
    }
    const h = ui.history;
    const ym = historyMonth();
    const m = windowTotals(`${ym}-01`, `${ym}-31`);
    const prs = analyse().prFeed.filter(p => p.pr && p.date.startsWith(ym)).length;
    const restCount = state.restDays.filter(r => r.date.startsWith(ym) && isRestDay(r.date)).length;
    return `<div class="grid">
      <aside class="c-4 col side">
        <section class="card">
          <div class="card-head">
            <button class="icon-btn" data-action="hist-month" data-dir="-1" aria-label="Previous month">${icon('left', 18)}</button>
            <h3>${fmtDate(`${ym}-01`, 'month')}</h3>
            <button class="icon-btn" data-action="hist-month" data-dir="1" aria-label="Next month" ${ym >= isoDate().slice(0, 7) ? 'disabled' : ''}>${icon('right', 18)}</button>
          </div>
          ${monthCalendar(ym, h.day)}
          <div class="mini-stats">
            <div><strong>${count(m.workouts)}</strong><span>Workouts</span></div>
            <div><strong>${m.duration ? fmtDuration(m.duration) : '–'}</strong><span>Time</span></div>
            <div><strong>${compact(m.volume)}</strong><span>${unit()} lifted</span></div>
            ${m.cardio ? `<div><strong>${count(Math.round(m.cardio / 60))}</strong><span>min cardio</span></div>` : ''}
            <div><strong>${count(prs)}</strong><span>PRs</span></div>
            ${restCount ? `<div><strong>${count(restCount)}</strong><span>Rest days</span></div>` : ''}
          </div>
        </section>
      </aside>
      <div class="c-8 col">
        <div class="toolbar">
          <div class="search grow">${icon('search', 16)}<input type="search" placeholder="Search workouts, exercises or notes" data-input="hist-q" value="${esc(h.q)}" aria-label="Search history"></div>
          ${segmented('hist-scope', [['month', 'This month'], ['all', 'All time']], h.scope)}
        </div>
        <div id="hist-list">${historyListHtml()}</div>
      </div>
    </div>`;
  },
};

Inputs['hist-q'] = el => {
  ui.history.q = el.value;
  $('#hist-list').innerHTML = historyListHtml();
};

Actions['hist-month'] = el => {
  ui.history.month = shiftMonth(historyMonth(), Number(el.dataset.dir));
  ui.history.day = null;
  ui.history.scope = 'month';
  ui.history.limit = HISTORY_PAGE;
  render();
};

Actions['hist-day'] = el => {
  ui.history.day = ui.history.day === el.dataset.date ? null : el.dataset.date;
  render();
};

Actions['hist-clear'] = () => {
  ui.history.day = null;
  render();
};

Actions['hist-scope'] = el => {
  ui.history.scope = el.dataset.value;
  ui.history.day = null;
  ui.history.limit = HISTORY_PAGE;
  render();
};

Actions['hist-more'] = () => {
  ui.history.limit = (ui.history.limit || HISTORY_PAGE) + HISTORY_PAGE;
  $('#hist-list').innerHTML = historyListHtml();
};

// From the dashboard: jump to one day's workout
Actions['hist-open'] = el => {
  ui.history = { ...ui.history, month: el.dataset.date.slice(0, 7), day: el.dataset.date, q: '', scope: 'month' };
  go('history');
};

// Mark or unmark a rest day. data-date is an ISO date, or 'today'.
Actions['rest-toggle'] = el => {
  const date = el.dataset.date === 'today' ? isoDate() : el.dataset.date;
  if (analyse().days.has(date)) return toast('You trained that day, so it can’t be a rest day', 'bad');
  const had = state.restDays.some(r => r.date === date);
  state.restDays = state.restDays.filter(r => r.date !== date);
  if (!had) state.restDays.push({ date, note: '' });
  save();
  render();
  toast(had ? 'Rest day removed' : date === isoDate() ? 'Rest day logged. Recover well!' : 'Rest day added', had ? '' : 'good');
};

Changes['rest-note'] = el => {
  const entry = state.restDays.find(r => r.date === el.dataset.date);
  if (!entry) return;
  entry.note = el.value.trim();
  save();
};

// Fill in a workout for a past day: a blank workout with the date already set
Actions['log-on-date'] = el => {
  startWorkout(null);
  const a = state.active;
  if (!a || a.exercises.length || a.mode !== 'workout') return;
  a.date = el.dataset.date;
  persist();
  render();
};

Actions['del-workout'] = el => {
  const w = workoutById(el);
  if (!confirm(`Delete “${w.name}” from ${fmtDate(w.date, 'weekday')}? This can't be undone.`)) return;
  state.workouts = state.workouts.filter(x => x !== w);
  save();
  render();
  toast('Workout deleted');
};
