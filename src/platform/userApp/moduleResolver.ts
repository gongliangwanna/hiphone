import type { ComponentType } from 'react';
import { executeInSandbox, type ModuleResolver } from './sandbox';
import { withUserAppContext } from './sdk/context';

/**
 * Resolve a relative specifier (starting with `./` or `../`) to an
 * actual path in the compiledMap. Tries, in order:
 *   - as-is
 *   - with .tsx
 *   - with .ts
 *   - joined with /index.tsx
 *   - joined with /index.ts
 *
 * Throws if no candidate matches.
 */
export function resolveRelativePath(
  fromPath: string,
  specifier: string,
  compiledMap: Record<string, string>,
): string {
  const base = dirname(fromPath);
  const joined = normalize(base === '' ? specifier.replace(/^\.\//, '') : `${base}/${specifier}`);

  const candidates = [
    joined,
    `${joined}.tsx`,
    `${joined}.ts`,
    `${joined}/index.tsx`,
    `${joined}/index.ts`,
  ];
  for (const c of candidates) {
    if (Object.prototype.hasOwnProperty.call(compiledMap, c)) return c;
  }
  throw new Error(
    `moduleResolver: cannot resolve "${specifier}" from "${fromPath}". ` +
      `Tried: ${candidates.join(', ')}`,
  );
}

function dirname(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
}

function normalize(path: string): string {
  const parts: string[] = [];
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

/**
 * Execute a user app entry module top-to-bottom inside the sandbox +
 * module-resolution runtime and return the module's exports object.
 *
 * Used for both UI entries (where the caller then expects a default
 * React component) and non-UI entries like services modules (where
 * the top-level side effects — e.g. registerService — are what matter
 * and there is no default export).
 */
export function evaluateUserAppModule(
  compiledMap: Record<string, string>,
  entryPath: string,
  sdkResolve: ModuleResolver,
  appId: string,
): Record<string, unknown> {
  if (!Object.prototype.hasOwnProperty.call(compiledMap, entryPath)) {
    throw new Error(`evaluateUserAppModule: entry "${entryPath}" not in compiledMap`);
  }

  const moduleCache = new Map<string, { exports: any }>();

  function requireFrom(fromPath: string): (specifier: string) => unknown {
    return (specifier: string) => {
      if (!specifier.startsWith('.')) {
        return sdkResolve(specifier);
      }
      const resolved = resolveRelativePath(fromPath, specifier, compiledMap);
      const cached = moduleCache.get(resolved);
      if (cached) return cached.exports;

      const module = { exports: {} as any };
      moduleCache.set(resolved, module);
      withUserAppContext(appId, () =>
        executeInSandbox(compiledMap[resolved]!, requireFrom(resolved), module),
      );
      return module.exports;
    };
  }

  const entryModule = { exports: {} as any };
  moduleCache.set(entryPath, entryModule);
  withUserAppContext(appId, () =>
    executeInSandbox(compiledMap[entryPath]!, requireFrom(entryPath), entryModule),
  );
  return entryModule.exports;
}

/**
 * Build and execute a user app runtime from a compiled module map.
 *
 * Semantics (CommonJS-style):
 * - Start by executing the entry module
 * - A `require(specifier)` inside module M resolves:
 *   - SDK / host bare names → `sdkResolve(specifier)`
 *   - Relative paths → `resolveRelativePath(M, specifier, compiledMap)`
 *     then return the cached `module.exports` (executing if cold)
 * - Circular deps: a placeholder `{ exports: {} }` is put in the cache
 *   BEFORE executing the module body, so re-entry during init returns
 *   the same (partial) exports object the other side already sees.
 *
 * Returns the default export of the entry module (must be a React
 * component function).
 */
export function createUserAppRuntime(
  compiledMap: Record<string, string>,
  entryPath: string,
  sdkResolve: ModuleResolver,
  appId: string,
): ComponentType {
  const exports = evaluateUserAppModule(compiledMap, entryPath, sdkResolve, appId);
  const Component = exports.default;
  if (typeof Component !== 'function') {
    throw new Error(
      `Entry "${entryPath}" did not export a default React component`,
    );
  }

  // Wrap returned Component so render-time SDK calls (inside hooks) also
  // see the context.
  return function UserAppRoot(props: any) {
    return withUserAppContext(appId, () => (Component as any)(props));
  };
}
