import { beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppIcon } from '../AppIcon';
import { useAppProfileStore } from '@/platform/stores/appProfileStore';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';

const noop = vi.fn();

describe('AppIcon', () => {
  beforeEach(() => {
    useAppProfileStore.setState({ profiles: {} });
    useInstalledUserAppsStore.setState({ apps: [] });
  });

  it('renders icon image with alt text', () => {
    render(
      <AppIcon app={{ id: 'test-app', name: 'Test App', icon: '/test.png', page: 0 }} onOpen={noop} />,
    );
    const img = screen.getByAltText('Test App');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/test.png');
  });

  it('renders app name label', () => {
    render(
      <AppIcon app={{ id: 'test-app', name: '测试应用', icon: '/test.png', page: 0 }} onOpen={noop} />,
    );
    expect(screen.getByText('测试应用')).toBeInTheDocument();
  });

  it('has test id based on app id', () => {
    render(
      <AppIcon app={{ id: 'safari', name: 'Safari', icon: '/safari.jpg', page: 0 }} onOpen={noop} />,
    );
    expect(screen.getByTestId('app-icon-safari')).toBeInTheDocument();
  });

  it('renders a placeholder block when icon images are hidden', () => {
    render(
      <AppIcon app={{ id: 'safari', name: 'Safari', icon: '/safari.jpg', page: 0 }} hideIconImages onOpen={noop} />,
    );

    expect(screen.getByTestId('app-icon-placeholder-safari')).toBeInTheDocument();
    expect(screen.queryByAltText('Safari')).toBeNull();
  });

  it('renders custom app profile name and icon', () => {
    useAppProfileStore.getState().setName('settings', '控制台');
    useAppProfileStore.getState().setIcon('settings', {
      dataUrl: 'data:image/png;base64,custom',
      crop: {
        sourceWidth: 400,
        sourceHeight: 400,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      },
    });

    render(
      <AppIcon
        app={{
          id: 'settings',
          name: '设置',
          icon: '/resource/icons/ios-system/settings.jpg',
          page: 0,
        }}
        onOpen={noop}
      />,
    );

    expect(screen.getByText('控制台')).toBeInTheDocument();
    expect(screen.getByAltText('控制台')).toHaveAttribute(
      'src',
      'data:image/png;base64,custom',
    );
  });

  it('opens canonical app id for legacy Dock aliases', () => {
    const onOpen = vi.fn();

    render(
      <div data-testid="device-root">
        <AppIcon
          app={{
            id: 'safari-dock',
            name: 'Safari',
            icon: '/safari.jpg',
            page: 0,
            isDock: true,
          }}
          onOpen={onOpen}
        />
      </div>,
    );

    fireEvent.click(screen.getByTestId('app-icon-safari'));

    expect(onOpen).toHaveBeenCalledWith('safari', expect.any(Object));
  });
});
