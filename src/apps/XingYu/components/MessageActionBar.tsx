import { memo, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Copy, Bookmark, Reply, Share, Grid2x2, Trash2 } from 'lucide-react';
import type { Message } from '../data';

export type ActionType = 'copy' | 'favorite' | 'quote' | 'forward' | 'multiSelect' | 'delete';

interface ActionItem {
  type: ActionType;
  icon: typeof Copy;
  label: string;
}

function getActions(msg: Message): ActionItem[] {
  const actions: ActionItem[] = [];

  if (msg.type === 'text') {
    actions.push({ type: 'copy', icon: Copy, label: '复制' });
  }

  actions.push({ type: 'favorite', icon: Bookmark, label: '收藏' });

  if (msg.type !== 'forward_card') {
    actions.push({ type: 'quote', icon: Reply, label: '引用' });
  }

  actions.push({ type: 'forward', icon: Share, label: '转发' });
  actions.push({ type: 'multiSelect', icon: Grid2x2, label: '多选' });
  actions.push({ type: 'delete', icon: Trash2, label: '删除' });

  return actions;
}

interface Props {
  msg: Message;
  position: 'above' | 'below';
  isMine: boolean;
  onAction: (type: ActionType, msg: Message) => void;
  onClose: () => void;
}

export const MessageActionBar = memo(function MessageActionBar({
  msg,
  position,
  isMine,
  onAction,
  onClose,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const actions = getActions(msg);

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handler);
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handler);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={barRef}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      style={{
        display: 'inline-flex',
        background: '#3A3A3C',
        borderRadius: 12,
        padding: '6px 2px',
        boxShadow: '0 6px 24px rgba(0,0,0,0.28)',
        marginBottom: position === 'above' ? 6 : 0,
        marginTop: position === 'below' ? 6 : 0,
        marginLeft: isMine ? 'auto' : undefined,
        zIndex: 5,
      }}
    >
      {actions.map((action) => (
        <button
          key={action.type}
          type="button"
          onClick={() => onAction(action.type, msg)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            padding: '6px 10px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#fff',
            minWidth: 52,
          }}
        >
          <action.icon size={20} strokeWidth={1.8} color="#fff" />
          <span style={{ fontSize: 10, lineHeight: 1, color: '#fff' }}>{action.label}</span>
        </button>
      ))}
    </motion.div>
  );
});
