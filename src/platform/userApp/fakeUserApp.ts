/**
 * Dev-only: a hardcoded TSX string used to verify the end-to-end
 * user-app pipeline (compile → sandbox → wrap → register → render).
 *
 * Imports only what M1's minimal SDK provides:
 * - 'react' — React namespace
 * - '@hiphone/ui' — NavBar
 *
 * Removed in production builds via import.meta.env.DEV gating in
 * devIcon.ts and apps.data.ts.
 */
export const FAKE_USER_APP_ID = 'dev-fake-user-app';
export const FAKE_USER_APP_NAME = '[DEV] 假用户 app';

export const FAKE_USER_APP_SOURCE = `
import React from 'react';
import { NavBar } from '@hiphone/ui';

export default function FakeUserApp() {
  return (
    <div style={{ height: '100%', backgroundColor: 'var(--color-systemBackground)' }}>
      <NavBar title="假用户 app" />
      <div style={{ padding: 20, fontSize: 17, color: 'var(--color-label)' }}>
        Hello from sandbox!
      </div>
    </div>
  );
}
`;
