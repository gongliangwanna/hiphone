import { memo } from 'react';
import { Share, LayoutGrid, Bookmark, Trash2 } from 'lucide-react';
import { T } from '../theme';

interface Props {
  selectedCount: number;
  onBatchForward: () => void;
  onMergeForward: () => void;
  onFavorite: () => void;
  onDelete: () => void;
}

export const MultiSelectToolbar = memo(function MultiSelectToolbar({
  selectedCount,
  onBatchForward,
  onMergeForward,
  onFavorite,
  onDelete,
}: Props) {
  const disabled = selectedCount === 0;
  const items: Array<{
    icon: typeof Share;
    label: string;
    onClick: () => void;
    danger: boolean;
  }> = [
    { icon: Share, label: '逐条转发', onClick: onBatchForward, danger: false },
    { icon: LayoutGrid, label: '合并转发', onClick: onMergeForward, danger: false },
    { icon: Bookmark, label: '收藏', onClick: onFavorite, danger: false },
    { icon: Trash2, label: '删除', onClick: onDelete, danger: true },
  ];

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: `0.5px solid ${T.separator}`,
        padding: '12px 16px',
        paddingBottom: 'max(12px, calc(var(--safe-bottom, 0px) + 12px))',
        display: 'flex',
        justifyContent: 'space-around',
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          disabled={disabled}
          onClick={item.onClick}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.35 : 1,
            padding: '4px 8px',
          }}
        >
          <item.icon size={22} strokeWidth={1.8} color={item.danger ? T.rose : T.accent} />
          <span style={{ fontSize: 11, color: item.danger ? T.rose : T.accent }}>
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
});
