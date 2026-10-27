/* ENDURA accounts — optional Supabase backend.
 *
 * What lives where:
 *   - workouts, food, measurements, scanner corrections: IndexedDB, this device
 *   - account: email + password, a public username, friends, 2FA factor
 *
 * The SDK is imported lazily so the app still boots with no connection and no
 * project configured. Nothing here runs until the user sets accounts up.
 */
import { state, saveSettings } from './core.js';

// 2.118 ships support for the current `sb_publishable_…` keys as well as the
// legacy anon JWT, so either key the dashboard offers works.
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

let client = null;
let sdkPromise = null;
const subs = new Set();

export const auth = {
  ready: false,
  configured: false,
  session: null,
  profile: null,
  factors: [],
  needsMfa: false,
  error: '',
  busy: false,
};

export function onAuth(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

function notify() {
  for (const fn of [...subs]) {
    try { fn(); } catch (err) { console.error(err); }
  }
}

const syncCfg = () => state.settings.sync || {};
export const authConfigured = () => !!(syncCfg().url && syncCfg().key);

const errText = (e) => (e && (e.message || e.error_description || e.msg)) || String(e || 'Unknown error');

/* GoTrue's two most common setup failures are opaque. Translate them once here
 * so every screen gets the actionable version instead of the raw code. */
function setupHint(msg) {
  const m = String(msg || '');
  if (/email not confirmed/i.test(m)) {
    return 'This account still needs email confirmation. In Supabase: Authentication → Sign In / Up → turn Confirm email off, then try again. (The free email service only delivers to the project owner, so leaving it on blocks everyone else.)';
  }
  if (/invalid api key|no api key|jwt/i.test(m) && /key/i.test(m)) {
    return 'That key was rejected. Copy the publishable key again from Project Settings → API Keys, not the secret key.';
  }
  if (/failed to fetch|networkerror|load failed/i.test(m)) {
    return 'Could not reach the project. Check the URL is https://<project-ref>.supabase.co and that this device is online.';
  }
  return m;
}

async function loadSdk() {
  if (!sdkPromise) sdkPromise = import(SDK_URL);
  return sdkPromise;
}

export async function getClient() {
  if (!authConfigured()) return null;
  if (client) return client;
  const { createClient } = await loadSdk();
  client = createClient(syncCfg().url.trim().replace(/\/+$/, ''), syncCfg().key.trim(), {
    auth: {
      persistSession: true,      // auto sign-in across app restarts
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'endura.auth',
    },
  });
  client.auth.onAuthStateChange((_event, session) => {
    auth.session = session || null;
    if (!session) {
      auth.profile = null;
      auth.needsMfa = false;
    }
    notify();
  });
  return client;
}

/** Save the project URL + publishable (or legacy anon) key, then connect. */
export async function configureSync({ url, key }) {
  await saveSettings({ sync: { url: String(url || '').trim(), key: String(key || '').trim() } });
  client = null;
  auth.error = '';
  await initAuth();
  return auth.configured;
}

/**
 * Three independent facts the setup sheet needs to report honestly:
 *   reachable — the SDK got a response from this project at all
 *   sql       — `username_taken()` exists, i.e. supabase-setup.sql was run
 *   key       — the key was accepted (a bad key answers 401, not 404)
 */
export async function checkBackend() {
  const c = await getClient();
  if (!c) return { reachable: false, sql: false, error: 'Accounts are not set up yet.' };
  try {
    const { error } = await c.rpc('username_taken', { u: '__endura_probe__' });
    if (!error) return { reachable: true, sql: true, error: '' };
    const msg = errText(error);
    if (/404|could not find the function|does not exist/i.test(msg)) {
      return { reachable: true, sql: false, error: 'Connected, but supabase-setup.sql has not been run in this project.' };
    }
    return { reachable: false, sql: false, error: setupHint(msg) };
  } catch (err) {
    return { reachable: false, sql: false, error: setupHint(errText(err)) };
  }
}

/** Restore the saved session (auto sign-in) and load the profile. */
export async function initAuth() {
  auth.configured = authConfigured();
  if (!auth.configured) {
    auth.ready = true;
    notify();
    return auth;
  }
  try {
    const c = await getClient();
    const { data, error } = await c.auth.getSession();
    if (error) throw error;
    auth.session = data.session || null;
    if (auth.session) {
      const { data: aal } = await c.auth.mfa.getAuthenticatorAssuranceLevel();
      auth.needsMfa = !!(aal && aal.nextLevel === 'aal2' && aal.currentLevel === 'aal1');
      if (!auth.needsMfa) {
        await loadProfile();
        await refreshFactors();
      }
    }
  } catch (err) {
    auth.error = setupHint(errText(err));
  }
  auth.ready = true;
  notify();
  return auth;
}

export async function loadProfile() {
  const c = await getClient();
  if (!c || !auth.session) { auth.profile = null; return null; }
  const uid = auth.session.user.id;
  const { data, error } = await c
    .from('profiles')
    .select('id,username,display_name,created_at')
    .eq('id', uid)
    .maybeSingle();

  if (error) {
    auth.error = 'Database not ready — run supabase-setup.sql. ' + errText(error);
    auth.profile = null;
    notify();
    return null;
  }
  if (data) {
    auth.profile = data;
    auth.error = '';
    notify();
    return data;
  }

  // Trigger missing or profile row lost: create it from the signup metadata.
  const meta = auth.session.user.user_metadata || {};
  const fallback = (meta.username || 'user_' + uid.slice(0, 8)).toLowerCase();
  const ins = await c
    .from('profiles')
    .insert({ id: uid, username: fallback })
    .select('id,username,display_name,created_at')
    .maybeSingle();
  if (ins.error) {
    auth.error = errText(ins.error);
    auth.profile = null;
  } else {
    auth.profile = ins.data;
    auth.error = '';
  }
  notify();
  return auth.profile;
}

export async function signUp({ email, password, username }) {
  const c = await getClient();
  if (!c) return { error: 'Accounts are not set up yet.' };
  const name = String(username || '').trim().toLowerCase();
  if (!USERNAME_RE.test(name)) return { error: 'Username: 3–20 characters, a–z, 0–9 or _.' };
  if (!email || !password) return { error: 'Email and password are required.' };

  auth.busy = true;
  auth.error = '';
  notify();
  try {
    const { data: taken, error: takenErr } = await c.rpc('username_taken', { u: name });
    if (takenErr) return { error: 'Setup SQL missing from the project — ' + errText(takenErr) };
    if (taken) return { error: 'That username is already taken.' };

    const { data, error } = await c.auth.signUp({
      email,
      password,
      options: { data: { username: name } },
    });
    if (error) return { error: setupHint(errText(error)) };
    if (!data.session) return { needsConfirm: true, email };
    auth.session = data.session;
    await loadProfile();
    return { ok: true };
  } catch (err) {
    return { error: errText(err) };
  } finally {
    auth.busy = false;
    notify();
  }
}

export async function signIn({ email, password }) {
  const c = await getClient();
  if (!c) return { error: 'Accounts are not set up yet.' };
  auth.busy = true;
  auth.error = '';
  notify();
  try {
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error) return { error: setupHint(errText(error)) };
    auth.session = data.session;
    const { data: aal } = await c.auth.mfa.getAuthenticatorAssuranceLevel();
    auth.needsMfa = !!(aal && aal.nextLevel === 'aal2' && aal.currentLevel === 'aal1');
    if (!auth.needsMfa) await loadProfile();
    return { ok: true, needsMfa: auth.needsMfa };
  } catch (err) {
    return { error: errText(err) };
  } finally {
    auth.busy = false;
    notify();
  }
}

export async function signOut() {
  const c = await getClient();
  auth.busy = true;
  notify();
  try {
    if (c) await c.auth.signOut();
  } catch {
    // A failed network sign-out must still drop the local session.
  }
  auth.session = null;
  auth.profile = null;
  auth.needsMfa = false;
  auth.error = '';
  // Signing out must return to the account screen, not to a skipped state.
  try { localStorage.removeItem('endura.acct.offline'); } catch { /* storage blocked */ }
  auth.busy = false;
  notify();
}

export async function saveUsername(name) {
  const c = await getClient();
  if (!c || !auth.session) return { error: 'Sign in first.' };
  const username = String(name || '').trim().toLowerCase();
  if (!USERNAME_RE.test(username)) return { error: 'Username: 3–20 characters, a–z, 0–9 or _.' };
  const { error } = await c.from('profiles').update({ username }).eq('id', auth.session.user.id);
  if (error) return { error: errText(error) };
  await loadProfile();
  return { ok: true };
}

/* ---------------- 2FA (TOTP) ---------------- */

export async function mfaFactors() {
  const c = await getClient();
  if (!c) return [];
  const { data, error } = await c.auth.mfa.listFactors();
  if (error) throw error;
  // TOTP and phone factors both count as second factors; a phone-enrolled
  // account must not look unprotected just because its factor is not TOTP.
  return [...((data && data.totp) || []), ...((data && data.phone) || [])];
}

export async function refreshFactors() {
  auth.factors = await mfaFactors().catch(() => []);
  notify();
  return auth.factors;
}

export async function enrollTotp() {
  const c = await getClient();
  if (!c) throw new Error('Accounts are not set up yet.');
  const existing = await mfaFactors();
  if (existing.some((f) => f.status === 'verified')) throw new Error('2FA is already on.');
  const { data, error } = await c.auth.mfa.enroll({ factorType: 'totp' });
  if (error) throw error;
  return { id: data.id, secret: data.totp.secret, uri: data.totp.uri };
}

/* Phone-number 2FA sends the code by text message. Supabase can only do that
 * when the project has an SMS provider (Twilio) connected, so the caller has to
 * be prepared for this to fail and say why. */
export async function enrollPhone(phone) {
  const c = await getClient();
  if (!c) throw new Error('Accounts are not set up yet.');
  const existing = await mfaFactors();
  if (existing.some((f) => f.status === 'verified')) throw new Error('2FA is already on.');
  const cleaned = String(phone || '').replace(/[^\d+]/g, '');
  if (!/^\+\d{8,15}$/.test(cleaned)) throw new Error('Use the full international number, e.g. +1 555 010 9999.');
  const { data, error } = await c.auth.mfa.enroll({ factorType: 'phone', phone: cleaned });
  if (error) throw error;
  return { id: data.id, phone: cleaned };
}

/** Ask for a fresh challenge. For a phone factor this is what sends the SMS. */
export async function startChallenge(factorId) {
  const c = await getClient();
  if (!c) return { error: 'Accounts are not set up yet.' };
  const { data, error } = await c.auth.mfa.challenge({ factorId });
  if (error) return { error: errText(error) };
  return { ok: true, challengeId: data.id };
}

export async function verifyChallenge(factorId, challengeId, code) {
  const c = await getClient();
  if (!c) return { error: 'Accounts are not set up yet.' };
  const { error } = await c.auth.mfa.verify({ factorId, challengeId, code: String(code || '').trim() });
  if (error) return { error: errText(error) };
  auth.needsMfa = false;
  return { ok: true };
}

/** Verify any factor's challenge — TOTP and phone OTP take the same path. */
export async function confirmFactor(factorId, code) {
  const ch = await startChallenge(factorId);
  if (ch.error) return ch;
  return verifyChallenge(factorId, ch.challengeId, code);
}

export const confirmTotp = confirmFactor;

/** Re-send a phone factor's SMS (a fresh challenge does the send). */
export const resendFactorCode = startChallenge;

export async function disableTotp(factorId) {
  const c = await getClient();
  if (!c) return { error: 'Accounts are not set up yet.' };
  const { error } = await c.auth.mfa.unenroll({ factorId });
  return error ? { error: errText(error) } : { ok: true };
}

export async function verifyMfa(code) {
  const c = await getClient();
  if (!c) return { error: 'Accounts are not set up yet.' };
  const factors = await mfaFactors().catch(() => []);
  const factor = factors.find((f) => f.status === 'verified');
  if (!factor) return { error: 'No 2FA factor on this account.' };
  const res = await confirmFactor(factor.id, code);
  if (res.error) return res;
  await loadProfile();
  return { ok: true };
}

/* ---------------- friends ---------------- */

const myUid = () => (auth.session ? auth.session.user.id : null);

export async function searchUsers(query) {
  const c = await getClient();
  if (!c || !auth.session) return { error: 'Sign in to search.' };
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 2) return { users: [] };

  const uid = myUid();
  const { data, error } = await c
    .from('profiles')
    .select('id,username,display_name')
    .ilike('username', q + '%')
    .neq('id', uid)
    .limit(10);
  if (error) return { error: errText(error) };

  const { data: rel } = await c
    .from('friendships')
    .select('requester,addressee,status')
    .or(`requester.eq.${uid},addressee.eq.${uid}`);

  const state_ = new Map();
  for (const r of rel || []) {
    const other = r.requester === uid ? r.addressee : r.requester;
    if (r.status === 'accepted') state_.set(other, 'friends');
    else if (r.requester === uid) state_.set(other, 'sent');
    else state_.set(other, 'incoming');
  }

  return { users: (data || []).map((u) => ({ ...u, relation: state_.get(u.id) || 'none' })) };
}

export async function friendsOverview() {
  const c = await getClient();
  if (!c || !auth.session) return { error: 'Sign in to use friends.' };
  const uid = myUid();
  const { data, error } = await c
    .from('friendships')
    .select('requester,addressee,status,created_at')
    .or(`requester.eq.${uid},addressee.eq.${uid}`);
  if (error) return { error: errText(error) };

  const rows = data || [];
  const otherIds = [...new Set(rows.map((r) => (r.requester === uid ? r.addressee : r.requester)))];
  let profiles = [];
  if (otherIds.length) {
    const { data: ps, error: pErr } = await c
      .from('profiles')
      .select('id,username,display_name')
      .in('id', otherIds);
    if (pErr) return { error: errText(pErr) };
    profiles = ps || [];
  }
  const byId = new Map(profiles.map((p) => [p.id, p]));

  const friends = [];
  const incoming = [];
  const outgoing = [];
  for (const r of rows) {
    const other = r.requester === uid ? r.addressee : r.requester;
    const p = byId.get(other);
    if (!p) continue;
    if (r.status === 'accepted') friends.push({ ...p, since: r.created_at });
    else if (r.requester === uid) outgoing.push({ ...p, since: r.created_at });
    else incoming.push({ ...p, since: r.created_at });
  }
  const byName = (a, b) => a.username.localeCompare(b.username);
  friends.sort(byName);
  incoming.sort(byName);
  outgoing.sort(byName);
  return { friends, incoming, outgoing };
}

export async function sendRequest(id) {
  const c = await getClient();
  if (!c || !auth.session) return { error: 'Sign in first.' };
  const { error } = await c.from('friendships').insert({ requester: myUid(), addressee: id, status: 'pending' });
  if (error) {
    if (error.code === '23505') return { error: 'You already have a request with them.' };
    return { error: errText(error) };
  }
  return { ok: true };
}

export async function acceptRequest(id) {
  const c = await getClient();
  if (!c || !auth.session) return { error: 'Sign in first.' };
  const { error } = await c
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('requester', id)
    .eq('addressee', myUid());
  return error ? { error: errText(error) } : { ok: true };
}

export async function dropFriendship(id) {
  const c = await getClient();
  if (!c || !auth.session) return { error: 'Sign in first.' };
  const uid = myUid();
  const a = await c.from('friendships').delete().eq('requester', uid).eq('addressee', id);
  const b = await c.from('friendships').delete().eq('requester', id).eq('addressee', uid);
  const err = a.error || b.error;
  return err ? { error: errText(err) } : { ok: true };
}
