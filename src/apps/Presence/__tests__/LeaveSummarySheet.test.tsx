import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LeaveSummarySheet } from '../components/LeaveSummarySheet';

describe('LeaveSummarySheet', () => {
  it('shows an animated loading indicator while generating the record', () => {
    render(
      <LeaveSummarySheet
        open
        loading
        error={null}
        summary={null}
        onRetry={vi.fn()}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByTestId('presence-summary-loading')).toBeInTheDocument();
    expect(screen.getByTestId('presence-summary-loading-icon')).toHaveClass('animate-spin');
    expect(screen.getByText('正在生成在场记录…')).toBeInTheDocument();
  });

  it('does not render next-thread todo fields in the summary', () => {
    render(
      <LeaveSummarySheet
        open
        loading={false}
        error={null}
        summary={{
          scene: '雨中便利店',
          whatHappened: '用户解释迟到。',
          emotionalShift: '气氛缓和。',
        }}
        onRetry={vi.fn()}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('场景')).toBeInTheDocument();
    expect(screen.getByText('发生了什么')).toBeInTheDocument();
    expect(screen.getByText('情绪变化')).toBeInTheDocument();
    expect(screen.queryByText('待续事项')).not.toBeInTheDocument();
    expect(screen.queryByText('待办事项')).not.toBeInTheDocument();
  });
});
