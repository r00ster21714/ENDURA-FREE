import {
  state, activeSession, saveSession, saveSettings, removeSession, sessionsFor, sessionsFor as allFor,
  today, addDays, prettyDate, clock, esc, icon, num, uid, fmtW, kgToDisplay, displayToKg, weightLabel,
  e1rm, round1, platesPerSide, openSheet, closeSheet, toast, confirmSheet, sessionVolume, sessionSets,
  hhmm, bar,
} from './core.js';
import { pageHead, emptyState, acts } from './common.js';
import { EXERCISES, GROUPS, searchExercises, exerciseById } from './data.js';
import { startRest, stopRest } from './rest.js';
import { lineChart } from './charts.js';

let clockTimer = null;
let saveTimer = null;

const newSet = (weight = 0, reps = 0) => ({ weight, reps, done: false, ts: 0 });

export function render(ctx) {
  clearInterval(clockTimer);
  const active = activeSession();
  return active ? renderActive(ctx, active) : renderIdle(ctx);
}

/* ---------------- idle ---------------- */

function renderIdle(ctx) {
  const history = state.sessions
    .filter((s) => s.status !== 'active')
    .sort((a, b) => (b.endedAt || b.startedAt) - (a.endedAt || a.startedAt));
  const last = history[0];

  const root = document.createElement('div');
  root.innerHTML = `
    ${pageHead({ eyebrow: 'Training', title: 'Workout' })}

    <section class="card card--accent">
      <div class="label" style="color:var(--accent)">Ready when you are</div>
      <h2 style="margin-top:4px;font-size:19px">Start a session</h2>
      <p class="tiny muted" style="margin-top:4px">Sets, rest timers and personal bests — all stored on this device.</p>
      <div class="row" style="margin-top:14px;gap:8px">
        <button class="btn btn--primary grow" data-act="start">${icon('plus')}Empty workout</button>
        ${last ? `<button class="btn" data-act="repeat">Repeat last</button>` : ''}
      </div>
    </section>

    <div class="stats" style="margin-top:12px">
      <div class="stat"><div class="stat__v">${history.length}</div><div class="stat__l">Sessions</div></div>
      <div class="stat"><div class="stat__v">${history.reduce((a, s) => a + sessionSets(s), 0)}</div><div class="stat__l">Sets</div></div>
      <div class="stat"><div class="stat__v">${Math.round(history.reduce((a, s) => a + sessionVolume(s), 0) / 1000)}k</div><div class="stat__l">Volume kg</div></div>
    </div>

    <div style="margin-top:18px">
      <div class="label" style="padding:0 2px 8px">History</div>
      ${history.length ? `<div class="list">
        ${history.slice(0, 20).map((s) => `
          <button class="listrow listrow--btn" data-session="${s.id}">
            <div class="listrow__main">
              <div class="listrow__t">${esc(s.name || 'Workout')}</div>
              <div class="listrow__s">${prettyDate(s.date)} · ${sessionSets(s)} sets · ${clock((s.endedAt || s.startedAt) - s.startedAt)}</div>
            </div>
            <div class="listrow__end">${Math.round(sessionVolume(s))}<small>kg vol</small></div>
            ${icon('chevron')}
          </button>`).join('')}
      </div>` : `<div class="card">${emptyState('dumbbell', 'No sessions yet. Your first one starts above.')}</div>`}
    </div>
  `;

  acts(root, {
    start: () => startSession(ctx),
    repeat: () => repeatLast(ctx),
  });
  root.querySelectorAll('[data-session]').forEach((b) => b.addEventListener('click', () => {
    const s = state.sessions.find((x) => x.id === b.dataset.session);
    if (s) openSessionDetail(ctx, s);
  }));

  return root;
}

async function startSession(ctx, seed = null) {
  const s = {
    id: uid(), date: today(), name: seed?.name || 'Workout',
    startedAt: Date.now(), endedAt: 0, status: 'active', notes: '',
    exercises: seed ? seed.exercises.map((ex) => ({
      id: ex.id, name: ex.name, group: ex.group, rest: ex.rest, unit: ex.unit,
      sets: ex.sets.map((st) => ({ ...st, done: false, ts: 0 })),
    })) : [],
  };
  await saveSession(s, { silent: true });
  ctx.rerender();
}

async function repeatLast(ctx) {
  const last = state.sessions.filter((s) => s.status !== 'active').sort((a, b) => b.startedAt - a.startedAt)[0];
  if (!last) return;
  await startSession(ctx, last);
  toast('Repeating ' + (last.name || 'last session'), 'ok');
}

/* ---------------- active ---------------- */

function renderActive(ctx, session) {
  const s = state.settings;
  const units = s.units;

  const root = document.createElement('div');
  const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = sessionSets(session);

  root.innerHTML = `
    <div class="pagehead">
      <div>
        <div class="pagehead__date">In progress</div>
        <h1 id="sess-timer" class="mono">${clock(Date.now() - session.startedAt)}</h1>
      </div>
      <div class="pagehead__act">
        <button class="btn btn--sm" data-act="finish">Finish</button>
        <button class="btn btn--icon" data-act="end-options" aria-label="More">${icon('gear')}</button>
      </div>
    </div>

    <div class="row" style="justify-content:space-between;padding:0 2px 10px">
      <button class="btn btn--bare" data-act="rename" style="font-size:14px;font-weight:650;color:var(--txt)">
        ${esc(session.name || 'Workout')} ${icon('chevron')}
      </button>
      <span class="tiny muted" id="sess-count">${doneSets}/${totalSets} sets</span>
    </div>

    <div id="exlist" class="stack">
      ${session.exercises.map((ex, i) => exerciseCard(ex, i, units)).join('')}
    </div>

    <button class="btn btn--block" style="margin-top:12px" data-act="add-ex">${icon('plus')}Add exercise</button>

    ${session.notes ? `<div class="card card--tight" style="margin-top:12px"><div class="label">Notes</div><div class="tiny" style="margin-top:4px">${esc(session.notes)}</div></div>` : ''}
  `;

  clearInterval(clockTimer);
  clockTimer = setInterval(() => {
    const t = root.querySelector('#sess-timer');
    if (!t) { clearInterval(clockTimer); return; }
    t.textContent = clock(Date.now() - session.startedAt);
  }, 1000);

  /* set inputs */
  root.querySelectorAll('[data-w]').forEach((inp) => {
    inp.addEventListener('input', () => {
      const ex = session.exercises[Number(inp.dataset.ex)];
      const st = ex.sets[Number(inp.dataset.si)];
      st.weight = displayToKg(num(inp.value, 0), units);
      persist(session);
      updatePlates(root, session, Number(inp.dataset.ex), units);
    });
  });
  root.querySelectorAll('[data-r]').forEach((inp) => {
    inp.addEventListener('input', () => {
      const ex = session.exercises[Number(inp.dataset.ex)];
      const st = ex.sets[Number(inp.dataset.si)];
      st.reps = num(inp.value, 0);
      persist(session);
    });
  });

  root.querySelectorAll('[data-done]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ei = Number(btn.dataset.ex);
      const si = Number(btn.dataset.si);
      const ex = session.exercises[ei];
      const st = ex.sets[si];
      st.done = !st.done;
      st.ts = st.done ? Date.now() : 0;
      btn.dataset.done = String(st.done);
      btn.closest('.setrow').classList.toggle('done', st.done);

      const count = root.querySelector('#sess-count');
      if (count) count.textContent = `${sessionSets(session)}/${session.exercises.reduce((a, e) => a + e.sets.length, 0)} sets`;

      if (st.done) {
        startRest(ex.rest || s.restDefault, {
          label: 'Rest',
          next: `${ex.name} · set ${si + 2}`,
        });
        if (si === ex.sets.length - 1) {
          ex.sets.push(newSet(st.weight, st.reps));
          await saveSession(session, { silent: true });
          ctx.rerender();
          return;
        }
      } else {
        stopRest();
      }
      await saveSession(session, { silent: true });
    });
  });

  root.querySelectorAll('[data-del-ex]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const i = Number(btn.dataset.delEx);
      const ex = session.exercises[i];
      const ok = await confirmSheet({ title: 'Remove exercise?', message: ex.name + ' and its sets will be discarded.', ok: 'Remove', danger: true });
      if (!ok) return;
      session.exercises.splice(i, 1);
      await saveSession(session, { silent: true });
      ctx.rerender();
    });
  });

  root.querySelectorAll('[data-add-set]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ex = session.exercises[Number(btn.dataset.addSet)];
      const last = ex.sets[ex.sets.length - 1];
      ex.sets.push(newSet(last?.weight || 0, last?.reps || 0));
      await saveSession(session, { silent: true });
      ctx.rerender();
    });
  });

  acts(root, {
    finish: () => finishSession(ctx, session),
    'end-options': () => openSessionOptions(ctx, session),
    rename: () => openRename(ctx, session),
    'add-ex': () => openExercisePicker(ctx, session),
  });

  return root;
}

function exerciseCard(ex, index, units) {
  const isTime = ex.unit === 'time';
  const lastDone = [...ex.sets].reverse().find((s) => s.done);
  const best = ex.sets.reduce((b, s) => (s.done && s.weight > b ? s.weight : b), 0);

  return `<section class="excard" data-ex="${index}">
    <div class="excard__head">
      <div class="grow" style="min-width:0">
        <div class="excard__name">${esc(ex.name)}</div>
        <div class="excard__sub">${esc(ex.group || '')}${lastDone ? ' · last ' + Math.round(fmtW(lastDone.weight, units)) + weightLabel(units) + ' × ' + lastDone.reps : ''}</div>
      </div>
      <button class="btn btn--bare" data-add-set="${index}" aria-label="Add set">${icon('plus')}</button>
      <button class="btn btn--bare" data-del-ex="${index}" aria-label="Remove exercise">${icon('trash')}</button>
    </div>
    <div class="sets">
      <div class="sethead"><span>#</span><span>${isTime ? 'load' : weightLabel(units)}</span><span>${isTime ? 'sec' : 'reps'}</span><span></span></div>
      ${ex.sets.map((st, si) => `
        <div class="setrow ${st.done ? 'done' : ''}">
          <span class="setrow__n">${si + 1}</span>
          <input class="input input--num" inputmode="decimal" data-ex="${index}" data-si="${si}" data-w
            value="${st.weight ? Math.round(fmtW(st.weight, units) * 10) / 10 : ''}" placeholder="—" aria-label="Weight">
          <input class="input input--num" inputmode="decimal" data-ex="${index}" data-si="${si}" data-r
            value="${st.reps || ''}" placeholder="—" aria-label="${isTime ? 'Seconds' : 'Reps'}">
          <button class="setcheck" data-ex="${index}" data-si="${si}" data-done="${st.done}" aria-label="Mark set done">${icon('check')}</button>
        </div>`).join('')}
    </div>
    ${best ? `<div class="plates">Best set ${Math.round(fmtW(best, units))} ${weightLabel(units)} · est. 1RM ${Math.round(fmtW(Math.max(...ex.sets.filter((x) => x.done).map((x) => e1rm(x.weight, x.reps))), units))} ${weightLabel(units)}</div>` : ''}
  </section>`;
}

function updatePlates(root, session, exIndex, units) {
  const ex = session.exercises[exIndex];
  const card = root.querySelector(`.excard[data-ex="${exIndex}"]`);
  if (!card) return;
  const last = [...ex.sets].reverse().find((s) => s.done);
  if (!last || !last.weight) return;
  const plates = platesPerSide(last.weight, state.settings.barKg, units);
  if (!plates.length) return;
  let node = card.querySelector('.plates');
  if (!node) { node = document.createElement('div'); node.className = 'plates'; card.appendChild(node); }
  node.textContent = 'Per side: ' + plates.map((p) => Math.round(kgToDisplay(p, units) * 10) / 10).join(' + ');
}

function persist(session) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveSession(session, { silent: true }).catch(() => {}), 400);
}

/* ---------------- sheets ---------------- */

function openRename(ctx, session) {
  openSheet(`
    <div class="sheet__head"><div class="sheet__title">Session details</div><button class="btn btn--bare" data-close>${icon('x')}</button></div>
    <div class="sheet__body">
      <label class="field"><span class="field__l">Name</span><input class="input" id="rn-name" value="${esc(session.name)}"></label>
      <label class="field"><span class="field__l">Notes</span><textarea class="input" id="rn-notes" placeholder="How did it feel?">${esc(session.notes || '')}</textarea></label>
    </div>
    <div class="sheet__foot"><button class="btn" data-close>Cancel</button><button class="btn btn--primary" data-save>Save</button></div>
  `, {
    onMount(root) {
      root.querySelector('[data-save]').addEventListener('click', async () => {
        session.name = root.querySelector('#rn-name').value.trim() || 'Workout';
        session.notes = root.querySelector('#rn-notes').value.trim();
        await saveSession(session, { silent: true });
        closeSheet();
        ctx.rerender();
      });
    },
  });
}

async function finishSession(ctx, session) {
  const done = sessionSets(session);
  if (!done) {
    const ok = await confirmSheet({ title: 'Finish with no sets?', message: 'Nothing was marked done. The session will be discarded.', ok: 'Discard', danger: true });
    if (ok) { await removeSession(session.id); closeSheet(); ctx.rerender(); }
    return;
  }
  session.status = 'done';
  session.endedAt = Date.now();
  await saveSession(session, { silent: true });
  stopRest();
  ctx.rerender();
  toast('Session saved · ' + done + ' sets', 'ok');
}

function openSessionOptions(ctx, session) {
  openSheet(`
    <div class="sheet__head"><div class="sheet__title">Session</div><button class="btn btn--bare" data-close>${icon('x')}</button></div>
    <div class="sheet__body">
      <div class="list">
        <button class="listrow listrow--btn" data-opt="notes"><div class="listrow__main"><div class="listrow__t">Name &amp; notes</div></div>${icon('chevron')}</button>
        <button class="listrow listrow--btn" data-opt="rest"><div class="listrow__main"><div class="listrow__t">Default rest timer</div><div class="listrow__s">${state.settings.restDefault}s</div></div>${icon('chevron')}</button>
        <button class="listrow listrow--btn" data-opt="discard"><div class="listrow__main"><div class="listrow__t" style="color:var(--danger)">Discard workout</div><div class="listrow__s">Deletes everything logged in this session</div></div>${icon('trash')}</button>
      </div>
    </div>
  `, {
    onMount(root) {
      root.querySelector('[data-opt="notes"]').addEventListener('click', () => { closeSheet(); openRename(ctx, session); });
      root.querySelector('[data-opt="rest"]').addEventListener('click', () => {
        closeSheet();
        openSheet(`
          <div class="sheet__head"><div class="sheet__title">Rest timer</div><button class="btn btn--bare" data-close>${icon('x')}</button></div>
          <div class="sheet__body">
            <div class="seg" id="rest-seg">${[45, 60, 90, 120, 180].map((v) => `<button data-v="${v}" aria-pressed="${state.settings.restDefault === v}">${v}s</button>`).join('')}</div>
            <div class="hint">Applies to new exercises. Each exercise keeps its own default.</div>
          </div>` , {
          onMount(r2) {
            r2.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', async () => {
              await saveSettings({ restDefault: Number(b.dataset.v) });
              toast('Default rest ' + b.dataset.v + 's', 'ok');
              closeSheet();
            }));
          },
        });
      });
      root.querySelector('[data-opt="discard"]').addEventListener('click', async () => {
        closeSheet();
        const ok = await confirmSheet({ title: 'Discard workout?', message: 'All sets from this session will be lost.', ok: 'Discard', danger: true });
        if (!ok) return;
        await removeSession(session.id);
        stopRest();
        ctx.rerender();
      });
    },
  });
}

function openExercisePicker(ctx, session) {
  openSheet(`
    <div class="sheet__head"><div class="sheet__title">Add exercise</div><button class="btn btn--bare" data-close>${icon('x')}</button></div>
    <div class="sheet__body">
      <input class="input" id="ex-q" placeholder="Search exercises…" autocomplete="off">
      <div class="scroll-x" id="ex-groups">
        <button class="pill" data-g="" aria-pressed="true">All</button>
        ${GROUPS.map((g) => `<button class="pill" data-g="${g}" aria-pressed="false">${g}</button>`).join('')}
      </div>
      <div id="ex-results" class="list" style="max-height:52dvh;overflow:auto"></div>
    </div>
  `, {
    onMount(root) {
      const results = root.querySelector('#ex-results');
      const q = root.querySelector('#ex-q');
      let group = '';

      const draw = () => {
        const list = searchExercises(q.value).filter((e) => !group || e.group === group);
        results.innerHTML = list.length ? list.map((e) => `
          <button class="listrow listrow--btn" data-ex-id="${e.id}">
            <div class="listrow__main">
              <div class="listrow__t">${esc(e.name)}</div>
              <div class="listrow__s">${e.group} · ${e.gear} · ${e.rest}s rest</div>
            </div>
            ${icon('plus')}
          </button>`).join('') : `<div class="empty" style="padding:20px">${icon('search')}<p>Nothing matches.</p></div>`;
        results.querySelectorAll('[data-ex-id]').forEach((b) => b.addEventListener('click', async () => {
          const e = EXERCISES.find((x) => x.id === b.dataset.exId) || exerciseById(b.dataset.exId);
          await addExercise(session, e);
          closeSheet();
          ctx.rerender();
        }));
      };

      q.addEventListener('input', draw);
      root.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => {
        group = b.dataset.g;
        root.querySelectorAll('[data-g]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        draw();
      }));
      draw();
      q.focus({ preventScroll: true });
    },
  });
}

async function addExercise(session, e) {
  const prev = lastPerformance(e.name);
  const setCount = prev ? Math.max(1, prev.sets.length) : 3;
  session.exercises.push({
    id: e.id, name: e.name, group: e.group, rest: e.rest, unit: e.unit,
    sets: Array.from({ length: setCount }, () => newSet(prev?.sets[0]?.weight || 0, prev?.sets[0]?.reps || 0)),
  });
  await saveSession(session, { silent: true });
}

function lastPerformance(name) {
  const sessions = state.sessions.filter((s) => s.status !== 'active').sort((a, b) => b.startedAt - a.startedAt);
  for (const s of sessions) {
    const ex = s.exercises.find((x) => x.name === name);
    if (ex && ex.sets.some((st) => st.done)) {
      return { sets: ex.sets.filter((st) => st.done) };
    }
  }
  return null;
}

/* ---------------- history detail ---------------- */

function openSessionDetail(ctx, session) {
  const units = state.settings.units;
  openSheet(`
    <div class="sheet__head">
      <div><div class="sheet__title">${esc(session.name || 'Workout')}</div>
      <div class="tiny muted">${prettyDate(session.date)} · ${clock((session.endedAt || session.startedAt) - session.startedAt)}</div></div>
      <button class="btn btn--bare" data-close>${icon('x')}</button>
    </div>
    <div class="sheet__body">
      ${session.exercises.map((ex) => {
        const done = ex.sets.filter((st) => st.done);
        const vol = done.reduce((a, st) => a + st.weight * st.reps, 0);
        return `<div class="card card--tight">
          <div class="spread">
            <div>
              <div style="font-weight:650;font-size:14px">${esc(ex.name)}</div>
              <div class="tiny muted">${done.length} sets · ${Math.round(vol)} kg volume</div>
            </div>
            <button class="btn btn--sm btn--ghost" data-progress="${esc(ex.name)}">Progress</button>
          </div>
          <div class="tiny mono" style="margin-top:6px;color:var(--muted);line-height:1.6">
            ${done.map((st) => `${Math.round(fmtW(st.weight, units))}${weightLabel(units)} × ${st.reps}`).join('   ·   ')}
          </div>
        </div>`;
      }).join('') || `<div class="tiny muted">No exercises recorded.</div>`}
      ${session.notes ? `<div class="card card--tight"><div class="label">Notes</div><div class="tiny" style="margin-top:4px">${esc(session.notes)}</div></div>` : ''}
    </div>
    <div class="sheet__foot">
      <button class="btn btn--danger" data-del>${icon('trash')}Delete session</button>
      <button class="btn" data-close>Close</button>
    </div>
  `, {
    onMount(root) {
      root.querySelectorAll('[data-progress]').forEach((b) => b.addEventListener('click', () => openProgress(b.dataset.progress)));
      root.querySelector('[data-del]').addEventListener('click', async () => {
        const ok = await confirmSheet({ title: 'Delete session?', message: 'This cannot be undone.', ok: 'Delete', danger: true });
        if (!ok) return;
        await removeSession(session.id);
        toast('Session deleted');
        ctx.rerender();
      });
    },
  });
}

export function openProgress(name) {
  const units = state.settings.units;
  const points = [];
  for (const s of state.sessions.filter((x) => x.status !== 'active').sort((a, b) => a.startedAt - b.startedAt)) {
    const ex = s.exercises.find((x) => x.name === name);
    if (!ex) continue;
    const done = ex.sets.filter((st) => st.done && st.reps > 0);
    if (!done.length) continue;
    const best = Math.max(...done.map((st) => e1rm(st.weight, st.reps)));
    if (best <= 0) continue;
    points.push({ x: s.date, y: Math.round(fmtW(best, units) * 10) / 10, label: prettyDate(s.date) });
  }

  openSheet(`
    <div class="sheet__head">
      <div><div class="sheet__title">${esc(name)}</div><div class="tiny muted">Estimated 1RM over time · ${weightLabel(units)}</div></div>
      <button class="btn btn--bare" data-close>${icon('x')}</button>
    </div>
    <div class="sheet__body">
      <div class="card">
        <div class="chartbox" style="height:170px"><canvas id="prog-chart"></canvas></div>
        <div class="chart-legend"><span>${points.length} sessions</span><span>${points.length ? 'best ' + Math.max(...points.map((p) => p.y)).toFixed(1) + ' ' + weightLabel(units) : ''}</span></div>
      </div>
      ${points.length < 2 ? `<div class="hint">Log this lift in at least two sessions to see a trend.</div>` : ''}
    </div>
  `, {
    onMount(root) {
      lineChart(root.querySelector('#prog-chart'), {
        points, height: 170, color: '#5EEAD4',
        format: (v) => v.toFixed(1) + ' ' + weightLabel(units),
      });
    },
  });
}
