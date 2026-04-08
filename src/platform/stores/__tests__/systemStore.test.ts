import { describe, it, expect, beforeEach } from 'vitest';
import { useSystemStore } from '../systemStore';

describe('systemStore', () => {
  beforeEach(() => {
    // Reset to initial state
    useSystemStore.setState({
      isLocked: true,
      brightness: 0.8,
      volume: 0.5,
      wallpaperId: 'ios-26-stock-01',
    });
  });

  it('starts locked', () => {
    expect(useSystemStore.getState().isLocked).toBe(true);
  });

  it('unlock sets isLocked to false', () => {
    useSystemStore.getState().unlock();
    expect(useSystemStore.getState().isLocked).toBe(false);
  });

  it('lock sets isLocked to true', () => {
    useSystemStore.getState().unlock();
    useSystemStore.getState().lock();
    expect(useSystemStore.getState().isLocked).toBe(true);
  });

  it('setBrightness clamps to 0–1', () => {
    useSystemStore.getState().setBrightness(1.5);
    expect(useSystemStore.getState().brightness).toBe(1);
    useSystemStore.getState().setBrightness(-0.5);
    expect(useSystemStore.getState().brightness).toBe(0);
    useSystemStore.getState().setBrightness(0.6);
    expect(useSystemStore.getState().brightness).toBe(0.6);
  });

  it('setVolume clamps to 0–1', () => {
    useSystemStore.getState().setVolume(2);
    expect(useSystemStore.getState().volume).toBe(1);
    useSystemStore.getState().setVolume(-1);
    expect(useSystemStore.getState().volume).toBe(0);
  });

  it('setWallpaper updates wallpaperId', () => {
    useSystemStore.getState().setWallpaper('ios-26-stock-03');
    expect(useSystemStore.getState().wallpaperId).toBe('ios-26-stock-03');
  });
});
