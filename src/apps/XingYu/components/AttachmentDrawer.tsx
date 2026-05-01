import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon } from 'lucide-react';
import { T } from '../theme';

interface AttachmentItem {
  id: string;
  label: string;
  Icon: LucideIcon;
  enabled: boolean;
  onTap?: () => void;
}

interface Props {
  visible: boolean;
  onPickImage: () => void;
}

export function AttachmentDrawer({ visible, onPickImage }: Props) {
  const items: AttachmentItem[] = [
    { id: 'photo', label: '照片', Icon: ImageIcon, enabled: true, onTap: onPickImage },
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 220, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          className="shrink-0 overflow-hidden"
          style={{ backgroundColor: T.bg, borderTop: `0.5px solid ${T.separator}` }}
          data-testid="xy-attachment-drawer"
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 12,
              padding: '20px 16px',
            }}
          >
            {items.map(({ id, label, Icon, enabled, onTap }) => (
              <motion.button
                key={id}
                type="button"
                className="flex flex-col items-center"
                style={{
                  gap: 6,
                  opacity: enabled ? 1 : 0.35,
                  pointerEvents: enabled ? 'auto' : 'none',
                  touchAction: 'manipulation',
                }}
                whileTap={enabled ? { scale: 0.94 } : undefined}
                onPointerDown={(e) => {
                  if (!enabled || !onTap) return;
                  e.preventDefault();
                  onTap();
                }}
                aria-label={label}
                data-testid={`xy-attach-${id}`}
              >
                <span
                  className="flex items-center justify-center"
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: T.r.lg,
                    backgroundColor: T.card,
                    border: `0.5px solid ${T.border}`,
                    boxShadow: T.shadow1,
                  }}
                >
                  <Icon size={26} strokeWidth={1.6} color={T.textPrimary} />
                </span>
                <span style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.2 }}>
                  {label}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
