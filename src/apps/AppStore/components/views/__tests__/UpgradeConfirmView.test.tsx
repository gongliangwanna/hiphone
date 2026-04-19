// src/apps/AppStore/components/views/__tests__/UpgradeConfirmView.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpgradeConfirmView } from '../UpgradeConfirmView';

const existing = { name: 'My App', version: '1.0.0' };
const incoming = { name: 'My App', version: '1.2.0' };

describe('UpgradeConfirmView', () => {
  it('shows both versions', () => {
    render(
      <UpgradeConfirmView existing={existing} incoming={incoming}
        onCancel={() => {}} onConfirm={() => {}} />,
    );
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('1.2.0')).toBeInTheDocument();
  });

  it('invokes onConfirm on 更新', () => {
    const onConfirm = vi.fn();
    render(
      <UpgradeConfirmView existing={existing} incoming={incoming}
        onCancel={() => {}} onConfirm={onConfirm} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '更新' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('invokes onCancel on 取消', () => {
    const onCancel = vi.fn();
    render(
      <UpgradeConfirmView existing={existing} incoming={incoming}
        onCancel={onCancel} onConfirm={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
