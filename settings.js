import {
  state, saveSettings, today, esc, icon, num, openSheet, closeSheet, toast, confirmSheet,
  round1, kgToDisplay, displayToKg, weightLabel, cmToDisplay, displayToCm, lengthLabel,
  dbPut, dbClear, forgetPhotoLearning,
} from './core.js';
import { pageHead, acts } from './common.js';
import { CLOUD_MODELS } from './vision.js';
import {
  auth, configureSync, signIn, signUp, signOut, saveUsername,
  enrollTotp, confirmTotp, disableTotp, verifyMfa, refreshFactors, USERNAME_RE,
} from './auth.js';

const joinedLabel = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

function accountCard() {
  if (!auth.configured) {
    return `
    <section class="card">
      <div class="card__head"><h2>Account</h2><span class="badge badge--muted">not set up</span></div>
      <div class="hint">Accounts add a profile, usernames for adding friends, and 2FA. Workouts and food stay on this phone either way.</div>
      <button class="btn btn--sm btn--primary" style="margin-top:10px" data-act="sync-setup">Set up accounts</button>
    </section>`;
  }

  if (auth.needsMfa) {
    return `
    <section class="card" style="border-color:rgba(255,200,90,.35)">
      <div class="card__head"><h2>Account</h2><span class="badge">2FA required</span></div>
      <div class="hint">This account has two-factor on. Enter the 6-digit code from your authenticator app to finish signing in.</div>
      <button class="btn btn--sm btn--primary" style="margin-top:10px" data-act="mfa-verify">Enter 2FA code</button>
    </section>`;
  }

  if (!auth.session) {
    return `
    <section class="card">
      <div class="card__head"><h2>Account</h2><span class="badge badge--muted">signed out</span></div>
      <div class="hint">Sign in or create an account. Your local data is never uploaded — only your username and friends live on the server.</div>
      ${auth.error ? `<div class="hint" style="color:var(--danger);margin-top:8px">${auth.error}</div>` : ''}
      <div class="row" style="gap:8px;margin-top:10px">
        <button class="btn btn--sm btn--primary" data-act="sign-in">Sign in</button>
        <button class="btn btn--sm" data-act="sign-up">Create account</button>
      </div>
    </section>`;
  }

  const p = auth.profile || {};
  const username = p.username || '…';
  const email = (auth.session.user && auth.session.user.email) || '';
  const tfOn = (auth.factors || []).some((f) => f.status === 'verified');
  const initial = (username[0] || '?').toUpperCase();

  return `
    <section class="card">
      <div class="row" style="gap:12px;align-items:center">
        <div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(140deg,var(--accent),#2f6f4f);display:grid;place-items:center;font-weight:800;font-size:18px;color:#08120c">${esc(initial)}</div>
        <div class="grow" style="min-width:0">
          <div style="font-weight:700;font-size:16px;overflow:hidden;text-overflow:ellipsis">@${esc(username)}</div>
          <div class="tiny muted" style="overflow:hidden;text-overflow:ellipsis">${esc(email)}</div>
        </div>
        <span class="badge badge--lime">signed in</span>
      </div>
      <div class="stats" style="margin-top:12px">
        <div class="stat"><div class="stat__v" style="font-size:13px">${esc(joinedLabel(p.created_at))}</div><div class="stat__l">joined</div></div>
        <div class="stat"><div class="stat__v" style="font-size:13px">${tfOn ? 'On' : 'Off'}</div><div class="stat__l">2FA</div></div>
        <div class="stat"><div class="stat__v" style="font-size:13px">@${esc(username)}</div><div class="stat__l">username</div></div>
      </div>
      <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn btn--sm" data-act="friends">Friends</button>
        <button class="btn btn--sm" data-act="edit-username">Change username</button>
        <button class="btn btn--sm" data-act="2fa">${tfOn ? 'Manage 2FA' : 'Turn on 2FA'}</button>
      </div>
      <button class="btn btn--sm btn--ghost btn--block" style="margin-top:8px;color:var(--danger)" data-act="sign-out">Sign out of account</button>
      <div class="hint" style="margin-top:8px">Signing out keeps every workout and meal on this phone.</div>
    </section>`;
}

export function render(ctx) {
  const s = state.settings;
  const units = s.units;
  const cloud = s.cloud;

  const root = document.createElement('div');
  root.innerHTML = `
    ${pageHead({ eyebrow: 'Settings', title: 'You' })}

    ${accountCard()}

    <section class="card" style="margin-top:12px">
      <div class="label" style="margin-bottom:8px">Units</div>
      <div class="seg" id="unit-seg">
        <button data-unit="metric" aria-pressed="${units === 'metric'}">Metric (kg / cm)</button>
        <button data-unit="imperial" aria-pressed="${units === 'imperial'}">Imperial (lb / in)</button>
      </div>
    </section>

    <section class="card" style="margin-top:12px">
      <div class="card__head">
        <h2>Daily targets</h2>
        <button class="btn btn--sm btn--ghost" data-act="targets">Edit</button>
      </div>
      <div class="stats">
        <div class="stat"><div class="stat__v">${Math.round(s.targets.kcal)}</div><div class="stat__l">kcal</div></div>
        <div class="stat"><div class="stat__v">${Math.round(s.targets.protein)}</div><div class="stat__l">protein</div></div>
        <div class="stat"><div class="stat__v">${Math.round(s.targets.carbs)}</div><div class="stat__l">carbs</div></div>
      </div>
      <div class="row" style="justify-content:space-between;margin-top:10px">
        <span class="tiny muted">Fat target</span>
        <span class="tiny mono">${Math.round(s.targets.fat)} g</span>
      </div>
      <button class="btn btn--sm btn--block" style="margin-top:10px" data-act="calc">${icon('spark')}Calculate from my stats</button>
    </section>

    <section class="card" style="margin-top:12px">
      <div class="card__head"><h2>Training</h2></div>
      <div class="list" style="border:0">
        <div class="listrow" style="padding-left:0;padding-right:0">
          <div class="listrow__main"><div class="listrow__t">Default rest</div><div class="listrow__s">Between sets</div></div>
          <div class="seg" style="width:auto;flex:none">
            ${[60, 90, 120, 180].map((v) => `<button data-rest="${v}" aria-pressed="${s.restDefault === v}">${v}s</button>`).join('')}
          </div>
        </div>
        <div class="listrow" style="padding-left:0;padding-right:0">
          <div class="listrow__main"><div class="listrow__t">Barbell weight</div><div class="listrow__s">Used for plate math</div></div>
          <div class="row" style="gap:6px">
            <input class="input input--num" id="bar-kg" inputmode="decimal" value="${round1(kgToDisplay(s.barKg, units))}" style="width:76px">
            <span class="tiny muted">${weightLabel(units)}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="card" style="margin-top:12px">
      <div class="card__head"><h2>Body</h2></div>
      <div class="grid2">
        <label class="field"><span class="field__l">Height (${lengthLabel(units)})</span>
          <input class="input input--num" id="height" inputmode="decimal" value="${s.heightCm ? round1(cmToDisplay(s.heightCm, units)) : ''}" placeholder="—"></label>
        <label class="field"><span class="field__l">Goal weight (${weightLabel(units)})</span>
          <input class="input input--num" id="goal" inputmode="decimal" value="${s.goalWeightKg ? round1(kgToDisplay(s.goalWeightKg, units)) : ''}" placeholder="—"></label>
      </div>
    </section>

    <section class="card" style="margin-top:12px">
      <div class="card__head">
        <h2>Food scanning</h2>
        <span class="badge ${cloud.provider !== 'none' ? 'badge--lime' : 'badge--muted'}">${cloud.provider === 'none' ? 'on-device' : cloud.provider}</span>
      </div>
      <div class="seg" id="prov-seg">
        <button data-prov="none" aria-pressed="${cloud.provider === 'none'}">On-device</button>
        <button data-prov="anthropic" aria-pressed="${cloud.provider === 'anthropic'}">Anthropic</button>
        <button data-prov="openai" aria-pressed="${cloud.provider === 'openai'}">OpenAI</button>
      </div>

      <div id="cloud-fields" class="${cloud.provider === 'none' ? 'hidden' : ''}" style="margin-top:12px">
        <label class="field"><span class="field__l">API key</span>
          <div class="row" style="gap:6px">
            <input class="input grow" id="cloud-key" type="password" placeholder="sk-…" autocomplete="off" spellcheck="false" value="${esc(cloud.key || '')}">
            <button class="btn btn--icon" data-act="show-key" aria-label="Show key">${icon('search')}</button>
          </div>
        </label>
        <label class="field" style="margin-top:10px"><span class="field__l">Model</span>
          <select class="input" id="cloud-model">
            ${(CLOUD_MODELS[cloud.provider] || []).map((m) => `<option value="${m}" ${cloud.model === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </label>
        <div class="row" style="gap:8px;margin-top:10px">
          <button class="btn btn--sm btn--primary" data-act="save-cloud">Save</button>
          <button class="btn btn--sm btn--ghost" data-act="clear-key">Remove key</button>
        </div>
        <div class="hint" style="margin-top:8px">The key is stored on this device and sent only to the provider you pick. Photos are uploaded to that API for estimation.${cloud.provider === 'openai' ? ' OpenAI does not always allow direct browser calls — if you see a CORS error, use Anthropic or on-device scanning.' : ''}</div>
      </div>

      <div class="hint" style="margin-top:10px">
        ${cloud.provider === 'none'
          ? 'Offline mode: a food-recognition model runs in the browser, then macros come from the built-in nutrition table — dishes, baked goods and pastries included. Best for single, recognisable items. Photos are never saved — not to the device, not anywhere.'
          : 'Cloud mode: the model estimates portion and macros from the photo. More accurate for mixed plates, needs a connection. The photo is sent to the provider for that request and is not stored by the app.'}
      </div>
    </section>

    <section class="card" style="margin-top:12px">
      <div class="card__head"><h2>Data</h2></div>
      <div class="list" style="border:0">
        <button class="listrow listrow--btn" data-act="export" style="padding-left:0;padding-right:0">
          <div class="listrow__main"><div class="listrow__t">Export backup</div><div class="listrow__s">JSON with sessions, food, measurements</div></div>
          ${icon('download')}
        </button>
        <button class="listrow listrow--btn" data-act="import" style="padding-left:0;padding-right:0">
          <div class="listrow__main"><div class="listrow__t">Import backup</div><div class="listrow__s">Replaces current data</div></div>
          ${icon('upload')}
        </button>
        <button class="listrow listrow--btn" data-act="forget-scan" style="padding-left:0;padding-right:0">
          <div class="listrow__main"><div class="listrow__t">Forget scanner corrections</div><div class="listrow__s">${Object.keys(state.learned || {}).length} label${Object.keys(state.learned || {}).length === 1 ? '' : 's'} learned · keeps your logs</div></div>
          ${icon('spark')}
        </button>
        <button class="listrow listrow--btn" data-act="clear" style="padding-left:0;padding-right:0">
          <div class="listrow__main"><div class="listrow__t" style="color:var(--danger)">Delete all data</div><div class="listrow__s">Cannot be undone</div></div>
          ${icon('trash')}
        </button>
      </div>
      <div class="hint" id="storage-line" style="margin-top:8px">Checking storage…</div>
    </section>

    <section class="card" style="margin-top:12px">
      <div class="spread">
        <div>
          <div style="font-weight:650;font-size:14px">ENDURA</div>
          <div class="tiny muted">v1.0 · offline-first PWA</div>
        </div>
        <a class="btn btn--sm btn--ghost" href="#/today">Done</a>
      </div>
    </section>
  `;

  /* units */
  root.querySelectorAll('[data-unit]').forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.unit === state.settings.units) return;
    await saveSettings({ units: b.dataset.unit });
    ctx.rerender();
  }));

  /* rest */
  root.querySelectorAll('[data-rest]').forEach((b) => b.addEventListener('click', async () => {
    await saveSettings({ restDefault: Number(b.dataset.rest) });
    ctx.rerender();
  }));

  root.querySelector('#bar-kg').addEventListener('change', async (e) => {
    await saveSettings({ barKg: displayToKg(num(e.target.value, 20), state.settings.units) });
    toast('Barbell weight saved', 'ok');
  });
  root.querySelector('#height').addEventListener('change', async (e) => {
    await saveSettings({ heightCm: displayToCm(num(e.target.value, 0), state.settings.units) });
    toast('Saved', 'ok');
  });
  root.querySelector('#goal').addEventListener('change', async (e) => {
    const v = num(e.target.value, 0);
    await saveSettings({ goalWeightKg: v > 0 ? displayToKg(v, state.settings.units) : null });
    toast('Goal saved', 'ok');
  });

  /* provider */
  root.querySelectorAll('[data-prov]').forEach((b) => b.addEventListener('click', async () => {
    const provider = b.dataset.prov;
    const model = provider === 'none' ? '' : (CLOUD_MODELS[provider]?.[0] || '');
    await saveSettings({ cloud: { provider, model } });
    ctx.rerender();
    if (provider !== 'none') setTimeout(() => root.querySelector('#cloud-key')?.focus({ preventScroll: true }), 60);
  }));

  acts(root, {
    targets: () => openTargets(ctx),
    calc: () => openCalculator(ctx),
    'sync-setup': () => openSyncSetup(ctx),
    'sign-in': () => openSignIn(ctx),
    'sign-up': () => openSignUp(ctx),
    'sign-out': async () => {
      const ok = await confirmSheet({
        title: 'Sign out?',
        message: 'Your workouts, food and measurements stay on this phone. You can sign back in any time.',
        ok: 'Sign out',
      });
      if (!ok) return;
      await signOut();
      toast('Signed out');
      ctx.rerender();
    },
    friends: () => ctx.navigate('#/friends'),
    'edit-username': () => openUsername(ctx),
    '2fa': () => openTwoFactor(ctx),
    'mfa-verify': () => openMfaVerify(ctx),
    'show-key': (btn) => {
      const input = root.querySelector('#cloud-key');
      input.type = input.type === 'password' ? 'text' : 'password';
    },
    'save-cloud': async () => {
      const key = root.querySelector('#cloud-key').value.trim();
      const model = root.querySelector('#cloud-model').value;
      if (!key) { toast('Paste an API key first', 'err'); return; }
      await saveSettings({ cloud: { provider: state.settings.cloud.provider, key, model } });
      toast('Scanning configured', 'ok');
    },
    'clear-key': async () => {
      await saveSettings({ cloud: { ...state.settings.cloud, key: '' } });
      root.querySelector('#cloud-key').value = '';
      toast('Key removed');
    },
    export: () => exportData(ctx),
    import: () => importData(ctx),
    'forget-scan': async () => {
      await forgetPhotoLearning();
      toast('Scanner corrections cleared');
      ctx.rerender();
    },
    clear: async () => {
      const ok = await confirmSheet({
        title: 'Delete everything?',
        message: 'Every workout, meal, and measurement on this device will be erased.',
        ok: 'Delete all', danger: true,
      });
      if (!ok) return;
      await Promise.all([dbClear('sessions'), dbClear('meals'), dbClear('metrics')]);
      state.sessions = []; state.meals = []; state.metrics = [];
      toast('All data deleted');
      ctx.rerender();
    },
  });

  /* storage estimate */
  const line = root.querySelector('#storage-line');
  if (navigator.storage?.estimate) {
    navigator.storage.estimate().then((est) => {
      const used = (est.usage || 0) / 1024 / 1024;
      line.textContent = `${used < 1 ? (used * 1024).toFixed(0) + ' KB' : used.toFixed(1) + ' MB'} used on this device · ${state.sessions.length} sessions, ${state.meals.length} meals, ${state.metrics.length} measurements`;
    }).catch(() => { line.textContent = 'Storage details unavailable'; });
  } else {
    line.textContent = `${state.sessions.length} sessions · ${state.meals.length} meals · ${state.metrics.length} measurements`;
  }

  return root;
}

/* ---------------- target editing ---------------- */

export function openTargets(ctx) {
  const t = state.settings.targets;
  openSheet(`
    <div class="sheet__head"><div class="sheet__title">Daily targets</div><button class="btn btn--bare" data-close>${icon('x')}</button></div>
    <div class="sheet__body">
      <label class="field"><span class="field__l">Calories</span><input class="input input--num" id="t-kcal" inputmode="numeric" value="${Math.round(t.kcal)}"></label>
      <div class="grid3">
        <label class="field"><span class="field__l">Protein g</span><input class="input input--num" id="t-p" inputmode="numeric" value="${Math.round(t.protein)}"></label>
        <label class="field"><span class="field__l">Carbs g</span><input class="input input--num" id="t-c" inputmode="numeric" value="${Math.round(t.carbs)}"></label>
        <label class="field"><span class="field__l">Fat g</span><input class="input input--num" id="t-f" inputmode="numeric" value="${Math.round(t.fat)}"></label>
      </div>
      <div class="hint" id="t-check">—</div>
      <button class="btn btn--ghost btn--sm" data-act="calc">Not sure? Calculate from your stats</button>
    </div>
    <div class="sheet__foot"><button class="btn" data-close>Cancel</button><button class="btn btn--primary" data-save>Save</button></div>
  `, {
    onMount(root) {
      const check = root.querySelector('#t-check');
      const recalc = () => {
        const k = num(root.querySelector('#t-kcal').value);
        const p = num(root.querySelector('#t-p').value) * 4;
        const c = num(root.querySelector('#t-c').value) * 4;
        const f = num(root.querySelector('#t-f').value) * 9;
        const sum = Math.round(p + c + f);
        const diff = sum - k;
        check.innerHTML = `Macros add up to <strong>${sum} kcal</strong>${Math.abs(diff) > 40 ? ` <span style="color:var(--warn)">(${diff > 0 ? '+' : ''}${diff} vs calorie target)</span>` : ''}`;
      };
      root.querySelectorAll('input').forEach((i) => i.addEventListener('input', recalc));
      recalc();
      root.querySelector('[data-act="calc"]').addEventListener('click', () => { closeSheet(); openCalculator(ctx); });
      root.querySelector('[data-save]').addEventListener('click', async () => {
        await saveSettings({
          targets: {
            kcal: num(root.querySelector('#t-kcal').value, 2400),
            protein: num(root.querySelector('#t-p').value, 160),
            carbs: num(root.querySelector('#t-c').value, 260),
            fat: num(root.querySelector('#t-f').value, 70),
          },
          onboarded: true,
        });
        closeSheet();
        toast('Targets saved', 'ok');
        ctx.rerender();
      });
    },
  });
}

/* ---------------- TDEE calculator ---------------- */

function openCalculator(ctx) {
  const s = state.settings;
  const units = s.units;
  const lastWeight = [...state.metrics].filter((m) => m.weightKg > 0).sort((a, b) => a.date.localeCompare(b.date)).pop();

  openSheet(`
    <div class="sheet__head">
      <div><div class="sheet__title">Target calculator</div><div class="tiny muted">Mifflin-St Jeor + activity</div></div>
      <button class="btn btn--bare" data-close>${icon('x')}</button>
    </div>
    <div class="sheet__body">
      <div class="seg" id="sex-seg">
        <button data-sex="male" aria-pressed="true">Male</button>
        <button data-sex="female" aria-pressed="false">Female</button>
      </div>
      <div class="grid3">
        <label class="field"><span class="field__l">Age</span><input class="input input--num" id="c-age" inputmode="numeric" value="25"></label>
        <label class="field"><span class="field__l">Height ${lengthLabel(units)}</span><input class="input input--num" id="c-h" inputmode="decimal" value="${s.heightCm ? round1(cmToDisplay(s.heightCm, units)) : ''}" placeholder="0"></label>
        <label class="field"><span class="field__l">Weight ${weightLabel(units)}</span><input class="input input--num" id="c-w" inputmode="decimal" value="${lastWeight ? round1(kgToDisplay(lastWeight.weightKg, units)) : ''}" placeholder="0"></label>
      </div>
      <label class="field"><span class="field__l">Activity</span>
        <select class="input" id="c-act">
          <option value="1.2">Sedentary — desk job, no training</option>
          <option value="1.375" selected>Light — 1–3 sessions/week</option>
          <option value="1.55">Moderate — 3–5 sessions/week</option>
          <option value="1.725">High — 6–7 sessions/week</option>
          <option value="1.9">Athlete — twice a day</option>
        </select>
      </label>
      <label class="field"><span class="field__l">Goal</span>
        <select class="input" id="c-goal">
          <option value="-500">Lose fat (−500 kcal)</option>
          <option value="0" selected>Maintain</option>
          <option value="300">Build muscle (+300 kcal)</option>
        </select>
      </label>

      <div class="card" id="c-result"></div>
      <div class="hint">Estimates only. Adjust by ±200 kcal after two weeks based on the scale.</div>
    </div>
    <div class="sheet__foot"><button class="btn" data-close>Cancel</button><button class="btn btn--primary" data-use>Use these targets</button></div>
  `, {
    onMount(root) {
      let sex = 'male';
      root.querySelectorAll('[data-sex]').forEach((b) => b.addEventListener('click', () => {
        sex = b.dataset.sex;
        root.querySelectorAll('[data-sex]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        paint();
      }));

      const calc = () => {
        const age = num(root.querySelector('#c-age').value, 25);
        const hCm = displayToCm(num(root.querySelector('#c-h').value, 0), units);
        const wKg = displayToKg(num(root.querySelector('#c-w').value, 0), units);
        const act = num(root.querySelector('#c-act').value, 1.375);
        const adj = num(root.querySelector('#c-goal').value, 0);
        if (!hCm || !wKg) return null;
        const bmr = 10 * wKg + 6.25 * hCm - 5 * age + (sex === 'male' ? 5 : -161);
        const tdee = bmr * act;
        const kcal = Math.max(1200, Math.round((tdee + adj) / 10) * 10);
        const protein = Math.round(wKg * 1.9);
        const fat = Math.round((kcal * 0.27) / 9);
        const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
        return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, fat, carbs };
      };

      const paint = () => {
        const r = calc();
        const box = root.querySelector('#c-result');
        if (!r) { box.innerHTML = '<div class="tiny muted">Enter height and weight to see your numbers.</div>'; return; }
        box.innerHTML = `
          <div class="row" style="justify-content:space-between"><span class="tiny muted">BMR</span><span class="mono tiny">${r.bmr} kcal</span></div>
          <div class="row" style="justify-content:space-between;margin-top:4px"><span class="tiny muted">Maintenance</span><span class="mono tiny">${r.tdee} kcal</span></div>
          <div class="divider" style="margin:8px 0"></div>
          <div class="row" style="justify-content:space-between"><strong style="color:var(--accent);font-size:18px" class="mono">${r.kcal}</strong><span class="tiny muted">kcal / day</span></div>
          <div class="tiny muted" style="margin-top:4px">${r.protein}g protein · ${r.carbs}g carbs · ${r.fat}g fat</div>`;
      };

      root.querySelectorAll('input,select').forEach((i) => i.addEventListener('input', paint));
      root.querySelector('[data-use]').addEventListener('click', async () => {
        const r = calc();
        if (!r) { toast('Enter height and weight first', 'err'); return; }
        await saveSettings({
          targets: { kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat },
          heightCm: displayToCm(num(root.querySelector('#c-h').value, 0), units) || state.settings.heightCm,
          onboarded: true,
        });
        closeSheet();
        toast('Targets set to ' + r.kcal + ' kcal', 'ok');
        ctx.rerender();
      });
      paint();
    },
  });
}

/* ---------------- backup ---------------- */

function exportData(ctx) {
  const payload = {
    app: 'ENDURA', version: 1, exportedAt: new Date().toISOString(),
    settings: state.settings, sessions: state.sessions, meals: state.meals, metrics: state.metrics,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `endura-backup-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Backup downloaded', 'ok');
}

function importData(ctx) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  document.body.appendChild(input);
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    input.remove();
    if (!f) return;
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.sessions) || !Array.isArray(data.meals)) throw new Error('Not an ENDURA backup');
      if (data.app && data.app !== 'ENDURA' && data.app !== 'FitTrack') throw new Error(`This backup is from ${data.app}`);
      const ok = await confirmSheet({
        title: 'Import backup?',
        message: `This replaces your current data with ${data.sessions.length} sessions, ${data.meals.length} meals and ${(data.metrics || []).length} measurements.`,
        ok: 'Import', danger: true,
      });
      if (!ok) return;

      await Promise.all([dbClear('sessions'), dbClear('meals'), dbClear('metrics')]);
      for (const s of data.sessions) await dbPut('sessions', s);
      for (const m of data.meals) await dbPut('meals', m);
      for (const m of data.metrics || []) await dbPut('metrics', m);

      state.sessions = data.sessions;
      state.meals = data.meals;
      state.metrics = data.metrics || [];
      if (data.settings) await saveSettings(data.settings);
      toast('Backup imported', 'ok');
      ctx.rerender();
    } catch (err) {
      toast(err.message || 'Import failed', 'err');
    }
  }, { once: true });
  input.click();
}

/* ---------------- account sheets ---------------- */

function openSyncSetup(ctx) {
  const s = state.settings.sync || {};
  openSheet(`
    <div class="sheet__head">
      <div class="sheet__title">Set up accounts</div>
      <button class="btn btn--bare" data-close aria-label="Close">${icon('x')}</button>
    </div>
    <div class="sheet__body">
      <div class="hint" style="line-height:1.5">1. Create a free project at supabase.com.<br>2. In the SQL editor, run <strong>supabase-setup.sql</strong> once.<br>3. Project settings → API: paste the Project URL and the anon public key below.</div>
      <label class="field" style="margin-top:12px"><span class="field__l">Project URL</span>
        <input class="input" id="sb-url" placeholder="https://xxxx.supabase.co" value="${esc(s.url || '')}" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
      <label class="field" style="margin-top:8px"><span class="field__l">Anon public key</span>
        <input class="input" id="sb-key" placeholder="eyJhbGciOi…" value="${esc(s.key || '')}" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
      <div class="hint" style="margin-top:8px">The anon key is public by design — row-level security decides what it can read.</div>
    </div>
    <div class="sheet__foot">
      <button class="btn" data-close>Cancel</button>
      <button class="btn btn--primary" data-connect>Connect</button>
    </div>
  `, {
    onMount(root) {
      root.querySelector('[data-connect]').addEventListener('click', async () => {
        const url = root.querySelector('#sb-url').value.trim().replace(/\/+$/, '');
        const key = root.querySelector('#sb-key').value.trim();
        if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) { toast('Paste the project URL', 'err'); return; }
        if (key.length < 40) { toast('Paste the anon public key', 'err'); return; }
        const btn = root.querySelector('[data-connect]');
        btn.disabled = true;
        btn.textContent = 'Connecting…';
        const ok = await configureSync({ url, key });
        closeSheet();
        toast(ok ? 'Accounts connected' : 'Could not connect', ok ? 'ok' : 'err');
        ctx.rerender();
      });
    },
  });
}

function openSignIn(ctx) {
  openSheet(`
    <div class="sheet__head">
      <div class="sheet__title">Sign in</div>
      <button class="btn btn--bare" data-close aria-label="Close">${icon('x')}</button>
    </div>
    <div class="sheet__body">
      <label class="field"><span class="field__l">Email</span>
        <input class="input" id="in-email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false"></label>
      <label class="field" style="margin-top:8px"><span class="field__l">Password</span>
        <input class="input" id="in-pass" type="password" autocomplete="current-password"></label>
      <div id="in-err" class="hint" style="color:var(--danger);margin-top:8px"></div>
    </div>
    <div class="sheet__foot">
      <button class="btn" data-close>Cancel</button>
      <button class="btn btn--primary" data-submit>Sign in</button>
    </div>
  `, {
    onMount(root) {
      const err = root.querySelector('#in-err');
      const submit = async () => {
        const btn = root.querySelector('[data-submit]');
        btn.disabled = true;
        btn.textContent = 'Signing in…';
        const res = await signIn({
          email: root.querySelector('#in-email').value.trim(),
          password: root.querySelector('#in-pass').value,
        });
        btn.disabled = false;
        btn.textContent = 'Sign in';
        if (res.error) { err.textContent = res.error; return; }
        closeSheet();
        if (res.needsMfa) { toast('Enter your 2FA code'); openMfaVerify(ctx); return; }
        toast('Signed in', 'ok');
        ctx.rerender();
      };
      root.querySelector('[data-submit]').addEventListener('click', submit);
      root.querySelector('#in-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    },
  });
}

function openSignUp(ctx) {
  openSheet(`
    <div class="sheet__head">
      <div class="sheet__title">Create account</div>
      <button class="btn btn--bare" data-close aria-label="Close">${icon('x')}</button>
    </div>
    <div class="sheet__body">
      <label class="field"><span class="field__l">Username</span>
        <input class="input" id="up-name" placeholder="yourname" autocapitalize="off" autocomplete="username" spellcheck="false"></label>
      <div class="hint" style="margin-top:4px">3–20 characters: a–z, 0–9 or _. Friends find you with this.</div>
      <label class="field" style="margin-top:10px"><span class="field__l">Email</span>
        <input class="input" id="up-email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false"></label>
      <label class="field" style="margin-top:8px"><span class="field__l">Password</span>
        <input class="input" id="up-pass" type="password" autocomplete="new-password"></label>
      <div id="up-msg" class="hint" style="margin-top:8px"></div>
    </div>
    <div class="sheet__foot">
      <button class="btn" data-close>Cancel</button>
      <button class="btn btn--primary" data-submit>Create</button>
    </div>
  `, {
    onMount(root) {
      const msg = root.querySelector('#up-msg');
      const submit = async () => {
        const btn = root.querySelector('[data-submit]');
        btn.disabled = true;
        btn.textContent = 'Creating…';
        const res = await signUp({
          username: root.querySelector('#up-name').value,
          email: root.querySelector('#up-email').value.trim(),
          password: root.querySelector('#up-pass').value,
        });
        btn.disabled = false;
        btn.textContent = 'Create';
        if (res.error) {
          msg.style.color = 'var(--danger)';
          msg.textContent = res.error;
          return;
        }
        if (res.needsConfirm) {
          msg.style.color = 'var(--accent)';
          msg.textContent = 'Account created. Confirm the email Supabase just sent, then sign in. (Turn off email confirmations in Supabase for instant sign-in.)';
          return;
        }
        closeSheet();
        toast('Account created', 'ok');
        ctx.rerender();
      };
      root.querySelector('[data-submit]').addEventListener('click', submit);
      root.querySelector('#up-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    },
  });
}

function openUsername(ctx) {
  const current = (auth.profile && auth.profile.username) || '';
  openSheet(`
    <div class="sheet__head">
      <div class="sheet__title">Change username</div>
      <button class="btn btn--bare" data-close aria-label="Close">${icon('x')}</button>
    </div>
    <div class="sheet__body">
      <label class="field"><span class="field__l">Username</span>
        <input class="input" id="un-name" value="${esc(current)}" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
      <div class="hint" style="margin-top:6px">3–20 characters: a–z, 0–9 or _. This is what friends search for.</div>
      <div id="un-msg" class="hint" style="color:var(--danger);margin-top:8px"></div>
    </div>
    <div class="sheet__foot">
      <button class="btn" data-close>Cancel</button>
      <button class="btn btn--primary" data-save>Save</button>
    </div>
  `, {
    onMount(root) {
      root.querySelector('[data-save]').addEventListener('click', async () => {
        const res = await saveUsername(root.querySelector('#un-name').value);
        if (res.error) { root.querySelector('#un-msg').textContent = res.error; return; }
        closeSheet();
        toast('Username updated', 'ok');
        ctx.rerender();
      });
    },
  });
}

function openMfaVerify(ctx) {
  openSheet(`
    <div class="sheet__head">
      <div class="sheet__title">Two-factor code</div>
      <button class="btn btn--bare" data-close aria-label="Close">${icon('x')}</button>
    </div>
    <div class="sheet__body">
      <label class="field"><span class="field__l">6-digit code</span>
        <input class="input input--num" id="mfa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"></label>
      <div id="mfa-msg" class="hint" style="color:var(--danger);margin-top:8px"></div>
    </div>
    <div class="sheet__foot">
      <button class="btn" data-close>Cancel</button>
      <button class="btn btn--primary" data-verify>Verify</button>
    </div>
  `, {
    onMount(root) {
      const go = async () => {
        const res = await verifyMfa(root.querySelector('#mfa-code').value);
        if (res.error) { root.querySelector('#mfa-msg').textContent = res.error; return; }
        closeSheet();
        toast('Signed in', 'ok');
        ctx.rerender();
      };
      root.querySelector('[data-verify]').addEventListener('click', go);
      root.querySelector('#mfa-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    },
  });
}

async function openTwoFactor(ctx) {
  openSheet(`
    <div class="sheet__head">
      <div class="sheet__title">Two-factor authentication</div>
      <button class="btn btn--bare" data-close aria-label="Close">${icon('x')}</button>
    </div>
    <div class="sheet__body">
      <div class="row" style="justify-content:center;gap:10px;padding:14px 0"><span class="spinner"></span><span class="tiny muted">Checking…</span></div>
    </div>
  `);

  let factors = [];
  try { factors = await refreshFactors(); } catch { factors = []; }
  const active = factors.find((f) => f.status === 'verified');

  if (active) {
    openSheet(`
      <div class="sheet__head">
        <div class="sheet__title">Two-factor authentication</div>
        <button class="btn btn--bare" data-close aria-label="Close">${icon('x')}</button>
      </div>
      <div class="sheet__body">
        <div class="card card--tight" style="border-color:rgba(160,255,180,.3)">
          <div class="row" style="gap:8px;align-items:center">
            <span class="badge badge--lime">on</span>
            <span class="tiny muted">Authenticator app · added ${esc(joinedLabel(active.created_at))}</span>
          </div>
          <div class="hint" style="margin-top:8px">Signing in asks for a 6-digit code after your password.</div>
        </div>
        <div class="hint" style="margin-top:10px">Phone-number 2FA needs an SMS provider (Twilio) connected to the project — the authenticator app is the free option and is stronger than SMS.</div>
        <button class="btn btn--sm btn--ghost btn--block" style="margin-top:12px;color:var(--danger)" data-off>Turn off 2FA</button>
      </div>
    `, {
      onMount(root) {
        root.querySelector('[data-off]').addEventListener('click', async () => {
          const res = await disableTotp(active.id);
          if (res.error) { toast(res.error, 'err'); return; }
          await refreshFactors();
          closeSheet();
          toast('2FA turned off');
          ctx.rerender();
        });
      },
    });
    return;
  }

  // not enrolled yet
  openSheet(`
    <div class="sheet__head">
      <div class="sheet__title">Turn on 2FA</div>
      <button class="btn btn--bare" data-close aria-label="Close">${icon('x')}</button>
    </div>
    <div class="sheet__body">
      <div class="row" style="justify-content:center;gap:10px;padding:14px 0"><span class="spinner"></span><span class="tiny muted">Creating a secret…</span></div>
    </div>
  `);

  let enrollment;
  try {
    enrollment = await enrollTotp();
  } catch (err) {
    openSheet(`
      <div class="sheet__head">
        <div class="sheet__title">Turn on 2FA</div>
        <button class="btn btn--bare" data-close aria-label="Close">${icon('x')}</button>
      </div>
      <div class="sheet__body"><div class="hint" style="color:var(--danger)">${esc(err.message || String(err))}</div></div>
    `);
    return;
  }

  openSheet(`
    <div class="sheet__head">
      <div class="sheet__title">Turn on 2FA</div>
      <button class="btn btn--bare" data-close aria-label="Close">${icon('x')}</button>
    </div>
    <div class="sheet__body">
      <div class="hint">Add this secret to your authenticator app (Google Authenticator, 1Password, iOS Passwords → “Set up code”), then enter the 6-digit code it shows.</div>
      <div class="card card--tight" style="margin-top:10px">
        <div class="label" style="margin-bottom:6px">Secret</div>
        <div class="mono" id="totp-secret" style="font-size:13px;word-break:break-all;letter-spacing:.06em">${esc(enrollment.secret)}</div>
        <button class="btn btn--sm btn--ghost btn--block" style="margin-top:8px" data-copy>Copy secret</button>
      </div>
      <label class="field" style="margin-top:10px"><span class="field__l">6-digit code</span>
        <input class="input input--num" id="totp-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"></label>
      <div id="totp-msg" class="hint" style="color:var(--danger);margin-top:8px"></div>
    </div>
    <div class="sheet__foot">
      <button class="btn" data-close>Cancel</button>
      <button class="btn btn--primary" data-confirm>Turn on</button>
    </div>
  `, {
    onMount(root) {
      root.querySelector('[data-copy]').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(enrollment.secret); toast('Secret copied', 'ok'); }
        catch { toast('Copy failed — select it manually', 'err'); }
      });
      root.querySelector('[data-confirm]').addEventListener('click', async () => {
        const res = await confirmTotp(enrollment.id, root.querySelector('#totp-code').value);
        if (res.error) { root.querySelector('#totp-msg').textContent = res.error; return; }
        await refreshFactors();
        closeSheet();
        toast('2FA is on', 'ok');
        ctx.rerender();
      });
    },
  });
}
