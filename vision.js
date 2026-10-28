/* ENDURA vision: on-device food classification + optional cloud estimation */

import { usesSharedKey } from './cloud-key.js';

const TF_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js';
const MN_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js';

let modelPromise = null;
export const modelState = { status: 'idle', detail: '' };

function loadScript(src, timeout = 45000) {
  return new Promise((resolve, reject) => {
    const existing = [...document.scripts].find((s) => s.src === src);
    if (existing && existing.dataset.loaded === '1') { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.crossOrigin = 'anonymous';
    const to = setTimeout(() => reject(new Error('Timed out loading ' + src)), timeout);
    s.onload = () => { clearTimeout(to); s.dataset.loaded = '1'; resolve(); };
    s.onerror = () => { clearTimeout(to); reject(new Error('Could not load ' + src)); };
    document.head.appendChild(s);
  });
}

/**
 * Loads MobileNet (ImageNet) once. Throws with a readable message when the
 * CDN or the weights are unreachable — callers fall back to manual entry.
 */
export function loadLocalModel(onStatus = () => {}) {
  if (modelPromise) return modelPromise;
  modelPromise = (async () => {
    modelState.status = 'loading';
    onStatus('Starting vision engine…');
    if (!window.tf) await loadScript(TF_URL);
    if (!window.mobilenet) await loadScript(MN_URL);
    onStatus('Getting the scanner ready…');
    const model = await window.mobilenet.load({ version: 2, alpha: 1.0, maxDetections: 5 });
    modelState.status = 'ready';
    modelState.detail = 'MobileNet v2 · on-device';
    onStatus('Ready');
    return model;
  })().catch((err) => {
    modelState.status = 'error';
    modelState.detail = err.message;
    modelPromise = null;
    throw err;
  });
  return modelPromise;
}

/** @returns {Promise<Array<{label:string, score:number}>>} */
export async function classify(canvas, onStatus) {
  const model = await loadLocalModel(onStatus);
  onStatus('Reading the photo…');
  const preds = await model.classify(canvas, 15);
  return preds.map((p) => ({ label: p.className, score: p.probability }));
}

/* ---------------- coarse photo fingerprint ---------------- */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Cheap colour/texture fingerprint of the frame. Not a classifier — 5k pixels
 * of statistics that let `matchVisual` order candidates inside a family
 * (a golden swirled roll and a pale white loaf produce different numbers).
 * @returns {{light:number,sat:number,warm:number,tex:number}|null}
 */
export function imageFeatures(canvas) {
  try {
    const size = 72;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    g.drawImage(canvas, 0, 0, size, size);
    const { data } = g.getImageData(0, 0, size, size);
    const lum = new Float32Array(size * size);
    let sumL = 0;
    let sumS = 0;
    let sumW = 0;
    for (let i = 0; i < size * size; i++) {
      const r = data[i * 4] / 255;
      const gr = data[i * 4 + 1] / 255;
      const b = data[i * 4 + 2] / 255;
      const mx = Math.max(r, gr, b);
      const mn = Math.min(r, gr, b);
      const l = 0.2126 * r + 0.7152 * gr + 0.0722 * b;
      lum[i] = l;
      sumL += l;
      sumS += mx < 0.01 ? 0 : (mx - mn) / mx;
      sumW += r - b;
    }
    const n = size * size;
    let edge = 0;
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const i = y * size + x;
        const gx = lum[i + 1] - lum[i - 1];
        const gy = lum[i + size] - lum[i - size];
        edge += Math.sqrt(gx * gx + gy * gy);
      }
    }
    const edgeMean = edge / ((size - 2) * (size - 2));
    return {
      light: clamp01(sumL / n),
      sat: clamp01(sumS / n),
      warm: clamp01(0.5 + (sumW / n) * 0.9),
      tex: clamp01(edgeMean * 7),
    };
  } catch {
    return null;
  }
}

/**
 * Merge several classification passes (full frame + centre crop). Same label
 * from two passes gets a small agreement bonus, which stabilises the top few.
 */
export function mergePreds(lists) {
  const byLabel = new Map();
  for (const list of lists) {
    for (const p of list) {
      const key = String(p.label || '').toLowerCase();
      if (!key) continue;
      const cur = byLabel.get(key);
      if (!cur) byLabel.set(key, { label: p.label, score: p.score, hits: 1 });
      else {
        cur.hits += 1;
        cur.score = Math.max(cur.score, p.score);
      }
    }
  }
  return [...byLabel.values()]
    .map((p) => ({ label: p.label, score: Math.min(1, p.score + (p.hits - 1) * 0.06) }))
    .sort((a, b) => b.score - a.score);
}

/* ---------------- cloud estimation ---------------- */

const PROMPT = `You are a nutrition analyst reading one photo of food. Work out what is actually on the plate and how much of it the person is about to eat.

Identifying:
- Name each distinct food the way a person would say it: "grilled chicken thigh", "jasmine rice", "garlic naan", "cheeseburger", "blueberry muffin". Never answer with a category like "meat", "pastry" or "food".
- List every component that carries calories: mains, sides, sauces, dressings, drinks, the oil something was fried in.
- Use visible text, packaging, logos and restaurant context when they are legible.
- A mixed plate is several items, not one item called "meal".

Portion (this is the part photos get wrong, so be disciplined):
- A photo with no ruler, hand, cutlery or packaging has no reliable scale. With no reference, use the reference weight below as the serving, never a restaurant platter.
- Reference weights, cooked and as eaten: burger bun 50 g; beef patty 90 g (a quarter-pound patty is 113 g raw); a whole single-patty burger 110-140 g; slice of bread 35 g; bagel 100 g; tortilla 45 g; cooked rice or pasta 150 g (one cupped hand); cereal 40 g per bowl; cooked chicken breast 130 g; steak 170 g; fish fillet 130 g; one egg 50 g; pizza slice 100 g; medium fries 115 g; side salad 80 g; banana 120 g; apple 180 g; avocado half 70 g; dressing 20 g; oil or butter 7 g; ketchup 15 g; slice of cheese 20 g.
- Depart from those numbers only when the frame proves it: a weight printed on packaging, a hand next to the plate, a whole pizza, a sharing dish, or a portion visibly filling the plate. Unproven, the reference weight is the answer.
- If the frame proves a bigger portion, scale it up by the amount the frame shows, not by default.
- When two weights are both plausible, choose the smaller one. People read a photo as bigger than the plate really is, so the generous answer is usually the wrong one.
- Give the cooked weight of the part actually eaten. Exclude bones, shells, garnish and what gets left.
- Count the fat you can see: a sheen is 3-5 g of oil, not a tablespoon. Visible sauces and dressings count.
- If the plate is only partly full, weigh what is there, not a full serving.

Numbers:
- Per item: kcal, protein, carbs, fat for that portion. Keep them consistent with 4/4/9 kcal per gram.
- Sanity check: kcal per gram must land between 0.08 (vegetables) and 0.9 (pure fat or oil). If the grams and kcal disagree with that, fix the grams, not the kcal.
- Grams rounded to 5, macros to one decimal. No ranges, no words in numeric fields.

Honesty:
- If two dishes are plausible, name the likelier one, set confidence "low", and say what the other was in notes.
- If the photo holds no food, return an empty items array and say why in notes.
- Never invent a side dish that is not visible.

Answer with JSON only, no markdown fence, exactly:
{"items":[{"name":"","grams":0,"kcal":0,"protein":0,"carbs":0,"fat":0}],"confidence":"low|medium|high","notes":""}`;

const ASK = 'Estimate this meal. One item per food visible.';

function extractJson(text) {
  if (!text) throw new Error('Empty response from model');
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch { /* try fenced / embedded */ }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1]); } catch { /* continue */ } }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error('Model did not return JSON');
}

const positive = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : 0;
};

/* No portion of real food carries more than ~0.95 kcal per gram (that is almost
   pure fat or oil). A weight that overshoots is usually still self-consistent,
   so this only stops the physically impossible ones — the portion discipline in
   the prompt does the rest. Macros are scaled with it so 4/4/9 stays true. */
const MAX_KCAL_PER_G = 0.95;

export function normalizeCloudResult(raw) {
  const items = Array.isArray(raw?.items) ? raw.items : [];
  const cleaned = items
    .filter((it) => it && (it.name || it.kcal))
    .map((it) => ({
      name: String(it.name || 'Food').slice(0, 60).replace(/^([a-z])/, (c) => c.toUpperCase()),
      grams: Math.round(positive(it.grams)) || 0,
      kcal: positive(it.kcal),
      protein: positive(it.protein),
      carbs: positive(it.carbs),
      fat: positive(it.fat),
    }))
    .map((it) => {
      const ceiling = it.grams * MAX_KCAL_PER_G;
      if (!it.grams || !it.kcal || it.kcal <= ceiling) return it;
      const f = ceiling / it.kcal;
      return {
        ...it,
        kcal: Math.round(it.kcal * f * 10) / 10,
        protein: Math.round(it.protein * f * 10) / 10,
        carbs: Math.round(it.carbs * f * 10) / 10,
        fat: Math.round(it.fat * f * 10) / 10,
      };
    })
    .filter((it) => it.kcal > 0 || it.protein > 0 || it.carbs > 0 || it.fat > 0);
  if (!cleaned.length) throw new Error('No food detected in that photo');
  return {
    items: cleaned,
    confidence: ['low', 'medium', 'high'].includes(String(raw.confidence).toLowerCase())
      ? String(raw.confidence).toLowerCase() : 'medium',
    notes: String(raw.notes || '').slice(0, 200),
  };
}

function timeout(ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(t) };
}

/** fetch that turns opaque CORS failures into something actionable */
async function apiFetch(url, opts) {
  try {
    return await fetch(url, opts);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    if (!navigator.onLine) throw new Error('You are offline — cloud estimation needs a connection');
    const host = (() => { try { return new URL(url).host; } catch { return 'the API'; } })();
    throw new Error(`The browser blocked ${host}'s response (CORS). Check the key, and that the model name is one that still exists.`);
  }
}

export const CLOUD_MODELS = {
  // Newest first. Google retires names for new keys (2.5-flash already is), so
  // this list is also the fallback chain: a busy or retired model moves to the
  // next one instead of failing the scan.
  gemini: ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash'],
  anthropic: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-3-5-haiku-latest'],
  openai: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini'],
};

const GEMINI_MAX_TRIES = 4;

/* The model that answered last time on this device. Google's newest flash is
   often 503 under load and old names are retired, so remembering the winner
   keeps the second scan fast instead of walking the chain again. */
let lastGoodGemini = null;

/* One Gemini call. Throws an error tagged with what the caller should do next:
   `tryNext` (busy / rate-limited / retired) vs. a hard failure such as a bad key. */
async function geminiOnce(model, key, imagePart, signal) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
    + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
  const res = await apiFetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: PROMPT + '\n\n' + ASK }, imagePart] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2000,
        responseMimeType: 'application/json',
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw = body?.error?.message || `Gemini ${res.status}`;
    const err = new Error(raw);
    err.status = res.status;
    if (res.status === 400 || res.status === 403 || res.status === 401) {
      if (/api key|api_key|credential|permission|unauthenticated|invalid/i.test(raw)) {
        err.friendly = usesSharedKey(key)
          ? 'Gemini rejected the key. Paste your own free key in You → Food scanning, or sign back in so the scan service can use its key.'
          : 'Gemini rejected that key. Copy it whole from aistudio.google.com and save it in You → Food scanning.';
      } else {
        err.friendly = raw;
      }
    } else if (res.status === 404 || /no longer available|is not found/i.test(raw)) {
      const m = raw.match(/models\/([a-zA-Z0-9._-]+)/);
      err.suggested = m ? m[1] : null;
      err.tryNext = true;
      err.retired = true;
      err.friendly = 'That model name is retired for new keys.';
    } else if (res.status === 429) {
      err.tryNext = true;
      // A 429 on the project key is not the user's fault and not fixable by
      // waiting a minute, so it points at their own key.
      err.friendly = usesSharedKey(key)
        ? 'The scanner is at its free limit right now. Add your own free key in You → Food scanning, or try again later.'
        : 'Free-tier limit reached on that model.';
    } else if (res.status === 503) {
      err.tryNext = true;
      err.friendly = 'Google is busy on that model right now.';
    } else {
      err.friendly = raw;
    }
    throw err;
  }
  const text = (body?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  if (!text) {
    const block = body?.promptFeedback?.blockReason;
    const err = new Error(block ? 'Gemini blocked that photo (' + block + ')' : 'Gemini returned no answer');
    err.friendly = err.message;
    throw err;
  }
  return { result: normalizeCloudResult(extractJson(text)), model };
}

/* 'unknown' until the app learns whether the scan function is deployed on this
   project. A 404 or a network failure marks it missing for the rest of the page
   session, so every scan does not pay for a probe that cannot succeed. */
let proxyState = 'unknown';

/* One call to the Supabase function. It returns Google's raw text; parsing and
   normalising stay here so the server stays a dumb relay. */
async function viaProxy(dataUrl, model, proxy) {
  const url = String(proxy.url).replace(/\/+$/, '') + '/functions/v1/scan';
  const t = timeout(30000);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      signal: t.signal,
      headers: {
        'Content-Type': 'application/json',
        apikey: proxy.key || '',
        Authorization: 'Bearer ' + proxy.token,
      },
      body: JSON.stringify({ image: dataUrl, prompt: PROMPT + '\n\n' + ASK, model }),
    });
  } catch {
    const e = new Error('Scan proxy unreachable');
    e.proxyMiss = true;
    throw e;
  } finally {
    t.done();
  }
  if (res.status === 404) {
    const e = new Error('Scan proxy not deployed');
    e.proxyMiss = true;
    throw e;
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || !body.text) {
    throw new Error((body && body.error) || `Scan proxy ${res.status}`);
  }
  return { result: normalizeCloudResult(extractJson(body.text)), model: body.model || model };
}

/**
 * @param {string} dataUrl jpeg data URL
 * @param {{provider:'openai'|'anthropic'|'gemini', key:string, model?:string}} cfg
 * @param {{url?:string, key?:string, token?:string}} [proxy] Supabase project the
 *   scan function lives in. When present and the user is signed in, the photo
 *   goes there instead and the Google key never touches the browser.
 */
export async function cloudAnalyze(dataUrl, cfg, proxy) {
  const provider = cfg?.provider;
  // Smartest mode needs no key of its own any more: the proxy holds it, so a
  // device with a session and no pasted key is fully equipped. Anthropic and
  // OpenAI still call their APIs directly and still need a key.
  const haveProxy = !!(proxy && proxy.url && proxy.token && proxyState !== 'missing');
  if (!cfg || (!cfg.key && !(provider === 'gemini' && haveProxy))) throw new Error('No API key configured');
  const model = cfg.model || CLOUD_MODELS[provider]?.[0];
  if (!model) throw new Error('Unknown provider: ' + provider);
  const t = timeout(60000);
  const b64 = dataUrl.split(',')[1] || '';

  try {
    if (provider === 'gemini') {
      // The proxy is the whole point of the backend: the key stays on the
      // server. If it is not deployed yet (404) or the call fails, the direct
      // path below still answers, so nothing regresses while it is switched on.
      if (haveProxy) {
        try {
          const out = await viaProxy(dataUrl, model, proxy);
          lastGoodGemini = out.model;
          out.result.model = out.model;
          if (out.model !== model) out.result.modelChanged = true;
          return out.result;
        } catch (err) {
          if (err.proxyMiss) proxyState = 'missing';
          // A working proxy that rejects the call is still worth a direct try
          // when this device has its own key; without one there is nothing left
          // to try, so the reason travels up and the scanner falls back to
          // on-device.
          if (!cfg.key) throw err;
        }
      }
      const imagePart = { inline_data: { mime_type: 'image/jpeg', data: b64 } };
      // Google's free tier is uneven: the newest flash can be 503 while the
      // lite one answers in a second, and old names are retired outright. So
      // the first pair is raced and the winner cancels the loser; anything
      // left is tried in order. A bad key aborts on the first hard error.
      const queue = [model, lastGoodGemini, ...CLOUD_MODELS.gemini].filter(Boolean);
      const tried = new Set();
      const deadline = Date.now() + 75000;
      let last = null;
      let sawRetired = false;

      const take = (name, out) => {
        lastGoodGemini = name;
        out.result.model = name;
        if (name !== model) out.result.modelChanged = true;
        if (sawRetired) out.result.retired = true;
        return out.result;
      };
      const hard = (err, name) => {
        if (err.name === 'AbortError') {
          err.tryNext = true;
          err.friendly = name + ' timed out.';
        }
        if (err.retired) sawRetired = true;
        last = err;
        if (err.suggested && !tried.has(err.suggested)) queue.push(err.suggested);
        return !err.tryNext ? new Error(err.friendly || err.message) : null;
      };

      while (queue.length && tried.size < GEMINI_MAX_TRIES && Date.now() < deadline) {
        const batch = [];
        while (queue.length && batch.length < (tried.size === 0 ? 2 : 1)) {
          const name = queue.shift();
          if (!name || tried.has(name) || batch.includes(name)) continue;
          tried.add(name);
          batch.push(name);
        }
        if (!batch.length) continue;

        const ms = Math.min(9000, Math.max(6000, deadline - Date.now()));
        // First answer wins; the loser is aborted so the sheet is not waiting on it.
        const ctrls = batch.map(() => new AbortController());
        const timers = ctrls.map((c) => setTimeout(() => c.abort(), ms));
        const stop = () => { timers.forEach(clearTimeout); };
        const race = await new Promise((resolve) => {
          const errs = [];
          let pending = batch.length;
          let done = false;
          batch.forEach((name, i) => {
            geminiOnce(name, cfg.key, imagePart, ctrls[i].signal).then(
              (out) => {
                if (done) return;
                done = true;
                stop();
                ctrls.forEach((c) => c.abort());
                resolve({ name, out });
              },
              (err) => {
                errs.push({ name, err });
                pending -= 1;
                if (!done && pending === 0) { done = true; stop(); resolve({ errs }); }
              },
            );
          });
        });
        if (race.out) return take(race.name, race.out);
        for (const l of race.errs) {
          const err = hard(l.err, l.name);
          if (err) throw err;
        }
      }
      throw new Error(last?.friendly || last?.message || 'Gemini did not answer');
    }

    if (provider === 'openai') {
      const res = await apiFetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: t.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
        body: JSON.stringify({
          model,
          max_tokens: 900,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: ASK },
                { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
              ],
            },
          ],
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message || `OpenAI ${res.status}`);
      const text = body?.choices?.[0]?.message?.content || '';
      return normalizeCloudResult(extractJson(text));
    }

    if (provider === 'anthropic') {
      const res = await apiFetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: t.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 900,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
              { type: 'text', text: PROMPT + '\n\n' + ASK },
            ],
          }],
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message || `Anthropic ${res.status}`);
      const text = Array.isArray(body?.content)
        ? body.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n')
        : '';
      return normalizeCloudResult(extractJson(text));
    }

    throw new Error('Unknown provider: ' + provider);
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out after 60s');
    throw err;
  } finally {
    t.done();
  }
}

export const CLOUD_LABELS = { gemini: 'Smartest mode', anthropic: 'Anthropic', openai: 'OpenAI' };
