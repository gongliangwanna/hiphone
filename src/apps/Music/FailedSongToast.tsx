import { motion, AnimatePresence } from 'motion/react';
import { useMusicDataStore } from './musicDataStore';

export function FailedSongToast() {
  const failedSongName = useMusicDataStore((s) => s.failedSongName);

  return (
    <AnimatePresence>
      {failedSongName && (
        <motion.div
          className="absolute left-0 right-0 flex justify-center"
          style={{ top: 48, zIndex: 60, pointerEvents: 'none' }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <div
            style={{
              backgroundColor: 'rgba(60, 60, 67, 0.9)',
              borderRadius: 10,
              padding: '10px 20px',
              fontSize: 14,
              color: '#fff',
              maxWidth: '80%',
              textAlign: 'center',
            }}
          >
            「{failedSongName}」暂时无法播放，已跳过
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
