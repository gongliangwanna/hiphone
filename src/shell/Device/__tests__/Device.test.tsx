import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Device } from '../Device';
import { useSystemStore } from '@/platform/stores/systemStore';

describe('Device', () => {
  beforeEach(() => {
    useSystemStore.setState({ isLocked: false });
  });

  it('renders wallpaper background', () => {
    render(<Device />);
    expect(screen.getByTestId('wallpaper')).toBeInTheDocument();
  });

  it('renders status bar', () => {
    render(<Device />);
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
  });

  it('renders springboard', () => {
    render(<Device />);
    expect(screen.getByTestId('springboard')).toBeInTheDocument();
  });

  it('renders lock screen with time when locked', () => {
    useSystemStore.setState({ isLocked: true });
    render(<Device />);
    expect(screen.getByTestId('lock-time')).toBeInTheDocument();
  });

  it('hides lock content when unlocked', () => {
    render(<Device />);
    expect(screen.queryByTestId('lock-time')).not.toBeInTheDocument();
  });
});
