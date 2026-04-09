import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ControlCenter } from './ControlCenter';

describe('ControlCenter', () => {
  it('renders when visible is true', () => {
    render(<ControlCenter visible onClose={() => {}} />);
    expect(screen.getByTestId('control-center')).toBeTruthy();
  });

  it('does not render when visible is false', () => {
    render(<ControlCenter visible={false} onClose={() => {}} />);
    expect(screen.queryByTestId('control-center')).toBeNull();
  });

  it('renders 4 toggle tiles', () => {
    render(<ControlCenter visible onClose={() => {}} />);
    expect(screen.getByTestId('cc-toggle-airplane')).toBeTruthy();
    expect(screen.getByTestId('cc-toggle-cellular')).toBeTruthy();
    expect(screen.getByTestId('cc-toggle-wifi')).toBeTruthy();
    expect(screen.getByTestId('cc-toggle-bluetooth')).toBeTruthy();
  });

  it('renders brightness and volume sliders', () => {
    render(<ControlCenter visible onClose={() => {}} />);
    expect(screen.getByTestId('cc-brightness')).toBeTruthy();
    expect(screen.getByTestId('cc-volume')).toBeTruthy();
  });

  it('renders 4 quick action tiles', () => {
    render(<ControlCenter visible onClose={() => {}} />);
    expect(screen.getByTestId('cc-quick-flashlight')).toBeTruthy();
    expect(screen.getByTestId('cc-quick-timer')).toBeTruthy();
    expect(screen.getByTestId('cc-quick-calculator')).toBeTruthy();
    expect(screen.getByTestId('cc-quick-camera')).toBeTruthy();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(<ControlCenter visible onClose={onClose} />);
    await userEvent.click(screen.getByTestId('cc-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('toggle tile changes visual state on click', async () => {
    render(<ControlCenter visible onClose={() => {}} />);
    const wifiToggle = screen.getByTestId('cc-toggle-wifi');

    // Default is ON — background should be systemBlue
    expect(wifiToggle.style.backgroundColor).toContain('var(--color-systemBlue)');

    await userEvent.click(wifiToggle);

    // After toggle — background should be translucent black
    expect(wifiToggle.style.backgroundColor).toBe('rgba(0, 0, 0, 0.3)');
  });
});
