import { beforeEach, describe, expect, it } from 'vitest';
import {
  serviceRegistry,
  ServiceNotFoundError,
  type ServiceDef,
} from '../serviceRegistry';

function def(name: string, value: unknown): ServiceDef {
  return { name, execute: async () => value };
}

describe('serviceRegistry — sync surface', () => {
  beforeEach(() => {
    serviceRegistry._resetForTests();
  });

  it('register + list returns the names', async () => {
    serviceRegistry.register('xingyu', def('postMoment', null));
    serviceRegistry.register('xingyu', def('likeMoment', null));
    const names = await serviceRegistry.list('xingyu');
    expect(names.sort()).toEqual(['likeMoment', 'postMoment']);
  });

  it('register replaces a prior service with the same name (hot reload semantics)', async () => {
    serviceRegistry.register('xingyu', { name: 'x', execute: async () => 1 });
    serviceRegistry.register('xingyu', { name: 'x', execute: async () => 2 });
    const v = await serviceRegistry.invoke('xingyu', 'x');
    expect(v).toBe(2);
  });

  it('unregisterApp clears all services for that app', async () => {
    serviceRegistry.register('xingyu', def('a', 1));
    serviceRegistry.register('xingyu', def('b', 2));
    serviceRegistry.register('notes', def('c', 3));

    serviceRegistry.unregisterApp('xingyu');

    await expect(serviceRegistry.list('xingyu')).resolves.toEqual([]);
    await expect(serviceRegistry.list('notes')).resolves.toEqual(['c']);
  });

  it('invoke returns the handler value', async () => {
    serviceRegistry.register('w', { name: 'ping', execute: async () => 'pong' });
    await expect(serviceRegistry.invoke('w', 'ping')).resolves.toBe('pong');
  });

  it('invoke passes params through to the handler', async () => {
    serviceRegistry.register('w', {
      name: 'echo',
      execute: async (p) => p,
    });
    await expect(serviceRegistry.invoke('w', 'echo', { hi: 1 })).resolves.toEqual({ hi: 1 });
  });

  it('invoke rejects with ServiceNotFoundError when app is empty', async () => {
    await expect(serviceRegistry.invoke('unknown-app', 'x')).rejects.toBeInstanceOf(
      ServiceNotFoundError,
    );
  });

  it('invoke rejects with ServiceNotFoundError when service name is missing', async () => {
    serviceRegistry.register('w', def('a', 1));
    await expect(serviceRegistry.invoke('w', 'b')).rejects.toBeInstanceOf(
      ServiceNotFoundError,
    );
  });

  it('handler errors propagate unchanged to the caller', async () => {
    const boom = new Error('boom');
    serviceRegistry.register('w', {
      name: 'fail',
      execute: async () => { throw boom; },
    });
    await expect(serviceRegistry.invoke('w', 'fail')).rejects.toBe(boom);
  });
});
