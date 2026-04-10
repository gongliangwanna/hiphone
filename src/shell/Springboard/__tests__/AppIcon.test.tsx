import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppIcon } from '../AppIcon';

const noop = vi.fn();

describe('AppIcon', () => {
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
});
