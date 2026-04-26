/**
 * Sandbox-level smoke test: a user-app TSX source that imports from
 * @hiphone/motion compiles, executes, and yields a working component.
 *
 * Catches regressions in:
 *   - Sucrase dropping the import when binding is used (CLAUDE.md note 1)
 *   - sdk/index.ts forgetting to register the module
 *   - motion/react bundle interop with the sandbox shape
 */
import { describe, it, expect } from 'vitest';
import { createElement, isValidElement } from 'react';
import { compileTsx } from '../../compiler';
import { executeSandboxed } from '../../sandbox';
import { resolveModule } from '../index';

const SOURCE = `
import React from 'react';
import { motion, AnimatePresence, spring } from '@hiphone/motion';

export default function Demo() {
  return (
    <AnimatePresence>
      <motion.div
        key="x"
        animate={{ opacity: 1 }}
        transition={spring.snappy}
      />
    </AnimatePresence>
  );
}
`;

describe('@hiphone/motion in sandbox', () => {
  it('compiles + sandboxes a component using motion + spring', async () => {
    const compiled = await compileTsx(SOURCE, 'motion-smoke.tsx');
    const Component = executeSandboxed(compiled, resolveModule);
    expect(typeof Component).toBe('function');

    // Actually invoke the component so motion + AnimatePresence + spring are
    // dereferenced. If Sucrase silently drops any binding (per CLAUDE.md note 1),
    // the call throws ReferenceError instead of silently passing.
    const element = createElement(Component);
    expect(isValidElement(element)).toBe(true);
  });
});
