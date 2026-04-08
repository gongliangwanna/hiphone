import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Springboard } from '../Springboard';

vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react');

  return {
    ...actual,
    animate: vi.fn((value: { set: (target: number) => void }, target: number) => {
      value.set(target);
      return {
        stop: vi.fn(),
      };
    }),
  };
});

function expectActivePage(page: number) {
  expect(screen.getByTestId(`page-dot-${page}`)).toHaveStyle({ opacity: 1 });
}

function swipe(
  surface: HTMLElement,
  {
    startX,
    endX,
    moveX = endX,
    pointerId = 1,
    startTime = 10,
    moveTime = startTime + 100,
    endTime = moveTime + 10,
    withMove = true,
  }: {
    startX: number;
    endX: number;
    moveX?: number;
    pointerId?: number;
    startTime?: number;
    moveTime?: number;
    endTime?: number;
    withMove?: boolean;
  },
) {
  act(() => {
    fireEvent.pointerDown(surface, {
      clientX: startX,
      pointerId,
      timeStamp: startTime,
    });

    if (withMove) {
      fireEvent.pointerMove(surface, {
        clientX: moveX,
        pointerId,
        timeStamp: moveTime,
      });
    }

    fireEvent.pointerUp(surface, {
      clientX: endX,
      pointerId,
      timeStamp: endTime,
    });
  });
}

describe('Springboard', () => {
  it('uses compact metrics for short mobile widths', () => {
    render(<Springboard sizeTier="compact" viewportWidth={360} />);

    const firstIcon = screen.getByTestId('app-icon-messages');
    const iconMask = firstIcon.querySelector('div');
    const dock = screen.getByTestId('dock');

    expect(firstIcon).toHaveStyle({ width: '68px' });
    expect(iconMask).toHaveStyle({ width: '54px', height: '54px' });
    expect(dock).toHaveStyle({ paddingBottom: '6px' });
  });

  it('uses large metrics for wide mobile widths', () => {
    render(<Springboard sizeTier="large" viewportWidth={430} />);

    const firstIcon = screen.getByTestId('app-icon-messages');
    const iconMask = firstIcon.querySelector('div');
    const dock = screen.getByTestId('dock');

    expect(firstIcon).toHaveStyle({ width: '78px' });
    expect(iconMask).toHaveStyle({ width: '64px', height: '64px' });
    expect(dock).toHaveStyle({ paddingBottom: '10px' });
  });

  it('commits to the next page after a slow drag crosses distance threshold', () => {
    render(<Springboard sizeTier="regular" viewportWidth={390} />);

    swipe(screen.getByTestId('springboard-gesture-surface'), {
      startX: 300,
      endX: 220,
      moveTime: 220,
      endTime: 240,
    });

    expectActivePage(1);
  });

  it('uses directional touch-action and disables dock blur while dragging', () => {
    render(<Springboard sizeTier="regular" viewportWidth={390} />);

    const surface = screen.getByTestId('springboard-gesture-surface');
    const dockMaterial = screen.getByTestId('dock-material');

    expect(surface).toHaveStyle({ touchAction: 'pan-y' });
    expect(dockMaterial.style.backdropFilter).toContain('blur(40px)');

    act(() => {
      fireEvent.pointerDown(surface, {
        clientX: 300,
        pointerId: 1,
        timeStamp: 10,
      });
    });

    expect(dockMaterial).toHaveStyle({ backdropFilter: 'none' });

    swipe(surface, {
      startX: 300,
      endX: 220,
      startTime: 20,
      moveTime: 220,
      endTime: 240,
    });

    expect(dockMaterial.style.backdropFilter).toContain('blur(40px)');
  });

  it('commits back to the previous page after a rightward swipe from page 1', () => {
    render(<Springboard sizeTier="regular" viewportWidth={390} />);

    const surface = screen.getByTestId('springboard-gesture-surface');
    swipe(surface, {
      startX: 300,
      endX: 220,
      moveTime: 220,
      endTime: 240,
    });

    expectActivePage(1);

    swipe(surface, {
      startX: 140,
      endX: 220,
      moveTime: 420,
      endTime: 440,
    });

    expectActivePage(0);
  });

  it('stays on the first page after overscrolling past the leading edge', () => {
    render(<Springboard sizeTier="regular" viewportWidth={390} />);

    swipe(screen.getByTestId('springboard-gesture-surface'), {
      startX: 120,
      endX: 190,
      moveTime: 200,
      endTime: 220,
    });

    expectActivePage(0);
  });

  it('stays on the last page after overscrolling past the trailing edge', () => {
    render(<Springboard sizeTier="regular" viewportWidth={390} />);

    const surface = screen.getByTestId('springboard-gesture-surface');
    swipe(surface, { startX: 300, endX: 220, moveTime: 200, endTime: 220 });
    swipe(surface, { startX: 300, endX: 220, moveTime: 450, endTime: 470 });

    expectActivePage(2);

    swipe(surface, {
      startX: 300,
      endX: 220,
      moveTime: 700,
      endTime: 720,
    });

    expectActivePage(2);
  });
});
