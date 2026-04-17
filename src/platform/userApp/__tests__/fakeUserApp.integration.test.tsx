import { render, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRegistry } from '@/platform/appRegistry';
import { AppScene } from '@/apps/AppScene';
import { mountFakeUserApp } from '../devIcon';
import { FAKE_USER_APP_ID } from '../fakeUserApp';

describe('M1 e2e — fake user app pipeline', () => {
  beforeEach(() => {
    appRegistry.unregister(FAKE_USER_APP_ID);
  });

  afterEach(() => {
    cleanup();
    appRegistry.unregister(FAKE_USER_APP_ID);
  });

  it('compiles, sandboxes, wraps, and registers the fake app', async () => {
    await mountFakeUserApp();

    const entry = appRegistry.get(FAKE_USER_APP_ID);
    expect(entry).toBeDefined();
    expect(entry?.type).toBe('user');
    expect(typeof entry?.component).toBe('function');
  });

  it('AppScene renders the fake app after mounting', async () => {
    await mountFakeUserApp();

    const { container } = render(<AppScene appId={FAKE_USER_APP_ID} />);

    expect(container.textContent).toContain('假用户 app');
    expect(container.textContent).toContain('Hello from sandbox!');
  });

  it('calling mountFakeUserApp twice is idempotent (single entry, not duplicated)', async () => {
    await mountFakeUserApp();
    await mountFakeUserApp();

    // Registry uses Map.set, so re-register overrides — total entries should still be 1.
    expect(appRegistry.list()).toHaveLength(1);
    expect(appRegistry.get(FAKE_USER_APP_ID)).toBeDefined();
  });
});
