import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBannerStore } from '../bannerStore';

describe('bannerStore', () => {
  beforeEach(() => {
    useBannerStore.getState().clear();
    vi.useRealTimers();
  });

  it('show() sets current when queue is empty', () => {
    useBannerStore.getState().show({ title: 'hello' });
    const { current, queue } = useBannerStore.getState();
    expect(current?.title).toBe('hello');
    expect(queue).toEqual([]);
  });

  it('subsequent show() queues additional banners', () => {
    useBannerStore.getState().show({ title: 'first' });
    useBannerStore.getState().show({ title: 'second' });
    useBannerStore.getState().show({ title: 'third' });

    const { current, queue } = useBannerStore.getState();
    expect(current?.title).toBe('first');
    expect(queue.map((b) => b.title)).toEqual(['second', 'third']);
  });

  it('dismiss() advances to the next queued banner', () => {
    useBannerStore.getState().show({ title: 'a' });
    useBannerStore.getState().show({ title: 'b' });
    useBannerStore.getState().dismiss();

    const { current, queue } = useBannerStore.getState();
    expect(current?.title).toBe('b');
    expect(queue).toEqual([]);
  });

  it('dismiss() clears current when queue is empty', () => {
    useBannerStore.getState().show({ title: 'solo' });
    useBannerStore.getState().dismiss();
    expect(useBannerStore.getState().current).toBeNull();
  });

  it('auto-dismiss fires after duration', () => {
    vi.useFakeTimers();
    useBannerStore.getState().show({ title: 'auto', duration: 1000 });
    expect(useBannerStore.getState().current?.title).toBe('auto');

    vi.advanceTimersByTime(999);
    expect(useBannerStore.getState().current?.title).toBe('auto');

    vi.advanceTimersByTime(1);
    expect(useBannerStore.getState().current).toBeNull();
  });

  it('auto-dismiss advances to queued banner then keeps timing', () => {
    vi.useFakeTimers();
    useBannerStore.getState().show({ title: 'a', duration: 500 });
    useBannerStore.getState().show({ title: 'b', duration: 500 });

    vi.advanceTimersByTime(500);
    expect(useBannerStore.getState().current?.title).toBe('b');

    vi.advanceTimersByTime(500);
    expect(useBannerStore.getState().current).toBeNull();
  });

  it('clear() empties both current and queue and cancels the timer', () => {
    vi.useFakeTimers();
    useBannerStore.getState().show({ title: 'a', duration: 500 });
    useBannerStore.getState().show({ title: 'b' });
    useBannerStore.getState().clear();

    expect(useBannerStore.getState().current).toBeNull();
    expect(useBannerStore.getState().queue).toEqual([]);

    vi.advanceTimersByTime(5000);
    // Clear's timer cancellation should prevent any resurfacing.
    expect(useBannerStore.getState().current).toBeNull();
  });

  it('assigns an auto-generated id when none is provided', () => {
    useBannerStore.getState().show({ title: 'x' });
    expect(useBannerStore.getState().current?.id).toMatch(/^banner-/);
  });

  it('respects an explicitly provided id', () => {
    useBannerStore.getState().show({ id: 'my-banner', title: 'x' });
    expect(useBannerStore.getState().current?.id).toBe('my-banner');
  });

  it('round-trips sourceAppId through show() to current', () => {
    useBannerStore.getState().show({
      title: 'from shop',
      sourceAppId: 'test-shop',
    });
    expect(useBannerStore.getState().current?.sourceAppId).toBe('test-shop');
  });
});
