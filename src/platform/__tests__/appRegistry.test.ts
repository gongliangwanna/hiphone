import { beforeEach, describe, expect, it } from 'vitest';
import { appRegistry } from '../appRegistry';

function Stub() { return null; }

describe('appRegistry', () => {
  beforeEach(() => {
    appRegistry.list().forEach((e) => appRegistry.unregister(e.id));
  });

  it('register + get returns the registered entry', () => {
    appRegistry.register({
      id: 'foo',
      name: 'Foo',
      type: 'builtin',
      component: Stub,
      perspectiveAware: false,
      globalData: false,
    });
    expect(appRegistry.get('foo')?.id).toBe('foo');
    expect(appRegistry.get('foo')?.component).toBe(Stub);
  });

  it('has returns true after register, false after unregister', () => {
    expect(appRegistry.has('foo')).toBe(false);
    appRegistry.register({
      id: 'foo', name: 'Foo', type: 'builtin', component: Stub,
      perspectiveAware: false, globalData: false,
    });
    expect(appRegistry.has('foo')).toBe(true);
    appRegistry.unregister('foo');
    expect(appRegistry.has('foo')).toBe(false);
  });

  it('list returns all registered entries', () => {
    appRegistry.register({
      id: 'a', name: 'A', type: 'builtin', component: Stub,
      perspectiveAware: false, globalData: false,
    });
    appRegistry.register({
      id: 'b', name: 'B', type: 'user', component: Stub,
      perspectiveAware: true, globalData: false,
    });
    expect(appRegistry.list().map((e) => e.id).sort()).toEqual(['a', 'b']);
  });

  it('unregister on unknown id does not throw', () => {
    expect(() => appRegistry.unregister('nope')).not.toThrow();
  });

  it('re-register overrides existing entry', () => {
    function A() { return null; }
    function B() { return null; }
    appRegistry.register({
      id: 'foo', name: 'Foo', type: 'builtin', component: A,
      perspectiveAware: false, globalData: false,
    });
    appRegistry.register({
      id: 'foo', name: 'Foo v2', type: 'user', component: B,
      perspectiveAware: true, globalData: false,
    });
    expect(appRegistry.get('foo')?.component).toBe(B);
    expect(appRegistry.get('foo')?.type).toBe('user');
  });
});
