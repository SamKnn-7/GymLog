'use strict';

// Rest timer. It shows in two places: a card on the workout page and a
// floating pill everywhere else, both updated from the same tick.
const timer = { end: 0, total: 0, id: null };
const TIMER_RING = 2 * Math.PI * 16;

const timerRunning = () => timer.id !== null;

function startTimer(seconds) {
  timer.total = seconds * 1000;
  timer.end = Date.now() + timer.total;
  clearInterval(timer.id);
  timer.id = setInterval(tickTimer, 200);
  renderTimer();
}

function adjustTimer(seconds) {
  if (!timerRunning()) return;
  timer.end += seconds * 1000;
  timer.total = Math.max(timer.total, timer.end - Date.now());
  tickTimer();
}

function stopTimer() {
  clearInterval(timer.id);
  timer.id = null;
  renderTimer();
}

function tickTimer() {
  const left = timer.end - Date.now();
  if (left <= 0) {
    stopTimer();
    toast('Rest over. Next set!', 'good');
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    beep();
    return;
  }
  for (const el of $$('[data-timer-text]')) el.textContent = fmtClock(Math.ceil(left / 1000));
  for (const el of $$('[data-timer-ring]')) el.style.strokeDashoffset = TIMER_RING * (1 - left / timer.total);
}

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.18].forEach(at => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.12);
    });
  } catch { /* sound is a nice-to-have */ }
}

function timerRingSvg(size) {
  return `<svg class="timer-ring" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true">
    <circle class="ring-track" cx="20" cy="20" r="16" stroke-width="4"/>
    <circle data-timer-ring class="ring-fill" cx="20" cy="20" r="16" stroke-width="4" stroke-dasharray="${TIMER_RING}" transform="rotate(-90 20 20)"/>
  </svg>`;
}

// The card on the workout page
function timerCard() {
  const s = state.settings;
  const presets = [60, 90, 120, 180];
  return `<section class="card" id="timer-card">
    <div class="card-head"><h3>${icon('timer', 16)} Rest timer</h3>
      <label class="check small"><input type="checkbox" data-change="setting" data-key="autoRest" ${s.autoRest ? 'checked' : ''}> Start after each set</label>
    </div>
    ${timerRunning() ? `<div class="timer-big">
        ${timerRingSvg(84)}
        <div><div class="timer-clock" data-timer-text></div>
          <div class="row gap-s">
            <button class="btn sm" data-action="timer-adjust" data-sec="-15">−15s</button>
            <button class="btn sm" data-action="timer-adjust" data-sec="15">+15s</button>
            <button class="btn sm" data-action="timer-stop">Skip</button>
          </div></div>
      </div>`
    : `<div class="row gap-s wrap">${presets.map(sec =>
        `<button class="btn sm ${sec === s.restSeconds ? 'on' : ''}" data-action="timer-start" data-sec="${sec}">${fmtClock(sec)}</button>`).join('')}</div>
      <p class="muted small">Tap a time to start. The highlighted one starts by itself when you tick off a set.</p>`}
  </section>`;
}

function renderTimer() {
  const card = $('#timer-card');
  if (card) card.outerHTML = timerCard();
  const pill = $('#timer-pill');
  pill.hidden = !timerRunning();
  if (timerRunning()) {
    pill.innerHTML = `${timerRingSvg(36)}<strong data-timer-text></strong>
      <button class="btn sm" data-action="timer-adjust" data-sec="15">+15s</button>
      <button class="btn sm" data-action="timer-stop">Skip</button>`;
    tickTimer();
  }
}
