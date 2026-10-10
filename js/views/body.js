'use strict';

const BODY_RANGES = [['3m', '3M'], ['6m', '6M'], ['1y', '1Y'], ['all', 'All']];
const GOALS = [['gain', 'Gain weight'], ['lose', 'Lose weight'], ['maintain', 'Maintain weight']];

function measurementsCard() {
  const u = lengthUnit();
  const byType = {};
  for (const m of [...state.measurements].sort((a, b) => a.date.localeCompare(b.date))) {
    (byType[m.type] || (byType[m.type] = [])).push(m);
  }
  const rows = MEASUREMENTS.filter(t => byType[t]).map(type => {
    const list = byType[type];
    const latest = lastOf(list);
    const change = latest.value - list[0].value;
    return `<li>
      <span class="stack"><strong>${type}</strong><span class="muted small">${fmtDate(latest.date, 'short')} · ${list.length} ${list.length === 1 ? 'entry' : 'entries'}</span></span>
      ${sparkline(list.map(m => m.value), 'new', 64, 24)}
      <span class="stack right"><strong>${num(latest.value)} ${measureUnit(type)}</strong>
        <span class="muted small">${list.length > 1 ? `${signed(change)} since ${fmtDate(list[0].date, 'short')}` : 'First entry'}</span></span>
      <button class="icon-btn danger" data-action="del-measure" data-type="${type}" data-tip="Delete the latest ${type.toLowerCase()} entry" aria-label="Delete latest entry">${icon('x', 14)}</button>
    </li>`;
  }).join('');
  return `<section class="card">
    <div class="card-head"><h3>Measurements</h3><span class="muted small">Optional</span></div>
    <div class="row gap-s wrap">
      <select id="measure-type" class="grow" aria-label="Measurement">${MEASUREMENTS.map(t => `<option value="${t}">${t} (${t === 'Body fat' ? '%' : u})</option>`).join('')}</select>
      <input type="number" id="measure-value" class="w-s" inputmode="decimal" step="0.1" min="0" placeholder="Value" aria-label="Value">
      <button class="btn" data-action="save-measure">Add</button>
    </div>
    ${rows ? `<ul class="list">${rows}</ul>` : '<p class="muted small">Track body fat, waist, chest, arms and more alongside your weight.</p>'}
  </section>`;
}

Views.body = {
  title: 'Body',
  render() {
    const b = bodyStats();
    const s = state.settings;
    const u = unit();
    const l = b.latest;

    const days = { '3m': 91, '6m': 182, '1y': 365 }[ui.body.range];
    const shown = days ? b.list.filter(e => e.date >= addDays(isoDate(), -days)) : b.list;
    const points = shown.map(e => ({
      date: e.date, value: e.weight, status: e.status,
      tip: `${num(e.weight)} ${u}|${fmtDate(e.date, 'weekday')}${e.status === 'new' ? '' : `|${signed(e.delta)} ${u} on the entry before`}|Trend ${num(e.trend)} ${u}`,
    }));

    const onTrack = b.rate != null && bodyOnTrack(b.rate);
    const month = b.change30 == null ? null : judgeBodyChange(b.change30, l.weight - b.change30);
    const monthLabel = { up: '▲ Toward your goal', down: '▼ Away from your goal', flat: '■ No change' };
    const tiles = !l ? '' : [
      tile('Current', `${count(l.weight)}<small> ${u}</small>`,
        l.status === 'new' ? fmtDate(l.date, 'short') : `${delta(l.delta, l.status, ` ${u}`)} on last entry`),
      tile('Trend weight', `${count(Math.round(l.trend * 10) / 10)}<small> ${u}</small>`, 'Smoothed average'),
      tile('Last 30 days', b.change30 == null ? '–' : `${signed(b.change30)}<small> ${u}</small>`,
        month ? `<span class="delta ${month}">${monthLabel[month]}</span>` : 'Needs a month of entries'),
      tile('Rate', b.rate == null ? '–' : `${signed(b.rate, 2)}<small> ${u}/wk</small>`,
        b.rate == null ? 'Needs two entries' : `<span class="delta ${onTrack ? 'up' : 'down'}">${onTrack ? '▲ On track' : '▼ Off track'}</span> for your goal`),
      tile(b.bmi ? 'BMI' : 'Weigh-ins', b.bmi ? num(b.bmi) : count(b.list.length), b.bmi ? `At ${num(Number(s.height))} ${lengthUnit()}` : 'Add your height for BMI'),
    ].map(t => `<div class="c-fit">${t}</div>`).join('');
    const toGo = !b.target || !l ? '' : Math.abs(b.remaining) < 0.05 ? '<span class="delta up">✓ Target reached</span>'
      : `<strong>${num(Math.abs(b.remaining))} ${u} to go</strong>${b.eta ? ` · on course for about ${fmtDate(b.eta, 'short')}` : ' · no finish date at the current rate'}`;

    const rows = [...b.list].reverse().map(e => `<tr>
        <td class="nowrap">${fmtDate(e.date, 'weekday')}</td>
        <td class="num"><strong>${num(e.weight)}</strong> ${u}</td>
        <td class="num">${delta(e.delta, e.status)}</td>
        <td class="num muted hide-s">${num(e.trend)}</td>
        <td class="right">${badge(e.status)}</td>
        <td><button class="icon-btn danger" data-action="del-bw" data-date="${e.date}" aria-label="Delete entry">${icon('x', 14)}</button></td>
      </tr>`).join('');

    return `<div class="grid">
      <aside class="c-4 col side">
        <section class="card ${b.weighedThisWeek || !l ? '' : 'banner'}">
          <div class="card-head"><h3>Log bodyweight</h3>
            <span class="muted small">${b.weighedThisWeek ? '✓ Done this week' : l ? 'Due this week' : ''}</span></div>
          <div class="row gap-s wrap">
            <label class="field">Date<input type="date" id="bw-date" value="${isoDate()}" max="${isoDate()}"></label>
            <label class="field grow">Weight (${u})<input type="number" id="bw-weight" inputmode="decimal" step="0.1" min="0" placeholder="e.g. ${u === 'kg' ? '75.4' : '166.2'}"></label>
          </div>
          <button class="btn primary wide" data-action="save-bw">Save weigh-in</button>
        </section>
        <section class="card">
          <div class="card-head"><h3>Goal</h3></div>
          <div class="form-grid">
            <label class="field">I want to<select data-change="setting" data-key="goal">${GOALS.map(([v, t]) => `<option value="${v}" ${s.goal === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
            <label class="field">Target (${u})<input type="number" inputmode="decimal" step="0.1" min="0" data-change="setting" data-key="targetWeight" value="${esc(s.targetWeight)}" placeholder="Optional"></label>
            <label class="field">Height (${lengthUnit()})<input type="number" inputmode="decimal" step="0.1" min="0" data-change="setting" data-key="height" value="${esc(s.height)}" placeholder="Optional"></label>
          </div>
          ${b.target && l ? `<div class="goal-line">
            <div class="progress"><span style="width:${(b.pct * 100).toFixed(0)}%"></span></div>
            <span class="small muted">${num(b.first.weight)} → ${num(b.target)} ${u} · ${(b.pct * 100).toFixed(0)}% of the way</span>
            <span class="small">${toGo}</span>
          </div>` : ''}
        </section>
        ${measurementsCard()}
      </aside>
      <div class="c-8 col">
        ${tiles ? `<div class="tile-row">${tiles}</div>` : ''}
        <section class="card">
          <div class="card-head"><h3>Weight trend</h3>${segmented('body-range', BODY_RANGES, ui.body.range)}</div>
          ${chartSlot({ points, unit: u, trend: shown.map(e => e.trend), target: b.target, height: 280, label: 'Bodyweight over time' })}
          <p class="legend">
            <span class="key shape up">▲</span>Moving toward your goal
            <span class="key shape down">▼</span>Away from it
            <span class="key dash"></span>Smoothed trend
            ${b.target ? '<span class="key dash target"></span>Target' : ''}
          </p>
        </section>
        ${rows ? `<section class="card">
          <div class="card-head"><h3>Entries</h3><span class="muted small">${plural(b.list.length, 'weigh-in')}</span></div>
          <div class="table-wrap scroll-y"><table class="table">
            <thead><tr><th>Date</th><th class="num">Weight</th><th class="num">Change</th><th class="num hide-s">Trend</th><th></th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>
        </section>` : ''}
      </div>
    </div>`;
  },
};

Actions['save-bw'] = () => {
  const weight = Number($('#bw-weight').value);
  const date = $('#bw-date').value || isoDate();
  if (!(weight > 0)) return toast('Enter your bodyweight first', 'bad');
  state.bodyweights = state.bodyweights.filter(e => e.date !== date);
  state.bodyweights.push({ date, weight });
  save();
  render(true);
  toast('Weigh-in saved', 'good');
};

Actions['del-bw'] = el => {
  if (!confirm('Delete this weigh-in?')) return;
  state.bodyweights = state.bodyweights.filter(e => e.date !== el.dataset.date);
  save();
  render();
};

Actions['body-range'] = el => {
  ui.body.range = el.dataset.value;
  render();
};

Actions['save-measure'] = () => {
  const value = Number($('#measure-value').value);
  const type = $('#measure-type').value;
  if (!(value > 0)) return toast('Enter a value first', 'bad');
  const date = isoDate();
  state.measurements = state.measurements.filter(m => !(m.type === type && m.date === date));
  state.measurements.push({ date, type, value });
  save();
  render();
  toast(`${type} saved`, 'good');
};

Actions['del-measure'] = el => {
  const type = el.dataset.type;
  const latest = lastOf(state.measurements.filter(m => m.type === type).sort((a, b) => a.date.localeCompare(b.date)));
  if (!latest || !confirm(`Delete the ${type.toLowerCase()} entry from ${fmtDate(latest.date, 'short')}?`)) return;
  state.measurements = state.measurements.filter(m => m !== latest);
  save();
  render();
};
