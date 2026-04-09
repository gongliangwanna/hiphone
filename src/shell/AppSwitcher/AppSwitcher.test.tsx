import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  AppSwitcher,
  computeSpacerWidth,
  CARD_WIDTH_RATIO,
  CARD_GAP,
  shouldLockDismissGesture,
} from './AppSwitcher';
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
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: () => {},
    });
    Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
      configurable: true,
      value: () => {},
    });
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

  it('dismisses a selected card after an upward diagonal drag', () => {
    useAppRuntimeStore.getState().focusAppInSwitcher('wechat');
    render(<AppSwitcher />);
    const surface = screen.getByTestId('switcher-card-surface-wechat');

    act(() => {
      fireEvent.pointerDown(surface, { clientX: 120, clientY: 400, pointerId: 1 });
      fireEvent.pointerMove(surface, { clientX: 146, clientY: 360, pointerId: 1 });
      fireEvent.pointerUp(surface, { clientX: 146, clientY: 220, pointerId: 1 });
    });

    expect(useAppRuntimeStore.getState().recentApps.map((task) => task.id)).toEqual(['settings']);
  });

  it('does not dismiss a card during a horizontal swipe', () => {
    render(<AppSwitcher />);
    const surface = screen.getByTestId('switcher-card-surface-settings');

    act(() => {
      fireEvent.pointerDown(surface, { clientX: 120, clientY: 400, pointerId: 1 });
      fireEvent.pointerMove(surface, { clientX: 184, clientY: 390, pointerId: 1 });
      fireEvent.pointerUp(surface, { clientX: 184, clientY: 390, pointerId: 1 });
    });

    expect(useAppRuntimeStore.getState().recentApps.map((task) => task.id)).toEqual([
      'settings',
      'wechat',
    ]);
  });

  it('computes enough scroll range to center the last card', () => {
    const vw = 390;
    const cardWidth = Math.round(vw * CARD_WIDTH_RATIO); // 257
    const spacer = computeSpacerWidth(vw, cardWidth, CARD_GAP); // 56.5
    const n = 3;
    // Total: spacer + gap + n*card + (n-1)*gap + gap + spacer
    const total = spacer + CARD_GAP + n * cardWidth + (n - 1) * CARD_GAP + CARD_GAP + spacer;
    const maxScroll = total - vw;
    const lastCenter = spacer + CARD_GAP + (n - 1) * (cardWidth + CARD_GAP) + cardWidth / 2;
    const required = lastCenter - vw / 2;

    expect(total).toBe(924);
    expect(maxScroll).toBe(534);
    expect(required).toBe(534);
    expect(maxScroll).toBeGreaterThanOrEqual(required);
  });

  it('locks upward drags more easily than horizontal drags', () => {
    expect(shouldLockDismissGesture(26, -40)).toBe(true);
    expect(shouldLockDismissGesture(64, -10)).toBe(false);
    expect(shouldLockDismissGesture(3, -5)).toBeNull();
  });
});
