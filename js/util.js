'use strict';

// ---------- DOM ----------

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// ---------- numbers ----------

const num = (v, d = 1) => String(Math.round(v * 10 ** d) / 10 ** d);
const big = v => Math.round(v).toLocaleString('en');
const signed = (v, d = 1) => (v > 0 ? '+' : '') + num(v, d);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sum = (arr, fn = x => x) => arr.reduce((n, x, i) => n + fn(x, i), 0);
const norm = name => String(name).trim().toLowerCase();
const lastOf = arr => arr[arr.length - 1];

// 12,340 -> 12.3k for tight spaces
const compact = v => v >= 1e6 ? `${num(v / 1e6)}M` : v >= 1e4 ? `${num(v / 1e3)}k` : big(v);

// ---------- dates (ISO yyyy-mm-dd strings, local time) ----------

function isoDate(d = new Date()) {
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const DATE_STYLES = {
  short: { day: 'numeric', month: 'short' },
  full: { day: 'numeric', month: 'short', year: 'numeric' },
  weekday: { weekday: 'short', day: 'numeric', month: 'short' },
  month: { month: 'long', year: 'numeric' },
};

function fmtDate(s, style = 'full') {
  return parseDate(s).toLocaleDateString('en-GB', DATE_STYLES[style]);
}

function addDays(iso, n) {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 864e5);

// Monday of the week containing the given date
function weekStartOf(iso) {
  return addDays(iso, -((parseDate(iso).getDay() + 6) % 7));
}

const weekStart = () => weekStartOf(isoDate());

// Mondays of the last n weeks, oldest first, ending with the current week
function weeksBack(n) {
  const start = weekStart();
  return Array.from({ length: n }, (_, i) => addDays(start, -7 * (n - 1 - i)));
}

function relDay(iso) {
  const days = daysBetween(iso, isoDate());
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

// ---------- durations ----------

function fmtDuration(seconds) {
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}

function fmtClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const z = n => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  return h ? `${h}:${z(Math.floor(s / 60) % 60)}:${z(s % 60)}` : `${Math.floor(s / 60)}:${z(s % 60)}`;
}

// ---------- timed exercises (cardio and holds) ----------

// Time as shown everywhere: 45s, 1:30, 30:00, 1:05:00
const fmtTime = seconds => seconds < 60 ? `${Math.round(seconds)}s` : fmtClock(seconds);

// Read a typed time into seconds. "22:30" always means minutes:seconds.
// A plain number means minutes for cardio ("30", "22.5") and seconds for holds ("45").
function parseTime(text, kind) {
  const t = String(text ?? '').trim().replace(',', '.');
  if (!t) return 0;
  if (t.includes(':')) {
    const parts = t.split(':').map(Number);
    if (parts.some(n => !isFinite(n) || n < 0)) return 0;
    return Math.round(parts.reduce((total, n) => total * 60 + n, 0));
  }
  const n = Number(t);
  return isFinite(n) && n > 0 ? Math.round(kind === 'hold' ? n : n * 60) : 0;
}

// The reverse, for filling a time box: "45" for a hold, "30" or "22:30" for cardio
function timeField(seconds, kind) {
  if (!seconds) return '';
  if (kind === 'hold') return String(seconds);
  return seconds % 60 === 0 ? String(seconds / 60) : fmtClock(seconds);
}

// Small seeded random generator, so the sample data is the same every time
function seededRandom(seed) {
  let a = seed;
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
