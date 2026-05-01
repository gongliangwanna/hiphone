import { BookOpenText } from 'lucide-react';
import { motion } from 'motion/react';
import type { CharacterCard } from '@/platform/stores/characterStore';
import { getPresenceBackdrop } from '../presenceScenes';
import type { PresenceRecord } from '../presenceTypes';

interface PresenceRecordListProps {
  records: PresenceRecord[];
  characters: CharacterCard[];
  onOpenRecord: (recordId: string) => void;
}

function formatRecordDate(ts: number): string {
  const date = new Date(ts);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function PresenceRecordList({
  records,
  characters,
  onOpenRecord,
}: PresenceRecordListProps) {
  if (records.length === 0) {
    return (
      <div
        className="flex h-full items-center justify-center px-8"
        data-testid="presence-records-empty"
      >
        <div
          className="rounded-[24px] px-6 py-7 text-center"
          style={{
            backgroundColor: 'rgba(255,255,255,0.68)',
            border: '0.5px solid rgba(60,60,67,0.12)',
            boxShadow: '0 16px 44px rgba(20,22,28,0.08)',
          }}
        >
          <BookOpenText
            className="mx-auto mb-3"
            size={26}
            strokeWidth={1.7}
            style={{ color: 'var(--color-systemBlue)' }}
          />
          <div
            className="text-[15px] font-semibold"
            style={{ color: 'var(--color-label)' }}
          >
            还没有在场记录
          </div>
          <div
            className="mt-1 text-[13px] leading-5"
            style={{ color: 'var(--color-secondaryLabel)' }}
          >
            完成一次场景后，会在这里保存只读记录。
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4 py-4" data-testid="presence-record-list">
      {records.map((record, index) => {
        const character = characters.find((item) => item.id === record.characterId);
        const backdrop = getPresenceBackdrop(record.backdropId);

        return (
          <motion.button
            type="button"
            key={record.id}
            onClick={() => onOpenRecord(record.id)}
            className="relative h-[128px] w-full overflow-hidden rounded-[24px] text-left"
            style={{
              border: '0.5px solid rgba(255,255,255,0.58)',
              boxShadow: '0 18px 42px rgba(20,22,28,0.16)',
            }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: Math.min(index * 0.04, 0.18),
              duration: 0.32,
              ease: [0.22, 1, 0.36, 1],
            }}
            whileTap={{ scale: 0.985 }}
            data-testid="presence-record-row"
          >
            <img
              src={backdrop.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/72 via-black/34 to-black/14" />
            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <div className="flex items-center gap-2">
                <img
                  src={character?.avatar || '/resource/avatars/preset-01.jpg'}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover"
                  style={{ boxShadow: '0 0 0 1.5px rgba(255,255,255,0.72)' }}
                />
                <span className="truncate text-[13px] font-semibold text-white/92">
                  {character?.name || '角色'}
                </span>
              </div>
              <div className="mt-2 truncate text-[19px] font-semibold">
                {record.title}
              </div>
              <div className="mt-1 text-[12px] font-medium text-white/68">
                {formatRecordDate(record.endedAt)}
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
