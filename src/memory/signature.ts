/**
 * Breakage signature normalization: incidental detail (paths, numbers, case,
 * punctuation) is collapsed so the same failure mode yields the same signature.
 *
 * Normalization is the caller's job before recording or querying memory; the
 * store itself treats signatures as opaque keys.
 */

/**
 * Normalize a raw error string into a stable signature.
 *
 * Pipeline: lowercase → any whitespace-delimited token containing a path
 * separator (`/` or `\`) becomes `<path>` → digit runs become `<n>` →
 * punctuation other than `<` `>` becomes a space → whitespace collapsed.
 *
 * Invariant: idempotent — normalizeSignature(normalizeSignature(s)) === normalizeSignature(s).
 * Invariant: "TypeError at src/cart.js:42:7" and "typeerror at lib/x.js:9:1"
 * both yield "typeerror at <path>".
 */
export function normalizeSignature(raw: string): string {
  const tokens = raw
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => (isPathLike(t) ? '<path>' : t.replace(/\d+/g, '<n>')));
  return tokens
    .join(' ')
    .replace(/[^a-z0-9<>\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A token is path-like when it contains a path separator. This deliberately
 * over-approximates (e.g. "and/or" normalizes to `<path>`): signatures exist
 * for stability across incidental variation, not for faithful parsing.
 */
function isPathLike(token: string): boolean {
  return token.includes('/') || token.includes('\\');
}

/**
 * Token set of a signature for similarity matching.
 *
 * Placeholders are unwrapped: `<path>` contributes the token "path" and `<n>`
 * contributes "n"; both are kept regardless of the length filter. Remaining
 * text is lowercased, split on non-alphanumerics, and tokens shorter than 2
 * characters are dropped.
 *
 * Invariant: tokenizing is case-insensitive, so callers may pass raw text when
 * a normalized signature is not at hand (normalization upstream is preferred).
 */
export function signatureTokens(sig: string): Set<string> {
  const tokens = new Set<string>();
  const stripped = sig
    .toLowerCase()
    .replace(/<path>/g, () => {
      tokens.add('path');
      return ' ';
    })
    .replace(/<n>/g, () => {
      tokens.add('n');
      return ' ';
    });
  for (const token of stripped.split(/[^a-z0-9]+/)) {
    if (token.length >= 2) {
      tokens.add(token);
    }
  }
  return tokens;
}
