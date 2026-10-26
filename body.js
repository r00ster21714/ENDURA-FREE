import {
  state, addMetric, removeMetric, today, addDays, prettyDate, esc, icon, num, openSheet, closeSheet,
  toast, confirmSheet, uid, fmtKg, fmtW, kgToDisplay, displayToKg, weightLabel, cmToDisplay, displayToCm,
  lengthLabel, round1, activityLevel, downscale, fileToBitmap, keyOf, fromKey,
} from './core.js';
import { pageHead, emptyState, acts } from './common.js';
import { lineChart } from './charts.js';

export function render(ctx) {
  const s = state.settings;
  const units = s.units;
  const metrics = [...state.metrics].sort((a, b) => a.date.localeCompare(b.date));
  const withWeight = metrics.filter((m) => m.weightKg > 0);
  const latest = withWeight[withWeight.length - 1];
  const prior = withWeight[withWeight.length - 2];
  const delta = latest && prior ? latest.weightKg - prior.weightKg : null;
  const goal = s.goalWeightKg;

  const points = withWeight.slice(-60).map((m) => ({
    x: m.date, y: Math.round(kgToDisplay(m.weightKg, units) * 10) / 10, label: prettyDate(m.date),
  }));

  const root = document.createElement('div');
  root.innerHTML = `
    ${pageHead({
      eyebrow: 'Body', title: 'Progress',
      right: `<button class="btn btn--icon" data-act="add" aria-label="Log measurement">${icon('plus')}</button>`,
    })}

    <section class="card">
      <div class="spread" style="align-items:flex-start">
        <div>
          <div class="label">Current weight</div>
          <div style="display:flex;align-items:baseline;gap:8px;margin-top:3px">
            <span class="mono" style="font-size:28px;font-weight:760">${latest ? round1(kgToDisplay(latest.weightKg, units)) : '—'}</span>
            <span class="muted tiny">${weightLabel(units)}</span>
            ${delta != null && Math.abs(delta) > 0.01 ? `<span class="tiny" style="color:${delta > 0 ? 'var(--warn)' : 'var(--accent)'}">${delta > 0 ? '+' : ''}${delta.toFixed(1)}</span>` : ''}
          </div>
          <div class="tiny muted" style="margin-top:2px">${latest ? prettyDate(latest.date) : 'No entries yet'}</div>
        </div>
        ${goal ? `<div style="text-align:right">
          <div class="label">Goal</div>
          <div class="mono" style="font-size:15px;font-weight:650;margin-top:4px">${round1(kgToDisplay(goal, units))} ${weightLabel(units)}</div>
          <div class="tiny" style="color:var(--accent);margin-top:2px">${latest ? (latest.weightKg > goal ? (latest.weightKg - goal).toFixed(1) + ' kg to go' : 'reached') : ''}</div>
        </div>` : ''}
      </div>
      <div class="chartbox" style="height:160px;margin-top:12px"><canvas id="weight-chart"></canvas></div>
      <div class="chart-legend"><span>${points.length} weigh-ins</span><span>${weightLabel(units)}</span></div>
    </section>

    <div class="stats" style="margin-top:12px">
      <div class="stat"><div class="stat__v">${withWeight.length}</div><div class="stat__l">Weigh-ins</div></div>
      <div class="stat"><div class="stat__v">${s.heightCm ? round1(cmToDisplay(s.heightCm, units)) : '—'}</div><div class="stat__l">Height ${lengthLabel(units)}</div></div>
      <div class="stat"><div class="stat__v">${state.sessions.filter((x) => x.status !== 'active').length}</div><div class="stat__l">Sessions</div></div>
    </div>

    <section class="card" style="margin-top:12px">
      <div class="card__head"><h2>Consistency</h2><span class="tiny muted">last 16 weeks</span></div>
      <div class="heat" id="heat"></div>
      <div class="row" style="justify-content:flex-end;gap:4px;margin-top:10px">
        <span class="tiny muted" style="margin-right:4px">less</span>
        ${[0, 1, 2, 3, 4].map((l) => `<i style="width:10px;height:10px;border-radius:3px;display:block;background:${l ? `rgba(184,244,91,${0.22 + (l - 1) * 0.22})` : '#151E22'}"></i>`).join('')}
        <span class="tiny muted" style="margin-left:4px">more</span>
      </div>
    </section>

    <div style="margin-top:18px">
      <div class="label" style="padding:0 2px 8px">Measurements</div>
      ${metrics.length ? `<div class="list">
        ${[...metrics].reverse().slice(0, 20).map((m) => {
          const extra = [];
          if (m.bodyFat) extra.push(m.bodyFat + '% bf');
          if (m.waist) extra.push('waist ' + round1(cmToDisplay(m.waist, units)) + lengthLabel(units));
          if (m.chest) extra.push('chest ' + round1(cmToDisplay(m.chest, units)));
          return `<div class="listrow">
            <div class="listrow__main">
              <div class="listrow__t">${m.weightKg ? round1(kgToDisplay(m.weightKg, units)) + ' ' + weightLabel(units) : 'Measurements'}</div>
              <div class="listrow__s">${prettyDate(m.date)}${extra.length ? ' · ' + extra.join(' · ') : ''}</div>
            </div>
            ${m.photo ? `<img src="${m.photo}" alt="" style="width:38px;height:38px;object-fit:cover;border-radius:9px;border:1px solid var(--line)">` : ''}
            <button class="btn btn--bare" data-del="${m.id}" aria-label="Delete entry">${icon('trash')}</button>
          </div>`;
        }).join('')}
      </div>` : `<div class="card">${emptyState('scale', 'Log your weight to start the chart.')}</div>`}
    </div>
  `;

  root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const ok = await confirmSheet({ title: 'Delete entry?', message: 'This measurement will be removed.', ok: 'Delete', danger: true });
    if (!ok) return;
    await removeMetric(b.dataset.del);
    toast('Entry removed');
    ctx.rerender();
  }));

  acts(root, { add: () => openMetricSheet(ctx) });

  /* heatmap */
  const heat = root.querySelector('#heat');
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (16 * 7 - 1));
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // align to Monday
  const cells = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = keyOf(d);
    const lvl = activityLevel(key);
    cells.push(`<i data-l="${lvl}" title="${key}"></i>`);
  }
  heat.innerHTML = cells.join('');

  if (points.length) {
    lineChart(root.querySelector('#weight-chart'), {
      points, height: 160, color: '#B8F45B',
      format: (v) => v.toFixed(1) + ' ' + weightLabel(units),
    });
  } else {
    lineChart(root.querySelector('#weight-chart'), { points: [], height: 160 });
  }

  return root;
}

export function openMetricSheet(ctx) {
  const s = state.settings;
  const units = s.units;
  const date = today();
  const existing = state.metrics.find((m) => m.date === date);
  let photo = existing?.photo || null;

  openSheet(`
    <div class="sheet__head">
      <div><div class="sheet__title">Log measurements</div><div class="tiny muted">${prettyDate(date)}</div></div>
      <button class="btn btn--bare" data-close aria-label="Close">${icon('x')}</button>
    </div>
    <div class="sheet__body">
      <div class="grid2">
        <label class="field"><span class="field__l">Weight (${weightLabel(units)})</span>
          <input class="input input--num" id="m-weight" inputmode="decimal" value="${existing?.weightKg ? round1(kgToDisplay(existing.weightKg, units)) : ''}" placeholder="0.0"></label>
        <label class="field"><span class="field__l">Body fat %</span>
          <input class="input input--num" id="m-bf" inputmode="decimal" value="${existing?.bodyFat || ''}" placeholder="optional"></label>
      </div>
      <div class="label" style="margin-top:4px">Tape measurements (${lengthLabel(units)})</div>
      <div class="grid3">
        <label class="field"><span class="field__l">Waist</span><input class="input input--num" id="m-waist" inputmode="decimal" value="${existing?.waist ? round1(cmToDisplay(existing.waist, units)) : ''}"></label>
        <label class="field"><span class="field__l">Chest</span><input class="input input--num" id="m-chest" inputmode="decimal" value="${existing?.chest ? round1(cmToDisplay(existing.chest, units)) : ''}"></label>
        <label class="field"><span class="field__l">Arm</span><input class="input input--num" id="m-arm" inputmode="decimal" value="${existing?.arm ? round1(cmToDisplay(existing.arm, units)) : ''}"></label>
      </div>
      <div class="grid2">
        <label class="field"><span class="field__l">Thigh</span><input class="input input--num" id="m-thigh" inputmode="decimal" value="${existing?.thigh ? round1(cmToDisplay(existing.thigh, units)) : ''}"></label>
        <div class="field">
          <span class="field__l">Progress photo</span>
          <button class="btn" data-photo>${icon('camera')}${photo ? 'Replace' : 'Add photo'}</button>
        </div>
      </div>
      <div id="m-photo-preview" class="${photo ? '' : 'hidden'}">
        ${photo ? `<img src="${photo}" class="scanimg" style="max-height:130px" alt="Progress photo">` : ''}
      </div>
      <label class="field"><span class="field__l">Notes</span><input class="input" id="m-notes" value="${esc(existing?.notes || '')}" placeholder="Optional"></label>
    </div>
    <div class="sheet__foot">
      <button class="btn" data-close>Cancel</button>
      <button class="btn btn--primary" data-save>Save</button>
    </div>
  `, {
    onMount(root) {
      const preview = root.querySelector('#m-photo-preview');
      root.querySelector('[data-photo]').addEventListener('click', async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        document.body.appendChild(input);
        input.addEventListener('change', async () => {
          const f = input.files?.[0];
          input.remove();
          if (!f) return;
          try {
            const bmp = await fileToBitmap(f);
            photo = downscale(bmp, 700, 0.7).dataUrl;
            preview.innerHTML = `<img src="${photo}" class="scanimg" style="max-height:130px" alt="">`;
            preview.classList.remove('hidden');
          } catch { toast('Could not read that image', 'err'); }
        }, { once: true });
        input.click();
      });

      root.querySelector('[data-save]').addEventListener('click', async () => {
        const w = num(root.querySelector('#m-weight').value, 0);
        const metric = {
          id: existing?.id || uid(),
          date,
          createdAt: existing?.createdAt || Date.now(),
          weightKg: w > 0 ? displayToKg(w, units) : existing?.weightKg || 0,
          bodyFat: num(root.querySelector('#m-bf').value, existing?.bodyFat || 0),
          waist: displayToCm(num(root.querySelector('#m-waist').value, 0), units) || existing?.waist || 0,
          chest: displayToCm(num(root.querySelector('#m-chest').value, 0), units) || existing?.chest || 0,
          arm: displayToCm(num(root.querySelector('#m-arm').value, 0), units) || existing?.arm || 0,
          thigh: displayToCm(num(root.querySelector('#m-thigh').value, 0), units) || existing?.thigh || 0,
          notes: root.querySelector('#m-notes').value.trim(),
          photo,
        };
        if (!metric.weightKg && !metric.bodyFat && !metric.waist && !metric.chest) {
          toast('Enter at least a weight', 'err');
          return;
        }
        await addMetric(metric);
        closeSheet();
        toast('Measurements saved', 'ok');
        ctx.rerender();
      });
    },
  });
}
