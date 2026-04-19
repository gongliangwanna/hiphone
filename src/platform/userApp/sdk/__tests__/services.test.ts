import { beforeEach, describe, expect, it } from 'vitest';
import { registerService, invoke, list } from '../services';
import { withUserAppContext } from '../context';
import { serviceRegistry } from '@/platform/services/serviceRegistry';

describe('@hiphone/services', () => {
  beforeEach(() => {
    serviceRegistry._resetForTests();
  });

  it('registerService uses the current app context for the appId', async () => {
    withUserAppContext('my-todo', () => {
      registerService({ name: 'noop', execute: async () => 42 });
    });
    await expect(invoke('my-todo', 'noop')).resolves.toBe(42);
  });

  it('invoke forwards params through to the registered handler', async () => {
    withUserAppContext('wallet', () => {
      registerService({
        name: 'echo',
        execute: async (p) => p,
      });
    });
    await expect(invoke('wallet', 'echo', { amount: 10 })).resolves.toEqual({ amount: 10 });
  });

  it('list returns the names an app has registered', async () => {
    withUserAppContext('wallet', () => {
      registerService({ name: 'balance', execute: async () => 100 });
      registerService({ name: 'history', execute: async () => [] });
    });
    await expect(list('wallet')).resolves.toEqual(
      expect.arrayContaining(['balance', 'history']),
    );
  });
});
