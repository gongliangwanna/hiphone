import React from 'react';
import * as hiphoneUi from './ui';

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
};

/**
 * Resolve a bare import specifier to its module object.
 *
 * Used as the `ModuleResolver` passed to `executeSandboxed()`.
 * Throws on unknown specifier — user apps must use only the SDK
 * surface exposed here, not arbitrary npm packages.
 */
export function resolveModule(specifier: string): unknown {
  if (specifier in moduleMap) return moduleMap[specifier];
  throw new Error(
    `Module not found in hiPhone user-app SDK: "${specifier}". ` +
      `Available: ${Object.keys(moduleMap).join(', ')}`,
  );
}
