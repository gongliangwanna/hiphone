import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { downloadBlob } from '../downloadBlob';

describe('downloadBlob', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    createObjectURLSpy = vi.fn(() => 'blob:fake-url');
    revokeObjectURLSpy = vi.fn();
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    (URL as unknown as { createObjectURL: typeof createObjectURLSpy }).createObjectURL = createObjectURLSpy;
    (URL as unknown as { revokeObjectURL: typeof revokeObjectURLSpy }).revokeObjectURL = revokeObjectURLSpy;
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('creates a blob URL, an anchor with download attribute, clicks it, and revokes the URL', () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const clickSpy = vi.fn();
    const removeSpy = vi.fn();

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          const fakeAnchor = originalCreateElement('a');
          fakeAnchor.click = clickSpy;
          fakeAnchor.remove = removeSpy;
          return fakeAnchor;
        }
        return originalCreateElement(tagName);
      });

    downloadBlob(blob, 'my-file.zip');

    expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:fake-url');
    expect(removeSpy).toHaveBeenCalledOnce();

    createElementSpy.mockRestore();
  });

  it('throws when not in a browser environment', () => {
    const originalDocument = globalThis.document;
    delete (globalThis as { document?: Document }).document;

    expect(() => downloadBlob(new Blob(['x']), 'x.txt')).toThrow(/browser/);

    (globalThis as { document?: Document }).document = originalDocument;
  });
});
