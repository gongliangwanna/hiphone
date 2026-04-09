import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppSwitcher, computeSpacerWidth, CARD_WIDTH_RATIO, CARD_GAP } from './AppSwitcher';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import type { ViewportProfile } from '@/shell/Device/viewportProfile';

const viewportProfileRef = {
  current: {
    shellMode: 'fullscreen',
    sizeTier: 'regular',
    width: 390,
    height: 844,
    isPortrait: true,
  } as ViewportProfile,
};

vi.mock('@/shell/Device/useViewportProfile', () => ({
  useViewportProfile: () => viewportProfileRef.current,
}));

describe('AppSwitcher DOM structure', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    useAppRuntimeStore.setState({
      activeAppId: 'a',
      recentApps: [
        { id: 'a', origin: null },
        { id: 'b', origin: null },
        { id: 'c', origin: null },
      ],
      switcherAppId: 'a',
      presentationMode: 'switcher',
      dismissedAppId: null,
      dismissReason: null,
      cardDismiss: { appId: null, startY: 0, cardHeight: 1, deltaY: 0, progress: 0, velocityY: 0 },
    });
  });

  it('renders cards + 1 trailing spacer (no leading spacer div)', () => {
    render(<AppSwitcher />);
    const track = screen.getByTestId('app-switcher-track');
    // 3 cards + 1 trailing spacer = 4 children
    expect(track.children.length).toBe(4);
  });

  it('first card has extra marginLeft for centering', () => {
    const vw = 390;
    const cw = Math.round(vw * CARD_WIDTH_RATIO);
    const spacer = computeSpacerWidth(vw, cw, CARD_GAP);
    const sideMargin = spacer + CARD_GAP;

    render(<AppSwitcher />);
    const track = screen.getByTestId('app-switcher-track');
    const first = track.children[0] as HTMLElement;

    expect(parseFloat(first.style.marginLeft)).toBeCloseTo(sideMargin, 0);
  });

  it('trailing spacer has correct width and real content', () => {
    const vw = 390;
    const cw = Math.round(vw * CARD_WIDTH_RATIO);
    const spacer = computeSpacerWidth(vw, cw, CARD_GAP);
    const expectedWidth = spacer + CARD_GAP;

    render(<AppSwitcher />);
    const track = screen.getByTestId('app-switcher-track');
    const last = track.children[3] as HTMLElement;

    expect(parseFloat(last.style.width)).toBeCloseTo(expectedWidth, 0);
    // Must have a child (the 1×1 div) so WebKit counts it in scrollWidth
    expect(last.children.length).toBe(1);
  });
});
