import { appRegistry } from '@/platform/appRegistry';
import { compileTsx } from './compiler';
import { executeSandboxed } from './sandbox';
import { resolveModule } from './sdk';
import { wrapUserComponent } from './sdk/wrap';
import { FAKE_USER_APP_ID, FAKE_USER_APP_SOURCE } from './fakeUserApp';

/**
 * Run the full user-app pipeline on the hardcoded fake source, and
 * register the result in appRegistry. Exported separately from the
 * DEV-gated entry point so tests (which run under Vite's test mode
 * where `import.meta.env.DEV` can be true) can invoke it
 * deterministically.
 *
 * Usage:
 * - Tests: call `mountFakeUserApp()` directly
 * - App.tsx: call `mountFakeUserAppIfDev()` (DEV-only)
 */
export async function mountFakeUserApp(): Promise<void> {
  const compiled = await compileTsx(FAKE_USER_APP_SOURCE);
  const RawComponent = executeSandboxed(compiled, resolveModule);
  const WrappedComponent = wrapUserComponent(RawComponent);

  appRegistry.register({
    id: FAKE_USER_APP_ID,
    type: 'user',
    component: WrappedComponent,
    perspectiveAware: false,
    globalData: false, // model a typical user app: per-owner data, shows placeholder when viewing another phone
  });
}

/**
 * DEV-gated entry point called from App.tsx at startup.
 * In production builds, `import.meta.env.DEV` is false and Vite's
 * dead-code elimination removes this function body entirely.
 */
export async function mountFakeUserAppIfDev(): Promise<void> {
  if (!import.meta.env.DEV) return;
  try {
    await mountFakeUserApp();
  } catch (err) {
    console.error('[DEV] Failed to mount fake user app:', err);
  }
}
