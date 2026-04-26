/**
 * @hiphone/motion — animation primitives for user apps.
 *
 * Re-exports motion/react's component & hook surface plus the project's
 * stable spring / duration / ease tokens. User apps build iOS-fidelity
 * animations on top of these without re-tuning physics parameters.
 *
 * Sandbox rationale: motion/react is a bare-import module and would fail
 * sandbox resolution unless whitelisted here. Tokens are re-exported
 * directly from the design-tokens module (not mirrored) so they stay in
 * sync with system code automatically.
 */
export {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useSpring,
  useAnimate,
  useMotionValueEvent,
  useScroll,
  useInView,
} from 'motion/react';

export { spring, duration, ease } from '@/platform/design-tokens/motion';
