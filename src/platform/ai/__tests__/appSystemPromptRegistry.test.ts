import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerAppSystemPrompt,
  getAppSystemPrompt,
  unregisterApp,
  _resetAppSystemPromptRegistryForTests,
} from '../appSystemPromptRegistry';

beforeEach(() => {
  _resetAppSystemPromptRegistryForTests();
});

describe('appSystemPromptRegistry', () => {
  it('returns null when no prompt fn is registered', () => {
    expect(getAppSystemPrompt('unknown')).toBeNull();
  });

  it('register + get returns the registered fn', () => {
    const fn = () => 'hello';
    registerAppSystemPrompt('app-a', fn);
    expect(getAppSystemPrompt('app-a')).toBe(fn);
  });

  it('the registered fn is evaluated lazily — each getAppSystemPrompt()() call re-runs it', () => {
    let count = 0;
    registerAppSystemPrompt('app-a', () => {
      count++;
      return `call #${count}`;
    });
    const retrieved = getAppSystemPrompt('app-a')!;
    expect(retrieved()).toBe('call #1');
    expect(retrieved()).toBe('call #2'); // not cached — supports dynamic content
  });

  it('unregisterApp makes subsequent getAppSystemPrompt return null', () => {
    registerAppSystemPrompt('app-a', () => 'x');
    unregisterApp('app-a');
    expect(getAppSystemPrompt('app-a')).toBeNull();
  });

  it('register replaces the previous fn for the same appId', () => {
    registerAppSystemPrompt('app-a', () => 'first');
    registerAppSystemPrompt('app-a', () => 'second');
    expect(getAppSystemPrompt('app-a')!()).toBe('second');
  });

  it('apps with different appIds are isolated', () => {
    registerAppSystemPrompt('app-a', () => 'A');
    registerAppSystemPrompt('app-b', () => 'B');
    expect(getAppSystemPrompt('app-a')!()).toBe('A');
    expect(getAppSystemPrompt('app-b')!()).toBe('B');
  });
});
