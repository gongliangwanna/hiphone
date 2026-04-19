import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InstallProgressView } from '../InstallProgressView';

describe('InstallProgressView', () => {
  it('shows unzip stage text and ~7% progress', () => {
    render(<InstallProgressView event={{ stage: 'unzip', progress: 0.5 }} />);
    expect(screen.getByText('正在解压…')).toBeInTheDocument();
    expect(screen.getByTestId('install-progress-ring')).toHaveAttribute('data-percent', '8');
  });

  it('maps compile fileIndex=1 of total=4 to 42%', () => {
    render(
      <InstallProgressView
        event={{ stage: 'compile', progress: 0, fileIndex: 1, total: 4 }}
      />,
    );
    expect(screen.getByText('编译 2/4')).toBeInTheDocument();
    expect(screen.getByTestId('install-progress-ring')).toHaveAttribute('data-percent', '55');
  });

  it('shows persist 95%', () => {
    render(<InstallProgressView event={{ stage: 'persist', progress: 0.5 }} />);
    expect(screen.getByText('写入本地存储…')).toBeInTheDocument();
    expect(screen.getByTestId('install-progress-ring')).toHaveAttribute('data-percent', '95');
  });
});
