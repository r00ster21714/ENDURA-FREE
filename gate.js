/* The account gate.
 *
 * ENDURA stores workouts, meals and measurements on the phone, but the app
 * itself opens on an account: a username, friends, and optional 2FA. Two rules
 * shape everything here:
 *
 *   1. first launch is a greeting, not a login form — "create an account" is
 *      the primary action, and the screen only becomes a login form once this
 *      phone has been through it
 *   2. signing out always lands here, on the sign-in screen — there is no state
 *      in which the app is open but nobody is signed in
 *
 * The gate never blocks access to local data on its own: if the server is
 * unreachable, "Trouble signing in?" offers a way to use the app offline, and
 * You keeps asking to sign in.
 */
import { esc, icon, state } from './core.js';
import {
  auth, signIn, signUp, signOut, startChallenge, verifyChallenge, refreshFactors,
} from './auth.js';

const SEEN = 'endura.acct.seen';
const OFFLINE = 'endura.acct.offline';

const flag = (k) => {
  try { return localStorage.getItem(k) === '1'; } catch { return false; }
};
const setFlag = (k, on) => {
  try {
    if (on) localStorage.setItem(k, '1');
    else localStorage.removeItem(k);
  } catch { /* private mode: fall back to in-memory behaviour */ }
};

/** True while the app must stay closed behind the account screen. */
export function gateNeeded() {
  if (flag(OFFLINE)) return false;
  const cfg = state.settings.sync || {};
  // Before initAuth runs, auth.configured is still false. The baked defaults
  // mean a backend is configured from the first frame, so read settings too —
  // otherwise the app would flash open ahead of the gate.
  const configured = auth.configured || !!(cfg.url && cfg.key);
  if (!configured) return false;           // no backend → local-only app
  if (!auth.ready) return true;            // resolving the saved session
  return !(auth.session && !auth.needsMfa);
}

export function sawAccountScreen() {
  setFlag(SEEN, true);
}

/* The router calls this whenever a live session is in place. It keeps the
 * gate's next appearance on the sign-in screen instead of the first-run
 * greeting, and marks the phone as set up. */
export function noteSignedIn() {
  setFlag(SEEN, true);
  mode = null;
  lastHadSession = true;
}

/* ------------------------------------------------------------------ state */

let mode = null;              // 'welcome' | 'signup' | 'signin'
let lastHadSession = false;
let mfaFactorId = null;
let mfaChallengeId = null;
let mfaStarted = false;

/* A failed attempt is state, not a DOM detail: every auth change notifies the
 * router, which rebuilds this screen. Without these two, a wrong password
 * would silently clear the message and the email typed in. */
let gateErr = '';
const draft = { 'g-name': '', 'g-email': '', 'g-pass': '', 'g-code': '' };

function setErr(msg) {
  gateErr = String(msg || '');
  const el = document.querySelector('#g-err');
  if (el) {
    el.style.color = gateErr ? 'var(--danger)' : '';
    el.textContent = gateErr;
  }
}

function currentMode() {
  if (mode === null) mode = flag(SEEN) ? 'signin' : 'welcome';
  return mode;
}

/* ------------------------------------------------------------------ pieces */

const wordmark = () => `
  <div class="gate__brand">
    <div class="gate__logo">EN<span>DURA</span></div>
    <div class="gate__tag">Train. Eat. Track. On this phone.</div>
  </div>`;

function shell(inner, { back = null } = {}) {
  return `
    <div class="gate__inner">
      ${back ? `<button class="btn btn--bare gate__back" data-back>${icon('back')}Back</button>` : ''}
      ${inner}
    </div>`;
}

const errorLine = (id) => `<div class="hint gate__err" id="${id}">${esc(gateErr)}</div>`;

/* ------------------------------------------------------------------ screens */

function splash() {
  return `<div class="gate__inner"><div class="gate__splash">
    <div class="gate__logo">EN<span>DURA</span></div>
    <div class="gate__tag">Restoring your account…</div>
  </div></div>`;
}

function welcome() {
  return shell(`
    ${wordmark()}
    <div class="gate__pitch">
      <div class="gate__point">${icon('check')}<span>Workouts, food and body data stay on this phone</span></div>
      <div class="gate__point">${icon('check')}<span>An account adds your username, friends and 2FA — nothing else</span></div>
      <div class="gate__point">${icon('check')}<span>Sign out and it comes back to this screen</span></div>
    </div>
    <button class="btn btn--primary btn--block gate__cta" data-go="signup">Create an account</button>
    <button class="btn btn--block gate__cta gate__cta--ghost" data-go="signin">I already have one</button>
  `);
}

function signupScreen() {
  return shell(`
    ${wordmark()}
    <div class="gate__title">Create your account</div>
    <label class="field"><span class="field__l">Username</span>
      <input class="input" id="g-name" placeholder="yourname" autocapitalize="off" autocomplete="username" spellcheck="false"></label>
    <div class="hint">3–20 characters: a–z, 0–9 or _. This is how friends find you.</div>
    <label class="field" style="margin-top:10px"><span class="field__l">Email</span>
      <input class="input" id="g-email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false"></label>
    <label class="field" style="margin-top:8px"><span class="field__l">Password</span>
      <input class="input" id="g-pass" type="password" autocomplete="new-password"></label>
    <div class="hint">At least 6 characters. Nobody can reset it for you, so pick one you'll remember.</div>
    ${errorLine('g-err')}
    <button class="btn btn--primary btn--block gate__cta" data-submit="signup">Create account</button>
    <button class="btn btn--bare gate__swap" data-go="signin">I already have an account</button>
  `, { back: true });
}

function signinScreen() {
  return shell(`
    ${wordmark()}
    <div class="gate__title">Welcome back</div>
    <label class="field"><span class="field__l">Email</span>
      <input class="input" id="g-email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false"></label>
    <label class="field" style="margin-top:8px"><span class="field__l">Password</span>
      <input class="input" id="g-pass" type="password" autocomplete="current-password"></label>
    ${errorLine('g-err')}
    <button class="btn btn--primary btn--block gate__cta" data-submit="signin">Sign in</button>
    <button class="btn btn--bare gate__swap" data-go="signup">Create a different account</button>
    <button class="btn btn--bare gate__swap gate__trouble" data-trouble>Trouble signing in?</button>
  `);
}

function mfaScreen() {
  const factor = (auth.factors || []).find((f) => f.status === 'verified');
  const isPhone = factor && factor.factor_type === 'phone';
  const where = isPhone ? `a 6-digit code by text to ${esc(factor.phone || 'your phone')}` : 'the 6-digit code from your authenticator app';
  return shell(`
    ${wordmark()}
    <div class="gate__title">Two-factor</div>
    <div class="gate__sub">This account is protected. Enter ${where}.</div>
    <label class="field" style="margin-top:14px"><span class="field__l">Code</span>
      <input class="input input--num gate__code" id="g-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"></label>
    ${errorLine('g-err')}
    <button class="btn btn--primary btn--block gate__cta" data-submit="mfa">Verify</button>
    ${isPhone ? '<button class="btn btn--bare gate__swap" data-resend>Send a new code</button>' : ''}
    <button class="btn btn--bare gate__swap gate__trouble" data-leave>Use a different account</button>
  `);
}

/* ------------------------------------------------------------------ wiring */

function mount(node, ctx) {
  // Restore anything typed before the last auth notification rebuilt this
  // screen, then keep the draft current.
  Object.keys(draft).forEach((id) => {
    const el = node.querySelector('#' + id);
    if (el) el.value = draft[id];
  });
  Object.keys(draft).forEach((id) => {
    const el = node.querySelector('#' + id);
    if (el) el.addEventListener('input', () => { draft[id] = el.value; });
  });

  const go = (m) => { mode = m; gateErr = ''; ctx.rerender(); };

  node.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  const back = node.querySelector('[data-back]');
  if (back) back.addEventListener('click', () => go('welcome'));

  const fail = (msg) => setErr(msg);

  node.querySelectorAll('[data-submit]').forEach((btn) => btn.addEventListener('click', async () => {
    const kind = btn.dataset.submit;
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = kind === 'signup' ? 'Creating…' : kind === 'signin' ? 'Signing in…' : 'Checking…';
    setErr('');

    try {
      if (kind === 'signup') {
        const res = await signUp({
          username: node.querySelector('#g-name').value,
          email: node.querySelector('#g-email').value.trim(),
          password: node.querySelector('#g-pass').value,
        });
        if (res.error) { fail(res.error); return; }
        if (res.needsConfirm) { fail('Account made, but this project still asks for email confirmation. Turn Confirm email off in Supabase → Authentication → Sign In / Up, then sign in.'); return; }
        Object.keys(draft).forEach((k) => { draft[k] = ''; });
        sawAccountScreen();
        setFlag(OFFLINE, false);
        mode = 'welcome';
        ctx.rerender();
        return;
      }

      if (kind === 'signin') {
        const res = await signIn({
          email: node.querySelector('#g-email').value.trim(),
          password: node.querySelector('#g-pass').value,
        });
        if (res.error) { fail(res.error); return; }
        Object.keys(draft).forEach((k) => { draft[k] = ''; });
        sawAccountScreen();
        setFlag(OFFLINE, false);
        mode = 'welcome';
        ctx.rerender();
        return;
      }

      // mfa
      const code = node.querySelector('#g-code').value;
      if (!mfaFactorId) { fail('No 2FA factor found on this account. Sign in again.'); return; }
      if (!mfaChallengeId) {
        const ch = await startChallenge(mfaFactorId);
        if (ch.error) { fail(ch.error); return; }
        mfaChallengeId = ch.challengeId;
      }
      const res = await verifyChallenge(mfaFactorId, mfaChallengeId, code);
      if (res.error) { fail(res.error); return; }
      Object.keys(draft).forEach((k) => { draft[k] = ''; });
      sawAccountScreen();
      setFlag(OFFLINE, false);
      mode = 'welcome';
      ctx.rerender();
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }));

  const resend = node.querySelector('[data-resend]');
  if (resend) resend.addEventListener('click', async () => {
    resend.disabled = true;
    const ch = await startChallenge(mfaFactorId);
    resend.disabled = false;
    if (ch.error) { fail(ch.error); return; }
    mfaChallengeId = ch.challengeId;
    const out = node.querySelector('#g-err');
    if (out) { out.style.color = 'var(--accent)'; out.textContent = 'New code sent.'; }
  });

  const leave = node.querySelector('[data-leave]');
  if (leave) leave.addEventListener('click', async () => {
    mfaFactorId = null;
    mfaChallengeId = null;
    mfaStarted = false;
    await signOut();
    mode = 'signin';
    ctx.rerender();
  });

  const trouble = node.querySelector('[data-trouble]');
  if (trouble) trouble.addEventListener('click', () => {
    const out = node.querySelector('#g-err');
    if (!out) return;
    out.style.color = 'var(--muted)';
    out.innerHTML = `If the server is unreachable, you can still use ENDURA on this phone — local data never needed an account.
      <button class="btn btn--bare tiny" style="text-decoration:underline" data-offline>Use ENDURA offline</button>`;
    out.querySelector('[data-offline]').addEventListener('click', () => {
      setFlag(OFFLINE, true);
      ctx.rerender();
    });
  });
}

/* ------------------------------------------------------------------ render */

export function renderGate(ctx) {
  const node = document.createElement('div');

  if (!auth.ready) {
    node.innerHTML = splash();
    return node;
  }

  // Leaving a session must always come back to sign-in, never to the greeting.
  if (auth.session) lastHadSession = true;
  else if (lastHadSession) {
    lastHadSession = false;
    mode = 'signin';
    mfaFactorId = null;
    mfaChallengeId = null;
    mfaStarted = false;
  }

  if (auth.needsMfa) {
    const factor = (auth.factors || []).find((f) => f.status === 'verified');
    if (!factor) {
      // Factors are fetched async; one refresh then re-render.
      if (!mfaStarted) { mfaStarted = true; refreshFactors(); }
      node.innerHTML = `<div class="gate__inner"><div class="gate__splash">
        <div class="gate__logo">EN<span>DURA</span></div>
        <div class="gate__tag">Checking 2FA…</div></div></div>`;
      return node;
    }
    mfaFactorId = factor.id;
    if (!mfaChallengeId && factor.factor_type === 'phone') {
      startChallenge(factor.id).then((ch) => { if (ch.ok) mfaChallengeId = ch.challengeId; }).catch(() => {});
    }
    node.innerHTML = mfaScreen();
    mount(node, ctx);
    return node;
  }

  mfaStarted = false;
  mfaFactorId = null;
  mfaChallengeId = null;

  const m = currentMode();
  node.innerHTML = m === 'signup' ? signupScreen() : m === 'signin' ? signinScreen() : welcome();
  mount(node, ctx);
  return node;
}
