/* ENDURA scanning key.
 *
 * Nothing ships in this file. The Google key lives in the Supabase project as
 * the GEMINI_API_KEY secret, and the browser reaches it through the `scan`
 * Edge Function (supabase/functions/scan/index.ts). A photo is posted to that
 * function, the function adds the key and calls Google, and the key never
 * reaches a device — so the public bundle cannot be read for it.
 *
 * A device may still paste its own key in You -> Food scanning. That key is
 * stored locally and used directly, which spends the user's own quota instead
 * of the project's.
 *
 * The value below stays empty on purpose; keep it empty.
 */

export const SHARED_GEMINI_KEY = '';

/* True when the device is riding the server's key rather than a user's own. */
export function usesSharedKey(key) {
  return !key || key === SHARED_GEMINI_KEY;
}
