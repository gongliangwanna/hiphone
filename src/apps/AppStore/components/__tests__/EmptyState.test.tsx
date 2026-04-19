import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders heading, subtitle, and CTA', () => {
    render(<EmptyState onUpload={() => {}} />);
    expect(screen.getByText('还没装 App')).toBeInTheDocument();
    expect(screen.getByText(/拖拽文件/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /上传 zip/ })).toBeInTheDocument();
  });

  it('calls onUpload when CTA clicked', () => {
    const onUpload = vi.fn();
    render(<EmptyState onUpload={onUpload} />);
    fireEvent.click(screen.getByRole('button', { name: /上传 zip/ }));
    expect(onUpload).toHaveBeenCalledTimes(1);
  });
});
