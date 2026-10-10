'use strict';

// Line charts are drawn at their container's real pixel width so text never
// scales. A view asks for a slot; mountCharts() fills every slot once the
// HTML is in the page, and again when the window is resized.
const _chartSpecs = [];

function chartSlot(spec) {
  _chartSpecs.push(spec);
  return `<div class="chart" data-chart="${_chartSpecs.length - 1}" style="height:${spec.height || 240}px"></div>`;
}

function mountCharts(root = document) {
  for (const el of $$('[data-chart]', root)) {
    const spec = _chartSpecs[Number(el.dataset.chart)];
    if (spec) el.innerHTML = lineChartSvg(spec, Math.max(240, el.clientWidth));
  }
}

// Round axis values that cover min..max in about `count` steps
function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw - 1e-12);
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

// Marker shapes repeat what the colour says: triangle up = progress,
// triangle down = decline, square = no change, circle = first entry.
function markerPath(status, cx, cy, r) {
  const f = n => n.toFixed(1);
  if (status === 'up') return `M${f(cx)} ${f(cy - r)}L${f(cx + r)} ${f(cy + r * 0.8)}L${f(cx - r)} ${f(cy + r * 0.8)}Z`;
  if (status === 'down') return `M${f(cx)} ${f(cy + r)}L${f(cx + r)} ${f(cy - r * 0.8)}L${f(cx - r)} ${f(cy - r * 0.8)}Z`;
  const q = r * 0.8;
  if (status === 'flat') return `M${f(cx - q)} ${f(cy - q)}h${f(q * 2)}v${f(q * 2)}h${f(-q * 2)}Z`;
  return `M${f(cx - q)} ${f(cy)}a${f(q)} ${f(q)} 0 1 0 ${f(q * 2)} 0a${f(q)} ${f(q)} 0 1 0 ${f(-q * 2)} 0Z`;
}

// spec: { points: [{ date, value, status, tip }], unit, trend: [values], target, height, label }
function lineChartSvg(spec, W) {
  const { points, trend, target } = spec;
  const H = spec.height || 240;
  if (points.length < 2) return '<div class="chart-empty">Log at least two entries to see a chart.</div>';
  const m = { l: 46, r: 18, t: 18, b: 26 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const all = points.map(p => p.value).concat(trend || [], target != null ? [target] : []);
  const ticks = niceTicks(Math.min(...all), Math.max(...all), H < 200 ? 3 : 4);
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1];
  const times = points.map(p => parseDate(p.date).getTime());
  const span = times[times.length - 1] - times[0];
  const last = points.length - 1;
  const xs = points.map((_, i) => m.l + (span ? pw * (times[i] - times[0]) / span : pw * i / last));
  const y = v => m.t + ph * (1 - (v - y0) / (y1 - y0));
  const fmtTick = v => Math.abs(v) >= 1000 ? big(v) : num(v, 2);

  const grid = ticks.map(v =>
    `<line class="gl" x1="${m.l}" x2="${W - m.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`
    + `<text class="tick" x="${m.l - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${fmtTick(v)}</text>`).join('');

  // Date labels: spread evenly, dropping any that would collide
  const want = clamp(Math.floor(pw / 90), 2, points.length);
  const kept = [];
  for (let k = 0; k < want; k++) {
    const i = Math.round(k * last / (want - 1));
    if (!kept.length || xs[i] - xs[kept[kept.length - 1]] >= 64) kept.push(i);
  }
  if (kept[kept.length - 1] !== last) {
    if (kept.length > 1) kept[kept.length - 1] = last;
    else kept.push(last);
  }
  const dates = kept.map(i => {
    const anchor = i === 0 ? 'start' : i === last ? 'end' : 'middle';
    return `<text class="tick" x="${xs[i].toFixed(1)}" y="${H - 6}" text-anchor="${anchor}">${fmtDate(points[i].date, 'short')}</text>`;
  }).join('');

  const path = vals => vals.map((v, i) => `${i ? 'L' : 'M'}${xs[i].toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const line = path(points.map(p => p.value));
  const area = `${line}L${xs[last].toFixed(1)} ${m.t + ph}L${xs[0].toFixed(1)} ${m.t + ph}Z`;

  // Each point owns a full-height hover band, so the pointer only has to be near it
  const r = pw / points.length < 16 ? 3.6 : 5.5;
  const groups = points.map((p, i) => {
    const left = i ? (xs[i - 1] + xs[i]) / 2 : 0;
    const right = i < last ? (xs[i] + xs[i + 1]) / 2 : W;
    return `<g class="pt-g" data-tip="${esc(p.tip)}">
      <rect class="hit" x="${left.toFixed(1)}" y="0" width="${Math.max(1, right - left).toFixed(1)}" height="${H}"/>
      <line class="cross" x1="${xs[i].toFixed(1)}" x2="${xs[i].toFixed(1)}" y1="${m.t}" y2="${m.t + ph}"/>
      <path class="pt ${p.status}" d="${markerPath(p.status, xs[i], y(p.value), r)}" style="animation-delay:${Math.min(900, 250 + i * 40)}ms"/>
    </g>`;
  }).join('');

  const endY = y(points[last].value);
  const endLabel = `<text class="end-label" x="${(xs[last] - 2).toFixed(1)}" y="${(endY < 30 ? endY + 20 : endY - 11).toFixed(1)}" text-anchor="end">${num(points[last].value)}${spec.unit ? ` ${esc(spec.unit)}` : ''}</text>`;

  return `<svg class="line-chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(spec.label || 'Chart')}">
    ${grid}${dates}
    ${target != null ? `<line class="target" x1="${m.l}" x2="${W - m.r}" y1="${y(target).toFixed(1)}" y2="${y(target).toFixed(1)}"/>
      <text class="tick" x="${m.l + 6}" y="${(y(target) - 5).toFixed(1)}">Target ${num(target)}</text>` : ''}
    <path class="area" d="${area}"/>
    ${trend ? `<path class="trend" d="${path(trend)}"/>` : ''}
    <path class="line" pathLength="1" d="${line}"/>
    ${groups}${endLabel}
  </svg>`;
}

function sparkline(values, status = 'new', w = 88, h = 26) {
  if (values.length < 2) return `<svg class="spark" width="${w}" height="${h}" aria-hidden="true"></svg>`;
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const x = i => 3 + (w - 6) * i / (values.length - 1);
  const y = v => 4 + (h - 8) * (1 - (v - min) / span);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const last = values.length - 1;
  return `<svg class="spark ${status}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <path d="${d}" pathLength="1"/><circle cx="${x(last).toFixed(1)}" cy="${y(values[last]).toFixed(1)}" r="3"/></svg>`;
}

function ring(pct, size = 44, stroke = 5, cls = '') {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const mid = size / 2;
  return `<svg class="ring ${cls}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle class="ring-track" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${stroke}"/>
    <circle class="ring-fill" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${c.toFixed(2)}"
      stroke-dashoffset="${(c * (1 - clamp(pct, 0, 1))).toFixed(2)}" style="--c:${c.toFixed(2)}" transform="rotate(-90 ${mid} ${mid})"/>
  </svg>`;
}

// What was done on one day, for tooltips: "15 sets · 20 min cardio"
function dayLabel(day) {
  const parts = [];
  if (day.sets) parts.push(plural(day.sets, 'set'));
  if (day.cardio) parts.push(`${Math.round(day.cardio / 60)} min cardio`);
  if (day.workouts > 1) parts.push(`${day.workouts} workouts`);
  return parts.join(' · ') || 'Workout';
}

// Calendar grid, one column per week with Monday on top. Darker = more sets that day.
function heatmap(weeksCount = 16) {
  const { days, rest } = analyse();
  const today = isoDate();
  const mondays = weeksBack(weeksCount);
  let max = 1;
  for (const [date, d] of days) if (date >= mondays[0]) max = Math.max(max, d.sets);
  let cells = ['M', '', 'W', '', 'F', '', ''].map(l => `<span class="heat-day">${l}</span>`).join('');
  let months = '<span></span>';
  let lastMonth = '';
  mondays.forEach((monday, col) => {
    const label = fmtDate(monday, 'short').split(' ')[1];
    months += `<span>${label !== lastMonth ? label : ''}</span>`;
    lastMonth = label;
    for (let d = 0; d < 7; d++) {
      const date = addDays(monday, d);
      const day = days.get(date);
      const isRest = !day && rest.has(date);
      const cls = date > today ? 'future' : isRest ? 'rest' : `l${day ? clamp(Math.ceil(day.sets / max * 4), 1, 4) : 0}`;
      const tip = `${day ? dayLabel(day) : isRest ? 'Rest day' : 'Nothing logged'}|${fmtDate(date, 'weekday')}${isRest && rest.get(date) ? `|${rest.get(date)}` : ''}`;
      // Any day up to today opens in History, where it can be marked as a rest day or filled in
      const link = date <= today ? ` data-action="hist-open" data-date="${date}"` : '';
      cells += `<i class="${cls}${date === today ? ' today' : ''}"${link} data-tip="${esc(tip)}" style="animation-delay:${col * 25}ms"></i>`;
    }
  });
  return `<div class="heat-months" style="--cols:${weeksCount}">${months}</div>
    <div class="heat" style="--cols:${weeksCount}">${cells}</div>
    <div class="heat-legend">Less <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> More <i class="rest gap"></i> Rest day</div>`;
}

// Weekly training load for the last n weeks. Uses volume lifted, or set count
// for someone who only logs bodyweight work. A bar is green when the week at
// least matched the one before it; the current week stays neutral until it does.
function weeklyBars(n = 8) {
  const { weeks } = analyse();
  const mondays = weeksBack(n + 1);
  const useVolume = mondays.some(mo => weeks.has(mo) && weeks.get(mo).volume > 0);
  const val = mo => weeks.has(mo) ? (useVolume ? weeks.get(mo).volume : weeks.get(mo).sets) : 0;
  const max = Math.max(1, ...mondays.slice(1).map(val));
  const what = useVolume ? unit() : 'sets';
  const html = mondays.slice(1).map((mo, i) => {
    const cur = val(mo);
    const prev = val(mondays[i]);
    const current = i === n - 1;
    const cls = !cur || (!prev && !current) ? 'new' : cur >= prev ? 'up' : current ? 'new' : 'down';
    const change = prev && cur ? `${cur >= prev ? '▲' : '▼'} ${signed((cur - prev) / prev * 100, 0)}% on the week before` : current ? 'This week so far' : '';
    const tip = `${big(cur)} ${what}|Week of ${fmtDate(mo, 'short')}${change ? `|${change}` : ''}`;
    return `<div class="bar-col" data-tip="${esc(tip)}">
      <span class="bar-val">${cur ? compact(cur) : ''}</span>
      <div class="bar-track"><div class="bar ${cls}" style="height:${(cur / max * 100).toFixed(1)}%;animation-delay:${i * 45}ms"></div></div>
      <span class="bar-label">${fmtDate(mo, 'short')}</span>
    </div>`;
  }).join('');
  return { html: `<div class="bars">${html}</div>`, useVolume };
}

// Minutes of cardio per week. Plain bars: this shows how much, not good or bad.
function cardioBars(n = 8) {
  const { weeks } = analyse();
  const mondays = weeksBack(n);
  const minutes = mo => weeks.has(mo) ? Math.round(weeks.get(mo).cardio / 60) : 0;
  const max = Math.max(1, ...mondays.map(minutes));
  return `<div class="bars short">${mondays.map((mo, i) => {
    const m = minutes(mo);
    const km = weeks.has(mo) ? weeks.get(mo).distance : 0;
    const tip = `${m} min${km ? ` · ${num(km)} ${distUnit()}` : ''}|Week of ${fmtDate(mo, 'short')}`;
    return `<div class="bar-col" data-tip="${esc(tip)}">
      <span class="bar-val">${m || ''}</span>
      <div class="bar-track"><div class="bar plain" style="height:${(m / max * 100).toFixed(1)}%;animation-delay:${i * 45}ms"></div></div>
      <span class="bar-label">${fmtDate(mo, 'short')}</span>
    </div>`;
  }).join('')}</div>`;
}

// Sets per muscle group: last 7 days as a bar, the 7 days before as a tick mark
function muscleBars(cur, prev) {
  const names = MUSCLES.concat(cur.Other || prev.Other ? ['Other'] : []);
  const max = Math.max(1, ...names.map(m => Math.max(cur[m] || 0, prev[m] || 0)));
  return `<div class="hbars">${names.map((m, i) => {
    const c = cur[m] || 0;
    const p = prev[m] || 0;
    const d = c - p;
    return `<div class="hbar" data-tip="${plural(c, 'set')} in the last 7 days|${p} in the 7 days before">
      <span class="hbar-name">${m}</span>
      <span class="hbar-track">
        <span class="hbar-fill" style="width:${(c / max * 100).toFixed(1)}%;animation-delay:${i * 30}ms"></span>
        ${p ? `<span class="hbar-mark" style="left:${(p / max * 100).toFixed(1)}%"></span>` : ''}
      </span>
      <span class="hbar-val">${c}</span>
      <span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : 'same'}">${d > 0 ? `▲ ${d}` : d < 0 ? `▼ ${-d}` : '–'}</span>
    </div>`;
  }).join('')}</div>`;
}

// One month as a grid. Every day up to today is a button: workouts are filled, rest days outlined
function monthCalendar(ym, selected) {
  const { days, rest } = analyse();
  const [y, mth] = ym.split('-').map(Number);
  const count = new Date(y, mth, 0).getDate();
  const lead = (new Date(y, mth - 1, 1).getDay() + 6) % 7;
  const today = isoDate();
  let cells = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<span class="cal-head">${d}</span>`).join('') + '<span></span>'.repeat(lead);
  for (let d = 1; d <= count; d++) {
    const date = `${ym}-${String(d).padStart(2, '0')}`;
    const day = days.get(date);
    const isRest = !day && rest.has(date);
    const cls = `cal-day${date === today ? ' today' : ''}${day ? ' has' : isRest ? ' rest' : ''}${date === selected ? ' sel' : ''}`;
    const tip = `${day ? dayLabel(day) : isRest ? 'Rest day' : 'Nothing logged'}|${fmtDate(date, 'weekday')}`;
    cells += date > today
      ? `<span class="${cls} future">${d}</span>`
      : `<button class="${cls}" data-action="hist-day" data-date="${date}" data-tip="${esc(tip)}">${d}</button>`;
  }
  return `<div class="cal">${cells}</div>`;
}

// Which plates go on each side of the bar to reach a target weight
function plateMath(target, bar) {
  let side = (target - bar) / 2;
  const plates = [];
  if (!(target > 0) || side < 0) return { plates, rest: 0, ok: false };
  for (const p of plateSizes()) {
    while (side >= p - 1e-9) { plates.push(p); side -= p; }
  }
  return { plates, rest: side * 2, ok: true };
}

function plateVisual(target, bar) {
  const { plates, rest, ok } = plateMath(target, bar);
  if (!ok) return `<p class="muted small">Enter a weight of at least the bar (${num(bar)} ${unit()}).</p>`;
  const biggest = plateSizes()[0];
  const counts = [];
  for (const p of plates) {
    const lastCount = counts[counts.length - 1];
    if (lastCount && lastCount[0] === p) lastCount[1]++;
    else counts.push([p, 1]);
  }
  return `<div class="barbell" aria-hidden="true">
      <span class="barbell-bar"></span>
      ${plates.map(p => `<span class="plate" style="height:${28 + 52 * Math.sqrt(p / biggest)}px;width:${p >= 10 ? 14 : 9}px"></span>`).join('')}
      <span class="barbell-end"></span>
    </div>
    <p class="small">${plates.length
      ? `<strong>Each side:</strong> ${counts.map(([p, n]) => `${n} × ${num(p, 2)}`).join(' + ')} ${unit()}`
      : 'Just the empty bar.'}
      ${rest > 0.001 ? `<br><span class="muted">${num(rest, 2)} ${unit()} can't be made with standard plates. Loaded weight: ${num(target - rest, 2)} ${unit()}.</span>` : ''}</p>`;
}
