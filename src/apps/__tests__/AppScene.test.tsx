import { render, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ComponentType } from 'react';
import { appRegistry } from '@/platform/appRegistry';
import { AppScene } from '../AppScene';
import { usePhoneOwnerStore } from '@/platform/stores/phoneOwnerStore';
import { useCharacterStore } from '@/platform/stores/characterStore';

const makeStub = (label: string): ComponentType =>
  function Stub() { return <div data-testid="stub">{label}</div>; };

function registerStub(opts: {
  id: string;
  perspectiveAware: boolean;
  globalData: boolean;
  label: string;
}) {
  appRegistry.register({
    id: opts.id,
    name: opts.label,
    type: 'builtin',
    component: makeStub(opts.label),
    perspectiveAware: opts.perspectiveAware,
    globalData: opts.globalData,
  });
}

describe('AppScene (post-Registry refactor)', () => {
  beforeEach(() => {
    appRegistry.list().forEach((e) => appRegistry.unregister(e.id));
    usePhoneOwnerStore.setState({ phoneOwnerId: null });
    useCharacterStore.setState({
      characters: [{
        id: 'char-001', name: '测试角色', avatar: '',
        description: '', personality: '', scenario: '',
        firstMessage: '',
        messageExamples: '', alternateGreetings: [],
        systemPrompt: '', postHistoryInstructions: '',
        creatorNotes: '', tags: [], version: '',
      }],
    });
  });

  afterEach(() => {
    cleanup();
    appRegistry.list().forEach((e) => appRegistry.unregister(e.id));
  });

  it('renders the registered component when viewing as player', () => {
    registerStub({ id: 'app-a', perspectiveAware: false, globalData: false, label: 'A-RENDER' });

    const { getByTestId } = render(<AppScene appId="app-a" />);
    expect(getByTestId('stub').textContent).toBe('A-RENDER');
  });

  it('renders DemoApp fallback for unknown appId', () => {
    const { container } = render(<AppScene appId="nonexistent-app-xyz" />);
    // DemoApp tags its root with data-testid="demo-app-${appId}"; we check
    // that attribute rather than textContent (DemoApp renders the app *name*,
    // not the id, so unknown ids produce generic "App" text).
    expect(container.querySelector('[data-testid="demo-app-nonexistent-app-xyz"]')).not.toBeNull();
  });

  it('renders perspective-aware app normally when viewing another phone', () => {
    registerStub({ id: 'app-pa', perspectiveAware: true, globalData: false, label: 'PA-RENDER' });
    usePhoneOwnerStore.setState({ phoneOwnerId: 'char-001' });

    const { getByTestId } = render(<AppScene appId="app-pa" />);
    expect(getByTestId('stub').textContent).toBe('PA-RENDER');
  });

  it('renders global-data app normally when viewing another phone', () => {
    registerStub({ id: 'app-gd', perspectiveAware: false, globalData: true, label: 'GD-RENDER' });
    usePhoneOwnerStore.setState({ phoneOwnerId: 'char-001' });

    const { getByTestId } = render(<AppScene appId="app-gd" />);
    expect(getByTestId('stub').textContent).toBe('GD-RENDER');
  });

  it('shows read-only placeholder for non-perspective, non-global app when viewing another phone', () => {
    registerStub({ id: 'app-ro', perspectiveAware: false, globalData: false, label: 'RO-RENDER' });
    usePhoneOwnerStore.setState({ phoneOwnerId: 'char-001' });

    const { container, queryByTestId } = render(<AppScene appId="app-ro" />);
    expect(queryByTestId('stub')).toBeNull();
    expect(container.textContent).toContain('测试角色');
    expect(container.textContent).toContain('暂无数据');
  });

  it('shows read-only placeholder for unknown appId when viewing another phone', () => {
    // Unregistered ids (icons without a real component, e.g. 'alipay',
    // 'messages' on the springboard) should STILL show the character-
    // scoped placeholder — matching pre-Registry behavior. The fallback
    // to DemoApp only applies when the player is viewing their own phone.
    usePhoneOwnerStore.setState({ phoneOwnerId: 'char-001' });

    const { container, queryByTestId } = render(<AppScene appId="unregistered-foo" />);
    // No stub rendered (appId has no registry entry)
    expect(queryByTestId('stub')).toBeNull();
    // No DemoApp either
    expect(container.querySelector('[data-testid="demo-app-unregistered-foo"]')).toBeNull();
    // Placeholder shown instead
    expect(container.textContent).toContain('测试角色');
    expect(container.textContent).toContain('暂无数据');
  });
});
