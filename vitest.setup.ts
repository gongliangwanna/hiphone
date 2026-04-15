import '@testing-library/jest-dom/vitest';

// Polyfill setPointerCapture / releasePointerCapture for jsdom
if (typeof HTMLElement !== 'undefined') {
  HTMLElement.prototype.setPointerCapture ??= function () {};
  HTMLElement.prototype.releasePointerCapture ??= function () {};
  HTMLElement.prototype.hasPointerCapture ??= function () {
    return false;
  };
}

// Polyfill Range methods for ProseMirror / TipTap in jsdom
if (typeof Range !== 'undefined') {
  Range.prototype.getBoundingClientRect ??= () => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    toJSON: () => ({}),
  });
  Range.prototype.getClientRects ??= () =>
    ({
      item: () => null,
      length: 0,
      [Symbol.iterator]: function* () {},
    }) as DOMRectList;
}
