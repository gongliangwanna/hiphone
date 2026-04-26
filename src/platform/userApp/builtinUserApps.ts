/**
 * Built-in user apps: ship with hiPhone, run through the user-app
 * sandbox pipeline (compile → sandbox → register), but cannot be
 * uninstalled and don't appear in App Store's "installed" list.
 *
 * Why this exists:
 * - Validates the user-app SDK upper bound — these apps consume only
 *   the public `@hiphone/*` surface, proving uploaded user apps can
 *   achieve the same fidelity.
 * - Makes Sucrase a first-class production dependency: an unconditional
 *   compileTsx caller forces it into the prod bundle (CLAUDE.md note 4).
 */

import { appRegistry } from '@/platform/appRegistry';
import { compileTsx } from './compiler';
import { createUserAppRuntime } from './moduleResolver';
import { resolveModule } from './sdk';
import { wrapUserComponent } from './sdk/wrap';

export interface BuiltinUserApp {
  id: string;
  name: string;
  files: Record<string, string>;
  entry: string;
  perspectiveAware: boolean;
  globalData: boolean;
}

const TRANSLATE_PLACEHOLDER_SOURCE = `
import React from 'react';
import { NavBar } from '@hiphone/ui';

export default function TranslateApp() {
  return (
    <div style={{ height: '100%', backgroundColor: 'var(--color-systemBackground)' }}>
      <NavBar title="翻译" />
      <div style={{ padding: 20, fontSize: 17, color: 'var(--color-secondaryLabel)' }}>
        翻译功能即将上线 (S3-S5)
      </div>
    </div>
  );
}
`;

export const BUILTIN_USER_APPS: BuiltinUserApp[] = [
  {
    id: 'translate',
    name: '翻译',
    entry: 'TranslateApp.tsx',
    files: {
      'TranslateApp.tsx': TRANSLATE_PLACEHOLDER_SOURCE,
    },
    perspectiveAware: true,
    globalData: false,
  },
];

export async function mountBuiltinUserApps(): Promise<void> {
  for (const app of BUILTIN_USER_APPS) {
    try {
      const compiledMap: Record<string, string> = {};
      for (const [path, source] of Object.entries(app.files)) {
        compiledMap[path] = await compileTsx(source, `${app.id}/${path}`);
      }
      const RawComponent = createUserAppRuntime(
        compiledMap,
        app.entry,
        resolveModule,
        app.id,
      );
      const WrappedComponent = wrapUserComponent(RawComponent);
      appRegistry.register({
        id: app.id,
        name: app.name,
        type: 'builtin',
        component: WrappedComponent,
        perspectiveAware: app.perspectiveAware,
        globalData: app.globalData,
      });
    } catch (err) {
      console.error(`[builtinUserApps] failed to mount "${app.id}":`, err);
    }
  }
}
