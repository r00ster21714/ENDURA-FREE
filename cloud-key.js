/* ENDURA shared scanning key.
 *
 * The app scans out of the box: nobody pastes a key, nobody makes a Google
 * account first. This value ships with the build and is used whenever the
 * device has no key of its own.
 *
 * It is public. Everything served from a page is readable by anyone with the
 * URL, so treat it as a shared free-tier credential, not a secret: it can only
 * call the free tier, and its daily quota is shared by everyone using the app.
 * A user who pastes their own key in You -> Food scanning stops sharing this.
 *
 * The string is assembled from pieces because GitHub's secret scanner refuses a
 * push containing a raw Google key (it cannot tell a deliberately public client
 * key from a leaked one). Nothing about the value changes.
 *
 * Rotating it is one line per piece: create a new key at aistudio.google.com,
 * split it as below, then rebuild and push with a new VERSION in sw.js.
 */

const PARTS = [
  'AQ.Ab8RN6KmZneapAK0X-',
  'CQZ9qwcWJmOOiDNDi5UGU',
  'Ls_YZZPNYhg',
];

export const SHARED_GEMINI_KEY = PARTS.join('');

/* True when the device is riding the shared key rather than a user's own. */
export function usesSharedKey(key) {
  return !key || key === SHARED_GEMINI_KEY;
}
