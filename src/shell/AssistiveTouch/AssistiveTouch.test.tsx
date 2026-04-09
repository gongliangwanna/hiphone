import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssistiveTouch } from './AssistiveTouch';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { useSystemStore } from '@/platform/stores/systemStore';
import { useAssistiveTouchStore } from '@/platform/stores/assistiveTouchStore';

describe('AssistiveTouch', () => {
  beforeEach(() => {
    useSystemStore.setState({ isLocked: false });
    useAppRuntimeStore.setState({
      activeAppId: null,
      presentationMode: 'foreground',
      recentApps: [],
    });
    useAssistiveTouchStore.setState({
      anchorEdge: 'right',
      anchorY: 0.7,
      isMenuOpen: false,
    });
  });

  it('does not render when no app is active', () => {
    render(<AssistiveTouch />);
    expect(screen.queryByTestId('assistive-touch-ball')).not.toBeInTheDocument();
  });

  it('does not render when locked', () => {
    useSystemStore.setState({ isLocked: true });
    useAppRuntimeStore.setState({ activeAppId: 'settings' });
    render(<AssistiveTouch />);
    expect(screen.queryByTestId('assistive-touch-ball')).not.toBeInTheDocument();
  });

  it('renders when an app is active and unlocked', () => {
    useAppRuntimeStore.setState({ activeAppId: 'settings' });
    render(<AssistiveTouch />);
    expect(screen.getByTestId('assistive-touch-ball')).toBeInTheDocument();
  });

  it('renders when in switcher mode', () => {
    useAppRuntimeStore.setState({
      activeAppId: null,
      presentationMode: 'switcher',
      recentApps: [{ id: 'settings', origin: null }],
    });
    render(<AssistiveTouch />);
    expect(screen.getByTestId('assistive-touch-ball')).toBeInTheDocument();
  });

  it('opens menu on tap (click)', () => {
    useAppRuntimeStore.setState({ activeAppId: 'settings' });
    render(<AssistiveTouch />);

    // Simulate a tap (pointerdown + pointerup with no movement)
    const ball = screen.getByTestId('assistive-touch-ball');
    fireEvent.pointerDown(ball, { pointerId: 1, clientX: 300, clientY: 500 });
    fireEvent.pointerUp(ball, { pointerId: 1, clientX: 300, clientY: 500 });

    expect(screen.getByTestId('assistive-touch-menu')).toBeInTheDocument();
  });

  it('home action triggers exitAppToHome', () => {
    useAppRuntimeStore.setState({
      activeAppId: 'settings',
      recentApps: [{ id: 'settings', origin: null }],
    });
    useAssistiveTouchStore.setState({ isMenuOpen: true });
    render(<AssistiveTouch />);

    fireEvent.click(screen.getByTestId('at-action-home'));

    const s = useAppRuntimeStore.getState();
    expect(s.activeAppId).toBeNull();
    expect(s.dismissedAppId).toBe('settings');
    expect(s.dismissReason).toBe('home');
  });

  it('switcher action triggers openSwitcher', () => {
    useAppRuntimeStore.setState({
      activeAppId: 'settings',
      recentApps: [{ id: 'settings', origin: null }],
    });
    useAssistiveTouchStore.setState({ isMenuOpen: true });
    render(<AssistiveTouch />);

    fireEvent.click(screen.getByTestId('at-action-switcher'));

    expect(useAppRuntimeStore.getState().presentationMode).toBe('switcher');
  });

  it('closes menu when backdrop is clicked', () => {
    useAppRuntimeStore.setState({ activeAppId: 'settings' });
    render(<AssistiveTouch />);

    // Open menu via tap first
    const ball = screen.getByTestId('assistive-touch-ball');
    fireEvent.pointerDown(ball, { pointerId: 1, clientX: 300, clientY: 500 });
    fireEvent.pointerUp(ball, { pointerId: 1, clientX: 300, clientY: 500 });

    // Now close via backdrop
    fireEvent.click(screen.getByTestId('assistive-touch-backdrop'));
    expect(useAssistiveTouchStore.getState().isMenuOpen).toBe(false);
  });
});
