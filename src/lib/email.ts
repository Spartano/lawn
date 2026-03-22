/** Match Convex `normalizedEmail` — lowercase, trimmed. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
