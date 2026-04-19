// src/apps/AppStore/components/views/__tests__/DropZoneView.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DropZoneView } from '../DropZoneView';

describe('DropZoneView', () => {
  it('calls onFile when file selected', () => {
    const onFile = vi.fn();
    render(<DropZoneView onFile={onFile} />);
    const input = screen.getByTestId('upload-file-input') as HTMLInputElement;
    const file = new File(['x'], 'app.zip', { type: 'application/zip' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('calls onFile on drop', () => {
    const onFile = vi.fn();
    render(<DropZoneView onFile={onFile} />);
    const zone = screen.getByTestId('upload-drop-zone');
    const file = new File(['x'], 'app.zip', { type: 'application/zip' });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });
});
