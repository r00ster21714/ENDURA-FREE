/* shared view fragments */

import { icon, esc, ring, clamp, today, prettyDate, addDays, longDate } from './core.js';

export function pageHead({ eyebrow, title, right = '' }) {
  return `<header class="pagehead">
    <div><div class="pagehead__date">${esc(eyebrow)}</div><h1>${esc(title)}</h1></div>
    ${right ? `<div class="pagehead__act">${right}</div>` : ''}
  </header>`;
}

export function emptyState(iconName, text, action = '') {
  return `<div class="empty">${icon(iconName)}<p>${esc(text)}</p>${action ? `<div style="margin-top:12px">${action}</div>` : ''}</div>`;
}

export function macroCard(totals, targets) {
  const kcalPct = targets.kcal ? totals.kcal / targets.kcal : 0;
  const left = Math.round(targets.kcal - totals.kcal);
  const rows = [
    ['Protein', totals.protein, targets.protein, 'var(--accent)'],
    ['Carbs', totals.carbs, targets.carbs, 'var(--teal)'],
    ['Fat', totals.fat, targets.fat, 'var(--warn)'],
  ];
  return `<section class="card macrocard">
    <div class="ring" style="width:96px;height:96px">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle class="track" cx="48" cy="48" r="43" stroke-width="7"/>
        <circle class="prog" cx="48" cy="48" r="43" stroke-width="7" stroke="var(--accent)"
          stroke-dasharray="${(2 * Math.PI * 43).toFixed(1)}"
          stroke-dashoffset="${(2 * Math.PI * 43 * (1 - clamp(kcalPct, 0, 1))).toFixed(1)}"/>
      </svg>
      <div class="ring__mid">
        <div class="ring__val">${Math.round(totals.kcal)}</div>
        <div class="ring__sub">${left >= 0 ? Math.round(left) + ' left' : Math.abs(Math.round(left)) + ' over'}</div>
      </div>
    </div>
    <div class="mbars">
      ${rows.map(([label, v, target, color]) => `
        <div>
          <div class="mbar__top"><span>${label}</span><span>${Math.round(v)} / ${Math.round(target)} g</span></div>
          <div class="mbar__track"><div class="mbar__fill" style="width:${clamp(target ? v / target : 0, 0, 1) * 100}%;background:${color}"></div></div>
        </div>`).join('')}
    </div>
  </section>`;
}

export function dateNav(date, opts = {}) {
  const isToday = date === today();
  return `<div class="datenav">
    <button class="btn btn--icon" data-act="prev" aria-label="Previous day">${icon('back')}</button>
    <div class="datenav__mid">
      <div class="datenav__d">${prettyDate(date)}</div>
      <div class="datenav__s">${isToday ? 'Today' : longDate(date)}</div>
    </div>
    <button class="btn btn--icon" data-act="next" aria-label="Next day" ${isToday || opts.lockForward ? 'disabled' : ''}>${icon('chevron')}</button>
  </div>`;
}

export function streakStrip(activityFn) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const key = addDays(today(), -i);
    days.push({ key, level: activityFn(key) });
  }
  return `<div class="card card--tight" style="display:flex;align-items:center;gap:10px">
    <div class="grow">
      <div class="label">This week</div>
      <div style="display:flex;gap:5px;margin-top:7px">
        ${days.map((d) => `<span title="${d.key}" style="flex:1;height:6px;border-radius:99px;background:${d.level ? `rgba(184,244,91,${0.25 + d.level * 0.18})` : 'rgba(255,255,255,.07)'}"></span>`).join('')}
      </div>
    </div>
    <div class="tiny muted" style="text-align:right;line-height:1.3">
      <strong style="color:var(--txt);font-size:13px">${days.filter((d) => d.level).length}/7</strong><br>days logged
    </div>
  </div>`;
}

/* One switch row: label, optional sub-label, and a native-button toggle that
 * the caller listens to with [data-key] / aria-checked. */
export function switchRow({ label, sub = '', on, attr = '' }) {
  return `<div class="listrow" style="padding-left:0;padding-right:0">
    <div class="listrow__main">
      <div class="listrow__t">${esc(label)}</div>
      ${sub ? `<div class="listrow__s">${esc(sub)}</div>` : ''}
    </div>
    <button class="switch" role="switch" aria-checked="${on ? 'true' : 'false'}" aria-label="${esc(label)}" ${attr}></button>
  </div>`;
}

export function acts(root, handlers) {
  root.addEventListener('click', (e) => {
    const node = e.target.closest('[data-act]');
    if (!node || !root.contains(node)) return;
    const fn = handlers[node.dataset.act];
    if (fn) { e.preventDefault(); fn(node, e); }
  });
}

export function on(root, selector, type, fn) {
  root.addEventListener(type, (e) => {
    const node = e.target.closest(selector);
    if (node && root.contains(node)) fn(node, e);
  });
}
