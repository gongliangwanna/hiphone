import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppIcon } from './AppIcon';
import type { AppInfo } from './apps.data';

const settingsApp: AppInfo = {
  id: 'settings',
  name: '设置',
  icon: '/resource/icons/ios-system/settings.jpg',
  page: 0,
};

const otherApp: AppInfo = {
  id: 'alipay',
  name: '支付宝',
  icon: '/resource/icons/popular-cn/alipay.jpg',
  page: 1,
};

describe('AppIcon', () => {
  it('renders icon image and label', () => {
    render(<AppIcon app={settingsApp} onOpen={vi.fn()} />);
    expect(screen.getByTestId('app-icon-settings')).toBeTruthy();
    expect(screen.getByAltText('设置')).toBeTruthy();
    expect(screen.getByText('设置')).toBeTruthy();
  });

  it('hides label when hideLabel is true', () => {
    render(<AppIcon app={settingsApp} hideLabel onOpen={vi.fn()} />);
    expect(screen.queryByText('设置')).toBeNull();
  });

  it('renders a solid placeholder instead of the image when icon isolation is enabled', () => {
    render(<AppIcon app={settingsApp} hideIconImages onOpen={vi.fn()} />);

    expect(screen.getByTestId('app-icon-placeholder-settings')).toBeInTheDocument();
    expect(screen.queryByAltText('设置')).toBeNull();
  });

  it('calls onOpen with app id and origin rect on click', async () => {
    const onOpen = vi.fn();
    render(
      <div data-testid="device-root">
        <AppIcon app={settingsApp} onOpen={onOpen} />
      </div>,
    );
    await userEvent.click(screen.getByTestId('app-icon-settings'));

    expect(onOpen).toHaveBeenCalledWith('settings', expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number),
      width: expect.any(Number),
      height: expect.any(Number),
    }));
  });

  it('calls onOpen for non-settings icons', async () => {
    const onOpen = vi.fn();
    render(
      <div data-testid="device-root">
        <AppIcon app={otherApp} onOpen={onOpen} />
      </div>,
    );
    await userEvent.click(screen.getByTestId('app-icon-alipay'));

    expect(onOpen).toHaveBeenCalledWith('alipay', expect.any(Object));
  });
});
