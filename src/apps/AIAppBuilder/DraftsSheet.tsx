/**
 * Drafts history sheet — bottom sheet listing all drafts. Tap a row to
 * switch the active draft; swipe left to reveal Export + Delete actions.
 *
 * Pattern mirrors:
 *   - src/apps/translate/selectors/LangSheet.tsx (backdrop + slide-up)
 *   - src/apps/translate/recents/RecentRow.tsx (motion drag swipe-actions)
 *
 * Uses motion/react directly (host code, not a user-app sandbox).
 */

import { motion, AnimatePresence } from 'motion/react';
import { Download, Trash2, FileText, Plus } from 'lucide-react';
import { spring } from '@/platform/design-tokens/motion';
import {
  useAIAppBuilderStore,
  getDraftTitle,
  type Draft,
} from './aiAppBuilderStore';

interface DraftsSheetProps {
  open: boolean;
  onClose: () => void;
  onCreateNew: () => void;
}

export function DraftsSheet({ open, onClose, onCreateNew }: DraftsSheetProps) {
  const drafts = useAIAppBuilderStore((s) => s.drafts);
  const activeDraftId = useAIAppBuilderStore((s) => s.activeDraftId);

  const list = Object.values(drafts).sort((a, b) => b.updatedAt - a.updatedAt);

  const handlePick = (id: string) => {
    useAIAppBuilderStore.getState().setActiveDraft(id);
    onClose();
  };

  const handleDelete = (id: string) => {
    if (!confirm('确定删除该草稿?')) return;
    useAIAppBuilderStore.getState().deleteDraft(id);
  };

  const handleExport = async (id: string) => {
    try {
      await useAIAppBuilderStore.getState().exportDraftAsZip(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`导出失败: ${msg}`);
    }
  };

  const handleNewDraft = () => {
    onCreateNew();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="absolute inset-0 z-[100]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="draftssheet-title"
        >
          <motion.button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={spring.smooth}
            className="absolute inset-0 bg-black/40 border-none cursor-pointer"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring.snappy}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              maxHeight: '75%',
              backgroundColor: 'var(--color-secondarySystemBackground)',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingTop: 12,
              paddingBottom: 12,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* drag handle */}
            <div
              style={{
                width: 36,
                height: 5,
                borderRadius: 3,
                margin: '0 auto 8px',
                backgroundColor: 'var(--color-tertiaryLabel)',
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 16px 8px',
              }}
            >
              <span
                id="draftssheet-title"
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  color: 'var(--color-label)',
                }}
              >
                草稿
              </span>
              <motion.button
                type="button"
                onClick={handleNewDraft}
                whileTap={{ scale: 0.92 }}
                transition={spring.snappy}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 12px',
                  borderRadius: 14,
                  border: 'none',
                  backgroundColor: 'var(--color-systemBlue)',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                aria-label="新建草稿"
              >
                <Plus size={14} />
                新建
              </motion.button>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                paddingBottom: 8,
              }}
            >
              {list.length === 0 ? (
                <EmptyDraftList />
              ) : (
                list.map((draft) => (
                  <DraftRow
                    key={draft.id}
                    draft={draft}
                    isActive={draft.id === activeDraftId}
                    onPick={() => handlePick(draft.id)}
                    onExport={() => handleExport(draft.id)}
                    onDelete={() => handleDelete(draft.id)}
                  />
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function EmptyDraftList() {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '40px 20px',
        color: 'var(--color-secondaryLabel)',
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      <FileText
        size={28}
        color="var(--color-tertiaryLabel)"
        strokeWidth={1.5}
        style={{ marginBottom: 12 }}
      />
      <div>还没有草稿</div>
      <div style={{ fontSize: 13, marginTop: 4 }}>点右上角 + 开始一个新草稿</div>
    </div>
  );
}

function DraftRow({
  draft,
  isActive,
  onPick,
  onExport,
  onDelete,
}: {
  draft: Draft;
  isActive: boolean;
  onPick: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const title = getDraftTitle(draft);
  const fileCount = Object.keys(draft.files).length;
  const subtitle = `${formatRelativeTime(draft.updatedAt)} · ${fileCount} 个文件`;

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderBottom: '0.5px solid var(--color-separator)',
      }}
    >
      {/* swipe-revealed actions sit behind the row */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <button
          type="button"
          aria-label="导出 ZIP"
          aria-hidden="true"
          tabIndex={-1}
          onClick={onExport}
          style={{
            width: 88,
            border: 'none',
            backgroundColor: 'var(--color-systemBlue)',
            color: 'white',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            cursor: 'pointer',
          }}
        >
          <Download size={18} strokeWidth={2.2} />
          导出
        </button>
        <button
          type="button"
          aria-label="删除"
          aria-hidden="true"
          tabIndex={-1}
          onClick={onDelete}
          style={{
            width: 88,
            border: 'none',
            backgroundColor: 'var(--color-systemRed)',
            color: 'white',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            cursor: 'pointer',
          }}
        >
          <Trash2 size={18} strokeWidth={2.2} />
          删除
        </button>
      </div>

      <motion.button
        type="button"
        onClick={onPick}
        drag="x"
        dragConstraints={{ left: -176, right: 0 }}
        dragElastic={0.05}
        transition={spring.snappy}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          padding: '12px 16px',
          backgroundColor: isActive
            ? 'var(--color-systemBlue)'
            : 'var(--color-secondarySystemBackground)',
          color: isActive ? 'white' : 'var(--color-label)',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <FileText
          size={20}
          strokeWidth={2}
          color={isActive ? 'white' : 'var(--color-secondaryLabel)'}
          style={{ flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 12,
              marginTop: 2,
              color: isActive
                ? 'rgba(255,255,255,0.85)'
                : 'var(--color-secondaryLabel)',
            }}
          >
            {subtitle}
          </div>
        </div>
      </motion.button>
    </div>
  );
}

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  const date = new Date(ts);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
