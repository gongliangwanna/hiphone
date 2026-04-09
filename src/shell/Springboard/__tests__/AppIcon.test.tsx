import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppIcon } from '../AppIcon';
import { usePerfDebugStore } from '@/platform/stores/perfDebugStore';

describe('AppIcon', () => {
  it('renders icon image with alt text', () => {
    usePerfDebugStore.setState({ hideIconImages: false });
    render(
      <AppIcon app={{ id: 'test-app', name: 'Test App', icon: '/test.png', page: 0 }} />,
    );
    const img = screen.getByAltText('Test App');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/test.png');
  });

  it('renders app name label', () => {
    usePerfDebugStore.setState({ hideIconImages: false });
    render(
      <AppIcon app={{ id: 'test-app', name: '测试应用', icon: '/test.png', page: 0 }} />,
    );
    expect(screen.getByText('测试应用')).toBeInTheDocument();
  });

  it('has test id based on app id', () => {
    usePerfDebugStore.setState({ hideIconImages: false });
    render(
      <AppIcon app={{ id: 'safari', name: 'Safari', icon: '/safari.jpg', page: 0 }} />,
    );
    expect(screen.getByTestId('app-icon-safari')).toBeInTheDocument();
  });

  it('renders a placeholder block when icon images are hidden', () => {
    usePerfDebugStore.setState({ hideIconImages: true });
    render(
      <AppIcon app={{ id: 'safari', name: 'Safari', icon: '/safari.jpg', page: 0 }} />,
    );

    expect(screen.getByTestId('app-icon-placeholder-safari')).toBeInTheDocument();
    expect(screen.queryByAltText('Safari')).toBeNull();
  });
});
