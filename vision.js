/* ENDURA vision: on-device food classification + optional cloud estimation */

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

const PROMPT = `You are a nutrition estimator looking at a photo of food.
Name the dish as specifically as the photo allows, then estimate the edible portion actually shown.

Rules:
- Name the dish, not the category. "cinnamon roll", not "pastry"; "blueberry muffin", not
  "baked good"; "sourdough toast", not "bread". Homemade dishes get named like any other.
- If several foods are on the plate, return one item per food.
- Estimate portion sizes from visual cues (plate, hand, utensils, packaging).
- Return totals for the visible portion, not per 100 g.
- If you cannot identify the food, still return your best specific guess with low confidence.
- Never return ranges or text instead of numbers. Numbers only, per item.

Respond with STRICT JSON, no markdown, exactly this shape:
{"items":[{"name":"string","grams":number,"kcal":number,"protein":number,"carbs":number,"fat":number}],"confidence":"low|medium|high","notes":"one short sentence"}`;

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

export function normalizeCloudResult(raw) {
  const items = Array.isArray(raw?.items) ? raw.items : [];
  const cleaned = items
    .filter((it) => it && (it.name || it.kcal))
    .map((it) => ({
      name: String(it.name || 'Food').slice(0, 60),
      grams: Math.round(positive(it.grams)) || 0,
      kcal: positive(it.kcal),
      protein: positive(it.protein),
      carbs: positive(it.carbs),
      fat: positive(it.fat),
    }))
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
    throw new Error(`The browser blocked ${host}'s response (CORS). Check the key, or switch to on-device scanning.`);
  }
}

export const CLOUD_MODELS = {
  anthropic: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest', 'claude-sonnet-4-5'],
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
};

/**
 * @param {string} dataUrl jpeg data URL
 * @param {{provider:'openai'|'anthropic', key:string, model?:string}} cfg
 */
export async function cloudAnalyze(dataUrl, cfg) {
  if (!cfg || !cfg.key) throw new Error('No API key configured');
  const provider = cfg.provider;
  const model = cfg.model || CLOUD_MODELS[provider]?.[0];
  if (!model) throw new Error('Unknown provider: ' + provider);
  const t = timeout(60000);

  try {
    if (provider === 'openai') {
      const res = await apiFetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: t.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
        body: JSON.stringify({
          model,
          max_tokens: 600,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Estimate the nutrition for this meal.' },
                { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
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
      const b64 = dataUrl.split(',')[1] || '';
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
          max_tokens: 600,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
              { type: 'text', text: PROMPT + '\n\nEstimate the nutrition for this meal.' },
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
