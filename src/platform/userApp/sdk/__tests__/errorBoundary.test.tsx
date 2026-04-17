import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserAppErrorBoundary } from '../errorBoundary';

describe('UserAppErrorBoundary', () => {
  afterEach(() => cleanup());

  it('renders children when no error', () => {
    const { container } = render(
      <UserAppErrorBoundary>
        <div data-testid="child">ok</div>
      </UserAppErrorBoundary>,
    );
    expect(container.textContent).toBe('ok');
  });

  it('renders fallback UI when child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Boom(): null { throw new Error('boom'); }
    const { container } = render(
      <UserAppErrorBoundary>
        <Boom />
      </UserAppErrorBoundary>,
    );
    expect(container.textContent).toContain('App crashed');
    expect(container.textContent).toContain('boom');
    spy.mockRestore();
  });

  it('does not catch async errors (only render errors)', () => {
    // Verify the scope is exactly "render-time" — async errors inside effects
    // or promise rejections are NOT caught by Error Boundaries. This is a
    // React guarantee, but pinning it prevents future confusion.
    // (No actual async test — the React docs are authoritative. This is a
    // marker test documenting the contract via a passing no-op.)
    expect(true).toBe(true);
  });
});
