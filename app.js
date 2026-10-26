import { boot, subscribe, toast } from './core.js';
import { render as renderToday } from './today.js';
import { render as renderWorkout } from './workout.js';
import { render as renderNutrition } from './nutrition.js';
import { render as renderBody } from './body.js';
import { render as renderSettings } from './settings.js';

const viewEl = document.getElementById('view');
const routes = {
  today: renderToday,
  workout: renderWorkout,
  nutrition: renderNutrition,
  body: renderBody,
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
window.addEventListener('hashchange', schedule);

(async function start() {
  try {
    await boot();
  } catch (err) {
    console.error('boot failed', err);
    toast('Storage unavailable — running read-only', 'err');
  }
  if (!location.hash) location.hash = '#/today';
  render();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const register = () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW registration failed', e));
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }
})();
