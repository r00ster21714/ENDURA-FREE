import { boot, subscribe, toast } from './core.js';
import { render as renderToday } from './today.js';
import { render as renderWorkout } from './workout.js';
import { render as renderNutrition } from './nutrition.js';
import { render as renderBody } from './body.js';
import { render as renderSettings } from './settings.js';
import { render as renderFriends } from './friends.js';
import { initAuth, onAuth, auth } from './auth.js';
import { gateNeeded, noteSignedIn, renderGate } from './gate.js';

const viewEl = document.getElementById('view');
const gateEl = document.getElementById('gate');
const appEl = document.getElementById('app');
const routes = {
  today: renderToday,
  workout: renderWorkout,
  nutrition: renderNutrition,
  body: renderBody,
  friends: renderFriends,
  settings: renderSettings,
};

let pending = false;

const ctx = {
  navigate(hash) {
    if (location.hash === hash) schedule();
    else location.hash = hash;
  },
  rerender: () => schedule(),
};

function schedule() {
  if (pending) return;
  pending = true;
  setTimeout(() => {
    pending = false;
    render();
  }, 0);
}

function currentRoute() {
  const raw = location.hash.replace(/^#\/?/, '').split('?')[0];
  return routes[raw] ? raw : 'today';
}

function render() {
  // The account gate owns the whole screen until there is a signed-in session
  // (or the phone has been explicitly switched to offline use). Hiding .app
  // also hides the tab bar, so there is no way around it mid-session.
  if (gateNeeded()) {
    gateEl.hidden = false;
    appEl.hidden = true;
    document.title = 'ENDURA';
    gateEl.replaceChildren(renderGate(ctx));
    return;
  }

  gateEl.hidden = true;
  gateEl.replaceChildren();
  appEl.hidden = false;
  if (auth.session) noteSignedIn();

  const name = currentRoute();
  try {
    const node = routes[name](ctx);
    viewEl.replaceChildren(node);
    viewEl.scrollTop = 0;
    document.querySelectorAll('#tabbar a').forEach((a) => {
      if (a.dataset.tab === name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.title = name === 'today' ? 'ENDURA' : `ENDURA · ${name[0].toUpperCase()}${name.slice(1)}`;
  } catch (err) {
    console.error(err);
    viewEl.innerHTML = `<div class="card" style="margin-top:40px;border-color:rgba(255,122,122,.4)">
      <div style="font-weight:700;color:var(--danger);margin-bottom:6px">Something broke rendering this screen</div>
      <div class="tiny" style="font-family:var(--mono);white-space:pre-wrap;color:var(--muted)">${String(err && err.message || err)}</div>
      <button class="btn btn--sm" style="margin-top:12px" onclick="location.reload()">Reload</button>
    </div>`;
  }
}

subscribe(() => schedule());
onAuth(() => schedule());
window.addEventListener('hashchange', schedule);

(async function start() {
  try {
    await boot();
  } catch (err) {
    console.error('boot failed', err);
    toast('Storage unavailable — running read-only', 'err');
  }
  if (!location.hash) location.hash = '#/today';
  // Restores a saved session (auto sign-in). Started before the first paint so
  // the gate can show its splash instead of the app flashing open — the router
  // re-renders as soon as the session resolves.
  initAuth();
  render();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const register = () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW registration failed', e));
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }
})();
