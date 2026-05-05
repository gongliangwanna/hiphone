import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavBar } from './NavBar';

describe('NavBar', () => {
  it('renders title', () => {
    render(<NavBar title="设置" />);
    expect(screen.getByTestId('nav-bar')).toBeTruthy();
    expect(screen.getByText('设置')).toBeTruthy();
    expect(screen.getByTestId('nav-bar')).toHaveAttribute('data-variant', 'inline');
  });

  it('does not show back button by default', () => {
    render(<NavBar title="设置" />);
    expect(screen.queryByTestId('nav-back')).toBeNull();
  });

  it('shows back button when showBack is true', () => {
    render(<NavBar title="设置" showBack />);
    expect(screen.getByTestId('nav-back')).toBeTruthy();
  });

  it('calls onBack when back button is clicked', async () => {
    const onBack = vi.fn();
    render(<NavBar title="关于本机" showBack onBack={onBack} />);
    await userEvent.click(screen.getByTestId('nav-back'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('renders large title variant without inline chrome', () => {
    render(<NavBar title="设置" variant="largeTitle" />);
    expect(screen.getByTestId('nav-bar')).toHaveAttribute('data-variant', 'largeTitle');
    expect(screen.queryByTestId('nav-back')).toBeNull();
    expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument();
  });

  it('supports dark glass tone for immersive app pages', () => {
    render(<NavBar title="安静图书馆" tone="darkGlass" showBack />);

    expect(screen.getByTestId('nav-bar')).toHaveAttribute('data-tone', 'darkGlass');
    expect(screen.getByText('安静图书馆')).toHaveStyle({ color: '#ffffff' });
  });
});
