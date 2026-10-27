/* ENDURA core: storage, state, formatting, UI primitives */

/* ---------------- tiny DOM helpers ---------------- */

export function el(tag, attrs = {}, html = '') {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  if (html) n.innerHTML = html;
  return n;
}

export function mount(html) {
  const root = document.createElement('div');
  root.className = 'screen';
  root.innerHTML = html;
  return root;
}

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------------- dates ---------------- */

const pad = (n) => String(n).padStart(2, '0');

export function keyOf(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return keyOf(d);
}

export const today = () => keyOf(new Date());

export function prettyDate(key) {
  const d = fromKey(key);
  const t = today();
  if (key === t) return 'Today';
  if (key === addDays(t, -1)) return 'Yesterday';
  if (key === addDays(t, 1)) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function longDate(key) {
  return fromKey(key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function clock(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function hhmm(ts) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/* ---------------- numbers & units ---------------- */

export function num(v, fallback = 0) {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

export const round1 = (n) => Math.round(n * 10) / 10;
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

export function kgToDisplay(kg, units) {
  return units === 'imperial' ? kg * 2.2046226 : kg;
}
export function displayToKg(v, units) {
  return units === 'imperial' ? v / 2.2046226 : v;
}
export const weightLabel = (units) => (units === 'imperial' ? 'lb' : 'kg');
export const cmToDisplay = (cm, units) => (units === 'imperial' ? cm / 2.54 : cm);
export const displayToCm = (v, units) => (units === 'imperial' ? v * 2.54 : v);
export const lengthLabel = (units) => (units === 'imperial' ? 'in' : 'cm');

export const fmtW = (kg, units) => `${round1(kgToDisplay(kg, units))}`;
export const fmtKg = (kg, units) => `${round1(kgToDisplay(kg, units))} ${weightLabel(units)}`;

/* Epley estimated 1RM */
export const e1rm = (weight, reps) => (reps <= 1 ? weight : weight * (1 + reps / 30));

export function platesPerSide(weightKg, barKg = 20, units = 'metric') {
  const w = weightKg - barKg;
  if (w <= 0) return [];
  const plates = units === 'imperial'
    ? [45, 35, 25, 10, 5, 2.5].map((p) => p / 2.2046226)
    : [25, 20, 15, 10, 5, 2.5, 1.25];
  const out = [];
  let left = w / 2;
  for (const p of plates) {
    while (left >= p - 0.001) { out.push(p); left -= p; }
  }
  return out;
}

/* ---------------- storage ---------------- */

// Kept as "fittrack" on purpose: renaming the database would strand every log
// already saved on this device. The name is internal and never shown.
const DB_NAME = 'fittrack';
const DB_VERSION = 1;
let dbPromise = null;

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        for (const name of ['sessions', 'meals', 'metrics']) {
          if (!d.objectStoreNames.contains(name)) {
            const s = d.createObjectStore(name, { keyPath: 'id' });
            s.createIndex('date', 'date');
          }
        }
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv', { keyPath: 'k' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function run(store, mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const tx = d.transaction(store, mode);
    const os = tx.objectStore(store);
    let out;
    try { out = fn(os); } catch (e) { reject(e); return; }
    tx.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export const dbAll = (store) => run(store, 'readonly', (os) => os.getAll());
export const dbGet = (store, id) => run(store, 'readonly', (os) => os.get(id));
export const dbPut = (store, val) => run(store, 'readwrite', (os) => os.put(val));
export const dbDel = (store, id) => run(store, 'readwrite', (os) => os.delete(id));
export const dbClear = (store) => run(store, 'readwrite', (os) => os.clear());

/* ---------------- state ---------------- */

/* The accounts server ships with the app so a fresh install can create an
 * account without pasting anything. The publishable key is public by design —
 * row-level security is what protects the rows. These are only the defaults;
 * a device that already saved its own values keeps them. */
export const DEFAULT_SETTINGS = {
  units: 'metric',
  targets: { kcal: 2400, protein: 160, carbs: 260, fat: 70 },
  restDefault: 90,
  heightCm: 175,
  goalWeightKg: null,
  barKg: 20,
  cloud: { provider: 'none', model: '' },
  sync: {
    url: 'https://npeinkgyioxlgotmwqea.supabase.co',
    key: 'sb_publishable_vvsQjcOBHNjhtwIopVJK-w_zbunWTCA',
  },
  // What close friends may read. Off by default; every section is its own switch.
  share: { enabled: false, meals: true, macros: true, workouts: true, body: false },
  onboarded: false,
};

export const state = {
  settings: structuredClone(DEFAULT_SETTINGS),
  sessions: [],
  meals: [],
  metrics: [],
  learned: {},
  ready: false,
};

const subs = new Set();
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
export function emit() { subs.forEach((fn) => fn()); }

export async function boot() {
  const [settings, sessions, meals, metrics, learned] = await Promise.all([
    dbGet('kv', 'settings').catch(() => null),
    dbAll('sessions').catch(() => []),
    dbAll('meals').catch(() => []),
    dbAll('metrics').catch(() => []),
    dbGet('kv', 'learned').catch(() => null),
  ]);
  if (settings && settings.v) state.settings = mergeSettings(DEFAULT_SETTINGS, settings.v);
  if (Array.isArray(sessions)) state.sessions = sessions;
  if (Array.isArray(meals)) {
    // Scan photos are preview-only. Older builds stored a data URL on every
    // meal (never displayed), so strip and rewrite those records once.
    const clean = meals.map(({ photo, ...rest }) => rest);
    state.meals = clean;
    clean.forEach((m, i) => {
      if ('photo' in meals[i]) dbPut('meals', m).catch(() => {});
    });
  }
  if (Array.isArray(metrics)) state.metrics = metrics;
  if (learned && learned.v && typeof learned.v === 'object') state.learned = learned.v;
  const local = localStorage.getItem('ft.settings');
  if (local && !settings) {
    try { state.settings = mergeSettings(DEFAULT_SETTINGS, JSON.parse(local)); } catch { /* ignore */ }
  }
  state.ready = true;
}

function mergeSettings(base, patch) {
  const out = { ...base, ...patch };
  out.targets = { ...base.targets, ...(patch.targets || {}) };
  out.cloud = { ...base.cloud, ...(patch.cloud || {}) };
  out.sync = { ...base.sync, ...(patch.sync || {}) };
  out.share = { ...base.share, ...(patch.share || {}) };
  // A saved blank must not erase the built-in server: an install that predates
  // the baked-in config would otherwise be left with no accounts at all.
  if (!out.sync.url || !out.sync.key) out.sync = { ...base.sync, ...(out.sync.url ? { url: out.sync.url } : {}), ...(out.sync.key ? { key: out.sync.key } : {}) };
  return out;
}

export async function saveSettings(patch) {
  state.settings = mergeSettings(state.settings, patch);
  localStorage.setItem('ft.settings', JSON.stringify(state.settings));
  await dbPut('kv', { k: 'settings', v: state.settings }).catch(() => {});
  emit();
}

/* photo-scanner corrections: "dough" meant cookie last time, so try it first */
const labelKey = (label) => String(label || '')
  .toLowerCase().split(',')[0].replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export async function learnLabel(label, foodId) {
  const key = labelKey(label);
  if (!key || !foodId) return;
  const prev = state.learned[key];
  const n = prev && prev.id === foodId ? (prev.n || 0) + 1 : 1;
  state.learned[key] = { id: foodId, n };
  await dbPut('kv', { k: 'learned', v: state.learned }).catch(() => {});
}

export async function forgetPhotoLearning() {
  state.learned = {};
  await dbPut('kv', { k: 'learned', v: {} }).catch(() => {});
  emit();
}

export const activeSession = () => state.sessions.find((s) => s.status === 'active') || null;

export async function saveSession(session, opts = {}) {
  const i = state.sessions.findIndex((s) => s.id === session.id);
  if (i >= 0) state.sessions[i] = session; else state.sessions.push(session);
  await dbPut('sessions', session);
  if (!opts.silent) emit();
}

export async function removeSession(id) {
  state.sessions = state.sessions.filter((s) => s.id !== id);
  await dbDel('sessions', id);
  emit();
}

export async function addMeal(meal) {
  // The scan photo is a preview in the sheet only. Dropping it here (rather
  // than in the callers) guarantees no image data ever reaches IndexedDB.
  const { photo, ...record } = meal;
  state.meals.push(record);
  await dbPut('meals', record);
  emit();
}
export async function removeMeal(id) {
  state.meals = state.meals.filter((m) => m.id !== id);
  await dbDel('meals', id);
  emit();
}

export async function addMetric(metric) {
  // one entry per day: overwrite same-date weight records
  const existing = state.metrics.find((m) => m.date === metric.date);
  if (existing) {
    metric.id = existing.id;
    metric.createdAt = existing.createdAt;
    state.metrics = state.metrics.map((m) => (m.id === metric.id ? metric : m));
  } else {
    state.metrics.push(metric);
  }
  await dbPut('metrics', metric);
  emit();
}
export async function removeMetric(id) {
  state.metrics = state.metrics.filter((m) => m.id !== id);
  await dbDel('metrics', id);
  emit();
}

/* ---------------- selectors ---------------- */

export const mealsFor = (date) => state.meals.filter((m) => m.date === date);
export const sessionsFor = (date) => state.sessions.filter((s) => s.date === date && s.status !== 'active');

export function totalsFor(date) {
  return mealsFor(date).reduce((t, m) => {
    t.kcal += m.kcal || 0; t.protein += m.protein || 0;
    t.carbs += m.carbs || 0; t.fat += m.fat || 0;
    return t;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

export function sessionVolume(s) {
  return (s.exercises || []).reduce((v, ex) => v + ex.sets.reduce((a, st) =>
    a + (st.done ? (st.weight || 0) * (st.reps || 0) : 0), 0), 0);
}

export function sessionSets(s) {
  return (s.exercises || []).reduce((a, ex) => a + ex.sets.filter((st) => st.done).length, 0);
}

/** consecutive days (ending today or yesterday) with any logged activity */
export function streak() {
  const days = new Set();
  state.meals.forEach((m) => days.add(m.date));
  state.sessions.forEach((s) => { if (s.status !== 'active') days.add(s.date); });
  state.metrics.forEach((m) => days.add(m.date));
  let d = today();
  if (!days.has(d)) d = addDays(d, -1);
  let n = 0;
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

export function activityLevel(date) {
  let score = 0;
  if (state.sessions.some((s) => s.date === date && s.status !== 'active')) score += 2;
  const meals = state.meals.filter((m) => m.date === date).length;
  if (meals) score += 1;
  if (meals >= 3) score += 1;
  if (state.metrics.some((m) => m.date === date)) score += 1;
  return Math.min(4, score);
}

/* ---------------- UI primitives ---------------- */

let toastTimer = null;
export function toast(msg, kind = '') {
  const wrap = document.getElementById('toastwrap');
  const n = el('div', { class: `toast ${kind ? 'toast--' + kind : ''}`, text: msg });
  wrap.appendChild(n);
  clearTimeout(toastTimer);
  setTimeout(() => {
    n.style.transition = 'opacity .25s';
    n.style.opacity = '0';
    setTimeout(() => n.remove(), 250);
  }, 2200);
}

const overlay = () => document.getElementById('overlay');
const sheetEl = () => document.getElementById('sheet');

export function openSheet(html, opts = {}) {
  const s = sheetEl();
  s.innerHTML = `<div class="sheet__grab"></div>${html}`;
  overlay().hidden = false;
  document.body.style.overflow = 'hidden';
  s.scrollTop = 0;
  if (opts.onMount) opts.onMount(s);
  s.focus({ preventScroll: true });
}

export function closeSheet() {
  overlay().hidden = true;
  sheetEl().innerHTML = '';
  document.body.style.overflow = '';
}

document.addEventListener('click', (e) => {
  if (e.target === overlay()) closeSheet();
  const c = e.target.closest('[data-close]');
  if (c) closeSheet();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay().hidden) closeSheet();
});

export function confirmSheet({ title, message, ok = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    openSheet(`
      <div class="sheet__head"><div class="sheet__title">${esc(title)}</div></div>
      <p class="muted" style="font-size:14px">${esc(message)}</p>
      <div class="sheet__foot">
        <button class="btn" data-close>Cancel</button>
        <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-ok>${esc(ok)}</button>
      </div>`, {
      onMount(s) {
        s.querySelector('[data-ok]').addEventListener('click', () => { closeSheet(); resolve(true); });
        s.querySelector('[data-close]').addEventListener('click', () => resolve(false));
      },
    });
  });
}

export function ring(pct, size, stroke, color = 'var(--accent)') {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - clamp(pct, 0, 1));
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
      <circle class="prog" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"
        stroke="${color}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
    </svg>
  </div>`;
}

export function bar(pct, color = 'var(--accent)') {
  return `<div class="mbar__track"><div class="mbar__fill" style="width:${clamp(pct * 100, 0, 100)}%;background:${color}"></div></div>`;
}

/* photo pipeline */
export function fileToBitmap(file) {
  if ('createImageBitmap' in window) return createImageBitmap(file);
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

export function downscale(bitmap, max = 720, quality = 0.72) {
  const w = bitmap.width, h = bitmap.height;
  const scale = Math.min(1, max / Math.max(w, h));
  const cw = Math.round(w * scale), ch = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, cw, ch);
  return { canvas, dataUrl: canvas.toDataURL('image/jpeg', quality) };
}

export function pickPhoto() {
  return new Promise((resolve) => {
    const input = document.getElementById('photo-input');
    input.value = '';
    const onChange = () => {
      input.removeEventListener('change', onChange);
      resolve(input.files && input.files[0] ? input.files[0] : null);
    };
    input.addEventListener('change', onChange);
    input.click();
  });
}
