import { motion } from 'motion/react';

const PARTICLES = [
  { emoji: '✦', x: '10%', delay: 0, dur: 6 },
  { emoji: '♡', x: '25%', delay: 1, dur: 7 },
  { emoji: '✧', x: '45%', delay: 2.5, dur: 5.5 },
  { emoji: '♡', x: '65%', delay: 0.5, dur: 6.5 },
  { emoji: '✦', x: '80%', delay: 3, dur: 5 },
  { emoji: '·', x: '90%', delay: 1.5, dur: 7.5 },
  { emoji: '✧', x: '35%', delay: 4, dur: 6 },
];

/** Decorative floating hearts/stars — sits behind chat content */
export function FloatingElements() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ opacity: 0.12 }}>
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{ left: p.x, bottom: -20, fontSize: 16, color: '#FF9A9E' }}
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
          {p.emoji}
        </motion.span>
      ))}
    </div>
  );
}
