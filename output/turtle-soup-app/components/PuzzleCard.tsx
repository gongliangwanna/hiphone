import React, { useState } from 'react';
import { AnimatePresence, motion, spring } from '@hiphone/motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Puzzle } from '../constants/types';

interface Props {
  puzzle: Puzzle;
  revealed: boolean;
  solved: boolean;
}

const DIFFICULTY: Record<Puzzle['difficulty'], { label: string; color: string }> = {
  easy:   { label: 'CASE-A · 简单', color: '#3D6840' },
  medium: { label: 'CASE-B · 中等', color: '#8B6B1F' },
  hard:   { label: 'CASE-C · 困难', color: '#B8362E' },
};

export function PuzzleCard({ puzzle, revealed, solved }: Props) {
  const [open, setOpen] = useState(true);
  const diff = DIFFICULTY[puzzle.difficulty];

  return (
    <div
      className="relative border border-[#1A0F0A]/35"
      style={{ background: '#EADBC0' }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-[#1A0F0A]/20" />
      <div
        className="absolute -top-2 left-6 h-3 w-12 border border-[#1A0F0A]/35"
        style={{ background: '#D8C29E' }}
      />

      <button onClick={() => setOpen((v) => !v)} className="relative flex w-full items-start gap-3 px-4 pt-5 pb-3 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em]">
            <span style={{ color: diff.color }}>{diff.label}</span>
            <span className="text-[#8C765C]">·</span>
            <span className="text-[#8C765C]">案卷 №{stableNumber(puzzle.title)}</span>
            {solved && (
              <span
                className="rounded-sm border px-1.5 py-0.5 text-[9px] font-bold"
                style={{ borderColor: '#3D6840', color: '#3D6840', background: '#E8DFC2' }}
              >
                ✓ 已结案
              </span>
            )}
          </div>
          <h2 className="mt-1.5 text-[19px] font-extrabold leading-snug tracking-tight text-[#1A0F0A]">
            {puzzle.title}
          </h2>
        </div>
        <div className="mt-1 text-[#5C4937]">
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring.smooth}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5">
              <div className="my-2 flex items-center gap-2">
                <span className="h-px flex-1 bg-[#1A0F0A]/25" />
                <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#8C765C]">案情概要 · brief</span>
                <span className="h-px flex-1 bg-[#1A0F0A]/25" />
              </div>
              <div className="whitespace-pre-wrap text-[15px] leading-[1.75] text-[#1A0F0A]">
                {puzzle.scenario}
              </div>

              <div className="mt-5 flex items-center gap-2">
                <span className="h-px flex-1 bg-[#1A0F0A]/25" />
                <span className="font-mono text-[9px] uppercase tracking-[0.3em]" style={{ color: revealed ? '#3D6840' : '#B8362E' }}>
                  {revealed ? '真相 · declassified' : '机密 · classified'}
                </span>
                <span className="h-px flex-1 bg-[#1A0F0A]/25" />
              </div>

              {revealed ? (
                <div className="mt-2.5 whitespace-pre-wrap text-[14px] leading-[1.7] text-[#1A0F0A]">
                  {puzzle.truth}
                </div>
              ) : (
                <ClassifiedBlock />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ClassifiedBlock() {
  return (
    <div className="relative mt-2.5 overflow-hidden">
      <div className="space-y-1.5 select-none">
        <div className="h-2.5 w-[88%] bg-[#1A0F0A]/85" />
        <div className="h-2.5 w-[72%] bg-[#1A0F0A]/85" />
        <div className="h-2.5 w-[80%] bg-[#1A0F0A]/85" />
        <div className="h-2.5 w-[64%] bg-[#1A0F0A]/85" />
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="rounded-sm border-[2.5px] px-3 py-1 font-mono text-[12px] font-extrabold uppercase tracking-[0.3em]"
          style={{
            color: '#B8362E',
            borderColor: '#B8362E',
            transform: 'rotate(-6deg)',
            opacity: 0.92,
          }}
        >
          机密 · classified
        </div>
      </div>
    </div>
  );
}

function stableNumber(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return ((h % 8999) + 1000).toString();
}
