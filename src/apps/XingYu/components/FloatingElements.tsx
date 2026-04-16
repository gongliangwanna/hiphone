import { motion } from 'motion/react';
import { Star, Heart, Sparkle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const PARTICLES: { icon: LucideIcon; x: string; delay: number; dur: number }[] = [
  { icon: Star, x: '10%', delay: 0, dur: 6 },
  { icon: Heart, x: '25%', delay: 1, dur: 7 },
  { icon: Sparkle, x: '45%', delay: 2.5, dur: 5.5 },
  { icon: Heart, x: '65%', delay: 0.5, dur: 6.5 },
  { icon: Star, x: '80%', delay: 3, dur: 5 },
  { icon: Sparkle, x: '90%', delay: 1.5, dur: 7.5 },
  { icon: Sparkle, x: '35%', delay: 4, dur: 6 },
];

/** Decorative floating hearts/stars — sits behind chat content */
export function FloatingElements() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ opacity: 0.12 }}>
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{ left: p.x, bottom: -20, color: '#FF9A9E' }}
          animate={{
            y: [0, -500],
            opacity: [0, 0.8, 0],
            rotate: [0, 180],
          }}
          transition={{
            duration: p.dur,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <p.icon size={16} strokeWidth={1.5} />
        </motion.span>
      ))}
    </div>
  );
}
