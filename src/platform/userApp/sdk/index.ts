import React from 'react';
import * as hiphoneUi from './ui';
import * as hiphoneStorage from './storage';

/**
 * Module registry for the user-app sandbox.
 *
 * Keys: bare import specifiers users can write in their TSX
 * Values: the actual module object returned to `require(specifier)`
 *
 * Expanding this table adds new SDK surface. M1 is intentionally tiny
 * so errors from missing modules surface clearly during development.
 */
const moduleMap: Record<string, unknown> = {
  react: React,
  '@hiphone/ui': hiphoneUi,
  '@hiphone/storage': hiphoneStorage,
};

/**
 * Resolve a bare import specifier to its module object.
 *
 * Used as the `ModuleResolver` passed to `executeSandboxed()`.
 * Throws on unknown specifier — user apps must use only the SDK
 * surface exposed here, not arbitrary npm packages.
 */
export function resolveModule(specifier: string): unknown {
  // `Object.hasOwn` (ES2022) only checks own properties; the `in` operator
  // would walk the prototype chain and leak e.g. `toString`, `constructor`.
  // Runtime is modern (Node 16.9+, evergreen browsers — same promise
  // sandbox.ts relies on for ES2022 `Error { cause }`); tsconfig lib is
  // ES2020 so the type isn't on the default surface — cast to get it.
  const ObjectWithHasOwn = Object as ObjectConstructor & {
    hasOwn(o: object, v: PropertyKey): boolean;
  };
  if (ObjectWithHasOwn.hasOwn(moduleMap, specifier)) return moduleMap[specifier];
  throw new Error(
    `Module not found in hiPhone user-app SDK: "${specifier}". ` +
      `Available: ${Object.keys(moduleMap).join(', ')}`,
  );
}
