import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InstallErrorView } from '../InstallErrorView';
import { InstallError } from '@/platform/userApp/installer';

describe('InstallErrorView', () => {
  it('maps bad-zip kind to 这个 zip 打不开', () => {
    const err = new InstallError('bad-zip', 'raw zip parse failed at byte 42');
    render(<InstallErrorView error={err} onRetry={() => {}} />);
    expect(screen.getByText('这个 zip 打不开')).toBeInTheDocument();
    expect(screen.queryByText(/byte 42/)).not.toBeInTheDocument();
  });

  it('reveals raw message after 查看详情', () => {
    const err = new InstallError('io', 'IDBRequest aborted');
    render(<InstallErrorView error={err} onRetry={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '查看详情' }));
    expect(screen.getByText('IDBRequest aborted')).toBeInTheDocument();
  });

  it('invokes onRetry', () => {
    const onRetry = vi.fn();
    const err = new InstallError('compile', 'TS error');
    render(<InstallErrorView error={err} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
