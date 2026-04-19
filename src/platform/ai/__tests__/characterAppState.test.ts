import { describe, it, expect, beforeEach } from 'vitest';
import {
  getLastActiveAppId,
  setLastActiveAppId,
  _resetCharacterAppStateForTests,
} from '../characterAppState';

beforeEach(() => {
  _resetCharacterAppStateForTests();
});

describe('characterAppState', () => {
  it('getLastActiveAppId returns null for a character with no prior app activity', () => {
    expect(getLastActiveAppId('char-001')).toBeNull();
  });

  it('setLastActiveAppId then getLastActiveAppId round-trips', () => {
    setLastActiveAppId('char-001', 'xingyu');
    expect(getLastActiveAppId('char-001')).toBe('xingyu');
  });

  it('setLastActiveAppId overwrites on re-set', () => {
    setLastActiveAppId('char-001', 'xingyu');
    setLastActiveAppId('char-001', 'ai-auction');
    expect(getLastActiveAppId('char-001')).toBe('ai-auction');
  });

  it('different characters maintain independent state', () => {
    setLastActiveAppId('char-001', 'xingyu');
    setLastActiveAppId('char-002', 'ai-auction');
    expect(getLastActiveAppId('char-001')).toBe('xingyu');
    expect(getLastActiveAppId('char-002')).toBe('ai-auction');
  });
});
