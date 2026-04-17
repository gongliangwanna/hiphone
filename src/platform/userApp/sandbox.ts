import React from 'react';
import type { ComponentType } from 'react';

/**
 * Module resolver function: maps a bare specifier (e.g. 'react',
 * '@hiphone/ui') to the actual module object. Throws on unknown
 * specifiers. Typically wired to `src/platform/userApp/sdk/index.ts`.
 */
export type ModuleResolver = (specifier: string) => unknown;

/**
 * Execute compiled user code in a soft sandbox (L1).
 *
 * Approach: `new Function(...argNames, body)` with argNames that include
 * a list of shadowed globals (all set to `undefined`) plus the needed
 * runtime (`module`, `exports`, `require`, `React`). This removes direct
 * access to common globals without breaking referential transparency for
 * things the user *should* have (React, the SDK surface via require).
 *
 * Security assessment: see parent spec — L1 is acceptable for M1-M3
 * because user-app authors don't see host code and have no motive or
 * information to escape the sandbox. Escape is possible in principle
 * (via constructor-hop tricks), but not interesting in our threat model.
 * Architecturally we leave room for L2 (iframe sandbox) in M4+.
 */
export function executeSandboxed(
  compiledCode: string,
  resolve: ModuleResolver,
): ComponentType {
  const shadowedNames = [
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
  const shadowedValues = shadowedNames.map(() => undefined);

  const moduleObj: { exports: { default?: ComponentType } } = { exports: {} };

  const require = (specifier: string): unknown => resolve(specifier);

  const fn = new Function(
    ...shadowedNames,
    'module',
    'exports',
    'require',
    'React',
    compiledCode,
  );

  fn(
    ...shadowedValues,
    moduleObj,
    moduleObj.exports,
    require,
    React,
  );

  const Component = moduleObj.exports.default;
  if (typeof Component !== 'function') {
    throw new Error(
      'User app compiled code did not export a default component (function)',
    );
  }
  return Component;
}
