import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AppScene } from '@/apps/AppScene';
import { registerBuiltins } from '@/apps/registerBuiltins';
import { appRegistry } from '@/platform/appRegistry';

describe('app-store registration', () => {
  it('registerBuiltins registers app-store with AppStoreApp component', () => {
    // Clear then re-register to assert idempotent registration
    for (const entry of appRegistry.list()) {
      appRegistry.unregister(entry.id);
    }
    registerBuiltins();
    const entry = appRegistry.get('app-store');
    expect(entry).toBeDefined();
    expect(entry?.type).toBe('builtin');
    // App Store is globalData (玩家的商店，不随视角切换).
    expect(entry?.globalData).toBe(true);
    expect(entry?.perspectiveAware).toBe(false);
  });

  it('AppScene renders AppStoreApp for appId="app-store"', () => {
    registerBuiltins();
    const { getByText } = render(<AppScene appId="app-store" />);
    expect(getByText('App Store')).toBeInTheDocument();
  });
});
