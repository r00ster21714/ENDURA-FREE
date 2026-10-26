import {
  state, totalsFor, mealsFor, sessionsFor, activeSession, streak, activityLevel,
  today, longDate, hhmm, sessionVolume, sessionSets, fmtKg, clock, esc, icon,
} from './core.js';
import { pageHead, macroCard, streakStrip, acts } from './common.js';
import { openScanner, openAddFood } from './nutrition.js';
import { openMetricSheet } from './body.js';

export function render(ctx) {
  const date = today();
  const t = totalsFor(date);
  const s = state.settings;
  const active = activeSession();
  const done = sessionsFor(date);
  const meals = mealsFor(date).sort((a, b) => a.ts - b.ts);
  const streakN = streak();

  const weights = state.metrics.filter((m) => m.weightKg > 0).sort((a, b) => a.date.localeCompare(b.date));
  const latest = weights[weights.length - 1];
  const weekAgo = weights.filter((m) => m.date <= date && m.date >= new Date(Date.now() - 8 * 864e5).toISOString().slice(0, 10));
  const delta = latest && weekAgo.length > 1 ? latest.weightKg - weekAgo[0].weightKg : null;

  const root = document.createElement('div');
  root.innerHTML = `
    ${pageHead({
      eyebrow: longDate(date),
      title: streakN > 1 ? `${streakN} day streak` : 'Today',
      right: `<button class="btn btn--icon" data-act="settings" aria-label="Settings">${icon('gear')}</button>`,
    })}

    ${macroCard(t, s.targets)}

    ${active ? `
      <section class="card card--accent" style="margin-top:12px">
        <div class="spread">
          <div>
            <div class="label" style="color:var(--accent)">Session in progress</div>
            <div style="font-weight:700;font-size:15px;margin-top:3px">${esc(active.name || 'Workout')}</div>
            <div class="tiny muted" style="margin-top:2px">${sessionSets(active)} sets logged</div>
          </div>
          <button class="btn btn--primary" data-act="resume">Resume</button>
        </div>
      </section>` : ''}

    <div class="quickgrid" style="margin-top:12px">
      <button class="quick" data-act="workout">
        <span class="quick__ic">${icon('dumbbell')}</span>
        <span><span class="quick__t">${active ? 'Resume' : done.length ? 'Train again' : 'Start workout'}</span><br><span class="quick__s">${done.length ? done.length + ' session' + (done.length > 1 ? 's' : '') + ' today' : 'Log your sets'}</span></span>
      </button>
      <button class="quick" data-act="scan">
        <span class="quick__ic quick__ic--teal">${icon('camera')}</span>
        <span><span class="quick__t">Scan food</span><br><span class="quick__s">Photo → macros</span></span>
      </button>
      <button class="quick" data-act="addfood">
        <span class="quick__ic quick__ic--warn">${icon('fork')}</span>
        <span><span class="quick__t">Add food</span><br><span class="quick__s">Search the database</span></span>
      </button>
      <button class="quick" data-act="weight">
        <span class="quick__ic">${icon('scale')}</span>
        <span><span class="quick__t">Log weight</span><br><span class="quick__s">${latest ? fmtKg(latest.weightKg, s.units) + ' last' : 'Track progress'}</span></span>
      </button>
    </div>

    ${latest ? `
      <section class="card" style="margin-top:12px">
        <div class="spread">
          <div>
            <div class="label">Bodyweight</div>
            <div style="display:flex;align-items:baseline;gap:8px;margin-top:2px">
              <span class="mono" style="font-size:22px;font-weight:750">${fmtKg(latest.weightKg, s.units)}</span>
              ${delta != null && Math.abs(delta) >= 0.05 ? `<span class="tiny" style="color:${delta > 0 ? 'var(--warn)' : 'var(--accent)'}">${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg this week</span>` : ''}
            </div>
          </div>
          <button class="btn btn--sm" data-act="body">Charts</button>
        </div>
      </section>` : ''}

    ${done.length ? `
      <section class="card" style="margin-top:12px">
        <div class="card__head"><h2>Training today</h2></div>
        ${done.map((x) => `
          <div class="spread" style="padding:6px 0">
            <div>
              <div style="font-weight:640;font-size:14px">${esc(x.name || 'Workout')}</div>
              <div class="tiny muted">${sessionSets(x)} sets · ${Math.round(sessionVolume(x))} kg volume${x.endedAt ? ' · ' + clock(x.endedAt - x.startedAt) : ''}</div>
            </div>
            <span class="badge badge--lime">${icon('check')}Done</span>
          </div>`).join('')}
      </section>` : ''}

    <section class="card" style="margin-top:12px">
      <div class="card__head">
        <h2>Food today</h2>
        <button class="btn btn--sm btn--ghost" data-act="nutrition">Open</button>
      </div>
      ${meals.length ? meals.slice(0, 4).map((m) => `
        <div class="spread" style="padding:6px 0;border-bottom:1px solid var(--line)">
          <div style="min-width:0">
            <div class="listrow__t" style="font-size:13.5px">${esc(m.name)}</div>
            <div class="tiny muted">${hhmm(m.ts)} · ${Math.round(m.protein)}P ${Math.round(m.carbs)}C ${Math.round(m.fat)}F</div>
          </div>
          <span class="mono tiny" style="color:var(--muted)">${Math.round(m.kcal)}</span>
        </div>`).join('')
        : `<div class="tiny muted" style="padding:4px 0 2px">Nothing logged yet — ${Math.max(0, Math.round(s.targets.kcal - t.kcal))} kcal left.</div>`}
      ${meals.length > 4 ? `<div class="tiny muted" style="padding-top:8px">+${meals.length - 4} more</div>` : ''}
    </section>

    <div style="margin-top:12px">${streakStrip(activityLevel)}</div>

    ${!state.settings.onboarded ? `
      <section class="card" style="margin-top:12px;border-color:rgba(94,234,212,.3)">
        <div class="spread">
          <div>
            <div style="font-weight:650;font-size:14px">Set your daily targets</div>
            <div class="tiny muted">Calories and macros are estimates until you set them.</div>
          </div>
          <button class="btn btn--sm" data-act="targets">Set up</button>
        </div>
      </section>` : ''}
  `;

  acts(root, {
    settings: () => ctx.navigate('#/settings'),
    workout: () => ctx.navigate('#/workout'),
    resume: () => ctx.navigate('#/workout'),
    nutrition: () => ctx.navigate('#/nutrition'),
    body: () => ctx.navigate('#/body'),
    scan: () => { ctx.navigate('#/nutrition'); setTimeout(() => openScanner(ctx), 60); },
    addfood: () => { ctx.navigate('#/nutrition'); setTimeout(() => openAddFood(ctx), 60); },
    weight: () => openMetricSheet(ctx),
    targets: () => ctx.navigate('#/settings'),
  });

  return root;
}
