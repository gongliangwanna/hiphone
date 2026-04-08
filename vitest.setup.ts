import '@testing-library/jest-dom/vitest';

// Polyfill setPointerCapture / releasePointerCapture for jsdom
if (typeof HTMLElement !== 'undefined') {
  HTMLElement.prototype.setPointerCapture ??= function () {};
  HTMLElement.prototype.releasePointerCapture ??= function () {};
  HTMLElement.prototype.hasPointerCapture ??= function () {
    return false;
  };
}
