/**
 * The commitment scheme, browser side: `sha256(prediction + "|" + salt)`.
 *
 * `functions/commit.js` collapses runs of whitespace and trims the prediction before
 * hashing, so anybody re-checking a reveal has to do the same — `commitPreimage` is the
 * single place that knows the recipe.
 */

export const COMMIT_SEPARATOR = "|";

/** Exactly the normalisation `functions/commit.js` applies before hashing. */
export function normalizePrediction(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function commitPreimage(text: string, salt: string): string {
  return `${normalizePrediction(text)}${COMMIT_SEPARATOR}${salt.trim()}`;
}

/** SHA-256 as lowercase hex, via the browser's own SubtleCrypto — no network, no library. */
export async function sha256Hex(input: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("this browser cannot recompute sha-256 (no SubtleCrypto in an insecure context)");
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashCommit(text: string, salt: string): Promise<string> {
  return sha256Hex(commitPreimage(text, salt));
}
