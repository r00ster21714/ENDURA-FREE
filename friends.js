/* ENDURA friends — usernames, requests, and the friend list.
 * All of it lives on the Supabase project; local training data never leaves
 * the device.
 */
import {
  esc, icon, toast, openSheet, closeSheet, confirmSheet, prettyDate,
  round1, kgToDisplay, cmToDisplay, weightLabel, lengthLabel,
} from './core.js';
import { pageHead, switchRow } from './common.js';
import {
  auth, friendsOverview, searchUsers, sendRequest, acceptRequest, dropFriendship, setCloseFriend,
} from './auth.js';
import { fetchWeek } from './sharing.js';

/* ------------------------------------------------------------ friend sheet */

function openFriendSheet(p, onChange) {
  openSheet(`
    <div class="sheet__head">
      <div class="sheet__title">@${esc(p.username)}</div>
      <button class="btn btn--bare" data-close aria-label="Close">${icon('x')}</button>
    </div>
    <div class="sheet__body">
      ${switchRow({
        label: 'Close friend',
        sub: 'Sees the week you share in You → Close friends',
        on: !!p.close,
        attr: 'data-close-friend',
      })}
      <div class="hint" style="margin-top:8px;line-height:1.45">It works both ways: mark them and you are close friends. They still only see the sections you switched on, and you see theirs only if they share.</div>
      <button class="btn btn--sm btn--block" style="margin-top:14px" data-week>See their week</button>
      <button class="btn btn--sm btn--ghost btn--block" style="margin-top:8px;color:var(--danger)" data-remove>Remove friend</button>
    </div>
  `, {
    onMount(root) {
      const sw = root.querySelector('[data-close-friend]');
      sw.addEventListener('click', async () => {
        const on = sw.getAttribute('aria-checked') !== 'true';
        sw.setAttribute('aria-checked', String(on));
        sw.disabled = true;
        const res = await setCloseFriend(p.id, on);
        sw.disabled = false;
        if (res.error) {
          sw.setAttribute('aria-checked', String(!on));
          toast(res.error, 'err');
          return;
        }
        p.close = on;
        toast(on ? '@' + p.username + ' is a close friend' : '@' + p.username + ' is no longer close', 'ok');
        onChange();
      });

      root.querySelector('[data-week]').addEventListener('click', () => openWeekSheet(p));
      root.querySelector('[data-remove]').addEventListener('click', async () => {
        const ok = await confirmSheet({
          title: 'Remove @' + p.username + '?',
          message: 'You will both disappear from each other\'s friend list, and their shared week with you stops.',
          ok: 'Remove',
          danger: true,
        });
        if (!ok) return;
        const res = await dropFriendship(p.id);
        if (res.error) { toast(res.error, 'err'); return; }
        closeSheet();
        toast('Removed @' + p.username);
        onChange();
      });
    },
  });
}

/* -------------------------------------------------------------- week sheet */

const MAX_MEALS = 12;

function openWeekSheet(p) {
  openSheet(`
    <div class="sheet__head">
      <div class="sheet__title">@${esc(p.username)}</div>
      <button class="btn btn--bare" data-close aria-label="Close">${icon('x')}</button>
    </div>
    <div class="sheet__body"><div class="row" style="justify-content:center;gap:10px;padding:18px 0"><span class="spinner"></span><span class="tiny muted">Loading…</span></div></div>
  `);

  fetchWeek(p.id).then((res) => {
    const body = document.querySelector('.sheet__body');
    if (!body) return;

    if (res.error) {
      body.innerHTML = `<div class="hint" style="color:var(--danger)">${esc(res.error)}</div>`;
      return;
    }

    const week = res.week;
    const d = week && week.payload ? week.payload : null;
    const units = d && d.units === 'imperial' ? 'imperial' : 'metric';
    if (!d || (!d.macros && !d.meals && !d.workouts && !d.body)) {      body.innerHTML = `
        <div class="hint" style="line-height:1.5">Nothing shared ${week ? 'this week' : 'yet'}.</div>
        <div class="hint" style="margin-top:6px;line-height:1.45">Either they keep sharing off, or they have not opened the app since turning it on.</div>`;
      return;
    }

    const bits = [];

    if (d.macros) {
      bits.push(`
        <div class="label">The week</div>
        <div class="stats" style="margin-top:6px">
          <div class="stat"><div class="stat__v">${Math.round(d.macros.kcal)}</div><div class="stat__l">kcal / day</div></div>
          <div class="stat"><div class="stat__v">${d.macros.days}/7</div><div class="stat__l">days logged</div></div>
        </div>
        <div class="row tiny mono" style="gap:12px;margin-top:8px;color:var(--muted)">
          <span>${d.macros.protein} P</span><span>${d.macros.carbs} C</span><span>${d.macros.fat} F</span>
        </div>`);
    }

    if (d.meals && d.meals.length) {
      const shown = d.meals.slice().reverse().slice(0, MAX_MEALS);
      bits.push(`
        <div class="label" style="margin-top:16px">What they ate</div>
        ${shown.map((m) => `
          <div class="listrow" style="padding-left:0;padding-right:0">
            <div class="listrow__main">
              <div class="listrow__t">${esc(m.n)}</div>
              <div class="listrow__s">${esc(prettyDate(m.d))}${m.g ? ' · ' + m.g + ' g' : ''}</div>
            </div>
            <span class="tiny mono">${m.k} kcal</span>
          </div>`).join('')}
        ${d.meals.length > MAX_MEALS ? `<div class="tiny muted" style="margin-top:6px">and ${d.meals.length - MAX_MEALS} more</div>` : ''}`);
    }

    if (d.workouts) {
      bits.push(`
        <div class="label" style="margin-top:16px">Training</div>
        <div class="row tiny" style="gap:12px;margin-top:6px;color:var(--muted)">
          <span>${d.workouts.count} ${d.workouts.count === 1 ? 'session' : 'sessions'}</span>
          <span>${Math.floor(d.workouts.minutes / 60)}h ${d.workouts.minutes % 60}m</span>
          <span>${Math.round(kgToDisplay(d.workouts.volume, units)).toLocaleString()} ${weightLabel(units)} volume</span>
        </div>
        ${(d.workouts.list || []).slice(-8).map((s) => `
          <div class="listrow" style="padding-left:0;padding-right:0">
            <div class="listrow__main">
              <div class="listrow__t">${esc(s.n)}</div>
              <div class="listrow__s">${esc(prettyDate(s.d))} · ${s.sets} sets${s.m ? ' · ' + s.m + ' min' : ''}</div>
            </div>
          </div>`).join('')}`);
    }

    if (d.body) {
      const delta = d.body.deltaKg;
      bits.push(`
        <div class="label" style="margin-top:16px">Body</div>
        <div class="row" style="gap:10px;margin-top:6px;align-items:baseline">
          <span class="mono" style="font-size:22px;font-weight:750">${round1(kgToDisplay(d.body.weightKg, units))} ${weightLabel(units)}</span>
          ${delta !== null && delta !== undefined ? `<span class="tiny" style="color:${delta > 0 ? 'var(--warn)' : 'var(--accent)'}">${delta > 0 ? '+' : ''}${round1(kgToDisplay(delta, units))} ${weightLabel(units)} this week</span>` : ''}
        </div>
        ${d.body.bodyFat ? `<div class="tiny muted" style="margin-top:2px">${d.body.bodyFat}% body fat${d.body.waist ? ' · waist ' + round1(cmToDisplay(d.body.waist, units)) + ' ' + lengthLabel(units) : ''}</div>` : ''}`);
    }

    body.innerHTML = `
      <div class="tiny muted" style="margin-bottom:10px">${esc(prettyDate(d.from))} – ${esc(prettyDate(d.to))}</div>
      ${bits.join('')}
      <div class="hint" style="margin-top:14px">Shared by them, section by section. Anything switched off is not uploaded at all.</div>`;
  });
}

export function render(ctx) {
  const root = document.createElement('div');

  if (!auth.configured) {
    root.innerHTML = `
      ${pageHead({ eyebrow: 'Social', title: 'Friends' })}
      <section class="card">
        <div class="card__head"><h2>Accounts are off</h2><span class="badge badge--muted">not set up</span></div>
        <div class="hint">Friends need an account so names can be searched. Connect a free Supabase project and this tab comes alive.</div>
        <button class="btn btn--sm btn--primary" style="margin-top:10px" data-go>Set up in You</button>
      </section>`;
    root.querySelector('[data-go]').addEventListener('click', () => ctx.navigate('#/settings'));
    return root;
  }

  if (!auth.session) {
    root.innerHTML = `
      ${pageHead({ eyebrow: 'Social', title: 'Friends' })}
      <section class="card">
        <div class="card__head"><h2>Sign in first</h2><span class="badge badge--muted">signed out</span></div>
        <div class="hint">Friends are tied to your account, so sign in to search usernames and send requests.</div>
        <button class="btn btn--sm btn--primary" style="margin-top:10px" data-go>Go to You</button>
      </section>`;
    root.querySelector('[data-go]').addEventListener('click', () => ctx.navigate('#/settings'));
    return root;
  }

  const me = auth.profile || {};
  root.innerHTML = `
    ${pageHead({ eyebrow: 'Social', title: 'Friends' })}

    <section class="card">
      <div class="spread">
        <div style="min-width:0">
          <div class="label">Your username</div>
          <div style="font-weight:750;font-size:19px;overflow:hidden;text-overflow:ellipsis">@${esc(me.username || '…')}</div>
          <div class="tiny muted" style="margin-top:2px">Friends search for exactly this.</div>
        </div>
        <button class="btn btn--sm btn--ghost" data-copy>Copy</button>
      </div>
    </section>

    <section class="card" style="margin-top:12px">
      <div class="label" style="margin-bottom:8px">Add by username</div>
      <div class="row" style="gap:8px">
        <input class="input grow" id="friend-q" placeholder="Search username…" autocapitalize="off" autocomplete="off" spellcheck="false">
        <button class="btn btn--icon" data-search aria-label="Search">${icon('search')}</button>
      </div>
      <div id="friend-results" style="margin-top:10px"></div>
    </section>

    <section class="card hidden" id="requests-card" style="margin-top:12px">
      <div class="card__head"><h2>Requests</h2><span class="badge" id="req-count">0</span></div>
      <div id="request-list"></div>
    </section>

    <section class="card" style="margin-top:12px">
      <div class="card__head"><h2>Your friends</h2><span class="badge badge--muted" id="friend-count">0</span></div>
      <div id="friend-list"><div class="hint" style="padding:6px 0">Loading…</div></div>
    </section>

    <div class="hint" style="margin-top:10px">Your username, friend list and — only if you switch it on — a summary of your last 7 days are stored online. Marking someone a close friend is what lets them read that summary. Workouts, meals, measurements and photos stay on this phone otherwise.</div>
  `;

  const results = root.querySelector('#friend-results');
  const list = root.querySelector('#friend-list');
  const reqCard = root.querySelector('#requests-card');
  const reqList = root.querySelector('#request-list');
  const countEl = root.querySelector('#friend-count');
  const reqCount = root.querySelector('#req-count');
  const q = root.querySelector('#friend-q');

  const person = (p, sub) => `
    <div class="listrow" style="padding-left:0;padding-right:0">
      <div class="listrow__main">
        <div class="listrow__t">@${esc(p.username)}</div>
        <div class="listrow__s">${esc(sub || (p.display_name || 'ENDURA user'))}</div>
      </div>
      <div class="listrow__end" data-slot="${esc(p.id)}"></div>
    </div>`;

  const paintOverview = (data) => {
    if (data.error) {
      list.innerHTML = `<div class="hint" style="color:var(--danger)">${esc(data.error)}</div>`;
      return;
    }
    countEl.textContent = String(data.friends.length);
    reqCount.textContent = String(data.incoming.length);
    reqCard.classList.toggle('hidden', data.incoming.length === 0);

    reqList.innerHTML = data.incoming.length
      ? data.incoming.map((p) => person(p, 'wants to add you')).join('')
      : '';
    data.incoming.forEach((p) => {
      const slot = reqList.querySelector(`[data-slot="${p.id}"]`);
      if (!slot) return;
      slot.innerHTML = '<button class="btn btn--sm btn--primary" data-accept>Accept</button>';
      slot.querySelector('[data-accept]').addEventListener('click', async () => {
        const res = await acceptRequest(p.id);
        if (res.error) { toast(res.error, 'err'); return; }
        toast('@' + p.username + ' added', 'ok');
        await load();
      });
    });

    list.innerHTML = data.friends.length
      ? data.friends.map((p) => `
        <button class="listrow listrow--btn" data-open="${esc(p.id)}" style="width:100%;padding-left:0;padding-right:0;text-align:left">
          <div class="listrow__main">
            <div class="listrow__t">@${esc(p.username)}${p.close ? ' <span class="badge badge--lime">close</span>' : ''}</div>
            <div class="listrow__s">${p.close ? 'Close friend · sees what you share' : 'Tap to mark close or see their week'}</div>
          </div>
          ${icon('chevron')}
        </button>`).join('')
      : '<div class="hint" style="padding:6px 0">No friends yet. Search a username above.</div>';

    data.friends.forEach((p) => {
      const row = list.querySelector(`[data-open="${p.id}"]`);
      if (!row) return;
      row.addEventListener('click', () => openFriendSheet(p, load));
    });
  };

  const load = async () => paintOverview(await friendsOverview());

  const paintResults = (data, query) => {
    if (data.error) { results.innerHTML = `<div class="hint" style="color:var(--danger)">${esc(data.error)}</div>`; return; }
    if (!data.users.length) {
      results.innerHTML = `<div class="hint">No username starts with “${esc(query)}”. Usernames are exact — try the start of it.</div>`;
      return;
    }
    results.innerHTML = data.users.map((u) => person(u, u.relation === 'friends' ? 'already friends'
      : u.relation === 'sent' ? 'request sent'
      : u.relation === 'incoming' ? 'wants to add you'
      : 'ENDURA user')).join('');

    data.users.forEach((u) => {
      const slot = results.querySelector(`[data-slot="${u.id}"]`);
      if (!slot) return;
      if (u.relation === 'friends') { slot.innerHTML = `<span class="badge badge--lime">friends</span>`; return; }
      if (u.relation === 'sent') { slot.innerHTML = `<span class="badge badge--muted">pending</span>`; return; }
      if (u.relation === 'incoming') {
        slot.innerHTML = '<button class="btn btn--sm btn--primary" data-accept>Accept</button>';
        slot.querySelector('[data-accept]').addEventListener('click', async () => {
          const res = await acceptRequest(u.id);
          if (res.error) { toast(res.error, 'err'); return; }
          toast('@' + u.username + ' added', 'ok');
          await load();
          runSearch();
        });
        return;
      }
      slot.innerHTML = '<button class="btn btn--sm btn--primary" data-add>Add</button>';
      slot.querySelector('[data-add]').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = 'Sent';
        const res = await sendRequest(u.id);
        if (res.error) { toast(res.error, 'err'); btn.disabled = false; btn.textContent = 'Add'; return; }
        toast('Request sent to @' + u.username, 'ok');
        btn.className = 'badge badge--muted';
        btn.textContent = 'pending';
        await load();
      });
    });
  };

  let timer = 0;
  const runSearch = async () => {
    const query = q.value.trim().toLowerCase();
    if (query.length < 2) {
      results.innerHTML = '<div class="hint">Type at least 2 characters.</div>';
      return;
    }
    results.innerHTML = '<div class="hint">Searching…</div>';
    paintResults(await searchUsers(query), query);
  };

  q.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(runSearch, 260);
  });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(timer); runSearch(); } });
  root.querySelector('[data-search]').addEventListener('click', runSearch);

  root.querySelector('[data-copy]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText('@' + (me.username || '')); toast('Username copied', 'ok'); }
    catch { toast('Copy failed', 'err'); }
  });

  results.innerHTML = '<div class="hint">Type at least 2 characters.</div>';
  load();
  return root;
}
