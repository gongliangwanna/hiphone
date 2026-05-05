import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AGE_CONFIRMATION_STORAGE_KEY } from './system/AgeGate';

const {
  startHeartbeatScheduler,
  loadInstalledApps,
  mountBuiltinUserApps,
  mountFakeUserAppIfDev,
  installDevApi,
  registerBuiltins,
} = vi.hoisted(() => ({
  startHeartbeatScheduler: vi.fn(),
  loadInstalledApps: vi.fn(),
  mountBuiltinUserApps: vi.fn(),
  mountFakeUserAppIfDev: vi.fn(),
  installDevApi: vi.fn(),
  registerBuiltins: vi.fn(),
}));

vi.mock('./shell/Device', () => ({
  Device: () => <div data-testid="device-root">Device</div>,
}));

vi.mock('./apps/Music/MusicPlaybackHost', () => ({
  MusicPlaybackHost: () => <div data-testid="music-playback-host" />,
}));

vi.mock('./platform/ai/heartbeatAgent', () => ({
  startHeartbeatScheduler,
}));

vi.mock('./platform/userApp/installer', () => ({
  loadInstalledApps,
}));

vi.mock('./platform/userApp/devIcon', () => ({
  mountFakeUserAppIfDev,
}));

vi.mock('./platform/userApp/devInstall', () => ({
  installDevApi,
}));

vi.mock('./platform/userApp/builtinUserApps', () => ({
  mountBuiltinUserApps,
}));

vi.mock('./apps/registerBuiltins', () => ({
  registerBuiltins,
}));

describe('App age gate integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    window.localStorage.removeItem(AGE_CONFIRMATION_STORAGE_KEY);
  });

  it('does not render the phone shell or start app side effects before age confirmation', async () => {
    const { App } = await import('./App');

    render(<App />);

    expect(screen.getByTestId('age-gate')).toBeInTheDocument();
    expect(screen.queryByTestId('device-root')).not.toBeInTheDocument();
    expect(screen.queryByTestId('music-playback-host')).not.toBeInTheDocument();
    expect(startHeartbeatScheduler).not.toHaveBeenCalled();
    expect(loadInstalledApps).not.toHaveBeenCalled();
    expect(mountBuiltinUserApps).not.toHaveBeenCalled();
  });

  it('does not render the phone shell or start app side effects for persisted minors', async () => {
    window.localStorage.setItem(AGE_CONFIRMATION_STORAGE_KEY, 'minor');
    const { App } = await import('./App');

    render(<App />);

    expect(screen.getByTestId('age-gate-blocked')).toBeInTheDocument();
    expect(screen.queryByTestId('device-root')).not.toBeInTheDocument();
    expect(screen.queryByTestId('music-playback-host')).not.toBeInTheDocument();
    expect(startHeartbeatScheduler).not.toHaveBeenCalled();
    expect(loadInstalledApps).not.toHaveBeenCalled();
    expect(mountBuiltinUserApps).not.toHaveBeenCalled();
  });

  it('renders the phone shell and starts app side effects for persisted adults', async () => {
    window.localStorage.setItem(AGE_CONFIRMATION_STORAGE_KEY, 'adult');
    const { App } = await import('./App');

    render(<App />);

    expect(screen.getByTestId('device-root')).toBeInTheDocument();
    expect(screen.getByTestId('music-playback-host')).toBeInTheDocument();
    expect(screen.queryByTestId('age-gate')).not.toBeInTheDocument();
    expect(startHeartbeatScheduler).toHaveBeenCalledTimes(1);
    expect(loadInstalledApps).toHaveBeenCalledTimes(1);
    expect(mountBuiltinUserApps).toHaveBeenCalledTimes(1);
  });
});
