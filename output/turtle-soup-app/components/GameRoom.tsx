import React, { useState } from 'react';
import { ArrowLeft, Flag } from 'lucide-react';
import { motion } from '@hiphone/motion';
import { show } from '@hiphone/toast';
import { Character, accentFor, fileNumberFor } from '../constants/character';
import { useTurtleSoup } from '../hooks/useTurtleSoup';
import { PuzzleCard } from './PuzzleCard';
import { ChatMessages } from './ChatMessages';
import { AskInput } from './AskInput';

interface Props {
  character: Character;
  onBack: () => void;
}

export function GameRoom({ character, onBack }: Props) {
  const game = useTurtleSoup(character);
  const accent = accentFor(character.id);
  const fileNo = fileNumberFor(character.id);
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);

  const { state, pending, hydrated } = game;
  const hasPuzzle = !!state.puzzle;
  const inputDisabled = !hydrated || !hasPuzzle || pending !== null || state.solved || state.revealed;

  const startLabel = pending === 'generate'
    ? '调题中…'
    : hasPuzzle
    ? '换 · 一 · 题'
    : '开 · 第 · 一 · 题';

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: '#F1E4CC' }}>
      <header className="sticky top-0 z-10 border-b border-[#1A0F0A]/20" style={{ background: '#F1E4CC' }}>
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center text-[#1A0F0A] active:opacity-50"
            aria-label="返回"
          >
            <ArrowLeft size={20} strokeWidth={2.2} />
          </button>

          <div className="relative shrink-0">
            <div
              className="relative h-10 w-10 overflow-hidden border border-[#1A0F0A]/45"
              style={{ background: '#E5D4B5' }}
            >
              {character.avatar ? (
                <img
                  src={character.avatar}
                  alt={character.name}
                  className="h-full w-full object-cover"
                  style={{ filter: 'sepia(0.18) contrast(1.02)' }}
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-[14px] font-bold"
                  style={{ color: accent }}
                >
                  {character.name.slice(0, 1)}
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-extrabold leading-tight tracking-tight text-[#1A0F0A]">
              {character.name}
            </div>
            <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[#8C765C]">
              档 №{fileNo} · 执 汤 在 席
            </div>
          </div>

          {hasPuzzle && !state.revealed && !state.solved && (
            <button
              onClick={() => {
                if (confirmGiveUp) {
                  game.giveUp();
                  setConfirmGiveUp(false);
                  show('谜底已揭晓');
                } else {
                  setConfirmGiveUp(true);
                  setTimeout(() => setConfirmGiveUp(false), 2500);
                }
              }}
              className={
                'flex h-8 items-center gap-1 border px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] active:opacity-70 ' +
                (confirmGiveUp
                  ? 'border-[#B8362E] text-white'
                  : 'border-[#1A0F0A]/40 text-[#5C4937]')
              }
              style={{ background: confirmGiveUp ? '#B8362E' : 'transparent' }}
            >
              <Flag size={11} strokeWidth={2.4} />
              {confirmGiveUp ? '再确认' : '举白旗'}
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-2 pt-4">
        {hasPuzzle && state.puzzle && (
          <div className="mb-4">
            <PuzzleCard puzzle={state.puzzle} revealed={state.revealed} solved={state.solved} />
          </div>
        )}

        {!hasPuzzle && hydrated && (
          <div className="mt-12 px-2 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#8C765C]">
              awaiting case file · №—
            </div>
            <div className="mt-3 text-[18px] font-extrabold tracking-tight text-[#1A0F0A]">
              {character.name} 还未端汤上桌
            </div>
            <div className="mt-2 text-[13px] leading-relaxed text-[#1A0F0A]/70">
              点下方按钮，
              <br />
              让 ta 从案卷库里随手抽一道。
            </div>
            <div className="mx-auto mt-5 h-px w-16 bg-[#1A0F0A]/30" />
          </div>
        )}

        <ChatMessages
          character={character}
          turns={state.turns}
          pending={pending !== null}
        />

        {(state.solved || state.revealed) && hasPuzzle && (
          <div className="mt-4 border border-[#1A0F0A]/30 px-4 py-3" style={{ background: '#E8DFC2' }}>
            <div className="font-mono text-[10px] uppercase tracking-[0.24em]" style={{ color: state.solved ? '#3D6840' : '#B8362E' }}>
              {state.solved ? 'Case Closed · 已结案' : 'Surrendered · 投 · 降'}
            </div>
            <div className="mt-1.5 text-[14px] leading-relaxed text-[#1A0F0A]">
              {state.solved
                ? '推理无误，真相已浮出水面。'
                : '案卷已被翻开，谜底就在上方那张文件里。'}
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#8C765C]">
              提问数 · {state.questionCount.toString().padStart(2, '0')}
            </div>
          </div>
        )}
      </div>

      <div
        className="space-y-2.5 border-t border-[#1A0F0A]/20 px-4 pb-5 pt-3"
        style={{ background: '#F1E4CC' }}
      >
        <motion.button
          whileTap={{ scale: 0.985 }}
          onClick={() => {
            void game.startNewGame();
          }}
          disabled={pending !== null}
          className="flex w-full items-center justify-center gap-2 px-4 py-3 font-mono text-[13px] font-bold uppercase tracking-[0.22em] text-[#F1E4CC] disabled:opacity-50"
          style={{ background: '#1A0F0A' }}
        >
          <span className="text-[#B8362E]">●</span>
          <span>{startLabel}</span>
          <span className="text-[#B8362E]">●</span>
        </motion.button>

        <AskInput
          onSend={(t) => {
            void game.ask(t);
          }}
          disabled={inputDisabled}
          placeholder={
            !hasPuzzle
              ? '先开新案卷再开始问'
              : state.solved || state.revealed
              ? '本案已结，开新卷再问'
              : pending === 'reply'
              ? '等 ' + character.name + ' 落笔…'
              : '问一个是非题，比如「他活着吗？」'
          }
        />
      </div>
    </div>
  );
}
