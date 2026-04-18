import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { UploadPage } from '../UploadPage';
import * as installerMod from '@/platform/userApp/installer';

// Build a fake zip Blob — installer is mocked so content doesn't matter.
function fakeZip(): File {
  const blob = new Blob([new Uint8Array([0, 1, 2, 3])], { type: 'application/zip' });
  return new File([blob], 'todo.zip', { type: 'application/zip' });
}

describe('UploadPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders file input and drop zone', () => {
    render(<UploadPage />);
    expect(screen.getByTestId('appstore-upload-page')).toBeInTheDocument();
    expect(screen.getByTestId('upload-file-input')).toBeInTheDocument();
    expect(screen.getByTestId('upload-drop-zone')).toBeInTheDocument();
  });

  it('calls installer.install when a file is selected', async () => {
    const installSpy = vi.spyOn(installerMod, 'install').mockResolvedValue({
      id: 'todo',
      installedAt: 1234,
      isUpgrade: false,
    });

    render(<UploadPage />);
    const input = screen.getByTestId('upload-file-input') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { files: [fakeZip()] } });
    });

    expect(installSpy).toHaveBeenCalledOnce();
    expect(installSpy.mock.calls[0]![0]).toBeInstanceOf(File);
  });

  it('shows progress text while installing and success toast on done', async () => {
    vi.spyOn(installerMod, 'install').mockImplementation(async (_file, options) => {
      options?.onProgress?.({ stage: 'unzip', progress: 0.5 });
      options?.onProgress?.({ stage: 'compile', progress: 0.4, fileIndex: 2, total: 5 });
      options?.onProgress?.({ stage: 'done' });
      return { id: 'todo', installedAt: 1, isUpgrade: false };
    });

    render(<UploadPage />);
    const input = screen.getByTestId('upload-file-input') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { files: [fakeZip()] } });
    });

    await waitFor(() => {
      // Success surface shows after done event
      expect(screen.getByText(/已安装/)).toBeInTheDocument();
    });
    expect(screen.getByText(/todo/)).toBeInTheDocument();
  });

  it('shows error message when install rejects', async () => {
    vi.spyOn(installerMod, 'install').mockImplementation(async (_file, options) => {
      options?.onProgress?.({ stage: 'unzip', progress: 0 });
      options?.onProgress?.({ stage: 'error', error: new Error('manifest.json missing') });
      throw new Error('manifest.json missing');
    });

    render(<UploadPage />);
    const input = screen.getByTestId('upload-file-input') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { files: [fakeZip()] } });
    });

    await waitFor(() => {
      expect(screen.getByText(/安装失败/)).toBeInTheDocument();
    });
    expect(screen.getByText(/manifest\.json missing/)).toBeInTheDocument();
  });

  it('handles drag-drop of a File', async () => {
    const installSpy = vi.spyOn(installerMod, 'install').mockResolvedValue({
      id: 'todo',
      installedAt: 1,
      isUpgrade: false,
    });

    render(<UploadPage />);
    const dropZone = screen.getByTestId('upload-drop-zone');

    const file = fakeZip();
    const dataTransfer = { files: [file], items: [], types: ['Files'] } as unknown as DataTransfer;

    await act(async () => {
      fireEvent.dragOver(dropZone, { dataTransfer });
      fireEvent.drop(dropZone, { dataTransfer });
    });

    expect(installSpy).toHaveBeenCalledOnce();
  });
});
