/* global rest timer bar */

let endsAt = 0;
let total = 0;
let raf = null;
let hideTimer = null;
let audioCtx = null;
const C = 2 * Math.PI * 19;

const bar = () => document.getElementById('restbar');
const timeEl = () => document.getElementById('rest-time');
const labelEl = () => document.getElementById('rest-label');
const nextEl = () => document.getElementById('rest-next');
const progEl = () => bar()?.querySelector('.prog');

export function isResting() {
  return endsAt > 0 && Date.now() < endsAt;
}

function beep(times = 2) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    for (let i = 0; i < times; i++) {
      const t = audioCtx.currentTime + i * 0.18;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.16);
    }
    if (navigator.vibrate) navigator.vibrate([160, 90, 160]);
  } catch { /* audio unavailable — silent timer */ }
}

function paint() {
  const left = Math.max(0, endsAt - Date.now());
  const pct = total ? left / total : 0;
  if (timeEl()) timeEl().textContent = left > 0 ? fmt(left) : '0:00';
  const p = progEl();
  if (p) p.style.strokeDashoffset = String(C * (1 - pct));
  if (left <= 0) finish();
}

function fmt(ms) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function loop() {
  paint();
  if (endsAt > Date.now()) raf = setTimeout(loop, 250);
}

let onDone = null;

export function startRest(seconds, { label = 'Rest', next = '', done = null } = {}) {
  total = Math.max(5, seconds) * 1000;
  endsAt = Date.now() + total;
  onDone = done;
  const b = bar();
  if (!b) return;
  b.hidden = false;
  labelEl().textContent = label;
  nextEl().textContent = next || 'Recover, then next set';
  if (progEl()) progEl().style.strokeDasharray = String(C);
  clearTimeout(hideTimer);
  clearTimeout(raf);
  loop();
}

export function stopRest() {
  endsAt = 0;
  clearTimeout(raf);
  if (bar()) bar().hidden = true;
  clearTimeout(hideTimer);
}

export function adjustRest(delta) {
  if (!endsAt) return;
  const remaining = Math.max(0, endsAt - Date.now());
  total = Math.max(total, remaining + delta * 1000);
  endsAt = Math.max(Date.now(), endsAt + delta * 1000);
  paint();
}

function finish() {
  clearTimeout(raf);
  if (timeEl()) timeEl().textContent = '0:00';
  if (labelEl()) labelEl().textContent = 'Rest complete';
  if (nextEl()) nextEl().textContent = 'Next set — go';
  beep();
  if (onDone) { try { onDone(); } catch { /* ignore */ } }
  const ended = endsAt;
  endsAt = 0;
  hideTimer = setTimeout(() => { if (bar() && !endsAt) bar().hidden = true; }, 5000);
  return ended;
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-rest]');
  if (!b) return;
  const v = b.dataset.rest;
  if (v === 'skip') stopRest();
  else adjustRest(parseInt(v, 10));
});
