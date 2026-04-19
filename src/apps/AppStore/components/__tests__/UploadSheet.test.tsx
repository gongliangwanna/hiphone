import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UploadSheet } from '../UploadSheet';
import * as installerMod from '@/platform/userApp/installer';
import { InstallError } from '@/platform/userApp/installer';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('UploadSheet', () => {
  it('starts in idle phase showing DropZone', () => {
    render(<UploadSheet onClose={() => {}} onOpenApp={() => {}} />);
    expect(screen.getByTestId('upload-drop-zone')).toBeInTheDocument();
  });

  it('transitions idle → installing → success on happy path', async () => {
    vi.spyOn(installerMod, 'install').mockImplementation(async (_file, opts) => {
      opts?.onProgress?.({ stage: 'unzip', progress: 0.5 });
      opts?.onProgress?.({ stage: 'compile', progress: 0, fileIndex: 0, total: 1 });
      return { id: 'demo', installedAt: 1, isUpgrade: false };
    });
    render(<UploadSheet onClose={() => {}} onOpenApp={() => {}} />);
    const input = screen.getByTestId('upload-file-input') as HTMLInputElement;
    const file = new File(['x'], 'demo.zip', { type: 'application/zip' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '打开 App' })).toBeInTheDocument(),
    );
  });

  it('shows UpgradeConfirm and resolves true on 更新', async () => {
    vi.spyOn(installerMod, 'install').mockImplementation(async (_file, opts) => {
      const ok = await opts!.onUpgradeDetected!({
        existing: { id: 'demo', name: 'Demo', version: '1.0.0' },
        incoming: { id: 'demo', name: 'Demo', version: '2.0.0' },
      });
      expect(ok).toBe(true);
      return { id: 'demo', installedAt: 2, isUpgrade: true };
    });
    render(<UploadSheet onClose={() => {}} onOpenApp={() => {}} />);
    const input = screen.getByTestId('upload-file-input') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'demo.zip', { type: 'application/zip' })] },
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '更新' })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: '更新' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '打开 App' })).toBeInTheDocument(),
    );
  });

  it('shows ErrorView on bad-zip', async () => {
    vi.spyOn(installerMod, 'install').mockRejectedValue(
      new InstallError('bad-zip', 'corrupt'),
    );
    render(<UploadSheet onClose={() => {}} onOpenApp={() => {}} />);
    const input = screen.getByTestId('upload-file-input') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'demo.zip', { type: 'application/zip' })] },
    });
    await waitFor(() =>
      expect(screen.getByText('这个 zip 打不开')).toBeInTheDocument(),
    );
  });

  it('returns to idle silently on user-cancelled', async () => {
    vi.spyOn(installerMod, 'install').mockImplementation(async (_f, opts) => {
      await opts!.onUpgradeDetected!({
        existing: { id: 'demo', name: 'Demo', version: '1.0.0' },
        incoming: { id: 'demo', name: 'Demo', version: '2.0.0' },
      });
      throw new InstallError('user-cancelled', 'cancelled');
    });
    render(<UploadSheet onClose={() => {}} onOpenApp={() => {}} />);
    fireEvent.change(screen.getByTestId('upload-file-input'), {
      target: { files: [new File(['x'], 'demo.zip', { type: 'application/zip' })] },
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    await waitFor(() =>
      expect(screen.getByTestId('upload-drop-zone')).toBeInTheDocument(),
    );
  });
});
