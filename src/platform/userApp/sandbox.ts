import React from 'react';
import type { ComponentType } from 'react';

/**
 * Module resolver function: maps a bare specifier (e.g. 'react',
 * '@hiphone/ui') to the actual module object. Throws on unknown
 * specifiers. Typically wired to `src/platform/userApp/sdk/index.ts`.
 */
export type ModuleResolver = (specifier: string) => unknown;

const SHADOWED_GLOBALS = [
  'window',
  'document',
  'globalThis',
  'fetch',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'XMLHttpRequest',
  'WebSocket',
  'Worker',
];

const SHADOWED_VALUES = SHADOWED_GLOBALS.map(() => undefined);

/**
 * Low-level sandbox execution. Runs `compiledCode` with caller-owned
 * `require` and `module`. Used by `moduleResolver` to load each file
 * in a multi-file user app while sharing the module cache across calls.
 *
 * Does NOT inspect `module.exports.default`. The caller decides what to
 * do with the populated exports (the single-file case uses
 * `executeSandboxed` which pulls `.default`; the multi-file case
 * stores the whole exports object in a cache keyed by file path).
 */
export function executeInSandbox(
  compiledCode: string,
  require: (specifier: string) => unknown,
  module: { exports: any },
): void {
  const fn = new Function(
    ...SHADOWED_GLOBALS,
    'module',
    'exports',
    'require',
    'React',
    compiledCode,
  );

  try {
    fn(...SHADOWED_VALUES, module, module.exports, require, React);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const ErrorWithCause = Error as new (
      message?: string,
      options?: { cause?: unknown },
    ) => Error;
    throw new ErrorWithCause(
      `User app module initialization failed: ${message}`,
      { cause: err },
    );
  }
}

/**
 * High-level backward-compat wrapper: execute a single compiled module
 * and return its `default` export as a React component.
 *
 * Used by DEV icon path where the fake app is a single file. The
 * multi-file installer path uses `createUserAppRuntime` in
 * `moduleResolver.ts` instead.
 */
export function executeSandboxed(
  compiledCode: string,
  resolve: ModuleResolver,
): ComponentType {
  const module: { exports: { default?: ComponentType } } = { exports: {} };
  const require = (specifier: string): unknown => resolve(specifier);
  executeInSandbox(compiledCode, require, module);

  const Component = module.exports.default;
  if (typeof Component !== 'function') {
    throw new Error(
      'User app compiled code did not export a default component (function)',
    );
  }
  return Component;
}
