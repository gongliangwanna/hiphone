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
 * Compile a TSX source string to CommonJS-flavored JS with an inline
 * source map appended as a base64-encoded sourceMappingURL comment.
 *
 * The inline source map means browser devtools automatically map
 * stack traces back to the original TSX source lines, giving user-app
 * authors meaningful error locations without any runtime library.
 *
 * Transforms applied:
 * - `typescript` — strip type annotations and interfaces
 * - `jsx` — convert JSX to React.createElement
 * - `imports` — convert ESM import/export to CJS require/module.exports
 *
 * The resulting code is runnable inside `executeSandboxed()` which
 * provides `require` / `module` / `exports` / `React` in scope.
 *
 * @param source — raw TSX source
 * @param filePath — optional logical path for the source map (default 'userApp.tsx')
 */
export async function compileTsx(
  source: string,
  filePath = 'userApp.tsx',
): Promise<string> {
  const { transform } = await loadSucrase();
  const result = transform(source, {
    transforms: ['typescript', 'jsx', 'imports'],
    production: true,
    filePath,
    sourceMapOptions: { compiledFilename: `${filePath}.compiled.js` },
  });

  let code = result.code;
  if (result.sourceMap) {
    const mapJson = JSON.stringify(result.sourceMap);
    const mapBase64 = encodeBase64(mapJson);
    code += `\n//# sourceMappingURL=data:application/json;base64,${mapBase64}\n`;
  }
  return code;
}

/**
 * UTF-8-safe base64 for the source map payload. Browsers + jsdom provide
 * `btoa`; a bare Node environment (no browser globals) falls back to
 * `Buffer`. We cast the fallback because the project has no `@types/node`.
 */
function encodeBase64(input: string): string {
  if (typeof btoa !== 'undefined') {
    return btoa(unescape(encodeURIComponent(input)));
  }
  const nodeBuffer = (globalThis as { Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } } }).Buffer;
  if (nodeBuffer) {
    return nodeBuffer.from(input, 'utf8').toString('base64');
  }
  throw new Error('compileTsx: no base64 encoder available (neither btoa nor Buffer)');
}
