/* ENDURA scan proxy — Supabase Edge Function.
 *
 * The browser never holds a Google key. It posts the photo here, this function
 * adds GEMINI_API_KEY (a project secret, never shipped to a device) and returns
 * Google's raw answer for the app to parse.
 *
 * Deploy: tools/deploy-scan-proxy.ps1 (needs a Supabase access token), or paste
 * this file into Dashboard → Edge Functions → Deploy new function → name "scan".
 * The secret to set there is GEMINI_API_KEY.
 *
 * Only signed-in accounts on this project can call it: the caller's JWT is
 * verified before anything is sent to Google, so an anonymous visitor cannot
 * spend the quota.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/* Model order: the one the app asked for, then the chain. Google retires names
 * for new keys and 503s the newest flash under load, so a failure here moves on
 * instead of dead-ending. */
const FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];

const reply = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS, 'Content-Type': 'application/json' },
});

/* The gateway key used to verify the caller. Newer projects only expose the
 * JSON dictionaries (publishable/secret keys) and no longer inject the legacy
 * SUPABASE_ANON_KEY, so fall back through both. */
const firstKey = (json) => {
  try {
    const dict = JSON.parse(json || '{}');
    return dict.default || Object.values(dict)[0] || '';
  } catch {
    return '';
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'POST only' }, 405);

  const auth = req.headers.get('Authorization') || '';
  if (!/^Bearer\s+\S+/i.test(auth)) return reply({ error: 'Sign in to scan' }, 401);

  const supaUrl = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
    || firstKey(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'))
    || firstKey(Deno.env.get('SUPABASE_SECRET_KEYS'));
  if (!supaUrl || !anon) return reply({ error: 'Function is missing its Supabase env' }, 500);

  // Verify the caller's session. A signed-out visitor cannot use this as a free
  // Gemini endpoint.
  const who = await fetch(`${supaUrl}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: auth },
  });
  if (!who.ok) return reply({ error: 'Sign in to scan' }, 401);

  let body = null;
  try { body = await req.json(); } catch { /* handled below */ }
  if (!body) return reply({ error: 'Expected JSON' }, 400);

  const prompt = String(body.prompt || '');
  const dataUrl = String(body.image || '');
  const b64 = dataUrl.split(',')[1] || '';
  if (!prompt || prompt.length > 12000) return reply({ error: 'Bad prompt' }, 400);
  if (!b64 || b64.length > 4000000) return reply({ error: 'Bad image' }, 400);

  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return reply({ error: 'This project has no GEMINI_API_KEY secret set' }, 500);

  const queue = [...new Set([String(body.model || ''), ...FALLBACK_MODELS].filter(Boolean))].slice(0, 4);
  let last = '';

  for (const model of queue) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
      + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: b64 } }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2000, responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(25000),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) { last = out?.error?.message || `Gemini ${res.status}`; continue; }
      const text = (out?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
      if (!text) { last = out?.promptFeedback?.blockReason ? `Photo blocked (${out.promptFeedback.blockReason})` : 'Gemini returned no answer'; continue; }
      // `model` is what actually answered, so the app can adopt it and skip the
      // dead name on the next scan.
      return reply({ model, text });
    } catch (err) {
      last = String(err?.message || err);
    }
  }

  return reply({ error: last || 'Gemini did not answer' }, 502);
});
