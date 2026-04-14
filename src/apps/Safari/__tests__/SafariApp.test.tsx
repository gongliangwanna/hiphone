import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { SafariApp } from '../SafariApp';
import { useSafariStore } from '../safariStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';

beforeEach(() => {
  useSafariStore.getState().reset();
  useAppRuntimeStore.setState({
    activeAppId: 'safari',
    appOrigin: { x: 0, y: 0, width: 60, height: 60 },
  });
});

describe('SafariApp', () => {
  it('renders the app container', () => {
    render(<SafariApp />);
    expect(screen.getByTestId('safari-app')).toBeInTheDocument();
  });

  it('shows URL bar with search placeholder on start page', () => {
    render(<SafariApp />);
    expect(screen.getByTestId('safari-url-bar')).toBeInTheDocument();
    expect(screen.getByText('搜索或输入网站名称')).toBeInTheDocument();
  });

  it('shows tab count badge', () => {
    render(<SafariApp />);
    const tabBtn = screen.getByTestId('safari-tabs-btn');
    expect(tabBtn).toBeInTheDocument();
    expect(tabBtn.textContent).toContain('1');
  });

  it('opens URL editing overlay on URL bar click', async () => {
    render(<SafariApp />);
    fireEvent.click(screen.getByTestId('safari-url-bar'));
    await waitFor(() => {
      expect(screen.getByTestId('safari-url-input')).toBeInTheDocument();
      expect(screen.getByTestId('safari-cancel-edit')).toBeInTheDocument();
    });
  });

  it('cancel button has pill styling', async () => {
    render(<SafariApp />);
    fireEvent.click(screen.getByTestId('safari-url-bar'));
    await waitFor(() => {
      const cancelBtn = screen.getByTestId('safari-cancel-edit');
      expect(cancelBtn.className).toContain('rounded-');
    });
  });

  it('shows branded favicons instead of emojis', () => {
    render(<SafariApp />);
    const startPage = screen.getByTestId('safari-start-page');
    expect(startPage.textContent).not.toContain('🍎');
    expect(startPage.textContent).not.toContain('🔍');
  });

  it('shows search history when available', async () => {
    render(<SafariApp />);
    act(() => useSafariStore.getState().navigateTo('test query'));
    act(() => useSafariStore.getState().goBack());
    fireEvent.click(screen.getByTestId('safari-url-bar'));
    await waitFor(() => {
      expect(screen.getByText('test query')).toBeInTheDocument();
    });
  });

  it('shows lock icon with domain when navigated', () => {
    act(() => useSafariStore.getState().navigateTo('https://apple.com'));
    render(<SafariApp />);
    expect(screen.getByText('apple.com')).toBeInTheDocument();
  });
});
