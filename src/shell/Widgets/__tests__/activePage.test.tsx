import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  ActivePagesProvider,
  PageIndexProvider,
  useIsPageActive,
} from '../activePage';

function Probe({ onResult }: { onResult: (active: boolean) => void }) {
  const active = useIsPageActive();
  onResult(active);
  return null;
}

function last(arr: boolean[]): boolean | undefined {
  return arr[arr.length - 1];
}

describe('ActivePagesProvider / useIsPageActive', () => {
  it('reports true when no PageIndexProvider exists (e.g. drawer)', () => {
    const results: boolean[] = [];
    render(<Probe onResult={(v) => results.push(v)} />);
    expect(last(results)).toBe(true);
  });

  it('reports true only for the matching page index', () => {
    const a: boolean[] = [];
    const b: boolean[] = [];
    render(
      <ActivePagesProvider currentPage={1}>
        <PageIndexProvider pageIndex={0}>
          <Probe onResult={(v) => a.push(v)} />
        </PageIndexProvider>
        <PageIndexProvider pageIndex={1}>
          <Probe onResult={(v) => b.push(v)} />
        </PageIndexProvider>
      </ActivePagesProvider>,
    );
    expect(last(a)).toBe(false);
    expect(last(b)).toBe(true);
  });

  it('reports true for every page when forceAllActive is set (drag mode)', () => {
    const a: boolean[] = [];
    const b: boolean[] = [];
    render(
      <ActivePagesProvider currentPage={1} forceAllActive>
        <PageIndexProvider pageIndex={0}>
          <Probe onResult={(v) => a.push(v)} />
        </PageIndexProvider>
        <PageIndexProvider pageIndex={2}>
          <Probe onResult={(v) => b.push(v)} />
        </PageIndexProvider>
      </ActivePagesProvider>,
    );
    expect(last(a)).toBe(true);
    expect(last(b)).toBe(true);
  });
});
