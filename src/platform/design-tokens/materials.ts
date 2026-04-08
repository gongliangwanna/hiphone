/**
 * Material presets for Liquid Glass.
 * ONLY the <Material> component should use these values directly.
 * All other components must use <Material variant="...">.
 */

export const materials = {
  thin: {
    blur: 20,
    saturate: 180,
    background: 'rgba(255, 255, 255, 0.55)',
  },
  regular: {
    blur: 30,
    saturate: 180,
    background: 'rgba(255, 255, 255, 0.70)',
  },
  thick: {
    blur: 40,
    saturate: 180,
    background: 'rgba(255, 255, 255, 0.85)',
  },
  chrome: {
    blur: 50,
    saturate: 200,
    background: 'rgba(242, 242, 247, 0.95)',
  },
} as const;

export type MaterialVariant = keyof typeof materials;
