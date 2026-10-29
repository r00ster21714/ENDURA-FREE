/*
 * Published-figure lookup.
 *
 * The vision model is good at "what is this and how big is it" and weaker at
 * "how many calories does this exact menu item have", because it answers from
 * memory. For anything with a brand on it there is a real number published
 * somewhere, so this stage looks it up instead of estimating.
 *
 * How it reaches the web from a static page: DuckDuckGo's HTML endpoint is
 * fetched through r.jina.ai, a public reader that returns page text as plain
 * markdown with CORS open. Both are keyless. A small text pass over the results
 * then pulls out the figure that the results literally state — the model does
 * not get to invent one, and an answer is only accepted when the item and the
 * size match, it is plausible for the weight, and it is close to the photo
 * estimate. Anything else is discarded and the estimate stands.
 *
 * Nothing here is required for a scan: every failure returns null and the sheet
 * shows the estimate it already had.
 */

const READER = 'https://r.jina.ai/';
const SEARCH = 'https://html.duckduckgo.com/html/?q=';

/* A 1x1 JPEG. The scan function requires an image part, and this stage is text
   only, so the model is told plainly to ignore it. */
const PIXEL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

/* Size words a photo can actually carry. Anything else is the model guessing,
   and a guessed size sends the search to the wrong row of a nutrition table
   ("tall" for a 330 ml can), so unknown words are dropped rather than passed
   on. The vision prompt already asks for one of these. */
const SIZE_WORDS = /^(short|small|tall|medium|grande|venti|large|kids|regular|can|bottle|cup|glass|slice|pint|single|double|mini|half|whole)$/;

function cleanSize(value) {
  const s = String(value || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s || s.length > 18) return '';
  return s.split(' ').filter((w) => SIZE_WORDS.test(w)).join(' ');
}

/* Brands whose numbers are actually published. A photo of a home-made sandwich
   has nothing to look up, so the lookup stays off there. */
export const BRAND_RE = /\b(starbucks|mcdonald'?s?|dunkin'?|tim horton'?s?|costa|pret|greggs|kfc|burger king|subway|chipotle|panera|nando'?s?|domino'?s?|pizza hut|papa john'?s?|five guys|shake shack|taco bell|wendy'?s?|popeyes|pepsi|coca[- ]?cola|coke|monster|red bull|gatorade|powerade|innocent|tropicana|nescaf[eé]|oreo|cadbury|kinder|snickers|mars bar|protein bar|quest|barebells|huel|boost)\b/i;

export function looksBranded(result) {
  if (!result || !Array.isArray(result.items)) return false;
  return result.items.some((it) => BRAND_RE.test(String(it.name || '')) || BRAND_RE.test(String(it.brand || '')));
}

/* Strip a result page down to the lines that can carry a number.
   DuckDuckGo wraps every snippet in a redirect link, so the useful text and the
   attribution both live inside markdown. Unwrapping keeps the sentence and
   turns the target into "(domain)" — which is what the source line shows. */
function compact(text) {
  const keep = [];
  for (const raw of String(text || '').split('\n')) {
    let line = raw.trim();
    if (!line || line.length < 12) continue;
    line = line.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
    line = line.replace(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, (m, label, href) => {
      let host = '';
      try {
        const u = new URL(href);
        const target = u.searchParams.get('uddg');
        host = new URL(target || u.href).hostname.replace(/^www\./, '');
      } catch { /* keep the label alone */ }
      const clean = label.replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim();
      return host ? clean + ' (' + host + ')' : clean;
    });
    line = line.replace(/\*\*|__/g, '').replace(/\s+/g, ' ').trim();
    if (line.length < 12) continue;
    if (!/\d|calorie|kcal|nutrition/i.test(line)) continue;
    keep.push(line);
    if (keep.length > 70) break;
  }
  return keep.join('\n').slice(0, 6500);
}

async function readerText(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(READER + url, { signal: ctrl.signal, headers: { Accept: 'text/plain' } });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

/* One text-only call through the scan function. Same relay the photo uses, so
   the Google key still never touches the browser. */
async function askJson(prompt, proxy, model, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(String(proxy.url).replace(/\/+$/, '') + '/functions/v1/scan', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        apikey: proxy.key || '',
        Authorization: 'Bearer ' + proxy.token,
      },
      body: JSON.stringify({ image: PIXEL, prompt, model }),
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    const text = String(body && body.text || '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? x : 0;
};

/**
 * Look up one item's published calories.
 *
 * Two queries at most, in order of specificity, both inside one deadline: the
 * size-tagged one ("grande", "can") hits the right row of a nutrition table,
 * and the plain one catches everything the size word would only narrow out.
 * A miss on both returns null and the photo estimate stands.
 *
 * @param {{name:string, grams:number, kcal:number, brand?:string, size?:string, isDrink?:boolean, drink?:object}} item
 * @param {{url:string, key:string, token:string}} proxy
 * @param {{model?:string, timeoutMs?:number}} [opts]
 * @returns {Promise<null|{kcal:number, size:string, source:string, quote:string}>}
 */
export async function lookupPublished(item, proxy, opts = {}) {
  if (!proxy || !proxy.url || !proxy.token) return null;
  const model = opts.model || 'gemini-3.5-flash-lite';
  const budget = opts.timeoutMs || 11000;
  const deadline = Date.now() + budget;

  const name = String(item.name || '').replace(/\s+/g, ' ').trim();
  if (!name || name.length < 3) return null;

  const brand = String(item.brand || '').trim();
  const size = cleanSize(item.size);
  const ml = n(item.drink && item.drink.ml) || (item.isDrink ? n(item.grams) : 0);
  const portion = item.isDrink || item.drink
    ? (ml ? Math.round(ml) + ' ml' : '')
    : (n(item.grams) ? Math.round(n(item.grams)) + ' g' : '');

  // The brand is often already inside the name ("Starbucks caffe latte"), so
  // only prefix it when the name does not carry it.
  const alreadyNamed = brand && new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(name);
  const lead = alreadyNamed ? '' : brand;

  const queries = [];
  if (size) queries.push([lead, size, name, 'calories nutrition'].filter(Boolean).join(' '));
  queries.push([lead, name, 'calories'].filter(Boolean).join(' '));

  for (let i = 0; i < queries.length; i++) {
    const left = deadline - Date.now();
    if (left < 3800) break;

    const page = await readerText(SEARCH + encodeURIComponent(queries[i]) + '&kl=us-en',
      Math.min(6000, Math.max(2500, left - 3800)));
    const digest = compact(page);
    if (!digest || digest.length < 120) continue;

    const remain = Math.max(2200, deadline - Date.now());
    const prompt = [
      'You are checking one nutrition figure against search results.',
      'The attached image is a 1x1 placeholder. Ignore it completely.',
      '',
      'Item: ' + name + (brand ? ' (' + brand + ')' : '') +
        (size ? ', ' + size + ' size' : '') + (portion ? ', about ' + portion : '') + '.',
      '',
      'The text below is a web search result page. Find a calorie number that is literally written there for THIS item at THIS size.',
      '- Ignore the "2,000 calories a day" boilerplate, per-100 g/ml figures, other sizes and other products.',
      '- Prefer the brand\'s own site when it is present.',
      '- If a sentence states a different size than the one asked for, that is not a match.',
      '- If no sentence states a figure for this exact item and size, answer found=false. Do not estimate.',
      '',
      'JSON only: {"found":false,"kcal":0,"size":"","source":"","quote":""}',
      'size is the portion the figure belongs to, copied from the sentence (e.g. "grande", "1 can"). source is the bare domain. quote is the sentence you took the number from.',
      '',
      'SEARCH RESULTS:',
      digest,
    ].join('\n');

    const raw = await askJson(prompt, proxy, model, remain);
    if (typeof opts.onTrace === 'function') opts.onTrace({ query: queries[i], digest: digest.length, raw });
    const found = accept(raw, item, size, ml);
    if (found) return found;
  }

  return null;
}

/* A number is only an answer when it is the right item at the right size and
   physically possible for the portion in the photo. Everything else is noise
   from a search page: another product, another cup, a per-100 ml column. */
function accept(raw, item, sizeWord, ml) {
  if (!raw || raw.found !== true) return null;
  const kcal = n(raw.kcal);
  if (!kcal) return null;

  // Size discipline: a figure for a different cup is not an answer.
  const said = String(raw.size || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (sizeWord && said && !said.includes(sizeWord) && !sizeWord.includes(said)) return null;

  // Plausibility. A drink cannot be denser than cream, and no single item is
  // thousands of calories.
  const grams = n(item.grams) || (item.isDrink ? ml : 0);
  if (grams) {
    const perG = kcal / grams;
    const drink = !!(item.drink || item.isDrink);
    if (perG > (drink ? 1.6 : 9.6)) return null;
    if (perG < 0.05) return null;
  }
  if (kcal > 2500) return null;

  // A published figure that lands absurdly far from the photo estimate means
  // one of the two read the item wrong; keep the estimate and stay quiet.
  const est = n(item.kcal);
  if (est && (kcal / est > 3 || est / kcal > 3)) return null;

  const quote = String(raw.quote || '').replace(/\s+/g, ' ').slice(0, 180);
  const source = String(raw.source || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').slice(0, 60);
  return { kcal, size: said, source, quote };
}

/**
 * Replace an estimate with a published figure, keeping the row internally
 * consistent: the macros are scaled to the published calories so
 * 4P + 4C + 9F still matches, and the portion is left alone.
 */
export function applyPublished(item, found) {
  if (!item || !found || !found.kcal) return item;
  const kcal = Math.round(found.kcal);
  const p = n(item.protein);
  const c = n(item.carbs);
  const f = n(item.fat);
  const macroKcal = 4 * p + 4 * c + 9 * f;
  let out = { ...item, kcal };
  if (macroKcal > 0) {
    const k = kcal / macroKcal;
    out.protein = Math.round(p * k * 10) / 10;
    out.carbs = Math.round(c * k * 10) / 10;
    out.fat = Math.round(f * k * 10) / 10;
  }
  out.published = {
    kcal,
    source: found.source || '',
    quote: found.quote || '',
  };
  return out;
}
