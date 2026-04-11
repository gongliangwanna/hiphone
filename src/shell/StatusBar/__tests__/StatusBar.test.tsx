import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusBar } from '../StatusBar';
import { useSpringboardLayoutStore } from '@/platform/stores/springboardLayoutStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { useSystemStore } from '@/platform/stores/systemStore';

describe('StatusBar — edit mode buttons', () => {
  beforeEach(() => {
    useSystemStore.setState({ isLocked: false });
    useAppRuntimeStore.setState({ activeAppId: null });
    useSpringboardLayoutStore.setState({
      appOrder: null,
      isEditMode: true,
      isWidgetDrawerOpen: false,
    });
  });

  it('renders 小组件 on the left and 完成 on the right', () => {
    render(<StatusBar />);
    const widgetsBtn = screen.getByTestId('edit-mode-widgets-btn');
    const doneBtn = screen.getByTestId('edit-mode-done-btn');
    expect(widgetsBtn.textContent).toBe('小组件');
    expect(doneBtn.textContent).toBe('完成');

    // Order in DOM: widgets first, done second
    const container = widgetsBtn.parentElement!;
    const children = Array.from(container.children);
    expect(children.indexOf(widgetsBtn)).toBeLessThan(children.indexOf(doneBtn));
  });

  it('opens the widget drawer when 小组件 is clicked', () => {
    render(<StatusBar />);
    fireEvent.click(screen.getByTestId('edit-mode-widgets-btn'));
    expect(useSpringboardLayoutStore.getState().isWidgetDrawerOpen).toBe(true);
  });

  it('exits edit mode when 完成 is clicked', () => {
    render(<StatusBar />);
    fireEvent.click(screen.getByTestId('edit-mode-done-btn'));
    expect(useSpringboardLayoutStore.getState().isEditMode).toBe(false);
  });
});
