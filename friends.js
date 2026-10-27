/* ENDURA friends — usernames, requests, and the friend list.
 * All of it lives on the Supabase project; local training data never leaves
 * the device.
 */
import { esc, icon, toast } from './core.js';
import { pageHead } from './common.js';
import {
  auth, friendsOverview, searchUsers, sendRequest, acceptRequest, dropFriendship,
} from './auth.js';

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

    <div class="hint" style="margin-top:10px">Only your username and friend list are stored online. Workouts, meals and photos stay on this phone.</div>
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
      ? data.friends.map((p) => person(p)).join('')
      : '<div class="hint" style="padding:6px 0">No friends yet. Search a username above.</div>';

    data.friends.forEach((p) => {
      const slot = list.querySelector(`[data-slot="${p.id}"]`);
      if (!slot) return;
      slot.innerHTML = '<button class="btn btn--sm btn--ghost" data-remove>Remove</button>';
      slot.querySelector('[data-remove]').addEventListener('click', async () => {
        const res = await dropFriendship(p.id);
        if (res.error) { toast(res.error, 'err'); return; }
        toast('Removed @' + p.username);
        await load();
      });
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
