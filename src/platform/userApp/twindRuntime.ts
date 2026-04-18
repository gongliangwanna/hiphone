/**
 * Runtime Tailwind bootstrapping for user apps.
 *
 * User app TSX is compiled by Sucrase at runtime, so its class names are
 * invisible to the host's build-time Tailwind scan. @tailwindcss/browser
 * scans `document` for class attributes after import and generates the
 * matching CSS into <head>; it also keeps a MutationObserver running to
 * catch dynamically rendered classes.
 *
 * We invoke this lazily from UserAppRoot's layout effect — the first time
 * any user app mounts the package is dynamically imported; subsequent
 * mounts reuse the already-loaded module.
 */

let installed = false;
let pending: Promise<void> | null = null;

export function ensureTwindInstalled(): Promise<void> {
  if (installed) return Promise.resolve();
  if (pending) return pending;

  pending = import('@tailwindcss/browser')
    .then(() => {
      installed = true;
    })
    .catch((err: unknown) => {
      console.warn('[twindRuntime] failed to load @tailwindcss/browser:', err);
      // Reset both flags so a future mount can retry.
      installed = false;
    })
    .finally(() => {
      pending = null;
    });

  return pending;
}
