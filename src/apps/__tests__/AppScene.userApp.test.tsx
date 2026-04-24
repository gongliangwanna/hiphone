import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AppScene } from '../AppScene';
import { appRegistry } from '@/platform/appRegistry';
import { usePhoneOwnerStore } from '@/platform/stores/phoneOwnerStore';
import { useCharacterStore } from '@/platform/stores/characterStore';

function TodoStub() {
  return <div data-testid="todo-content">Todo inside</div>;
}

describe('AppScene — user app perspective behavior', () => {
  beforeEach(() => {
    appRegistry.list().forEach((e) => appRegistry.unregister(e.id));
    usePhoneOwnerStore.setState({ phoneOwnerId: null });
    useCharacterStore.setState({
      characters: [{
        id: '001', name: '测试角色', avatar: '',
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

  it('renders user app normally when perspectiveAware=true in char view', () => {
    appRegistry.register({
      id: 'aware',
      name: 'Aware',
      type: 'user',
      component: TodoStub,
      perspectiveAware: true,
      globalData: false,
    });
    usePhoneOwnerStore.setState({ phoneOwnerId: '001' }); // bare id

    render(<AppScene appId="aware" />);
    expect(screen.getByTestId('todo-content')).toBeTruthy();
  });

  it('shows read-only placeholder when perspectiveAware=false in char view', () => {
    appRegistry.register({
      id: 'unaware',
      name: 'Unaware',
      type: 'user',
      component: TodoStub,
      perspectiveAware: false,
      globalData: false,
    });
    usePhoneOwnerStore.setState({ phoneOwnerId: '001' }); // bare id

    const { container } = render(<AppScene appId="unaware" />);
    expect(screen.queryByTestId('todo-content')).toBeNull();
    // ReadOnlyAppPlaceholder renders character name + "暂无数据" text
    expect(container.textContent).toContain('暂无数据');
  });

  it('renders user app regardless of perspectiveAware in player view', () => {
    appRegistry.register({
      id: 'unaware-player',
      name: 'Unaware Player',
      type: 'user',
      component: TodoStub,
      perspectiveAware: false,
      globalData: false,
    });
    // phoneOwnerId remains null (player view — set in beforeEach)

    render(<AppScene appId="unaware-player" />);
    expect(screen.getByTestId('todo-content')).toBeTruthy();
  });
});
