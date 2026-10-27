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
`endura-deploy/` is a copy of exactly those 25 runtime files.

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

Two modes, picked in **You → Food scanning**:

**On-device (default, no key, no upload).** TF.js MobileNet v2 runs in the browser, loads once,
and classifies three passes (full frame, plate area, tight centre). What it returns is *evidence*,
not an answer — ImageNet has no "steak", "rice" or "cinnamon roll" class, so two rules keep the
guess honest:

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

**Cloud (optional key).** The photo goes to Anthropic or OpenAI and comes back with per-item
grams and macros, which you can scale or edit before logging. Anthropic works directly from the
browser (verified: the API answers with a normal error for a bad key). OpenAI does not always
send CORS headers on error responses, so a bad key shows as a CORS failure — the app tells you
that and suggests the alternatives. Keys are stored locally and sent only to the provider.

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

Not verified here: real camera capture on iOS/Android, audio beep volume, install prompt on a
physical device, and cloud estimation with a live API key.

## Known gaps

- Meals can be deleted but not edited after logging.
- No barcode scanning, no programmed splits, no per-meal targets.
- Weigh-ins are one-per-day; logging again overwrites that day's entry.
- Custom foods are logged but not saved to the food library.
- Charts are canvas-only; no zoom/scrub.
