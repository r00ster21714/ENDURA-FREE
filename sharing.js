/* ENDURA sharing — the only data this app ever uploads.

 * Workouts, meals and measurements stay in IndexedDB; when you turn sharing on,
 * a small summary of the last seven days is published to Supabase so the
 * friends you marked as close can read it. Every section is its own switch, and
 * a section that is off is never built into the payload — the server keeps what
 * you send, it cannot add what you left out. Turning the master switch off
 * deletes the published row.
 */
import { state, addDays, today, round1, sessionSets, sessionVolume } from './core.js';
import { auth, getClient } from './auth.js';

export const SHARE_DEFAULTS = {
  enabled: false,   // master switch
  meals: true,      // the dishes themselves
  macros: true,     // calories + protein/carbs/fat
  workouts: true,   // sessions, time, volume
  body: false,      // weight and body measurements
};

/** Which sections are actually published right now. */
export function sharePrefs() {
  const s = { ...SHARE_DEFAULTS, ...(state.settings.share || {}) };
  const on = !!s.enabled;
  return {
    enabled: on,
    meals: on && s.meals !== false,
    macros: on && s.macros !== false,
    workouts: on && s.workouts !== false,
    body: on && s.body === true,
  };
}

export const shareState = { lastError: '', lastPublished: 0, busy: false };

const myId = () => (auth.session ? auth.session.user.id : null);
const max = (n, list) => list.slice(0, n);

function mealName(m) {
  return String(m.name || 'Food').slice(0, 80);
}

/** The seven days ending today, as the payload the server stores. */
export function buildWeek() {
  const prefs = sharePrefs();
  const to = today();
  const from = addDays(to, -6);
  const inRange = (d) => d >= from && d <= to;

  const meals = state.meals.filter((m) => inRange(m.date));
  const days = new Set(meals.map((m) => m.date));

  const sum = meals.reduce((t, m) => {
    t.kcal += m.kcal || 0; t.protein += m.protein || 0;
    t.carbs += m.carbs || 0; t.fat += m.fat || 0;
    return t;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const dayCount = Math.max(1, days.size);

  const sessions = state.sessions.filter((s) => s.status !== 'active' && inRange(s.date));
  const minutes = sessions.reduce((t, s) => t + Math.max(0, Math.round(((s.endedAt || s.startedAt) - s.startedAt) / 60000)), 0);
  const volume = sessions.reduce((t, s) => t + sessionVolume(s), 0);

  const weights = state.metrics.filter((m) => m.weightKg > 0).sort((a, b) => a.date.localeCompare(b.date));
  const inWindow = weights.filter((m) => inRange(m.date));
  const latest = inWindow[inWindow.length - 1] || null;
  const first = inWindow[0] || null;

  const payload = { v: 1, from, to, units: state.settings.units };

  if (prefs.macros) {
    payload.macros = {
      days: days.size,
      totalKcal: Math.round(sum.kcal),
      kcal: Math.round(sum.kcal / dayCount),
      protein: round1(sum.protein / dayCount),
      carbs: round1(sum.carbs / dayCount),
      fat: round1(sum.fat / dayCount),
    };
  }

  if (prefs.meals) {
    payload.meals = max(60, meals
      .slice()
      .sort((a, b) => (a.date === b.date ? (a.ts || 0) - (b.ts || 0) : a.date.localeCompare(b.date)))
      .map((m) => ({ d: m.date, n: mealName(m), k: Math.round(m.kcal || 0), g: Math.round(m.grams || 0) })));
  }

  if (prefs.workouts) {
    payload.workouts = {
      count: sessions.length,
      minutes,
      volume: Math.round(volume),
      list: max(20, sessions
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((s) => ({ d: s.date, n: String(s.name || 'Workout').slice(0, 40), sets: sessionSets(s), m: Math.max(0, Math.round(((s.endedAt || s.startedAt) - s.startedAt) / 60000)) }))),
    };
  }

  if (prefs.body && latest) {
    payload.body = {
      weightKg: round1(latest.weightKg),
      deltaKg: first && latest !== first ? round1(latest.weightKg - first.weightKg) : null,
      bodyFat: latest.bodyFat ? round1(latest.bodyFat) : null,
      waist: latest.waist ? round1(latest.waist) : null,
      date: latest.date,
    };
  }

  return payload;
}

const blank = () => {
  const p = sharePrefs();
  return !p.enabled || (!p.meals && !p.macros && !p.workouts && !p.body);
};

/** Publish (or withdraw) this device's week. Safe to call often. */
export async function publishWeek() {
  const uid = myId();
  if (!uid || auth.needsMfa) return { skipped: true };
  const c = await getClient();
  if (!c) return { skipped: true };

  shareState.busy = true;
  try {
    if (blank()) {
      const { error } = await c.from('shared_weeks').delete().eq('user_id', uid);
      if (error && !/does not exist|schema cache/i.test(error.message || '')) {
        shareState.lastError = error.message;
        return { error: error.message };
      }
      shareState.lastError = '';
      return { cleared: true };
    }

    const payload = buildWeek();
    const { error } = await c.from('shared_weeks').upsert({
      user_id: uid,
      from_date: payload.from,
      to_date: payload.to,
      payload,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (error) {
      shareState.lastError = /does not exist|schema cache/i.test(error.message || '')
        ? 'The shared_weeks table is missing. Run tools/supabase-setup.sql in Supabase → SQL editor.'
        : error.message;
      return { error: shareState.lastError };
    }
    shareState.lastError = '';
    shareState.lastPublished = Date.now();
    return { ok: true, payload };
  } catch (err) {
    shareState.lastError = String((err && err.message) || err);
    return { error: shareState.lastError };
  } finally {
    shareState.busy = false;
  }
}

let timer = 0;
/** Debounced publish for callers that fire on every save. */
export function publishSoon(delay = 2500) {
  clearTimeout(timer);
  timer = setTimeout(() => { publishWeek().catch(() => {}); }, delay);
}

/** A friend's published week. RLS returns nothing unless you are close friends. */
export async function fetchWeek(userId) {
  const c = await getClient();
  if (!c || !auth.session) return { error: 'Sign in first.' };
  const { data, error } = await c
    .from('shared_weeks')
    .select('payload,from_date,to_date,updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    return {
      error: /does not exist|schema cache/i.test(error.message || '')
        ? 'Sharing is not set up on this project yet (missing shared_weeks table).'
        : error.message,
    };
  }
  return { week: data || null };
}
