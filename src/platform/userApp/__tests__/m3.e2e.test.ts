import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { install, uninstall } from '../installer';
import { AppScene } from '@/apps/AppScene';
import { appRegistry } from '@/platform/appRegistry';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { usePhoneOwnerStore } from '@/platform/stores/phoneOwnerStore';
import { useToastStore } from '@/system';
import { registerBuiltins } from '@/apps/registerBuiltins';
import {
  getDB,
  APP_META_STORE,
  APP_SRC_STORE,
  APP_KV_STORE,
} from '@/platform/storage/idbStorage';
import { loadFixtureZip } from './fixtures/loadFixture';

async function resetAll(): Promise<void> {
  cleanup();
  useInstalledUserAppsStore.setState({ apps: [] });
  useAppRuntimeStore.setState({
    appEvents: {},
    openParams: {},
    activeAppId: null,
    recentApps: [],
  });
  usePhoneOwnerStore.setState({ phoneOwnerId: null });
  useToastStore.setState({ message: null, visible: false });
  appRegistry.list().forEach((e) => appRegistry.unregister(e.id));
  const db = await getDB();
  const stores = [APP_META_STORE, APP_SRC_STORE, APP_KV_STORE];
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    stores.forEach((s) => tx.objectStore(s).clear());
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  registerBuiltins();
}

describe('M3 E2E — shop + wallet Deep Link + toast', () => {
  beforeEach(() => resetAll());

  it('installs both fixtures and registers them in appRegistry', async () => {
    await install(await loadFixtureZip('shop-app'));
    await install(await loadFixtureZip('wallet-app'));

    expect(appRegistry.has('test-shop')).toBe(true);
    expect(appRegistry.has('test-wallet')).toBe(true);

    const names = useInstalledUserAppsStore.getState().apps.map((a) => a.id).sort();
    expect(names).toEqual(['test-shop', 'test-wallet']);
  });

  it('shop renders the item and price', async () => {
    await install(await loadFixtureZip('shop-app'));
    await install(await loadFixtureZip('wallet-app'));

    await act(async () => {
      render(React.createElement(AppScene, { appId: 'test-shop' }));
    });

    expect(screen.getByTestId('shop-title')).toHaveTextContent('测试商场');
    expect(screen.getByTestId('shop-price')).toHaveTextContent('100');
  });

  it('clicking "立即购买" switches to wallet and writes Deep Link params', async () => {
    await install(await loadFixtureZip('shop-app'));
    await install(await loadFixtureZip('wallet-app'));

    await act(async () => {
      render(React.createElement(AppScene, { appId: 'test-shop' }));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('shop-buy'));
    });

    const runtime = useAppRuntimeStore.getState();
    expect(runtime.activeAppId).toBe('test-wallet');
    expect(runtime.openParams['test-wallet']).toEqual({
      action: 'pay',
      amount: 100,
      item: '宝剑',
      callback: 'test-shop',
    });
  });

  it('wallet reads openParams and shows the pay UI with correct amount', async () => {
    await install(await loadFixtureZip('shop-app'));
    await install(await loadFixtureZip('wallet-app'));

    // Directly seed openParams and activeAppId (simulating the shop click)
    useAppRuntimeStore.setState({
      openParams: {
        'test-wallet': {
          action: 'pay',
          amount: 100,
          item: '宝剑',
          callback: 'test-shop',
        },
      },
      activeAppId: 'test-wallet',
    });

    await act(async () => {
      render(React.createElement(AppScene, { appId: 'test-wallet' }));
    });

    expect(screen.getByTestId('wallet-title')).toHaveTextContent('支付确认');
    expect(screen.getByTestId('wallet-item')).toHaveTextContent('宝剑');
    expect(screen.getByTestId('wallet-amount')).toHaveTextContent('100');
  });

  it('wallet "确认支付" switches back to shop with result params', async () => {
    await install(await loadFixtureZip('shop-app'));
    await install(await loadFixtureZip('wallet-app'));

    useAppRuntimeStore.setState({
      openParams: {
        'test-wallet': {
          action: 'pay',
          amount: 100,
          item: '宝剑',
          callback: 'test-shop',
        },
      },
      activeAppId: 'test-wallet',
    });

    await act(async () => {
      render(React.createElement(AppScene, { appId: 'test-wallet' }));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('wallet-confirm'));
    });

    const runtime = useAppRuntimeStore.getState();
    expect(runtime.activeAppId).toBe('test-shop');
    expect(runtime.openParams['test-shop']).toEqual({
      result: 'success',
      amount: 100,
    });
  });

  it('shop shows a success toast after receiving result params on re-mount', async () => {
    await install(await loadFixtureZip('shop-app'));
    await install(await loadFixtureZip('wallet-app'));

    // Seed the result params directly — simulating wallet having bounced back.
    useAppRuntimeStore.setState({
      openParams: {
        'test-shop': { result: 'success', amount: 100 },
      },
      activeAppId: 'test-shop',
    });

    await act(async () => {
      render(React.createElement(AppScene, { appId: 'test-shop' }));
    });

    // The toast is fired in a useEffect after mount — flush effects.
    await act(async () => {
      await Promise.resolve();
    });

    expect(useToastStore.getState().message).toBe('支付 100 成功');
  });

  it('nav.open with unregistered appId surfaces a toast and does not switch', async () => {
    // Only install shop so that `test-wallet` is NOT registered.
    await install(await loadFixtureZip('shop-app'));
    expect(appRegistry.has('test-wallet')).toBe(false);

    await act(async () => {
      render(React.createElement(AppScene, { appId: 'test-shop' }));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('shop-buy'));
    });

    const runtime = useAppRuntimeStore.getState();
    expect(runtime.activeAppId).toBe(null);
    expect(runtime.openParams['test-wallet']).toBeUndefined();
    expect(useToastStore.getState().message).toContain('test-wallet');
  });

  it('uninstall removes an app from registry and store', async () => {
    await install(await loadFixtureZip('shop-app'));
    await install(await loadFixtureZip('wallet-app'));

    await uninstall('test-wallet');

    expect(appRegistry.has('test-wallet')).toBe(false);
    const remaining = useInstalledUserAppsStore.getState().apps.map((a) => a.id);
    expect(remaining).toEqual(['test-shop']);
  });

  it('shop reads wallet balance via service without mounting wallet', async () => {
    await install(await loadFixtureZip('shop-app'));
    await install(await loadFixtureZip('wallet-app'));

    // Only shop renders. Wallet UI is never mounted.
    await act(async () => {
      render(React.createElement(AppScene, { appId: 'test-shop' }));
    });
    // Flush the mount-effect's async invoke:
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(screen.getByTestId('shop-balance')).toHaveTextContent(/1000/);
  });

  it('shop shows "余额不足" when seeded balance is below item price', async () => {
    await install(await loadFixtureZip('shop-app'));
    await install(await loadFixtureZip('wallet-app'));

    // Seed wallet's balance to 50 directly in IDB so the service returns 50.
    // @hiphone/storage writes the owner-prefixed key `test-wallet:owner:me:balance`.
    const { appStorageSet } = await import('@/platform/userApp/appStorage');
    await appStorageSet('test-wallet', 'test-wallet:owner:me:balance', {
      appId: 'test-wallet',
      scope: 'owner',
      ownerId: 'me',
      userKey: 'balance',
      value: 50,
    });

    await act(async () => {
      render(React.createElement(AppScene, { appId: 'test-shop' }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(screen.getByTestId('shop-balance')).toHaveTextContent(/50/);
    const btn = screen.getByTestId('shop-buy') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('余额不足');
  });
});
