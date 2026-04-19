import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InstallSuccessView } from '../InstallSuccessView';

describe('InstallSuccessView', () => {
  it('shows install copy', () => {
    render(<InstallSuccessView
      appName="Demo" version="1.0.0" isUpgrade={false}
      onContinue={() => {}} onOpen={() => {}} />);
    expect(screen.getByText(/已安装.*Demo/)).toBeInTheDocument();
  });

  it('shows upgrade copy with version', () => {
    render(<InstallSuccessView
      appName="Demo" version="2.0.0" isUpgrade={true}
      onContinue={() => {}} onOpen={() => {}} />);
    expect(screen.getByText(/已更新到.*2\.0\.0/)).toBeInTheDocument();
  });

  it('invokes callbacks', () => {
    const onContinue = vi.fn(), onOpen = vi.fn();
    render(<InstallSuccessView appName="Demo" version="1" isUpgrade={false}
      onContinue={onContinue} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: '继续安装' }));
    fireEvent.click(screen.getByRole('button', { name: '打开 App' }));
    expect(onContinue).toHaveBeenCalled();
    expect(onOpen).toHaveBeenCalled();
  });
});
