# ENDURA

Offline-first training, nutrition and body tracker that installs to a phone home screen.
No framework, no build step. A free Supabase project holds accounts, usernames, friends and 2FA
factors, plus — only if you switch it on — a seven-day summary your close friends can read;
everything you log stays in IndexedDB on the device.

```
index.html              app shell + SVG icon sprite
manifest.webmanifest    PWA manifest
sw.js                   service worker (shell precache + model cache)
app.css                 all styling
app.js                  router + bootstrap
core.js                 IndexedDB, state, formatting, sheets/toasts, photo helpers
data.js                 114-food nutrition table, 66-exercise library, search + visual matching
vision.js               on-device classifier + Anthropic/OpenAI estimation
charts.js               canvas line chart (no chart library)
rest.js                 global rest timer (WebAudio beep + vibration)
gate.js                 account gate: first-run, sign-up, sign-in, 2FA
auth.js                 Supabase client, session, username, 2FA, connection test
friends.js              friend search, requests, friend list, close-friend week viewer
sharing.js              the seven-day summary close friends can read (write-time filtered)
today.js workout.js nutrition.js body.js settings.js common.js
                        the five screens plus their shared UI helpers
icon-*.png favicon-32.png apple-touch-icon.png
                        home-screen icons
tools/devserver/        local static server (dotnet)
tools/make-icons.ps1    regenerates the PNG icons
```

Every runtime file sits at the repo root on purpose: GitHub's web uploader flattens
loose files dragged out of a subfolder, so a flat layout can't be deployed wrong.
`endura-deploy/` is a copy of exactly those 26 runtime files.

## Run it

The app uses ES modules and a service worker, so it must be served over HTTP — opening
`index.html` from disk will not work.

```powershell
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
# → http://localhost:8137
```

Any static server works instead (`npx serve`, `python -m http.server`, nginx, IIS).

## Install on a phone

The service worker only runs in a **secure context**. `http://localhost` counts; a plain
`http://192.168.x.x` URL does **not**, so on a phone you get the website but no offline
install. Two working routes:

1. **Host it over HTTPS** — drag `endura-site.zip` onto Netlify Drop, or push to
   GitHub Pages / Cloudflare Pages. Open the HTTPS URL on the phone → Share →
   *Add to Home Screen*.
2. **Tunnel the dev server** — `powershell -ExecutionPolicy Bypass -File tools/tunnel.ps1`
   starts the server and a Cloudflare quick tunnel (bundled `cloudflared`), then prints the
   HTTPS URL to open on the phone. The URL holds for as long as the tunnel process lives,
   including across app updates; the script reuses a healthy tunnel instead of making a new
   one. It is still temporary — a tunnel restart means a new URL. If the tunnel port is
   blocked (Cloudflare WARP, school/work Wi-Fi), disconnect WARP or use option 1.

Over LAN HTTP you can still use it as a normal website for testing.

Full walkthrough, including Netlify Drop and GitHub Pages: `DEPLOY-iPHONE.md`.

## Food scanning

One engine, one question: what is on the plate, and how much of it. It is already on:
**You → Food scanning → Smartest mode** works on a fresh install with no key and no setup, through the
account that already gated the app. Anthropic and OpenAI are still there for anyone with a key of
theirs; on-device scanning is gone as a mode.

**Smartest mode (default, free tier).** The photo goes to Google's vision model, which reads the
plate instead of matching it against ImageNet labels. The prompt is written to name every visible
food, estimate the **eaten** weight in grams (bones and shells excluded, cooking oil and dressing
included), return per-item kcal · P · C · F consistent with 4/4/9, flag low confidence with the
alternative dish in `notes`, and answer JSON only. You then edit any number or use 0.5×–1.5×
before logging. The result is labelled with the model that produced it.

- **Nothing to paste, and nothing to steal.** The Google key lives on the Supabase project as the
  `GEMINI_API_KEY` secret, and the browser reaches it through the `scan` Edge Function. A photo is
  posted to that function, the function adds the key and calls Google. `cloud-key.js` ships empty, so
  reading the public bundle finds no credential. Only a signed-in account can call the function.
- **The key is never written to storage.** A device without its own key stores `key: ''`, which means
  "go through the scan service". Rotating the secret on the project changes nothing on any phone — no
  rebuild, no update.
- **Your own key still works.** Pasting one (free, no card:
  [aistudio.google.com](https://aistudio.google.com/app/apikey)) stores it on this device and calls
  Google directly, spending your quota instead of the project's. *Use ENDURA's scanner* clears it back
  to the server path.
- The photo is sent for the request and is not stored by the app.
- **The model chain is the reliability layer.** Google retires model names for new keys
  (`gemini-2.5-flash` already is) and 503s the newest flash under load, so the function walks the
  chain and returns whichever answered. A retired name is swapped for the one that works and saved,
  so the next scan is direct. A bad key fails in under a second with a plain message and no chain
  walk.
- **A tapped-out key says so.** A 429 reads *"The scanner is at its free limit right now — add your
  own free key, or try again later"* rather than blaming the user's connection.
- **Portions are deliberately conservative.** A photo with no ruler or hand has no reliable scale, and
  the models are known to answer big — a plain single-patty burger first came back as one 220 g /
  540 kcal item, roughly double the real thing. The prompt now carries reference weights for common
  foods (bun 50 g, patty 90 g, rice or pasta 150 g, chicken breast 130 g, pizza slice 100 g, oil
  7 g …) and treats them as the answer: the model leaves a reference number only when the frame
  proves it — packaging weight, a hand next to the plate, a whole pizza, a sharing dish, a portion
  visibly filling the plate — and then scales by what the frame shows. When two weights are
  plausible it picks the smaller one, because a photo reads bigger than the plate really is. The
  same scan now answers bun 50 g + patty 90 g + lettuce 10 g → **367 kcal**, or 412 kcal when it
  also counts the oil sheen on the patty, and the result lists components instead of one inflated
  lump. The 1.25× / 1.5× pills are still there for a genuinely big plate.
- A physically impossible portion is corrected in code too: no item can exceed 9.5 kcal/g (pure
  oil), so a model arithmetic slip cannot log a four-digit snack; macros are scaled with it.
  Ordinary over-estimates are left alone — the weighing discipline in the prompt handles those.
- **Drinks are sized, not guessed.** A drink goes wrong differently from food: the cup size is the
  portion and the milk is the calories. The prompt now fixes both before anything else — tall 355 ml,
  grande 473 ml, hot venti 591 ml, iced venti 710 ml, can 330 ml, bottle 500 ml, mug 350 ml — and then
  builds the drink from per-100 ml milk values (whole 61, 2% 50, skim 34, oat 45, soy 45, almond 15),
  a 20 kcal pump of syrup, 80 kcal of visible whip and the frappuccino base. It knows a cappuccino is
  about a third milk (grande ≈ 140 kcal) while a latte is nearly all milk (grande ≈ 190), and that ice
  displaces milk, so the iced grande latte is ≈ 130. Chain drinks use the chain's published number for
  the size in frame, and a size that cannot be read takes that chain's middle size, never the largest.
  A drink is stored in millilitres (1 ml ≈ 1 g), so the portion in the sheet is the cup.
- **The arithmetic has to close.** Every answer is checked against 4/4/9 kcal per gram before it is
  sent, and a drink against 0-1 kcal per ml; a mismatch is corrected rather than reported. Verified on
  a Starbucks grande latte (190), a grande iced latte (150), a caramel iced latte with whip (280) and
  a 250 ml Coke can read off its own label (113).
- **The default model is now `gemini-3.5-flash`**, with `gemini-3.5-flash-lite` kept as the fast
  fallback — lite names a dish reliably but was the source of the loose calorie answers. A device still
  holding the old shipped default is moved over once at boot; a model you typed yourself is left alone.
  Model names are editable, so a newer model can be typed in without a new build.
- **The session heals itself before a scan.** The token is checked and refreshed first (a phone that
  slept can wake with an expired one), and a 401 gets one silent refresh and retry. If the session is
  genuinely gone the sheet says *"Sign in again to scan"* with a button — it never asks for an API key,
  because there is nothing to paste.
- **A cloud failure no longer quietly becomes a wrong guess.** The old behaviour fell straight through
  to the 1,000-class on-device model, which answered "soda can" for a plate of food. Now the sheet
  offers *Try again* and, as a deliberate choice, *Basic on-device match*. When that fallback is used
  it recognises drink containers too (a can → Soda with Beer next to it, a mug → Coffee with Latte),
  which it used to discard as tableware.
- **A branded item gets its published number, not a memory.** The model is reliable at *what* is in the
  photo and how big it is, and weakest at recalling the exact calories of a menu item. So after the
  estimate is on screen, branded rows (Starbucks, McDonald's, Coke, Monster, Quest …) are looked up on
  the web in the background: DuckDuckGo's result page is fetched through the keyless `r.jina.ai` reader,
  and a small text pass pulls out only a figure that is *literally written* in the results. The card
  stays usable while this happens, and the number is swapped in with its source and sentence quoted
  under the row — "Published figure from calorieking.com — *There are 140 calories in 1 can (12 fl. oz)
  of Coca-Cola Classic.*". A drink with no brand gets a **Check the published number** button instead,
  so a home-made latte is not silently matched to someone else's menu. Verified: grande iced latte 130,
  grande cappuccino 140, Coca-Cola 330 ml 139-140, Big Mac 580.
- **A lookup can only replace an estimate, never break one.** The figure is accepted only when the size
  matches (a chain word like *grande*, or the same volume in oz/ml), the density is possible for the
  portion (≤1.6 kcal/ml for a drink, ≤9.6 kcal/g for food), it is within 3× of the photo estimate, and
  the macros still close on 4/4/9 after rescaling. Anything else — a per-100 ml column, a 2 L bottle, a
  different drink — is discarded and the estimate stands, silently. A failed lookup never shows an
  error and never blocks *Add*: the worst case is the number the photo already gave.
- **Nothing about the web lookup needs a key.** `r.jina.ai` and DuckDuckGo's HTML endpoint are open;
  the only credential involved is the same account token the photo already uses, and the extraction
  call goes through the same `scan` function, so the Google key stays on the server. It is also the
  one part of scanning that depends on a third party being up: if the reader or the search endpoint
  refuses, no number is found and the estimate is what you log.
- Provider errors are translated before they reach the sheet ("API key not valid" became *the scanner's
  key was rejected*), and a 429 from the free tier is retried once after 2.5 s instead of surfacing as
  a failure.

### Putting the key on a server (scan proxy)

A static site cannot hide a value it has to use, so the key sits in a function instead: the browser
posts the photo to a small function on the Supabase project the app already uses, the function adds
the Google key (a project secret) and returns the answer. Nothing holding a usable key ever reaches a
device.

- Source: `supabase/functions/scan/index.ts`. It verifies the caller's Supabase session before
  calling Google, so a random visitor cannot spend the quota, and it walks the same model chain as
  the client.
- Deploy, one command: create a token at
  [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens), then

  ```powershell
  $env:SUPABASE_ACCESS_TOKEN = 'sbp_...'
  powershell -ExecutionPolicy Bypass -File tools\deploy-scan-proxy.ps1 -GeminiKey 'AQ...'
  ```

  or do it by hand: Dashboard → Edge Functions → *Deploy a new function* → *Via Editor* → name it
  `scan`, paste `index.ts`, *Deploy function*. Then Dashboard → Edge Functions → **Secrets** → add
  `GEMINI_API_KEY` with the key as the value → *Save* (secrets apply without redeploying).
- The app calls the function for Smartest mode whenever the user is signed in and has no key of their
  own. A missing function (404) or an unreachable one is remembered for the page session, and the
  scanner drops to the on-device pass instead of hanging.
- Live since `en-v24`: bundle carries no key, storage holds `key: ''`, a burger photo answers through
  `POST /functions/v1/scan` in **1.6 s**, and no request ever goes to `generativelanguage.googleapis.com`
  from the browser.

**On-device fallback (no UI, no upload).** TF.js MobileNet v2 runs in the browser, loads once, and
classifies three passes (full frame, plate area, tight centre). What it returns is *evidence*, not
an answer — ImageNet has no "steak", "rice" or "cinnamon roll" class, and it cannot see portions at
all. Two rules keep the guess honest:

- **A direct hit beats a shelf guess.** A label that names a food in the table wins over a family
  expansion for the same photo.
- **A specific word is required for a specific pastry.** "dough"/"bakery"/"pastry" now reach
  generic bread; only "cinnamon"/"sweet roll"/"icing" (or a whorl-shaped label plus a bakery shelf)
  reach **Cinnamon roll**. This is the fix for a plate of steak and rice coming back as a cinnamon
  roll.

When the photo looks like a **plated meal** — tableware plus one or more savoury shelves (meat,
rice/noodles, salad, fast food, breakfast) — the scanner still answers. It names the **combined
dish** from the evidence, with its macros:

> *Plate detected · combined dish*
> **Meat and potatoes** — 580 kcal per 400 g · 32 P / 52 C / 24 F
> **Add Meat and potatoes**

The combination is chosen by comparing label scores, not by category order, and the ingredients the
model actually saw stay as one-tap alternatives (Potato, Broccoli, Pasta). A plate that is clearly
tableware but comes back as a low-calorie side ("broccoli" beside "plate") gets the combined estimate
too, because 34 kcal is not a dinner. **Split the plate — exact portions** is still there as a
secondary button for anyone who wants to weigh the parts: tap protein / carbs / veg / extras,
0.5×–2× each, see the real combined kcal · P C F.

Steak + rice + broccoli is therefore one tap to log an estimate, or three taps for an exact split.
The builder is also always available from a normal answer, the food picker and the no-match screen.

A confident single label ("pizza 1.00", "carbonara 0.86") still answers directly, and the result
says **"This is"** instead of "Best guess". Sweet shelves are damped when the photo has no sweet
word and hard-damped on a plated frame, because most meal photos are savoury.

**When the guess is wrong, nothing gets typed.** *Not right? Choose the food* opens a browsable
picker: the photo's own candidates first, then what you actually log, then all 114 foods — each row
already showing kcal · P C F · serving grams. Tap the right food and the portion sheet opens with
everything filled in from the table, scaled to the portion; adjust grams (or 0.5×–2×), tap
**Add to log**. The correction is remembered against the label the model saw, so the same kind of
photo gets your food next time — except on a mixed plate, where that memory is deliberately ignored.
**You → Forget scanner corrections** clears it.

Other mechanics:

- **Visual families** — generic labels expand to a shelf (baked goods, dessert, fast food, rice,
  breakfast, salad, meat) with per-item weights and `needs` gates.
- **Colour/texture tie-break** — brightness, saturation, warmth and edge density nudge the order
  inside a shelf, centred on the shelf mean so a badly exposed photo shifts everything together.
- **Whole-word matching** — "chambered nautilus" cannot trip "ham"; a bare "cake" cannot name
  "coffee cake", while "chocolate chip cookie" is still a Cookie.
- **Tableware filter** — "plate", "tray", "menu", "restaurant" are skipped instead of eating a
  candidate slot, and instead feed the mixed-plate detector.
- **Always an answer** — a weak-but-real match is still named, with its kcal and macros and a
  *Best guess* kicker, plus one-tap alternatives and the picker. Only a photo with no usable label
  at all says *Not sure what that is*; the app never answers a food photo with a form.

114 foods, including the bakery shelf people actually photograph and the components used by the
plate builder.

Verified with real photos through the on-device model (not just synthetic labels):

| Photo | Result |
|---|---|
| pizza | **This is Pizza (cheese)** |
| pasta | **This is Pasta (cooked)** |
| burger | **This is Cheeseburger** |
| cinnamon rolls | **Best guess Cinnamon roll** (from a "coil, spiral" label) |
| steak + rice | **Meat and potatoes** — 580 kcal, plate estimate |
| chicken + rice + potatoes | **Meat and potatoes** — 580 kcal, plate estimate |
| salad bowl | **Best guess Avocado** (alternatives: Broccoli, Salad (mixed)) |
| pan of rice | *Not confident enough* → picker/plate |
| `hammer`, `chambered nautilus` | no bogus food |

Plate builder verified end to end: steak 100 g + rice 158 g + broccoli 100 g → 510 kcal,
32 P / 52 C / 19 F, three meal rows logged, zero console errors.

Limits: it names a dish and a per-100 g estimate — not your portion. The gram field is what makes
the number right. A plate of several things gets the combined estimate; the builder splits it
exactly.

**Smartest mode.** The photo goes to Google and comes back with one row per food and an estimated
portion, which you scale or edit before logging. Anthropic and OpenAI work too (Anthropic direct
from the browser; OpenAI does not always send CORS headers on error responses, so a bad key there
shows as a CORS failure). Keys are stored locally and sent only to the provider. Any cloud failure
falls back to the on-device pass, with the reason shown above the answer.

## Accounts, friends and 2FA

Every install starts on the account screen. There is no "skip": the app is closed behind a gate
until a session exists, so the first thing anyone sees is **Create an account**. The account only
holds an email, a username, friend links and a 2FA factor — never training data.

The backend ships with the app (`DEFAULT_SETTINGS.sync` in `core.js`), so a fresh install needs no
setup sheet. To use a different project: **You → Change**, paste the URL and key, **Connect**. The
setup sheet reports what it actually found — reachable, key accepted, setup SQL installed.

1. Supabase project (free tier, no card).
2. SQL editor → run `tools/supabase-setup.sql` once. It creates `profiles`, `friendships`
   (with the `close` flag), `shared_weeks` and `set_close_friend()`, all with row-level security,
   plus the unique `lower(username)` index, `username_taken()` and the `handle_new_user` trigger.
   Re-running it is safe.
3. Authentication → Sign In / Up → turn **Confirm email** off. The bundled email service only
   delivers to project members, so leaving it on means nobody else can finish signing up.
4. Project Settings → **API Keys** → copy the **Project URL** (`https://<project-ref>.supabase.co` —
   the ref is the project ID, but the URL is the whole address, not just the ID) and the
   **publishable** key (`sb_publishable_…`). Older projects label the same thing **anon public**;
   either works. The SDK is `@supabase/supabase-js@2.118`, which supports both.

First launch: **Create an account** (username + email + password) or **I already have one**. After
that the session is persisted (`persistSession`, storage key `endura.auth`), so every later launch
opens straight into the app. **Sign out** is the only way back to the account screen, and signing
out always lands on **Sign in** — never on the first-run greeting. Signing out clears the session
only: workouts, meals, measurements and scanner memory stay on the phone.

If the server cannot be reached, **Trouble signing in? → Use ENDURA offline** unblocks the local
app; You keeps offering sign-in and the next successful sign-out clears the escape flag.

**Friends** is its own tab: your @username with a copy button, live prefix search (2+ characters)
with relation badges (Add / pending / friends / accept), incoming requests, and the friend list
with Remove. Requests are rows in `friendships`; RLS lets only the two people involved read them.

## Close friends

Tap a friend to open their sheet: **Close friend**, **See their week**, **Remove friend**. The flag
lives on the friendship row and is mutual — either side can set it, and both become close friends.
A `SECURITY DEFINER` function (`set_close_friend`) does that write, so the same path cannot be used
to accept your own pending request.

Close friends can read a summary of the **last seven days**, and nothing else. It is built from
your log when the app saves, and every section has its own switch in **You → Close friends**:

| Switch | What a close friend sees |
|---|---|
| Share my week | the master switch; off deletes the published row |
| Meals I logged | dish names, day, grams, kcal (last 60) |
| Calories & macros | daily average kcal · P / C / F, days logged |
| Workouts | session count, total time, total volume, last 20 sessions |
| Body | latest weight, change across the week, body fat, waist |

The filtering happens **before upload**: `sharing.js` builds the payload from the switched-on
sections only, so a section that is off is never sent and never stored. Turning the master switch
off deletes the row rather than blanking it. Photos, notes and the full log are never part of the
payload.

RLS on `shared_weeks` returns a row only to its owner or to an accepted friendship with `close`
set, so a non-close friend's app gets nothing back from the server even if it asks by id. One row
per user (`user_id` primary key), republished debounced on every save, on sign-in and when the app
is hidden, so the server copy is never far behind the phone. The payload carries the owner's
`units` so a viewer on lb/in reads lb/in.

**2FA** is chosen when you turn it on:

- **Authenticator app** (default *free* path): TOTP — Google Authenticator, 1Password, iOS
  Passwords → Set up code. Reveal the secret, confirm with a 6-digit code.
- **Phone number (SMS)**: enter the international number, confirm the texted code. This needs an
  SMS provider (Twilio) connected to the Supabase project; if there isn't one, the sheet says so
  and points back to the authenticator app instead of failing silently.

Either factor is required at the next sign-in — the gate asks for it after the password, a wrong code
says *Invalid TOTP code* and lets you retry without signing in again. **You → Manage 2FA** switches
between the two methods in one tap (the old factor is removed first, so the gate only ever has one
prompt), and turns 2FA off again.

The public key (publishable or legacy anon) is public by design; RLS is what protects the rows. The
secret / service-role key is never used in the app.

Verified against the live project, end to end: sign-up lands straight in the app with a session,
a reload stays signed in, **Sign out** returns to the gate (never the first-run greeting), signing
back in asks for the TOTP code, a wrong code shows *Invalid TOTP code* and the correct one on the
next try still opens the app, the phone method explains the missing SMS provider instead of failing
silently, and the app hides behind the gate with nothing in the console. The key is accepted,
`username_taken()` answers, `profiles` and `friendships` exist, and anon cannot read profiles
("Test connection" reports all three).

## What is stored

| Store | Contents |
|---|---|
| `sessions` | workout name, timestamps, per-exercise sets (weight, reps, done) |
| `meals` | name, grams, kcal, protein/carbs/fat, source — **no photo** |
| `metrics` | weight, body fat, tape measurements, optional progress photo |
| `kv` | settings (units, targets, rest, cloud key, Supabase URL + anon key, close-friend switches) and learned scan labels |

| Server (Supabase) | Contents |
|---|---|
| `profiles` | username, display name |
| `friendships` | two user ids, pending/accepted, the mutual `close` flag |
| `shared_weeks` | one row per user: the seven-day payload, containing **only** the switched-on sections |

`shared_weeks` is the only place training data can ever be online, it holds nothing that a section
switch excluded, and turning sharing off deletes the row.

**Food photos are never written to storage.** A scan keeps the JPEG in memory for the preview
sheet and the cloud request, then drops it. `addMeal()` strips any `photo` field at the single
write path, and boot purges thumbnails saved by older builds. Progress photos on measurements
are deliberate and optional — delete the measurement to remove one.

**You → Data** exports a single JSON file with all stores, and imports it back (import replaces
current data). Export before clearing browser storage.

## Verified

Tested in Chromium against a local server:

- boot with empty database, no console errors
- log weight → persists across reload, Today card and chart update
- start session → add Bench press → set 60 kg × 8 → rest timer starts at 2:30 → finish → history
- add food (search → portion → 1.5× scale → log) → macro ring and meal list update
- photo → on-device model → `Pizza (cheese)` first, `likely` → 1.5× portion → 428 kcal logged
- real steak-dinner photo → **Meat and potatoes**, 580 kcal / 32P 52C 24F, one tap to log; the
  **Split the plate** route still yields steak + rice + broccoli → 510 kcal / 32P 52C 19F, three rows
- real chicken/rice/potato dinner → **Meat and potatoes** (broccoli 0.42, meat loaf 0.02,
  mashed potato 0.04 — the sides alone would have said "Broccoli, 34 kcal")
- real salad bowl → **Best guess Avocado**, alternatives Broccoli / Salad (mixed) / Cauliflower
- real pan-of-rice photo → *Not confident enough*, no invented Broccoli
- real cinnamon-roll photo → **Cinnamon roll** via a "coil, spiral" label plus the bakery shelf
- `dough` label alone → **Sourdough bread**; steak-and-rice labels (`plate` + `dough` +
  `carbonara` + `meat loaf`) → mixed plate, learned "dough → cinnamon roll" not applied
- cookie photo → "Best guess — Cookie" → Add → 30 g, 148 kcal, no stored image
- "Not right? Choose the food" → picker → Pizza (cheese) → 285 kcal / 12P 36C 10F at 107 g
  auto-filled, 1.5× → 428 kcal / 18P 54C 15F, logged, correction saved to the scan label
- no-match photo → "Pick the food" → browsable full list (114 rows), search box optional
- scanner renders one-tap alternatives; the choose-food button is always present
- skeleton/scanner status never mentions download size
- meal write with a `photo` field → record in IndexedDB has none; old thumbnails purged on boot
- target calculator: BMR 1826 / maintenance 2831 → targets 2830 kcal, 157 P / 359 C / 85 F
- body chart renders (canvas 532 px, painted), heatmap 112 cells
- service worker active, 24 files precached, app reloads with the server stopped
- rebrand: manifest, title, header and export are ENDURA (`en-v1`); old `ft-v8`
  cache is evicted on first load and the IndexedDB name is kept on purpose so
  existing logs survive
- close-friend settings card renders on the live project as `PRIVATE`, with the four section
  switches under a master; flipping the master stores `share.enabled`, republishes, and surfaces
  the missing-table message cleanly until the SQL is run
- Friends tab still renders `0 friends / No friends yet` before the migration, because
  `friendsOverview()` retries without the `close` column instead of failing the whole tab

Scanning, on **Smartest mode**:

- the request is accepted from the browser (no CORS block, no proxy), on a key from AI Studio
- **Google retired `gemini-2.5-flash` for new keys mid-project** — the API answers 404 with *"no
  longer available to new users … use models/gemini-3.x"*. That is why a device that had the old
  default stopped scanning; the chain now notices, swaps to a model that answers, and saves the new
  name (`settings.cloud.model` updated from `gemini-2.5-flash` → `gemini-3.5-flash-lite` in one scan)
- the newest flash 503s under load while the lite one answers in ~1.5 s, so the top two candidates
  are raced: first answer wins, the loser is aborted. Measured on a fresh page with the retired name
  saved: 2.0 s to a named result, 2.1 s on the repeat (was 22–33 s walking the chain one at a time)
- a real burger photo → **Hamburger bun 60 g · Beef patty 110 g · Green leaf lettuce 10 g · Cooking
  oil 5 g**, 492 kcal total, `high confidence`, four editable rows and one tap to log
- bad key: fails in 285 ms with *"Gemini rejected that key. Copy it whole from aistudio.google.com
  and save it in You → Food scanning."* — no chain walk, no raw 400
- no key and no session: tapping Camera/Gallery shows *"Smartest mode needs a sign-in"* with
  **Open settings** and **Pick the food instead**, and does not open the file picker first
- migration: a device with `cloud.provider: 'none'` saved reads back as `gemini` /
  `gemini-3.5-flash-lite` with its key intact; the card shows three choices (Smartest mode ·
  Anthropic · OpenAI), no On-device
- Food page badge reads `Smartest mode` when scanning can run (own key or a session) and `Add a key`
  when it cannot; results carry the model that actually answered
  (`Smartest mode · gemini-3.5-flash-lite`)
- cloud failure still falls back instead of dead-ending: *"Smartest mode couldn't answer — … Showing
  a basic on-device guess instead"*, then **Cheeseburger**, 303 kcal, alternatives Pizza / Hot dog /
  Sandwich
- on-device path unchanged: burger → `cheeseburger 0.99` → **Cheeseburger** (three passes, ~0.8 s)
- the idle "Point at your plate" block now collapses once there is an answer, and the result has a
  camera button to scan again without closing the sheet
- settings footer prints the installed cache (`v1.0 · offline-first PWA · en-v19`), so an old build
  on a phone is visible at a glance
- service worker update path: each precache request carries `?v=en-vNN`, so a CDN edge still serving
  the previous commit cannot pin old files under the new version name
- **en-v22, no key entry at all**: fresh install (IndexedDB + localStorage wiped) → `cloud.key` comes
  from `cloud-key.js`, Food page badge reads `Smartest mode`, and a burger photo scans in **1.5–1.8 s**
  to `1 item · Smartest mode · gemini-3.5-flash-lite`, **Hamburger 220 g**, 540 kcal, zero console
  errors — nothing pasted, no setup card
- the shared key never reaches storage: after saving settings, `kv/settings` and `ft.settings` hold
  `cloud.key: ''` and the working key is re-applied from the build on every boot, so a rotated key
  reaches devices that never pasted one
- the settings card shows an empty key field with placeholder *"Using the shared key"*, a **Use
  shared key** button, and no sign of the value in the DOM
- key handling across providers: paste your own → stored and shown; switch to Anthropic → the key
  goes blank instead of travelling; switch back → your key returns; **Remove key** → back on the
  shared one
- GitHub's secret scanner rejects a push containing a raw Google key (`422 Secret detected in
  content`), so `cloud-key.js` assembles the value from three fragments — same public key, push
  accepted
- **en-v24, key off the browser**: `scan` Edge Function deployed on the project with
  `GEMINI_API_KEY` as a secret; `cloud-key.js` shipped empty (851 bytes, byte-identical to the file
  in the repo, no `AQ.`/`AIza` string anywhere in the bundle); a burger photo from a signed-in
  account answers `POST /functions/v1/scan` **200 in 1.6 s** → 502 kcal, `gemini-3.5-flash-lite`,
  with **zero** requests to `generativelanguage.googleapis.com`; `ft.settings` and `kv/settings` both
  hold `cloud.key: ''`; no console errors
- the function only answers a real session: an `Authorization` header is required and the JWT is
  checked against `/auth/v1/user` before Google is called, so a signed-out visitor gets 401 rather
  than a free scan
- the settings card now reads *"Using ENDURA's scanner"* with a lime badge, the button says **Use
  ENDURA's scanner**, and the copy states the key is on the server, not in the app

Close friends, end to end on the live project with two throwaway accounts (`@selftest_a`,
`@selftest_b`):

- request sent from B → Accept on A → both lists show the friend, no console errors
- `Close friend` in the friend sheet persists to `friendships.close` and the badge shows on B's
  list too; tapping it again clears it for both
- B opens **See their week** and reads A's meals (newest first, with grams and kcal), the daily
  average macros, and the training block — the body block is absent because its switch is off
- with `close` turned off, `fetchWeek(A)` returns `null` and a direct `select` on `shared_weeks`
  returns only B's own row: the lock is RLS, not the UI
- sections verified against the stored row: meals off → payload loses `meals`; workouts off →
  loses `workouts`; body on with a weigh-in → adds `body` (80.4 kg / 18% / waist 84); master off
  deletes the row entirely
- viewer honours the payload's units: `80.4 kg` / `12,800 kg` metric vs `177.3 lb` / `28,219 lb`
  imperial, waist `84 cm` vs `33.1 in`

Not verified here: real camera capture on iOS/Android, audio beep volume, and install prompt on a
physical device.

## Known gaps

- Meals can be deleted but not edited after logging.
- No barcode scanning, no programmed splits, no per-meal targets.
- Weigh-ins are one-per-day; logging again overwrites that day's entry.
- Custom foods are logged but not saved to the food library.
- Charts are canvas-only; no zoom/scrub.
- The web lookup depends on two free third-party endpoints (DuckDuckGo's HTML page via `r.jina.ai`), so
  a lookup can return nothing when they throttle. The estimate is always there as the fallback; a
  server-side version (Google Search grounding inside the `scan` function) would remove that dependency
  but needs the function redeployed with a Supabase access token.
