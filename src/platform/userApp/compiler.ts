/**
 * Lazily-loaded Sucrase transform. Sucrase is ~120KB gzipped and only
 * needed when we actually compile a user app. Keeping it dynamic means
 * hiPhone startup is not penalized when no user app is opened.
 */
let sucrasePromise: Promise<typeof import('sucrase')> | null = null;

function loadSucrase() {
  if (!sucrasePromise) {
    sucrasePromise = import('sucrase');
  }
  return sucrasePromise;
}

/**
 * Compile a TSX source string to CommonJS-flavored JS.
 *
 * Transforms applied:
 * - `typescript` — strip type annotations and interfaces
 * - `jsx` — convert JSX to React.createElement
 * - `imports` — convert ESM import/export to CJS require/module.exports
 *
 * The resulting code is runnable inside `executeSandboxed()` which
 * provides `require` / `module` / `exports` / `React` in scope.
 */
export async function compileTsx(source: string): Promise<string> {
  const { transform } = await loadSucrase();
  const result = transform(source, {
    transforms: ['typescript', 'jsx', 'imports'],
    production: true,
  });
  return result.code;
}
