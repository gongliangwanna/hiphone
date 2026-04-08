import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Material } from '../Material';

describe('Material', () => {
  it('renders thin variant with backdrop-filter', () => {
    const { container } = render(<Material variant="thin" data-testid="mat" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.backdropFilter).toContain('blur(20px)');
  });

  it('renders regular variant with backdrop-filter', () => {
    const { container } = render(<Material variant="regular" data-testid="mat" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.backdropFilter).toContain('blur(30px)');
  });

  it('renders thick variant with backdrop-filter', () => {
    const { container } = render(<Material variant="thick" data-testid="mat" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.backdropFilter).toContain('blur(40px)');
  });

  it('renders chrome variant with backdrop-filter', () => {
    const { container } = render(<Material variant="chrome" data-testid="mat" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.backdropFilter).toContain('blur(50px)');
  });

  it('defaults to regular variant', () => {
    const { container } = render(<Material />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.backdropFilter).toContain('blur(30px)');
  });

  it('renders children', () => {
    render(<Material>Inside content</Material>);
    expect(screen.getByText('Inside content')).toBeInTheDocument();
  });

  it('can disable backdrop filter for performance-sensitive interactions', () => {
    render(
      <Material disableBackdrop data-testid="mat">
        Inside content
      </Material>,
    );
    const el = screen.getByTestId('mat');
    expect(el.style.backdropFilter).toBe('none');
  });
});
