/**
 * Generate a unique ID. Uses crypto.randomUUID() in secure contexts,
 * falls back to timestamp+random for HTTP LAN / older browsers.
 */
export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch { /* non-secure context */ }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}
