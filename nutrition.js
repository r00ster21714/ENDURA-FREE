import {
  state, totalsFor, mealsFor, addMeal, removeMeal, today, addDays, hhmm, esc, icon, num,
  openSheet, closeSheet, toast, uid, downscale, fileToBitmap, round1, learnLabel,
} from './core.js';
import { pageHead, macroCard, dateNav, acts } from './common.js';
import { searchFoods, FOODS, matchVisual } from './data.js';
import { classify, cloudAnalyze, mergePreds, imageFeatures } from './vision.js';

let viewDate = today();

const groupOf = (ts) => {
  const h = new Date(ts).getHours();
  if (h >= 4 && h < 11) return 'Breakfast';
  if (h >= 11 && h < 15) return 'Lunch';
  if (h >= 15 && h < 21) return 'Dinner';
  return 'Snacks';
};

export function render(ctx) {
  const date = viewDate;
  const t = totalsFor(date);
  const s = state.settings;
  const meals = mealsFor(date).sort((a, b) => a.ts - b.ts);
  const groups = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'].map((g) => ({
    name: g,
    items: meals.filter((m) => groupOf(m.ts) === g),
  })).filter((g) => g.items.length);
  const cloudOn = s.cloud.provider !== 'none';

  const root = document.createElement('div');
  root.innerHTML = `
    ${pageHead({ eyebrow: 'Nutrition', title: 'Food', right: `<button class="btn btn--icon" data-act="add" aria-label="Add food">${icon('plus')}</button>` })}
    ${dateNav(date)}
    ${macroCard(t, s.targets)}

    <section class="card card--accent" style="margin-top:12px">
      <div class="spread">
        <div style="min-width:0">
          <div class="row" style="gap:6px">
            <span class="badge ${cloudOn ? 'badge--lime' : ''}">${icon(cloudOn ? 'spark' : 'camera')}${cloudOn ? 'Cloud AI' : 'On-device'}</span>
          </div>
          <div style="font-weight:680;font-size:15px;margin-top:7px">Scan a meal</div>
          <div class="tiny muted" style="margin-top:2px;max-width:34ch">${cloudOn
            ? 'Photo goes to your chosen AI provider, which estimates the macros directly.'
            : 'Identifies the dish on your phone, then pulls macros from the food table. No upload.'}</div>
        </div>
        <button class="btn btn--primary btn--icon" data-act="scan" aria-label="Scan food" style="width:46px;height:46px">${icon('camera')}</button>
      </div>
    </section>

    <div style="margin-top:16px" class="stack--sm">
      ${groups.length ? groups.map((g) => `
        <div>
          <div class="label" style="padding:6px 2px">${g.name} · ${Math.round(g.items.reduce((a, m) => a + m.kcal, 0))} kcal</div>
          <div class="list">
            ${g.items.map((m) => `
              <div class="listrow">
                <div class="listrow__main">
                  <div class="listrow__t">${esc(m.name)}</div>
                  <div class="listrow__s">${m.grams ? Math.round(m.grams) + ' g · ' : ''}${Math.round(m.protein)}P ${Math.round(m.carbs)}C ${Math.round(m.fat)}F · ${hhmm(m.ts)}</div>
                </div>
                <div class="listrow__end">${Math.round(m.kcal)}<small>kcal</small></div>
                <button class="btn btn--bare" data-del="${m.id}" aria-label="Delete entry">${icon('trash')}</button>
              </div>`).join('')}
          </div>
        </div>`).join('')
        : `<div class="card">${`<div class="empty" style="padding:26px 10px">${icon('fork')}<p>No food logged for this day.</p></div>`}</div>`}
    </div>

    <div class="stats" style="margin-top:14px">
      <div class="stat"><div class="stat__v">${meals.length}</div><div class="stat__l">Entries</div></div>
      <div class="stat"><div class="stat__v">${Math.round(t.protein)}</div><div class="stat__l">Protein g</div></div>
      <div class="stat"><div class="stat__v">${Math.round(t.kcal)}</div><div class="stat__l">Total kcal</div></div>
    </div>
  `;

  root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    await removeMeal(b.dataset.del);
    toast('Entry removed');
    ctx.rerender();
  }));

  acts(root, {
    prev: () => { viewDate = addDays(viewDate, -1); ctx.rerender(); },
    next: () => { if (viewDate !== today()) { viewDate = addDays(viewDate, 1); ctx.rerender(); } },
    add: () => openAddFood(ctx),
    scan: () => openScanner(ctx),
  });

  return root;
}

/* ---------------- photo capture ---------------- */

/** middle slice of the frame, where the plate usually is */
function centerCrop(canvas, ratio) {
  const w = Math.round(canvas.width * ratio);
  const h = Math.round(canvas.height * ratio);
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  out.getContext('2d').drawImage(
    canvas,
    (canvas.width - w) / 2, (canvas.height - h) / 2, w, h,
    0, 0, w, h,
  );
  return out;
}

function pickImage(camera) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (camera) input.capture = 'environment';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const f = input.files && input.files[0] ? input.files[0] : null;
      input.remove();
      resolve(f);
    }, { once: true });
    input.click();
  });
}

/* ---------------- scanner ---------------- */

export function openScanner(ctx) {
  const s = state.settings;
  const cloudOn = s.cloud.provider !== 'none';

  openSheet(`
    <div class="sheet__head">
      <div class="sheet__title">Scan a meal</div>
      <button class="btn btn--bare" data-close aria-label="Close">${icon('x')}</button>
    </div>
    <div class="sheet__body">
      <div class="scan-drop">
        <img id="scan-preview" class="scanimg hidden" alt="">
        <div id="scan-idle">
          ${icon('camera')}
          <div style="font-weight:650;font-size:14px;margin-bottom:3px">Point at your plate</div>
          <div class="tiny muted" style="max-width:30ch;margin:0 auto 14px">${cloudOn
            ? 'Your provider estimates the nutrition of what is visible.'
            : 'The dish is identified locally. You confirm the portion before it is logged.'}</div>
          <div class="row" style="justify-content:center;gap:8px">
            <button class="btn btn--primary" data-shot="camera">${icon('camera')}Camera</button>
            <button class="btn" data-shot="gallery">${icon('upload')}Gallery</button>
          </div>
        </div>
        <div id="scan-busy" class="hidden" style="padding:10px 0">
          <div class="row" style="justify-content:center;gap:10px">
            <span class="spinner"></span>
            <span id="scan-status" class="tiny muted">Preparing…</span>
          </div>
        </div>
      </div>
      <div id="scan-result"></div>
      <div class="tiny muted" style="line-height:1.45">
        ${cloudOn
          ? `Using <strong>${esc(s.cloud.provider)}</strong>${s.cloud.model ? ' · ' + esc(s.cloud.model) : ''}. Photo is sent to that API from this device.`
          : 'Estimates come from a food-recognition model on this device plus a nutrition table. Portion size is the biggest source of error — check the grams before logging. Photos are never saved.'}
        <button class="btn btn--bare tiny" data-act="vision-settings" style="padding:2px 4px;text-decoration:underline">Change</button>
      </div>
    </div>
  `, {
    onMount(sheetRoot) {
      const status = (msg) => {
        const el = sheetRoot.querySelector('#scan-status');
        if (el) el.textContent = msg;
      };
      const busy = (on) => {
        sheetRoot.querySelector('#scan-busy').classList.toggle('hidden', !on);
        sheetRoot.querySelector('#scan-idle').classList.toggle('hidden', on);
      };

      sheetRoot.querySelectorAll('[data-shot]').forEach((b) => b.addEventListener('click', async () => {
        const file = await pickImage(b.dataset.shot === 'camera');
        if (!file) return;
        busy(true);
        status('Preparing photo…');
        try {
          const bmp = await fileToBitmap(file);
          const full = downscale(bmp, 900, 0.8);
          const thumb = downscale(bmp, 480, 0.6);
          sheetRoot.querySelector('#scan-preview').src = full.dataUrl;
          sheetRoot.querySelector('#scan-preview').classList.remove('hidden');

          const cfg = state.settings.cloud;
          if (cfg.provider !== 'none' && cfg.key) {
            status('Asking ' + cfg.provider + ' to read the plate…');
            const result = await cloudAnalyze(full.dataUrl, cfg);
            busy(false);
            showCloudResult(sheetRoot, result, thumb.dataUrl, ctx);
            return;
          }

          status('Loading model…');
          const crop = centerCrop(full.canvas, 0.74);
          const tight = centerCrop(full.canvas, 0.5);
          status('Reading the photo…');
          // Three passes: the whole frame, the plate area, and a tight centre
          // crop for close-ups. Agreement between them raises a label's score.
          const preds = mergePreds([
            await classify(full.canvas, status),
            await classify(crop, status),
            await classify(tight, status),
          ]);
          const features = imageFeatures(full.canvas);
          const match = matchVisual(preds, state.learned, features);
          busy(false);
          // A 0.02-score guess dressed up as an answer is worse than asking.
          const weak = !match.candidates.length || match.candidates[0].score < 0.05;
          if (weak) {
            showNoMatch(sheetRoot, thumb.dataUrl, match, ctx, !match.candidates.length ? 'unknown' : 'weak');
          } else {
            showCandidates(sheetRoot, match, thumb.dataUrl, ctx);
          }
        } catch (err) {
          busy(false);
          showScanError(sheetRoot, err.message || 'Scan failed', ctx);
        }
      }));

      sheetRoot.querySelector('[data-act="vision-settings"]').addEventListener('click', () => {
        closeSheet();
        ctx.navigate('#/settings');
      });
    },
  });
}

function showScanError(root, message, ctx) {
  const box = root.querySelector('#scan-result');
  box.innerHTML = `
    <div class="card" style="border-color:rgba(255,122,122,.35)">
      <div style="font-weight:650;font-size:14px;color:var(--danger)">Couldn't analyse that photo</div>
      <div class="tiny muted" style="margin-top:4px;line-height:1.45">${esc(message)}</div>
      <div class="row" style="margin-top:12px;gap:8px">
        <button class="btn btn--sm" data-again>Try again</button>
        <button class="btn btn--sm btn--ghost" data-manual>Enter manually</button>
      </div>
    </div>`;
  box.querySelector('[data-again]').addEventListener('click', () => openScanner(ctx));
  box.querySelector('[data-manual]').addEventListener('click', () => { closeSheet(); openAddFood(ctx); });
}

function showNoMatch(root, photo, match, ctx, reason = 'unknown') {
  const top = match.saw.join(', ');
  const box = root.querySelector('#scan-result');
  box.innerHTML = `
    <div class="card">
      <div style="font-weight:650;font-size:14px">${reason === 'weak' ? 'Not confident enough' : 'Not sure what that is'}</div>
      <div class="tiny muted" style="margin-top:4px">${reason === 'weak'
        ? `The model hesitated between ${esc(top || 'a few guesses')}, none strongly enough to call it. Pick it manually — the app remembers your choice for next time, and the photo isn't saved.`
        : `The model guessed ${esc(top || 'nothing')}, which isn't in the food list. Pick it manually — the app remembers your choice for next time, and the photo isn't saved.`}</div>
      <button class="btn btn--sm btn--primary" style="margin-top:12px" data-search>Search foods</button>
    </div>`;
  const prefill = searchHint(match.saw[0]);
  box.querySelector('[data-search]').addEventListener('click', () => {
    closeSheet();
    openAddFood(ctx, { photo, scanLabel: match.saw[0] || null, prefill });
  });
}

/* A generic ImageNet label is a bad search term. Point the manual search at
   something the table actually contains instead. */
const SEARCH_HINTS = {
  dough: 'roll',
  bun: 'roll',
  bakery: 'bread',
  confectionery: 'cake',
  pastry: 'roll',
  plate: '',
  tray: '',
  tableware: '',
  menu: '',
  restaurant: '',
  'grocery store': '',
};

function searchHint(label) {
  const key = String(label || '').toLowerCase().trim();
  if (!key) return '';
  return SEARCH_HINTS[key] !== undefined ? SEARCH_HINTS[key] : key;
}

/* One answer, not a quiz: name the dish, log it, and make the correction
   path obvious when the guess is wrong. */
function showCandidates(root, match, photo, ctx) {
  const { candidates, saw, sure, family } = match;
  const box = root.querySelector('#scan-result');
  const lead = candidates[0];
  const alts = candidates.slice(1, 4);
  const scanLabel = saw[0] || null;

  const openFood = (food) => {
    closeSheet();
    openPortionSheet(food, ctx, { photo, source: 'scan', scanLabel });
  };

  const drawAnswer = () => {
    box.innerHTML = `
      <div style="text-align:center;padding:8px 0 0">
        <div class="tiny muted">${sure ? 'This is' : family ? `Looks like ${esc(family)} · best guess` : 'Best guess'}</div>
        <div class="scan-answer__name">${esc(lead.food.name)}</div>
        <div class="scan-answer__sub">${Math.round(lead.food.kcal)} kcal per ${lead.food.serveG} g · ${Math.round(lead.food.protein)} P / ${Math.round(lead.food.carbs)} C / ${Math.round(lead.food.fat)} F</div>
      </div>
      <button class="btn btn--primary btn--block" data-log style="margin-top:16px">Add ${esc(lead.food.name)}</button>
      ${alts.length ? `
        <div class="label" style="margin:14px 0 6px">Not it? One tap</div>
        <div class="row" style="gap:6px;flex-wrap:wrap">
          ${alts.map((c, i) => `<button class="pill" data-quick="${i}">${esc(c.food.name)}</button>`).join('')}
        </div>` : ''}
      ${candidates.length > 1 ? `<button class="btn btn--ghost btn--sm btn--block" data-change style="margin-top:10px">See all ${candidates.length} matches</button>` : ''}
      <div class="tiny muted" style="margin-top:10px;text-align:center">The photo isn't saved.</div>`;
    box.querySelector('[data-log]').addEventListener('click', () => openFood(lead.food));
    box.querySelectorAll('[data-quick]').forEach((b) => b.addEventListener('click', () => {
      openFood(alts[Number(b.dataset.quick)].food);
    }));
    const change = box.querySelector('[data-change]');
    if (change) change.addEventListener('click', drawPicker);
  };

  const drawPicker = () => {
    const options = candidates;
    box.innerHTML = `
      <div style="font-weight:650;font-size:14px;margin-bottom:3px">Change it</div>
      <div class="tiny muted" style="margin-bottom:10px">Pick the right food for this photo. The app remembers it.</div>
      <div style="display:flex;flex-direction:column;gap:7px">
        ${options.map((c, i) => `
          <button class="listrow listrow--btn" data-pick="${i}" style="border:1px solid var(--line);border-radius:13px;background:var(--card)">
            <div class="listrow__main">
              <div class="listrow__t">${esc(c.food.name)}</div>
              <div class="listrow__s">${Math.round(c.food.kcal)} kcal per ${c.food.serveG} g</div>
            </div>
          </button>`).join('')}
      </div>
      <button class="btn btn--ghost btn--sm btn--block" style="margin-top:9px" data-search>Search all foods</button>`;

    box.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
      openFood(options[Number(b.dataset.pick)].food);
    }));
    box.querySelector('[data-search]').addEventListener('click', () => {
      closeSheet();
      openAddFood(ctx, { photo, scanLabel });
    });
  };

  drawAnswer();
}

/* ---------------- cloud result editor ---------------- */

function showCloudResult(root, result, photo, ctx) {
  const draft = result.items.map((it) => ({
    name: it.name,
    grams: it.grams || 0,
    base: { kcal: it.kcal, protein: it.protein, carbs: it.carbs, fat: it.fat, grams: it.grams || 0 },
  }));
  const scaleDraft = (factor) => {
    draft.forEach((d) => {
      d.grams = Math.round(d.base.grams * factor);
      d.kcal = d.base.kcal * factor;
      d.protein = d.base.protein * factor;
      d.carbs = d.base.carbs * factor;
      d.fat = d.base.fat * factor;
    });
  };
  scaleDraft(1);

  const totals = () => draft.reduce((a, d) => {
    a.kcal += d.kcal; a.protein += d.protein; a.carbs += d.carbs; a.fat += d.fat; return a;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  const box = root.querySelector('#scan-result');

  const paint = () => {
    const t = totals();
    box.innerHTML = `
      <div class="row" style="justify-content:space-between;margin-bottom:8px">
        <span class="badge badge--lime">${icon('spark')}${esc(result.confidence)} confidence</span>
        <span class="tiny muted">${draft.length} item${draft.length > 1 ? 's' : ''}</span>
      </div>
      <div class="stack--sm" style="display:flex;flex-direction:column;gap:8px">
        ${draft.map((d, i) => `
          <div class="card card--tight">
            <input class="input" data-f="name" data-i="${i}" value="${esc(d.name)}" aria-label="Food name" style="border:0;background:none;padding:0 0 6px;font-weight:650;font-size:14px">
            <div class="grid3" style="gap:6px;margin-top:2px">
              <label class="field"><span class="field__l">kcal</span><input class="input input--num" inputmode="decimal" data-f="kcal" data-i="${i}" value="${Math.round(d.kcal)}"></label>
              <label class="field"><span class="field__l">P</span><input class="input input--num" inputmode="decimal" data-f="protein" data-i="${i}" value="${round1(d.protein)}"></label>
              <label class="field"><span class="field__l">C</span><input class="input input--num" inputmode="decimal" data-f="carbs" data-i="${i}" value="${round1(d.carbs)}"></label>
            </div>
            <div class="grid2" style="margin-top:6px;align-items:end">
              <label class="field"><span class="field__l">fat g</span><input class="input input--num" inputmode="decimal" data-f="fat" data-i="${i}" value="${round1(d.fat)}"></label>
              <label class="field"><span class="field__l">grams</span><input class="input input--num" inputmode="decimal" data-f="grams" data-i="${i}" value="${d.grams}"></label>
            </div>
          </div>`).join('')}
      </div>

      <div class="row" style="gap:6px;margin:10px 0 8px;flex-wrap:wrap">
        ${[0.5, 0.75, 1, 1.25, 1.5].map((f) => `<button class="pill" data-scale="${f}">${f === 1 ? 'As shown' : f + '×'}</button>`).join('')}
      </div>

      <div class="spread card card--tight">
        <span class="tiny muted">Total</span>
        <span class="mono" style="font-size:13px">${Math.round(t.kcal)} kcal · ${Math.round(t.protein)}P ${Math.round(t.carbs)}C ${Math.round(t.fat)}F</span>
      </div>
      ${result.notes ? `<div class="tiny muted" style="margin-top:6px">${esc(result.notes)}</div>` : ''}
      <button class="btn btn--primary btn--block" data-add style="margin-top:10px">Add ${Math.round(t.kcal)} kcal to log</button>
    `;

    box.querySelectorAll('input[data-f]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const i = Number(inp.dataset.i);
        const f = inp.dataset.f;
        if (f === 'name') { draft[i].name = inp.value; return; }
        const v = num(inp.value, 0);
        if (f === 'grams') {
          const prev = draft[i].grams || 1;
          const factor = v / prev;
          draft[i].grams = v;
          for (const k of ['kcal', 'protein', 'carbs', 'fat']) draft[i][k] = draft[i][k] * factor;
          draft[i].base = { ...draft[i].base, grams: v };
          // sync macro fields without rebuilding the DOM
          for (const k of ['kcal', 'protein', 'carbs', 'fat']) {
            const node = box.querySelector(`input[data-f="${k}"][data-i="${i}"]`);
            if (node) node.value = k === 'kcal' ? String(Math.round(draft[i][k])) : String(round1(draft[i][k]));
          }
        } else {
          draft[i][f] = v;
        }
        const t2 = totals();
        const totalNode = box.querySelector('[data-add]');
        if (totalNode) totalNode.textContent = `Add ${Math.round(t2.kcal)} kcal to log`;
      });
    });

    box.querySelectorAll('[data-scale]').forEach((b) => b.addEventListener('click', () => {
      const f = Number(b.dataset.scale);
      // reset to base then apply factor
      draft.forEach((d) => {
        d.grams = Math.round(d.base.grams * f);
        d.kcal = d.base.kcal * f;
        d.protein = d.base.protein * f;
        d.carbs = d.base.carbs * f;
        d.fat = d.base.fat * f;
      });
      paint();
    }));

    box.querySelector('[data-add]').addEventListener('click', async () => {
      const ts = Date.now();
      for (const d of draft) {
        await addMeal({
          id: uid(), date: viewDate, ts,
          name: d.name.trim() || 'Food',
          grams: Math.round(d.grams),
          kcal: Math.round(d.kcal), protein: round1(d.protein), carbs: round1(d.carbs), fat: round1(d.fat),
          source: 'cloud',
        });
      }
      closeSheet();
      toast('Logged ' + Math.round(totals().kcal) + ' kcal', 'ok');
      ctx.rerender();
    });
  };

  paint();
}

/* ---------------- local portion editor ---------------- */

function openPortionSheet(foodItem, ctx, { photo = null, source = 'manual', scanLabel = null } = {}) {
  let grams = foodItem.serveG;
  const macros = (g) => ({
    kcal: (foodItem.per100.kcal * g) / 100,
    protein: (foodItem.per100.protein * g) / 100,
    carbs: (foodItem.per100.carbs * g) / 100,
    fat: (foodItem.per100.fat * g) / 100,
  });

  openSheet(`
    <div class="sheet__head">
      <div class="sheet__title">${esc(foodItem.name)}</div>
      <button class="btn btn--bare" data-close aria-label="Close">${icon('x')}</button>
    </div>
    <div class="sheet__body">
      ${photo ? `<img class="scanimg" src="${photo}" alt="Meal photo" style="max-height:150px">` : ''}
      <div>
        <div class="label" style="margin-bottom:6px">Portion</div>
        <div class="row" style="gap:8px">
          <input class="input input--num" id="portion-g" inputmode="decimal" value="${grams}" style="max-width:110px">
          <span class="muted tiny">grams</span>
          <div class="row" style="gap:5px;margin-left:auto">
            ${[0.5, 1, 1.5, 2].map((f) => `<button class="pill" data-mult="${f}">${f}×</button>`).join('')}
          </div>
        </div>
        <div class="hint" style="margin-top:6px">1 serving = ${foodItem.serveG} g · ${Math.round(foodItem.kcal)} kcal</div>
      </div>
      <div class="stats">
        <div class="stat"><div class="stat__v" id="p-kcal">0</div><div class="stat__l">kcal</div></div>
        <div class="stat"><div class="stat__v" id="p-p">0</div><div class="stat__l">protein</div></div>
        <div class="stat"><div class="stat__v" id="p-c">0</div><div class="stat__l">carbs</div></div>
        <div class="stat"><div class="stat__v" id="p-f">0</div><div class="stat__l">fat</div></div>
      </div>
    </div>
    <div class="sheet__foot">
      <button class="btn" data-close>Cancel</button>
      <button class="btn btn--primary" data-add>Add to log</button>
    </div>
  `, {
    onMount(root) {
      const input = root.querySelector('#portion-g');
      const paint = () => {
        const m = macros(Math.max(1, grams));
        root.querySelector('#p-kcal').textContent = Math.round(m.kcal);
        root.querySelector('#p-p').textContent = Math.round(m.protein);
        root.querySelector('#p-c').textContent = Math.round(m.carbs);
        root.querySelector('#p-f').textContent = Math.round(m.fat);
      };
      const setGrams = (g) => { grams = g; input.value = String(Math.round(g)); paint(); };
      input.addEventListener('input', () => { grams = Math.max(1, num(input.value, foodItem.serveG)); paint(); });
      root.querySelectorAll('[data-mult]').forEach((b) => b.addEventListener('click', () => setGrams(foodItem.serveG * Number(b.dataset.mult))));
      paint();

      root.querySelector('[data-add]').addEventListener('click', async () => {
        const m = macros(Math.max(1, grams));
        await addMeal({
          id: uid(), date: viewDate, ts: Date.now(),
          name: foodItem.name, grams: Math.round(grams),
          kcal: Math.round(m.kcal), protein: round1(m.protein), carbs: round1(m.carbs), fat: round1(m.fat),
          source,
        });
        if (scanLabel) await learnLabel(scanLabel, foodItem.id);
        closeSheet();
        toast(foodItem.name + ' logged', 'ok');
        ctx.rerender();
      });
    },
  });
}

/* ---------------- add food ---------------- */

export function openAddFood(ctx, { photo = null, scanLabel = null, prefill = '' } = {}) {
  const recent = [...state.meals].sort((a, b) => b.ts - a.ts)
    .filter((m, i, arr) => arr.findIndex((x) => x.name === m.name) === i)
    .slice(0, 4);

  openSheet(`
    <div class="sheet__head">
      <div class="sheet__title">Add food</div>
      <button class="btn btn--bare" data-close aria-label="Close">${icon('x')}</button>
    </div>
    <div class="sheet__body">
      <div class="row" style="gap:8px">
        <div class="grow" style="position:relative">
          ${icon('search', '')}
          <input class="input" id="food-q" placeholder="Search 100+ foods…" autocomplete="off" style="padding-left:40px">
          <svg class="ic" style="position:absolute;left:12px;top:12px;color:var(--muted-2);width:18px;height:18px"><use href="#i-search"/></svg>
        </div>
        <button class="btn btn--icon" data-scan aria-label="Scan instead">${icon('camera')}</button>
      </div>
      ${recent.length ? `<div>
        <div class="label" style="margin-bottom:6px">Recent</div>
        <div class="scroll-x">
          ${recent.map((m) => `<button class="pill" data-recent="${esc(m.name)}">${esc(m.name)}</button>`).join('')}
        </div>
      </div>` : ''}
      <div id="food-results" class="list"></div>
      <button class="btn btn--ghost btn--sm btn--block" data-custom>${icon('plus')}Create custom food</button>
    </div>
  `, {
    onMount(root) {
      const results = root.querySelector('#food-results');
      const q = root.querySelector('#food-q');

      const draw = (list) => {
        if (!list.length) {
          results.innerHTML = `<div class="empty" style="padding:22px">${icon('search')}<p>No match. Try a simpler word.</p></div>`;
          return;
        }
        results.innerHTML = list.slice(0, 30).map((f) => `
          <button class="listrow listrow--btn" data-food="${f.id}">
            <div class="listrow__main">
              <div class="listrow__t">${esc(f.name)}</div>
              <div class="listrow__s">${Math.round(f.kcal)} kcal · ${Math.round(f.protein)}P ${Math.round(f.carbs)}C ${Math.round(f.fat)}F</div>
            </div>
            <div class="listrow__end">${f.serveG}<small>g</small></div>
          </button>`).join('');
        results.querySelectorAll('[data-food]').forEach((b) => b.addEventListener('click', () => {
          const f = FOODS.find((x) => x.id === b.dataset.food);
          closeSheet();
          setTimeout(() => openPortionSheet(f, ctx, { photo, source: 'manual', scanLabel }), 40);
        }));
      };

      draw(FOODS.slice(0, 12));
      if (prefill) { q.value = prefill; draw(searchFoods(prefill)); }
      q.addEventListener('input', () => draw(searchFoods(q.value)));
      q.focus({ preventScroll: true });

      root.querySelectorAll('[data-recent]').forEach((b) => b.addEventListener('click', () => {
        const name = b.dataset.recent;
        const f = FOODS.find((x) => x.name === name) || FOODS.find((x) => x.aliases.includes(name.toLowerCase()));
        if (f) { closeSheet(); setTimeout(() => openPortionSheet(f, ctx, { photo, source: 'manual', scanLabel }), 40); }
        else { const m = state.meals.find((x) => x.name === name); if (m) addQuick(m); }
      }));

      async function addQuick(m) {
        await addMeal({ ...m, id: uid(), date: viewDate, ts: Date.now() });
        closeSheet(); toast('Logged again', 'ok'); ctx.rerender();
      }

      root.querySelector('[data-scan]').addEventListener('click', () => { closeSheet(); openScanner(ctx); });
      root.querySelector('[data-custom]').addEventListener('click', () => { closeSheet(); setTimeout(() => openCustomFood(ctx), 40); });
    },
  });
}

function openCustomFood(ctx) {
  openSheet(`
    <div class="sheet__head">
      <div class="sheet__title">Custom food</div>
      <button class="btn btn--bare" data-close aria-label="Close">${icon('x')}</button>
    </div>
    <div class="sheet__body">
      <label class="field"><span class="field__l">Name</span><input class="input" id="cf-name" placeholder="e.g. Mum's lasagne"></label>
      <div class="grid2">
        <label class="field"><span class="field__l">Calories</span><input class="input input--num" id="cf-kcal" inputmode="decimal" placeholder="0"></label>
        <label class="field"><span class="field__l">Portion (g)</span><input class="input input--num" id="cf-g" inputmode="decimal" value="100"></label>
      </div>
      <div class="grid3">
        <label class="field"><span class="field__l">Protein</span><input class="input input--num" id="cf-p" inputmode="decimal" placeholder="0"></label>
        <label class="field"><span class="field__l">Carbs</span><input class="input input--num" id="cf-c" inputmode="decimal" placeholder="0"></label>
        <label class="field"><span class="field__l">Fat</span><input class="input input--num" id="cf-f" inputmode="decimal" placeholder="0"></label>
      </div>
      <div class="hint">Values are for the portion size you enter. They are logged as-is.</div>
    </div>
    <div class="sheet__foot">
      <button class="btn" data-close>Cancel</button>
      <button class="btn btn--primary" data-add>Add to log</button>
    </div>
  `, {
    onMount(root) {
      root.querySelector('[data-add]').addEventListener('click', async () => {
        const name = root.querySelector('#cf-name').value.trim() || 'Custom food';
        const kcal = num(root.querySelector('#cf-kcal').value, 0);
        const grams = num(root.querySelector('#cf-g').value, 100);
        if (kcal <= 0) { toast('Enter calories', 'err'); return; }
        await addMeal({
          id: uid(), date: viewDate, ts: Date.now(), name, grams: Math.round(grams),
          kcal: Math.round(kcal),
          protein: num(root.querySelector('#cf-p').value, 0),
          carbs: num(root.querySelector('#cf-c').value, 0),
          fat: num(root.querySelector('#cf-f').value, 0),
          source: 'manual', photo: null,
        });
        closeSheet(); toast('Logged ' + name, 'ok'); ctx.rerender();
      });
    },
  });
}
