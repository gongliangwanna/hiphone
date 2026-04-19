import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { uninstall } from '../installer';
import {
  registerTools,
  getTools,
  _resetToolRegistryForTests,
} from '@/platform/ai/toolRegistry';
import {
  registerReplyRenderer,
  getReplyRenderer,
  DEFAULT_XINGYU_RENDERER,
  _resetReplyRendererRegistryForTests,
} from '@/platform/ai/replyRendererRegistry';
import {
  registerAppSystemPrompt,
  getAppSystemPrompt,
  _resetAppSystemPromptRegistryForTests,
} from '@/platform/ai/appSystemPromptRegistry';
import { appRegistry } from '@/platform/appRegistry';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';

const APP_ID = 'test-cleanup-app';

beforeEach(() => {
  _resetToolRegistryForTests();
  _resetReplyRendererRegistryForTests();
  _resetAppSystemPromptRegistryForTests();
  useInstalledUserAppsStore.setState({ apps: [] } as never);
  appRegistry.unregister(APP_ID); // ignore if absent
  // Pretend the app is installed (user type) so uninstall() doesn't hit the
  // "uninstall-builtin" guard.
  appRegistry.register({
    id: APP_ID,
    type: 'user',
    component: () => null,
    perspectiveAware: false,
    globalData: false,
  });
});

describe('installer.uninstall — AI registry cleanup', () => {
  it('unregisters tools / renderer / appSystemPrompt for the app', async () => {
    registerTools(APP_ID, [{ name: 't', description: '', parameters: {} }]);
    registerReplyRenderer(APP_ID, { render: () => 'x' });
    registerAppSystemPrompt(APP_ID, () => 'p');

    expect(getTools(APP_ID)).toHaveLength(1);
    expect(getReplyRenderer(APP_ID)).not.toBe(DEFAULT_XINGYU_RENDERER);
    expect(getAppSystemPrompt(APP_ID)).not.toBeNull();

    await uninstall(APP_ID);

    expect(getTools(APP_ID)).toEqual([]);
    expect(getReplyRenderer(APP_ID)).toBe(DEFAULT_XINGYU_RENDERER);
    expect(getAppSystemPrompt(APP_ID)).toBeNull();
  });

  it('still works when the app had nothing registered (no-op)', async () => {
    await expect(uninstall(APP_ID)).resolves.toBeUndefined();
  });
});
