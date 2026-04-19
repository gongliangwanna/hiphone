import { beforeEach, describe, expect, it } from 'vitest';
import { registerBuiltinServices } from '../builtinServices';
import { serviceRegistry } from '../serviceRegistry';
import { usePhoneOwnerStore } from '@/platform/stores/phoneOwnerStore';
import { registerBuiltins } from '@/apps/registerBuiltins';
import { appRegistry } from '@/platform/appRegistry';

describe('registerBuiltinServices', () => {
  beforeEach(() => {
    serviceRegistry._resetForTests();
    usePhoneOwnerStore.setState({ phoneOwnerId: null });
  });

  it('populates the platform registry eagerly (no bootstrap needed)', async () => {
    registerBuiltinServices('builtin-x', [
      { name: 'a', execute: async () => 1 },
      { name: 'b', execute: async () => 2 },
    ]);
    await expect(serviceRegistry.list('builtin-x')).resolves.toEqual(
      expect.arrayContaining(['a', 'b']),
    );
  });
});

describe('Settings builtin service via registerBuiltins', () => {
  beforeEach(() => {
    serviceRegistry._resetForTests();
    // Wipe registry so registerBuiltins can run fresh.
    for (const e of appRegistry.list()) appRegistry.unregister(e.id);
    registerBuiltins();
    usePhoneOwnerStore.setState({ phoneOwnerId: null });
  });

  it('settings.currentOwnerId returns null when viewing the player phone', async () => {
    await expect(
      serviceRegistry.invoke('settings', 'currentOwnerId'),
    ).resolves.toBeNull();
  });

  it('settings.currentOwnerId reflects live store updates (not a snapshot)', async () => {
    usePhoneOwnerStore.setState({ phoneOwnerId: 'char-001' });
    await expect(
      serviceRegistry.invoke('settings', 'currentOwnerId'),
    ).resolves.toBe('char-001');

    usePhoneOwnerStore.setState({ phoneOwnerId: null });
    await expect(
      serviceRegistry.invoke('settings', 'currentOwnerId'),
    ).resolves.toBeNull();
  });
});
