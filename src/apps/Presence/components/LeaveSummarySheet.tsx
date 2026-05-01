import { LoaderCircle, RotateCcw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Material } from '@/system';
import type { PresenceSummary } from '../presenceTypes';

interface LeaveSummarySheetProps {
  open: boolean;
  loading: boolean;
  error?: string | null;
  summary: PresenceSummary | null;
  onRetry: () => void;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-[16px] px-4 py-3"
      style={{
        backgroundColor: 'rgba(255,255,255,0.62)',
        border: '0.5px solid rgba(60,60,67,0.1)',
      }}
    >
      <div
        className="text-[12px] font-semibold"
        style={{ color: 'var(--color-tertiaryLabel)' }}
      >
        {label}
      </div>
      <div
        className="mt-1 text-[14px] leading-5"
        style={{ color: 'var(--color-label)' }}
      >
        {value || '无'}
      </div>
    </div>
  );
}

export function LeaveSummarySheet({
  open,
  loading,
  error,
  summary,
  onRetry,
  onSave,
  onDiscard,
  onCancel,
}: LeaveSummarySheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-50 flex items-end bg-black/30"
          data-testid="presence-leave-sheet"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button
            type="button"
            aria-label="取消离开"
            className="absolute inset-0"
            onClick={onCancel}
          />
          <motion.div
            className="relative w-full"
            initial={{ y: 34 }}
            animate={{ y: 0 }}
            exit={{ y: 34 }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
          >
            <Material
              variant="chrome"
              className="relative w-full rounded-t-[28px] px-5 pb-5 pt-3"
              style={{
                boxShadow: '0 -24px 64px rgba(0,0,0,0.28)',
                borderTop: '0.5px solid rgba(255,255,255,0.42)',
              }}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/16" />
              <h2
                className="text-center text-[20px] font-semibold"
                style={{ color: 'var(--color-label)' }}
              >
                保存这段经历
              </h2>
              <p
                className="mx-auto mt-1 max-w-[260px] text-center text-[12px] leading-5"
                style={{ color: 'var(--color-secondaryLabel)' }}
              >
                离开后写入一条总结记忆，同时保存为只读在场记录。
              </p>

              <div className="mt-4 space-y-2">
                {loading && (
                  <div
                    className="flex items-center justify-center gap-2 rounded-[18px] px-4 py-4 text-center text-[14px]"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.58)',
                      color: 'var(--color-secondaryLabel)',
                      border: '0.5px solid rgba(60,60,67,0.1)',
                    }}
                    data-testid="presence-summary-loading"
                  >
                    <LoaderCircle
                      className="animate-spin"
                      size={17}
                      strokeWidth={1.9}
                      data-testid="presence-summary-loading-icon"
                    />
                    <span>正在生成在场记录…</span>
                  </div>
                )}

                {summary ? (
                  <>
                    <SummaryRow label="场景" value={summary.scene} />
                    <SummaryRow label="发生了什么" value={summary.whatHappened} />
                    <SummaryRow label="情绪变化" value={summary.emotionalShift} />
                  </>
                ) : (
                  !loading && (
                    <div
                      className="rounded-[18px] px-4 py-4 text-[14px] leading-6"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.58)',
                        color: 'var(--color-secondaryLabel)',
                        border: '0.5px solid rgba(60,60,67,0.1)',
                      }}
                    >
                      本次内容较短，未生成总结。仍可保存为只读在场记录。
                    </div>
                  )
                )}

                {error && (
                  <div className="flex items-center justify-between rounded-[18px] bg-red-500/10 px-3 py-2 text-[13px] text-red-600">
                    <span className="min-w-0 flex-1 pr-3">{error}</span>
                    <button
                      type="button"
                      onClick={onRetry}
                      className="flex shrink-0 items-center gap-1 font-semibold"
                    >
                      <RotateCcw size={14} />
                      重试
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-5 flex gap-2">
                <motion.button
                  type="button"
                  onClick={onDiscard}
                  className="h-[50px] flex-1 rounded-[16px] text-[16px] font-semibold"
                  style={{
                    backgroundColor: 'rgba(118,118,128,0.12)',
                    color: 'var(--color-secondaryLabel)',
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  丢弃
                </motion.button>
                <motion.button
                  type="button"
                  onClick={onSave}
                  className="h-[50px] flex-[1.4] rounded-[16px] text-[16px] font-semibold text-white"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(0,122,255,1), rgba(0,98,220,1))',
                    boxShadow: '0 12px 28px rgba(0,122,255,0.24)',
                  }}
                  disabled={loading}
                  data-testid="presence-save-and-leave"
                  whileTap={{ scale: 0.98 }}
                >
                  保存并离开
                </motion.button>
              </div>
            </Material>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
