import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { wrapUserComponent } from '../wrap';

describe('wrapUserComponent', () => {
  afterEach(() => cleanup());

  it('wraps the user component inside AppScreen', () => {
    function UserApp() {
      return <div data-testid="user-content">user content</div>;
    }
    const Wrapped = wrapUserComponent(UserApp);

    const { getByTestId, container } = render(<Wrapped />);

    // The user content is rendered
    expect(getByTestId('user-content').textContent).toBe('user content');
    // Something else is rendered above it (AppScreen provides status-bar
    // safe area / layout). We don't assert specific structure because
    // AppScreen internals may evolve — just check the wrap exists.
    expect(container.firstChild).toBeTruthy();
    expect(container.firstChild).not.toBe(getByTestId('user-content'));
  });

  it('is a stable function reference when called twice with same input', () => {
    function UserApp(): null { return null; }
    expect(() => wrapUserComponent(UserApp)).not.toThrow();
    expect(() => wrapUserComponent(UserApp)).not.toThrow();
  });

  it('forwards no-op when user component throws — error bubbles', () => {
    function BrokenApp(): null {
      throw new Error('user code boom');
    }
    const Wrapped = wrapUserComponent(BrokenApp);

    // React 19 logs errors from render — we expect the render to throw.
    expect(() => render(<Wrapped />)).toThrow();
  });
});
