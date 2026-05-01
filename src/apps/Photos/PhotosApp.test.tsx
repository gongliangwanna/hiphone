import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotosApp } from './PhotosApp';
import { usePhotosStore } from './photosStore';

class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  readAsDataURL(file: File) {
    this.result = `data:${file.type};base64,TEST_IMAGE`;
    queueMicrotask(() => this.onload?.());
  }
}

describe('PhotosApp uploads', () => {
  beforeEach(() => {
    usePhotosStore.setState({
      photos: [],
      activeTab: 'library',
      viewingPhotoId: null,
      isDismissing: false,
    });
    vi.stubGlobal('FileReader', MockFileReader);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts with an empty library', () => {
    render(<PhotosApp />);

    expect(screen.getByTestId('photos-empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId(/photo-cell-/)).not.toBeInTheDocument();
    expect(usePhotosStore.getState().photos).toEqual([]);
  });

  it('imports local image files and opens the uploaded photo', async () => {
    render(<PhotosApp />);

    const file = new File(['image-bytes'], 'beach.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('photos-upload-input'), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(usePhotosStore.getState().photos).toHaveLength(1);
    });

    const photo = usePhotosStore.getState().photos[0]!;
    expect(photo.fileName).toBe('beach.png');
    expect(photo.fullSize).toBe('data:image/png;base64,TEST_IMAGE');
    expect(screen.getByTestId(`photo-cell-${photo.id}`)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(`photo-cell-${photo.id}`));
    expect(screen.getByTestId('photo-viewer')).toBeInTheDocument();
  });
});
