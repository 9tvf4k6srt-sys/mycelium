import { createHash } from 'node:crypto';

/**
 * Canonical JSON serialization.
 * Invariant: two values that differ only in object key order serialize identically.
 * Undefined object fields are dropped; array order is preserved.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => [k, canonicalize(v)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Content-addressed hash of any JSON-serializable value. */
export function contentHash(value: unknown): string {
  return sha256Hex(stableStringify(value));
}
