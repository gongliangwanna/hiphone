import { motion } from 'motion/react';
import type { CharacterCard } from '@/platform/stores/characterStore';
import { getPresenceBackdrop } from '../presenceScenes';

interface SceneHeroProps {
  character: CharacterCard | undefined;
  sceneText: string;
  backdropId: string;
  compact?: boolean;
  immersive?: boolean;
}

export function SceneHero({
  character,
  sceneText,
  backdropId,
  compact = false,
  immersive = false,
}: SceneHeroProps) {
  const backdrop = getPresenceBackdrop(backdropId);
  const avatarClassName = compact
    ? 'h-12 w-12 rounded-full object-cover'
    : 'h-14 w-14 rounded-full object-cover';
  const titleClassName = compact
    ? 'truncate text-[18px] font-semibold'
    : 'truncate text-[22px] font-semibold';
  const textClassName = compact
    ? 'mt-1 line-clamp-2 text-[13px] leading-5 text-white/82'
    : 'mt-2 line-clamp-2 text-[14px] leading-6 text-white/86';

  if (immersive) {
    return (
      <motion.div
        className="relative shrink-0 px-4 pb-2 pt-3 text-white"
        initial={{ opacity: 0.9 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
        data-testid="presence-scene-hero"
      >
        <motion.div
          className="relative overflow-hidden rounded-[24px] px-3 py-3"
          style={{
            background:
              'linear-gradient(90deg, rgba(26,23,24,0.62), rgba(47,38,36,0.46))',
            border: '0.5px solid rgba(255,255,255,0.2)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.2)',
          }}
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="absolute inset-y-0 right-0 w-28" data-testid="presence-hero-ambient">
            <span
              className="absolute right-9 top-5 h-7 w-7 rounded-full"
              style={{
                backgroundColor: 'rgba(255,214,138,0.9)',
                boxShadow: '0 0 24px rgba(255,205,116,0.42)',
              }}
            />
            <span
              className="absolute right-12 top-4 h-7 w-7 rounded-full"
              style={{ backgroundColor: 'rgba(44,36,35,0.96)' }}
            />
            {[
              ['right-5', 'top-6', 'h-1.5', 'w-1.5'],
              ['right-16', 'top-3', 'h-1', 'w-1'],
              ['right-20', 'bottom-5', 'h-1.5', 'w-1.5'],
              ['right-7', 'bottom-4', 'h-1', 'w-1'],
            ].map(([right, top, h, w], index) => (
              <span
                key={`${right}-${top}`}
                className={`absolute ${right} ${top} ${h} ${w} rounded-full`}
                style={{
                  backgroundColor: 'rgba(255,214,138,0.86)',
                  boxShadow: '0 0 12px rgba(255,214,138,0.45)',
                  opacity: index % 2 === 0 ? 0.9 : 0.62,
                }}
              />
            ))}
          </div>
          <div className="relative flex items-center gap-3 pr-20">
            <img
              src={character?.avatar || '/resource/avatars/preset-01.jpg'}
              alt=""
              className="h-12 w-12 rounded-full object-cover"
              style={{ boxShadow: '0 0 0 1.5px rgba(255,255,255,0.68)' }}
            />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[18px] font-semibold">
                {character?.name || '角色'}
              </h1>
              <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-white/72">
                {sceneText || backdrop.title}
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="relative overflow-hidden"
      style={{
        minHeight: compact ? 156 : 244,
        backgroundColor: '#111318',
      }}
      initial={{ opacity: 0.9 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      data-testid="presence-scene-hero"
    >
      <motion.img
        src={backdrop.imageUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        initial={{ scale: 1.08 }}
        animate={{ scale: 1.02 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/18 via-black/16 to-black/72" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(0,0,0,0.46), rgba(0,0,0,0.05) 58%, rgba(0,0,0,0.22))',
        }}
      />
      <motion.div
        className="absolute bottom-0 left-0 right-0 p-4 text-white"
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="flex items-end gap-3 rounded-[22px] p-3"
          style={{
            backgroundColor: 'rgba(12,14,18,0.28)',
            border: '0.5px solid rgba(255,255,255,0.22)',
            boxShadow: '0 18px 42px rgba(0,0,0,0.22)',
            backdropFilter: 'blur(18px)',
          }}
        >
          <img
            src={character?.avatar || '/resource/avatars/preset-01.jpg'}
            alt=""
            className={avatarClassName}
            style={{ boxShadow: '0 0 0 2px rgba(255,255,255,0.78)' }}
          />
          <div className="min-w-0 flex-1">
            <h1 className={titleClassName}>{character?.name || '角色'}</h1>
            <p className={textClassName}>{sceneText || backdrop.title}</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
