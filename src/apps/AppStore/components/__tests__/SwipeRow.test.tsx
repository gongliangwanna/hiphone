import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SwipeRow } from '../SwipeRow';

function makePointer(clientX: number) {
  return {
    clientX,
    clientY: 0,
    pointerId: 1,
    pointerType: 'touch',
    button: 0,
  };
}

describe('SwipeRow', () => {
  it('renders children in closed state', () => {
    render(
      <SwipeRow onDelete={() => {}}>
        <div>content</div>
      </SwipeRow>,
    );
    expect(screen.getByText('content')).toBeInTheDocument();
    const track = screen.getByTestId('swipe-row-track');
    expect(track.style.transform).toMatch(/translateX\(0/);
  });

  it('exposes delete action after leftward swipe past threshold', () => {
    const onDelete = vi.fn();
    render(
      <SwipeRow onDelete={onDelete}>
        <div data-testid="child">content</div>
      </SwipeRow>,
    );
    const track = screen.getByTestId('swipe-row-track');
    fireEvent.pointerDown(track, makePointer(200));
    fireEvent.pointerMove(track, makePointer(100)); // -100px
    fireEvent.pointerUp(track, makePointer(100));
    expect(track.style.transform).toMatch(/translateX\(-92/);
  });

  it('snaps back when swipe under threshold', () => {
    render(
      <SwipeRow onDelete={() => {}}>
        <div>c</div>
      </SwipeRow>,
    );
    const track = screen.getByTestId('swipe-row-track');
    fireEvent.pointerDown(track, makePointer(200));
    fireEvent.pointerMove(track, makePointer(190));
    fireEvent.pointerUp(track, makePointer(190));
    expect(track.style.transform).toMatch(/translateX\(0/);
  });

  it('calls onDelete when action tapped', () => {
    const onDelete = vi.fn();
    render(
      <SwipeRow onDelete={onDelete}>
        <div>c</div>
      </SwipeRow>,
    );
    const track = screen.getByTestId('swipe-row-track');
    fireEvent.pointerDown(track, makePointer(200));
    fireEvent.pointerMove(track, makePointer(80));
    fireEvent.pointerUp(track, makePointer(80));
    fireEvent.click(screen.getByTestId('swipe-delete-action'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('ignores rightward swipe (positive delta) — stays closed', () => {
    render(
      <SwipeRow onDelete={() => {}}>
        <div>c</div>
      </SwipeRow>,
    );
    const track = screen.getByTestId('swipe-row-track');
    fireEvent.pointerDown(track, makePointer(100));
    fireEvent.pointerMove(track, makePointer(200));
    fireEvent.pointerUp(track, makePointer(200));
    expect(track.style.transform).toMatch(/translateX\(0/);
  });
});
