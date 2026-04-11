import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppScreen } from '../AppScreen';

describe('AppScreen', () => {
  it('starts app content below the shell safe top inset', () => {
    render(
      <AppScreen>
        <div>内容</div>
      </AppScreen>,
    );

    expect(screen.getByTestId('app-screen')).toBeInTheDocument();
    expect(screen.getByTestId('app-screen-content').getAttribute('style')).toContain(
      'padding-top: var(--app-safe-top)',
    );
  });

  it('removes safe-area padding when edgeToEdge is true', () => {
    render(
      <AppScreen edgeToEdge>
        <div>全屏内容</div>
      </AppScreen>,
    );

    const content = screen.getByTestId('app-screen-content');
    const style = content.getAttribute('style');
    expect(style === null || !style.includes('padding-top')).toBe(true);
  });
});
