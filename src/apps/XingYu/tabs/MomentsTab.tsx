import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { useXYData } from '../xingYuDataStore';
import { useXYNav } from '../xingYuNavStore';
import { MomentCard } from '../components/MomentCard';
import { MomentComposer } from '../components/MomentComposer';
import { T, springs } from '../theme';

export function MomentsTab() {
  const moments = useXYData((s) => s.moments);
  const openComposer = useXYNav((s) => s.openMomentComposer);

  return (
    <div className="relative flex h-full flex-col" style={{ backgroundColor: T.bg }}>
      <div className="shrink-0 px-5 pt-3 pb-1">
        <div className="flex items-center justify-between" style={{ height: 44 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.textPrimary, letterSpacing: -0.5 }}>
            动态
          </h1>
          <motion.button
            className="flex items-center justify-center rounded-full"
            style={{
              width: 32,
              height: 32,
              background: T.accentGrad,
              boxShadow: T.shadow2,
            }}
            onClick={openComposer}
            whileTap={{ scale: 0.85 }}
            transition={springs.press}
          >
            <Plus size={18} strokeWidth={2.5} color={T.textOnAccent} />
          </motion.button>
        </div>
      </div>

      <div className="scrollbar-hide mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {moments.map((mo, i) => (
          <motion.div
            key={mo.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, ...springs.gentle }}
          >
            <MomentCard moment={mo} />
          </motion.div>
        ))}
        <div style={{ height: 16 }} />
      </div>

      {/* Moment Composer Overlay */}
      <MomentComposer />
    </div>
  );
}
