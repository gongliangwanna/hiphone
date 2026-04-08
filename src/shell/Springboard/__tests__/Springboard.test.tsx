import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Springboard } from '../Springboard';

describe('Springboard', () => {
  it('uses compact metrics for short mobile widths', () => {
    render(<Springboard sizeTier="compact" viewportWidth={360} />);

    const firstIcon = screen.getByTestId('app-icon-messages');
    const iconMask = firstIcon.querySelector('div');
    const dock = screen.getByTestId('dock');

    expect(firstIcon).toHaveStyle({ width: '68px' });
    expect(iconMask).toHaveStyle({ width: '54px', height: '54px' });
    expect(dock).toHaveStyle({ paddingBottom: '6px' });
  });

  it('uses large metrics for wide mobile widths', () => {
    render(<Springboard sizeTier="large" viewportWidth={430} />);

    const firstIcon = screen.getByTestId('app-icon-messages');
    const iconMask = firstIcon.querySelector('div');
    const dock = screen.getByTestId('dock');

    expect(firstIcon).toHaveStyle({ width: '78px' });
    expect(iconMask).toHaveStyle({ width: '64px', height: '64px' });
    expect(dock).toHaveStyle({ paddingBottom: '10px' });
  });
});
