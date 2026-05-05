import React, { useState } from 'react';
import { ArrowLeft, Coffee, Trash2 } from 'lucide-react';
import { motion } from '@hiphone/motion';
import { show } from '@hiphone/toast';
import { Character, accentFor } from '../constants/character';
import { useBarSession } from '../hooks/useBarSession';
import { DrunkMeter } from './DrunkMeter';
import { ChatMessages } from './ChatMessages';
import { DrinkMenu } from './DrinkMenu';
import { MessageInput } from './MessageInput';

interface Props {
  character: Character;
  onBack: () => void;
}

export function BarRoom({ character, onBack }: Props) {
  const session = useBarSession(character);
  const [confirmReset, setConfirmReset] = useState(false);
  const accent = accentFor(character.id);

  const tilt = session.stage.tilt;
  const blur = session.stage.blur;

  return (
    <div className="flex h-full flex-col bg-[var(--color-systemBackground)]">
      <header className="flex items-center gap-2 border-b border-[var(--color-separator)] px-3 py-2">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-systemBlue)] active:opacity-60"
          aria-label="返回"
        >
          <ArrowLeft size={20} />
        </button>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white"
          style={{ background: accent }}
        >
          {character.avatar ? (
            <img src={character.avatar} alt={character.name} className="h-full w-full object-cover" />
          ) : (
            character.name.slice(0, 1)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-[var(--color-label)]">
            {character.name}
          </div>
          <div className="truncate text-xs text-[var(--color-secondaryLabel)]">
            今晚不会写进 ta 的记忆
          </div>
        </div>
        <button
          onClick={() => {
            session.sober();
            show('解了酒，神志清醒');
          }}
          className="flex h-9 items-center gap-1 rounded-full bg-[var(--color-secondarySystemBackground)] px-3 text-xs text-[var(--color-label)] active:opacity-60"
          title="醒酒"
        >
          <Coffee size={14} />
          醒酒
        </button>
        <button
          onClick={() => {
            if (confirmReset) {
              session.reset();
              setConfirmReset(false);
              show('已离席并清空');
            } else {
              setConfirmReset(true);
              setTimeout(() => setConfirmReset(false), 2500);
            }
          }}
          className={
            'flex h-9 items-center gap-1 rounded-full px-3 text-xs active:opacity-60 ' +
            (confirmReset
              ? 'bg-[#A23E48] text-white'
              : 'bg-[var(--color-secondarySystemBackground)] text-[var(--color-secondaryLabel)]')
          }
          title="清空"
        >
          <Trash2 size={14} />
          {confirmReset ? '再点一次' : '清空'}
        </button>
      </header>

      <div className="px-4 pt-3">
        <DrunkMeter
          drunk={session.drunk}
          stage={session.stage}
          drinkCount={session.drinkCount}
          accent={accent}
        />
      </div>

      <motion.div
        animate={{ rotate: tilt, filter: blur > 0 ? 'blur(' + blur + 'px)' : 'none' }}
        transition={{ type: 'spring', stiffness: 80, damping: 14 }}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        <ChatMessages
          character={character}
          messages={session.messages}
          pending={session.pending}
        />
      </motion.div>

      <div className="space-y-2 border-t border-[var(--color-separator)] bg-[var(--color-systemBackground)] px-4 pb-5 pt-3">
        <DrinkMenu
          onOrder={(d) => {
            session.orderDrink(d);
            show('上了一杯' + d.name + ' ' + d.emoji);
          }}
          disabled={!session.hydrated}
        />
        <MessageInput
          onSend={session.send}
          disabled={!session.hydrated || session.pending}
          placeholder={
            session.drunk >= 60
              ? '舌头都打结了，想说啥…'
              : session.drunk >= 20
              ? '今晚想聊点什么？'
              : '随便说点什么开个场'
          }
        />
      </div>
    </div>
  );
}
