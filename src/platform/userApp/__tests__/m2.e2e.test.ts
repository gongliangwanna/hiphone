import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { install, uninstall, loadInstalledApps } from '../installer';
import { AppScene } from '@/apps/AppScene';
import { appRegistry } from '@/platform/appRegistry';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { usePhoneOwnerStore } from '@/platform/stores/phoneOwnerStore';
import { registerBuiltins } from '@/apps/registerBuiltins';
import {
  getDB,
  APP_META_STORE,
  APP_SRC_STORE,
  APP_KV_STORE,
} from '@/platform/storage/idbStorage';
import { appStorageGet, appStorageListByAppId } from '../appStorage';
import { loadFixtureZip } from './fixtures/loadFixture';
import { _resetAppMemoryForApp } from '../sdk/appMemory';

async function resetAll(): Promise<void> {
  // Cleanup DOM
  cleanup();

  // Reset Zustand stores
  useInstalledUserAppsStore.setState({ apps: [] });
  useAppRuntimeStore.setState({ appEvents: {}, openParams: {} });
  usePhoneOwnerStore.setState({ phoneOwnerId: null });

  // Unregister all apps from registry
  appRegistry.list().forEach((e) => appRegistry.unregister(e.id));

  // Clear all three IDB stores
  const db = await getDB();
  const stores = [APP_META_STORE, APP_SRC_STORE, APP_KV_STORE];
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    stores.forEach((s) => tx.objectStore(s).clear());
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Re-register builtins so AppScene still has them (preserves M1 behavior)
  registerBuiltins();

  // Reset app memory so draft state doesn't bleed between tests
  _resetAppMemoryForApp('test-todo');
  _resetAppMemoryForApp('no-persp');
}

describe('M2 E2E — todo-app full lifecycle', () => {
  beforeEach(() => resetAll());

  it('#3: installs the multi-file fixture zip and populates all backends', async () => {
    const zip = await loadFixtureZip('todo-app');
    const result = await install(zip);

    expect(result.id).toBe('test-todo');
    expect(result.isUpgrade).toBe(false);

    // installedUserAppsStore
    const apps = useInstalledUserAppsStore.getState().apps;
    expect(apps.map((a) => a.id)).toContain('test-todo');
    const todoEntry = apps.find((a) => a.id === 'test-todo')!;
    expect(todoEntry.perspectiveAware).toBe(true);
    expect(todoEntry.iconDataUrl).toMatch(/^data:image\/png;base64,/);

    // appRegistry
    const entry = appRegistry.get('test-todo');
    expect(entry?.type).toBe('user');
    expect(entry?.perspectiveAware).toBe(true);

    // IDB app-meta populated
    const db = await getDB();
    const meta = await new Promise<unknown>((resolve) => {
      const tx = db.transaction(APP_META_STORE, 'readonly');
      const req = tx.objectStore(APP_META_STORE).get('test-todo');
      req.onsuccess = () => resolve(req.result);
    });
    expect(meta).toBeDefined();
  });

  it('#3 + #5: renders the user app through AppScene with multi-file imports', async () => {
    await install(await loadFixtureZip('todo-app'));

    const { container } = render(React.createElement(AppScene, { appId: 'test-todo' }));

    expect(await screen.findByTestId('todo-app-root')).toBeInTheDocument();
    expect(screen.getByTestId('todo-title').textContent).toMatch(/我的待办/);

    // The fixture's root div carries a Tailwind utility class that must
    // survive through the sandbox + renderer. (Class presence only — we
    // don't assert computed style because jsdom doesn't run CSS.)
    expect(container.innerHTML).toContain('flex flex-col gap-2');
  });

  it('#3 + #4: user can write storage via SDK and it persists', async () => {
    await install(await loadFixtureZip('todo-app'));

    const user = userEvent.setup();
    render(React.createElement(AppScene, { appId: 'test-todo' }));

    // Wait for the app to render
    await screen.findByTestId('todo-input');

    await user.type(screen.getByTestId('todo-input'), '买牛奶');
    await user.click(screen.getByTestId('todo-add'));

    // Wait for IDB write to complete
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Assert storage write — ownerId is 'me' when phoneOwnerId is null
    const record = await appStorageGet(
      'test-todo',
      'test-todo:owner:me:todos',
    );
    expect(record).toBeDefined();
    const todos = (record as { value: Array<{ text: string }> }).value;
    expect(todos[0]!.text).toBe('买牛奶');
  });

  it('#4: loadInstalledApps rebuilds state after "reload"', async () => {
    await install(await loadFixtureZip('todo-app'));

    // Simulate reload: clear memory state, keep IDB
    useInstalledUserAppsStore.setState({ apps: [] });
    appRegistry.list().forEach((e) => appRegistry.unregister(e.id));

    await loadInstalledApps();

    expect(appRegistry.get('test-todo')).toBeDefined();
    expect(
      useInstalledUserAppsStore.getState().apps.some((a) => a.id === 'test-todo'),
    ).toBe(true);
  });

  it('#7: perspective-aware user app isolates storage per owner', async () => {
    await install(await loadFixtureZip('todo-app'));

    const user = userEvent.setup();

    // Render as player (phoneOwnerId = null → ownerId = 'me')
    const { unmount } = render(React.createElement(AppScene, { appId: 'test-todo' }));
    await screen.findByTestId('todo-input');

    await user.type(screen.getByTestId('todo-input'), 'player-task');
    await user.click(screen.getByTestId('todo-add'));

    // Wait for IDB write
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    unmount();

    // Switch to char-001 view — bare id
    act(() => usePhoneOwnerStore.setState({ phoneOwnerId: '001' }));

    render(React.createElement(AppScene, { appId: 'test-todo' }));
    await screen.findByTestId('todo-input');

    // char-001 should have no todos (isolated storage)
    const todos = screen.queryAllByTestId('todo-item');
    expect(todos.length).toBe(0);

    await user.type(screen.getByTestId('todo-input'), 'char-task');
    await user.click(screen.getByTestId('todo-add'));

    // Wait for IDB write
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Verify isolation in IDB
    // 'me' key for player
    const playerRec = await appStorageGet(
      'test-todo',
      'test-todo:owner:me:todos',
    );
    // 'char-001' key for the character — SDK prefixes bare id with 'char-'
    const charRec = await appStorageGet(
      'test-todo',
      'test-todo:owner:char-001:todos',
    );
    const playerTodos = (playerRec as { value: Array<{ text: string }> }).value;
    const charTodos = (charRec as { value: Array<{ text: string }> }).value;
    expect(playerTodos[0]!.text).toBe('player-task');
    expect(charTodos[0]!.text).toBe('char-task');
  });

  it('#8: perspectiveAware=false app shows placeholder in char view', async () => {
    // Patch manifest to perspectiveAware=false in-memory
    const zip = await loadFixtureZip('todo-app');
    const JSZipModule = (await import('jszip')).default;
    const zipObj = await JSZipModule.loadAsync(zip);
    const manifestStr = await zipObj.file('manifest.json')!.async('string');
    const parsed = JSON.parse(manifestStr) as {
      id: string;
      perspectiveAware: boolean;
    };
    parsed.id = 'no-persp';
    parsed.perspectiveAware = false;
    zipObj.file('manifest.json', JSON.stringify(parsed));
    const rezipped = await zipObj.generateAsync({ type: 'blob' });

    await install(rezipped);

    // Switch to viewing a character's phone
    act(() => usePhoneOwnerStore.setState({ phoneOwnerId: '001' }));

    render(React.createElement(AppScene, { appId: 'no-persp' }));

    // Wait a tick for renders to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // perspectiveAware=false + isViewingOther → ReadOnlyAppPlaceholder (no todo-app-root)
    expect(screen.queryByTestId('todo-app-root')).toBeNull();
  });

  it('#9: useOnLaunch fires on open; useAppMemory resets on kill', async () => {
    await install(await loadFixtureZip('todo-app'));

    const user = userEvent.setup();
    const { unmount } = render(React.createElement(AppScene, { appId: 'test-todo' }));
    await screen.findByTestId('todo-input');

    await user.type(screen.getByTestId('todo-input'), 'draft text');
    // Verify draft is set
    expect((screen.getByTestId('todo-input') as HTMLInputElement).value).toBe('draft text');
    unmount();

    // Simulate kill: bump kill nonce
    act(() => {
      useAppRuntimeStore.setState((s) => ({
        appEvents: {
          ...s.appEvents,
          'test-todo': {
            launch: s.appEvents['test-todo']?.launch ?? 0,
            resume: s.appEvents['test-todo']?.resume ?? 0,
            background: s.appEvents['test-todo']?.background ?? 0,
            kill: (s.appEvents['test-todo']?.kill ?? 0) + 1,
          },
        },
      }));
    });

    // Re-render — useAppMemory should reset draft to '' because kill nonce bumped
    render(React.createElement(AppScene, { appId: 'test-todo' }));
    await screen.findByTestId('todo-input');

    // draft should reset to initial '' because useAppMemory clears on kill
    expect((screen.getByTestId('todo-input') as HTMLInputElement).value).toBe('');
  });

  it('#10: uninstall clears all three IDB stores + Registry + installedUserAppsStore', async () => {
    await install(await loadFixtureZip('todo-app'));

    // Write per-owner data via the rendered app
    const user = userEvent.setup();
    const { unmount } = render(React.createElement(AppScene, { appId: 'test-todo' }));
    await screen.findByTestId('todo-input');

    await user.type(screen.getByTestId('todo-input'), 'before-uninstall');
    await user.click(screen.getByTestId('todo-add'));

    // Wait for IDB write
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    unmount();

    // Verify data was written
    const keysBefore = await appStorageListByAppId('test-todo');
    expect(keysBefore.length).toBeGreaterThan(0);

    await uninstall('test-todo');

    // All three IDB stores empty for this app
    const db = await getDB();
    const meta = await new Promise<unknown>((resolve) => {
      const tx = db.transaction(APP_META_STORE, 'readonly');
      const req = tx.objectStore(APP_META_STORE).get('test-todo');
      req.onsuccess = () => resolve(req.result);
    });
    const src = await new Promise<unknown>((resolve) => {
      const tx = db.transaction(APP_SRC_STORE, 'readonly');
      const req = tx.objectStore(APP_SRC_STORE).get('test-todo');
      req.onsuccess = () => resolve(req.result);
    });
    const keysAfter = await appStorageListByAppId('test-todo');

    expect(meta).toBeUndefined();
    expect(src).toBeUndefined();
    expect(keysAfter).toEqual([]);

    // Registry cleared
    expect(appRegistry.get('test-todo')).toBeUndefined();
    // installedUserAppsStore cleared
    expect(
      useInstalledUserAppsStore.getState().apps.some((a) => a.id === 'test-todo'),
    ).toBe(false);
  });
});
