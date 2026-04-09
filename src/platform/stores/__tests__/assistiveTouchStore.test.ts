import { beforeEach, describe, expect, it } from 'vitest';
import { useAssistiveTouchStore } from '../assistiveTouchStore';

describe('assistiveTouchStore', () => {
  beforeEach(() => {
    useAssistiveTouchStore.setState({
      anchorEdge: 'right',
      anchorY: 0.7,
      isMenuOpen: false,
    });
  });

  it('starts with default anchor on right edge at 70%', () => {
    const s = useAssistiveTouchStore.getState();
    expect(s.anchorEdge).toBe('right');
    expect(s.anchorY).toBe(0.7);
    expect(s.isMenuOpen).toBe(false);
  });

  it('openMenu sets isMenuOpen to true', () => {
    useAssistiveTouchStore.getState().openMenu();
    expect(useAssistiveTouchStore.getState().isMenuOpen).toBe(true);
  });

  it('closeMenu sets isMenuOpen to false', () => {
    useAssistiveTouchStore.setState({ isMenuOpen: true });
    useAssistiveTouchStore.getState().closeMenu();
    expect(useAssistiveTouchStore.getState().isMenuOpen).toBe(false);
  });

  it('toggleMenu flips isMenuOpen', () => {
    useAssistiveTouchStore.getState().toggleMenu();
    expect(useAssistiveTouchStore.getState().isMenuOpen).toBe(true);
    useAssistiveTouchStore.getState().toggleMenu();
    expect(useAssistiveTouchStore.getState().isMenuOpen).toBe(false);
  });

  it('setAnchor updates edge and y position', () => {
    useAssistiveTouchStore.getState().setAnchor('left', 0.3);
    const s = useAssistiveTouchStore.getState();
    expect(s.anchorEdge).toBe('left');
    expect(s.anchorY).toBe(0.3);
  });

  it('setAnchor clamps y to [0, 1]', () => {
    useAssistiveTouchStore.getState().setAnchor('right', -0.5);
    expect(useAssistiveTouchStore.getState().anchorY).toBe(0);

    useAssistiveTouchStore.getState().setAnchor('left', 1.5);
    expect(useAssistiveTouchStore.getState().anchorY).toBe(1);
  });
});
