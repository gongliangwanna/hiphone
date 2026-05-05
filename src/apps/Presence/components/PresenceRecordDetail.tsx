import { RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import type { CharacterCard } from '@/platform/stores/characterStore';
import { FragmentStream } from './FragmentStream';
import { SceneHero } from './SceneHero';
import type { PresenceRecord } from '../presenceTypes';

interface PresenceRecordDetailProps {
  record: PresenceRecord;
  character: CharacterCard | undefined;
  onReenter: () => void;
}

function SummaryBlock({ label, value }: { label: string; value: string }) {
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

export function PresenceRecordDetail({
  record,
  character,
  onReenter,
}: PresenceRecordDetailProps) {
  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-testid="presence-record-detail"
      style={{
        background:
          'linear-gradient(180deg, rgba(238,241,246,1), rgba(248,248,250,1))',
      }}
    >
      <div className="shrink-0">
        <SceneHero
          character={character}
          sceneText={record.sceneText}
          backdropId={record.backdropId}
          compact
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <motion.div
          className="flex items-center justify-between px-4 pt-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            <div
              className="text-[18px] font-semibold"
              style={{ color: 'var(--color-label)' }}
            >
              {record.title}
            </div>
            <div
              className="mt-1 text-[12px]"
              style={{ color: 'var(--color-secondaryLabel)' }}
            >
              只读记录
            </div>
          </div>
          <span
            className="rounded-full px-3 py-1 text-[12px] font-semibold"
            style={{
              backgroundColor: 'rgba(52,199,89,0.14)',
              color: 'var(--color-systemGreen)',
            }}
          >
            只读
          </span>
        </motion.div>

        <FragmentStream
          turns={record.turns}
          emptyText="这条记录没有互动片段。"
          characterName={character?.name}
        />

        <motion.div
          className="space-y-2 px-4 pb-4"
          data-testid="presence-record-summary"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {record.summary ? (
            <>
              <SummaryBlock label="场景" value={record.summary.scene} />
              <SummaryBlock label="发生了什么" value={record.summary.whatHappened} />
              <SummaryBlock label="情绪变化" value={record.summary.emotionalShift} />
            </>
          ) : (
            <SummaryBlock label="总结" value="本次内容较短，未生成总结。" />
          )}
        </motion.div>
      </div>

      <div
        className="shrink-0 border-t px-4 py-3"
        style={{
          borderColor: 'rgba(60,60,67,0.12)',
          backgroundColor: 'rgba(248,248,250,0.92)',
        }}
      >
        <motion.button
          type="button"
          onClick={onReenter}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-[16px] text-[15px] font-semibold"
          style={{
            backgroundColor: 'rgba(255,255,255,0.72)',
            border: '0.5px solid rgba(0,122,255,0.26)',
            color: 'var(--color-systemBlue)',
          }}
          whileTap={{ scale: 0.98 }}
          data-testid="presence-reenter-similar"
        >
          <RotateCcw size={17} strokeWidth={1.9} />
          再次进入类似场景
        </motion.button>
      </div>
    </div>
  );
}
