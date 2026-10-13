'use strict';

// A front and a back figure with one shape per muscle, so each muscle group
// can be coloured on its own. Only the left half of each figure is written
// down; the right half is its mirror image. Shapes are [group, path], where
// the group is a name from MUSCLES, 'part' for a muscle that is not tracked
// (forearms) or 'skin' for everything else.

// Rounded rectangle as a path
const roundRect = (x, y, w, h, r) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;

const BODY_ARM = [
  ['part', 'M39 160Q48 164 57 160Q56 188 42 214L31 212Q31 186 39 160Z'],
  ['skin', 'M27.500 227a6.500 11 0 1 0 13 0a6.500 11 0 1 0 -13 0Z'],
];

const BODY_SHAPES = {
  front: [
    ['skin', 'M92.500 46L92.500 66Q96 73 100 74L100 46Z'],
    ['Back', 'M90 56Q87 66 70 75Q82 75.500 90 71Z'],
    ['Shoulders', 'M67 78Q54 76 47 86Q41 96 44 116Q53 112 58 102Q63 91 67 78Z'],
    ['Chest', 'M71 79Q86 75 98 78L98 119Q86 127 74 122Q65 115 62 105Q65 92 71 79Z'],
    ['Biceps', 'M46 120Q55 116 60 106Q64 132 57 156Q48 160 39 156Q39 137 46 120Z'],
    ...BODY_ARM,
    ['Core', roundRect(85.5, 128, 12.5, 16, 4)],
    ['Core', roundRect(85.5, 147, 12.5, 16, 4)],
    ['Core', roundRect(85.5, 166, 12.5, 16, 4)],
    ['Core', 'M87 185L98 185L98 212Q89 205 85.500 193L85.500 186.500Q85.500 185 87 185Z'],
    ['Core', 'M64.500 122Q72 127 82.500 127L82.500 193Q76 200 66 204Q72 186 71.500 170Q69 146 64.500 122Z'],
    ['skin', 'M65 207.500Q76 203 84.500 197Q90 208 98 215L98 231Q80 219 62.500 211.500Z'],
    ['Quads', 'M61.500 216Q75 219 85.500 229Q89 262 89 293Q80 299 70 294Q59 256 61.500 216Z'],
    ['Adductors', 'M88.500 229Q94 231 98 235L98 266Q97 282 92.500 291Q93 260 88.500 229Z'],
    ['skin', 'M70.500 307a9.500 7 0 1 0 19 0a9.500 7 0 1 0 -19 0Z'],
    ['Calves', 'M69 319Q80 316 91 319Q95 347 86 385L76 385Q63 347 69 319Z'],
    ['skin', 'M75.500 389L86.500 389Q89 396 88 401Q79 406 68 402Q70 394 75.500 389Z'],
  ],
  back: [
    ['skin', 'M92.500 46L92.500 60L100 60L100 46Z'],
    ['Back', 'M98 52L92.500 58Q84 70 69 75Q80 81 89 95Q95 107 98 121Z'],
    ['Shoulders', 'M67 78Q54 76 47 86Q41 96 44 116Q53 112 58 102Q63 91 67 78Z'],
    ['Back', 'M69.500 80Q78 84 86 96Q91 105 94 116Q78 111 63.500 104Q65.500 91 69.500 80Z'],
    ['Back', 'M63 108Q79 115 94 120.500L98 125L98 156Q86 168 74.500 172Q66 142 63 108Z'],
    ['Back', 'M98 160Q87 171 75.500 176Q71 190 67 201Q84 198 98 204Z'],
    ['Triceps', 'M46 120Q55 116 60 106Q64 132 57 156Q48 160 39 156Q39 137 46 120Z'],
    ...BODY_ARM,
    ['Glutes', 'M65 206Q82 200 98 208L98 240Q84 249 68 242Q58 226 65 206Z'],
    ['Hamstrings', 'M67 247Q84 252 96.500 245Q98 270 93 293Q82 299 71 294Q61 270 67 247Z'],
    ['skin', 'M72.500 306a9 6.500 0 1 0 18 0a9 6.500 0 1 0 -18 0Z'],
    ['Calves', 'M69 318Q81 314 93 318Q97 341 90 364Q81 368 73 364Q64 341 69 318Z'],
    ['skin', 'M75 369Q81 371.500 88 369L86 385L76 385Z'],
    ['skin', 'M76 389L86 389Q88 396 87 400Q81 404 73 400Q73 394 76 389Z'],
  ],
};

const BODY_MIRROR = 'matrix(-1 0 0 1 200 0)';

// One figure. paint(muscle) returns { cls, attrs } for that muscle's shapes;
// every shape of a muscle shares one <g>, so both sides light up together.
function bodyFigure(side, paint) {
  const groups = new Map();
  for (const [group, d] of BODY_SHAPES[side]) {
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(`<path d="${d}"/><path d="${d}" transform="${BODY_MIRROR}"/>`);
  }
  let html = '<ellipse class="skin" cx="100" cy="29" rx="16" ry="21"/>';
  for (const [group, paths] of groups) {
    const p = MUSCLES.includes(group) ? paint(group) : { cls: group, attrs: '' };
    html += `<g class="${group === 'skin' || group === 'part' ? group : `m ${p.cls || ''}`}" ${p.attrs || ''}>${paths.join('')}</g>`;
  }
  return `<svg class="body-fig" viewBox="24 5 152 403" role="img" aria-label="${side === 'front' ? 'Front' : 'Back'} of the body">${html}</svg>`;
}

// Both figures side by side, with their captions
function bodyMap(paint, cls = '') {
  return `<div class="body-map ${cls}">
    <figure>${bodyFigure('front', paint)}<figcaption>Front</figcaption></figure>
    <figure>${bodyFigure('back', paint)}<figcaption>Back</figcaption></figure>
  </div>`;
}

// A small figure pair with the given muscles picked out, for "this works these muscles"
function bodyHighlight(muscles, cls = 'mini') {
  return bodyMap(m => ({ cls: muscles.includes(m) ? 'hit' : '' }), cls);
}

// ---------- the muscle map on the dashboard ----------

// What a muscle group's colour means in "Progress": [status, mark, label]
const MUSCLE_STATES = [
  ['up', '▲', 'Progressing'],
  ['flat', '■', 'No change'],
  ['down', '▼', 'Declined'],
  ['new', '●', 'Just started'],
  ['none', '○', 'Not trained in 4 weeks'],
];

// "▲ 2 improved · ■ 1 no change", from the latest session of each exercise for the group
function muscleSummary(g) {
  if (!g.exercises.length) return g.last ? `Last trained ${relDay(g.last).toLowerCase()}` : 'Nothing logged yet';
  return [
    g.up ? `▲ ${g.up} improved` : '',
    g.flat ? `■ ${g.flat} no change` : '',
    g.down ? `▼ ${g.down} declined` : '',
    g.fresh ? `● ${g.fresh} new` : '',
  ].filter(Boolean).join(' · ');
}

const muscleTag = (m, cls, extra = '') =>
  `<button class="mtag ${cls}" data-action="muscle-open" data-muscle="${m}">${m}${extra}</button>`;

// Front and back of the body, each muscle group coloured by how its exercises
// are going (green up, red down, grey level) or by how many sets it has had
// this week. The lists beside it say the same in words.
function muscleMapCard(cur7, prev7) {
  const mode = ui.muscleMap;
  const groups = muscleStatus();
  const sets = m => cur7.muscles[m] || 0;
  const most = Math.max(1, ...MUSCLES.map(sets));
  const level = m => sets(m) ? `l${clamp(Math.ceil(sets(m) / most * 4), 1, 4)}` : '';
  const paint = m => ({
    cls: mode === 'sets' ? level(m) : groups[m].status,
    attrs: `data-action="muscle-open" data-muscle="${m}" data-tip="${esc(`${m}|${muscleSummary(groups[m])}|${plural(sets(m), 'set')} in the last 7 days`)}"`,
  });

  let key;
  if (mode === 'sets') {
    const worked = MUSCLES.filter(sets).sort((x, y) => sets(y) - sets(x));
    const idle = MUSCLES.filter(m => !sets(m));
    key = `<div class="heat-legend">Fewer <i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> More sets, last 7 days</div>
      ${worked.length ? `<div class="key-row"><span class="muted small">Worked this week</span>
        <div class="mtags">${worked.map(m => muscleTag(m, level(m), ` <strong>${sets(m)}</strong>`)).join('')}</div></div>` : ''}
      ${idle.length ? `<div class="key-row"><span class="muted small">Not yet this week</span>
        <div class="mtags">${idle.map(m => muscleTag(m, '')).join('')}</div></div>` : ''}`;
  } else {
    key = MUSCLE_STATES.map(([status, mark, label]) => {
      const list = MUSCLES.filter(m => groups[m].status === status);
      return list.length ? `<div class="key-row"><span class="delta ${status}">${mark} ${label}</span>
        <div class="mtags">${list.map(m => muscleTag(m, status)).join('')}</div></div>` : '';
    }).join('');
  }
  return `<section class="card c-6">
    <div class="card-head"><h3>Muscle map</h3>${segmented('muscle-mode', [['progress', 'Progress'], ['sets', 'Sets']], mode)}</div>
    <div class="muscle-map">
      ${bodyMap(paint)}
      <div class="muscle-key">${key}
        <p class="muted small">${mode === 'sets' ? 'Darker means more sets.' : 'Based on the latest session of each exercise.'} Tap a muscle to see what is behind it.</p>
      </div>
    </div>
  </section>`;
}

Actions['muscle-mode'] = el => {
  ui.muscleMap = el.dataset.value;
  render();
};

// One muscle group: where it is, how it is going, and the exercises behind that
Actions['muscle-open'] = el => {
  const m = el.dataset.muscle;
  const a = analyse();
  const g = muscleStatus()[m];
  const today = isoDate();
  const cur = windowTotals(addDays(today, -6), today).muscles[m] || 0;
  const prev = windowTotals(addDays(today, -13), addDays(today, -7)).muscles[m] || 0;
  const done = [...a.exercises.values()]
    .filter(e => e.info.muscles.includes(m) && lastOf(e.sessions).kind !== 'cardio')
    .sort((x, y) => lastOf(y.sessions).date.localeCompare(lastOf(x.sessions).date));
  const rows = done.slice(0, 12).map(e => {
    const s = lastOf(e.sessions);
    return `<li class="clickable" data-action="open-ex" data-key="${esc(e.key)}">
      <span class="stack"><strong>${esc(e.name)}</strong><span class="muted small">${s.timed ? fmtSets(s.sets) : fmtSet(s.bestSet)} · ${relDay(s.date)}</span></span>
      ${badge(s.status, s.pr)}
    </li>`;
  }).join('');
  // A few to try that have not been logged yet, one per kind of equipment
  const seen = new Set();
  const ideas = [...exerciseIndex().values()]
    .filter(e => e.muscles.includes(m) && !a.exercises.has(norm(e.name)) && !seen.has(e.equipment) && seen.add(e.equipment))
    .slice(0, 5).map(e => esc(e.name)).join(' · ');
  const status = g.status === 'none' ? '<span class="badge new">○ Not trained lately</span>' : badge(g.status);
  openModal(`<div class="modal-head">
      <div class="row">${bodyHighlight([m], 'mid')}<div class="stack gap-s"><h2>${m}</h2><span class="muted small">${muscleSummary(g)}</span><span>${status}</span></div></div>
      <button class="icon-btn" data-action="close-modal" aria-label="Close">${icon('x')}</button>
    </div>
    <div class="mini-stats">
      <div><strong>${cur}</strong><span>Sets, last 7 days</span></div>
      <div><strong>${prev}</strong><span>The 7 days before</span></div>
      <div><strong>${g.last ? relDay(g.last) : 'Never'}</strong><span>Last trained</span></div>
    </div>
    ${rows ? `<ul class="list scroll-list">${rows}</ul>` : `<p class="muted small">Nothing logged for ${m.toLowerCase()} yet.</p>`}
    ${ideas ? `<p class="note"><strong>${rows ? 'More to try' : 'Exercises to try'}:</strong> ${ideas}</p>` : ''}`);
};
