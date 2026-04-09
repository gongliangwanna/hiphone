import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AppSwitcher } from './AppSwitcher';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { useSystemStore } from '@/platform/stores/systemStore';

describe('AppSwitcher', () => {
  beforeEach(() => {
    // Mock ResizeObserver for JSDOM
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    useSystemStore.setState({ isLocked: false });
    useAppRuntimeStore.setState({
      activeAppId: 'settings',
      appOrigin: { x: 10, y: 20, width: 60, height: 60 },
      switcherCardOrigin: null,
      switcherCardViewport: null,
      recentApps: [
        { id: 'settings', origin: { x: 10, y: 20, width: 60, height: 60 } },
        { id: 'wechat', origin: { x: 80, y: 20, width: 60, height: 60 } },
      ],
      switcherAppId: 'settings',
      transitionSource: 'icon',
      presentationMode: 'switcher',
      dismissedAppId: null,
      dismissReason: null,
      cardDismiss: {
        appId: null,
        startY: 0,
        cardHeight: 1,
        deltaY: 0,
        progress: 0,
        velocityY: 0,
      },
    });
  });

  it('renders recent app cards', () => {
    render(<AppSwitcher />);
    expect(screen.getByTestId('switcher-card-settings')).toBeInTheDocument();
    expect(screen.getByTestId('switcher-card-wechat')).toBeInTheDocument();
  });

  it('activates an app when its card is clicked', () => {
    render(
      <div data-testid="device-root">
        <AppSwitcher />
      </div>,
    );
    fireEvent.click(screen.getByTestId('switcher-card-wechat'));

    expect(useAppRuntimeStore.getState().activeAppId).toBe('wechat');
    expect(useAppRuntimeStore.getState().presentationMode).toBe('foreground');
  });

  it('card tap hands AppHost a device-root-relative rect + viewport via activateAppFromCard', () => {
    render(
      <div data-testid="device-root">
        <AppSwitcher />
      </div>,
    );
    fireEvent.click(screen.getByTestId('switcher-card-wechat'));

    const s = useAppRuntimeStore.getState();
    expect(s.switcherCardOrigin).not.toBeNull();
    expect(s.switcherCardViewport).not.toBeNull();
    expect(s.transitionSource).toBe('switcher');
  });

  it('dismisses a selected card after an upward drag', () => {
    useAppRuntimeStore.getState().focusAppInSwitcher('wechat');
    render(<AppSwitcher />);
    const surface = screen.getByTestId('switcher-card-surface-wechat');

    act(() => {
      fireEvent.pointerDown(surface, { clientY: 400, pointerId: 1 });
      fireEvent.pointerMove(surface, { clientY: 280, pointerId: 1 });
      fireEvent.pointerUp(surface, { clientY: 280, pointerId: 1 });
    });

    expect(useAppRuntimeStore.getState().recentApps.map((task) => task.id)).toEqual(['settings']);
  });
});
