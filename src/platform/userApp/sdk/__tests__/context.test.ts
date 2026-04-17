import { describe, expect, it } from 'vitest';
import {
  getCurrentAppId,
  withUserAppContext,
  NoUserAppContextError,
} from '../context';

describe('user app SDK context', () => {
  it('throws outside a runtime context', () => {
    expect(() => getCurrentAppId()).toThrow(NoUserAppContextError);
  });

  it('provides appId inside withUserAppContext callback', () => {
    const result = withUserAppContext('my-todo', () => {
      return getCurrentAppId();
    });
    expect(result).toBe('my-todo');
  });

  it('restores previous value on nested contexts', () => {
    withUserAppContext('outer', () => {
      expect(getCurrentAppId()).toBe('outer');
      withUserAppContext('inner', () => {
        expect(getCurrentAppId()).toBe('inner');
      });
      expect(getCurrentAppId()).toBe('outer');
    });
  });

  it('restores absence after context exit', () => {
    withUserAppContext('x', () => getCurrentAppId());
    expect(() => getCurrentAppId()).toThrow(NoUserAppContextError);
  });
});
