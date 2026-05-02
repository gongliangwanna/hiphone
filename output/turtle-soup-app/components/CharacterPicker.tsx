import React from 'react';
import { motion } from '@hiphone/motion';
import { ChevronRight } from 'lucide-react';
import { Character, accentFor, fileNumberFor } from '../constants/character';

interface Props {
  characters: Character[];
  onPick: (character: Character) => void;
}

export function CharacterPicker({ characters, onPick }: Props) {
  return (
    <div className="min-h-full px-6 pb-12 pt-9">
      <header className="mb-8">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#5C4937]">
          <span className="inline-block h-px w-6 bg-[#1A0F0A]/40" />
          <span>Dossier · 卷宗</span>
        </div>
        <h1 className="mt-3 text-[34px] font-extrabold leading-[1.05] tracking-tight text-[#1A0F0A]">
          海龟汤馆
        </h1>
        <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#8C765C]">
          Late-Night Riddle Parlor · Est. {new Date().getFullYear()}
        </div>
        <div className="mt-5 flex items-start gap-3">
          <span className="mt-2 inline-block h-px w-8 shrink-0 bg-[#B8362E]" />
          <p className="text-[14px] leading-[1.7] text-[#1A0F0A]/85">
            请选择今晚执汤的主持人。<br />
            由 ta 出题，你以是非问句逼近真相。<br />
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#8C765C]">
              本卷不录入长期档案。
            </span>
          </p>
        </div>
      </header>

      {characters.length === 0 ? (
        <EmptyDossier />
      ) : (
        <>
          <div className="mb-3 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.24em] text-[#8C765C]">
            <span>在席名册</span>
            <span>{characters.length} 人 · {characters.length.toString().padStart(2, '0')} entries</span>
          </div>
          <div className="border-t border-b border-[#1A0F0A]/15">
            {characters.map((c, i) => (
              <DossierCard
                key={c.id}
                character={c}
                index={i}
                onPick={() => onPick(c)}
                isLast={i === characters.length - 1}
              />
            ))}
          </div>
          <div className="mt-4 flex items-center justify-end gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#8C765C]">
            <span>FILED · 海龟汤馆 档案室</span>
            <span className="inline-block h-px w-6 bg-[#1A0F0A]/40" />
          </div>
        </>
      )}
    </div>
  );
}

function DossierCard({
  character,
  index,
  onPick,
  isLast,
}: {
  character: Character;
  index: number;
  onPick: () => void;
  isLast: boolean;
}) {
  const accent = accentFor(character.id);
  const fileNo = fileNumberFor(character.id);

  return (
    <motion.button
      onClick={onPick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1], delay: index * 0.05 }}
      whileTap={{ opacity: 0.7 }}
      className={
        'group flex w-full items-stretch gap-4 py-4 text-left active:bg-[#1A0F0A]/3 ' +
        (isLast ? '' : 'border-b border-[#1A0F0A]/12 border-dashed')
      }
    >
      <div className="relative shrink-0">
        <div
          className="relative h-[76px] w-[60px] overflow-hidden border border-[#1A0F0A]/40"
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
              className="flex h-full w-full items-center justify-center text-[28px] font-bold"
              style={{ color: accent, background: '#E5D4B5' }}
            >
              {character.name.slice(0, 1)}
            </div>
          )}
          <div
            className="pointer-events-none absolute inset-0 border border-white/30"
            style={{ mixBlendMode: 'overlay' }}
          />
        </div>
        <div
          className="absolute -top-1 left-1/2 h-2 w-6 -translate-x-1/2 border border-[#1A0F0A]/35"
          style={{ background: '#D8C29E' }}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#8C765C]">
          <span>档案 №{fileNo}</span>
          <span style={{ color: accent }}>● {dossierTagFor(character.id)}</span>
        </div>
        <div className="mt-1 truncate text-[20px] font-extrabold leading-tight tracking-tight text-[#1A0F0A]">
          {character.name}
        </div>
        <div className="mt-1.5 line-clamp-2 text-[13px] leading-[1.55] text-[#1A0F0A]/72">
          {character.description?.trim() || '我来当今晚的汤主。'}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div
            className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: '#B8362E' }}
          >
            <span>请入席</span>
            <ChevronRight size={11} strokeWidth={2.5} />
          </div>
          <div className="font-mono text-[9px] tracking-[0.16em] text-[#8C765C]/70">
            №{(index + 1).toString().padStart(2, '0')}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

const TAGS = ['冷面', '深夜', '老饕', '说书', '推理', '惊魂', '秘酿'];
function dossierTagFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TAGS[h % TAGS.length];
}

function EmptyDossier() {
  return (
    <div className="border border-dashed border-[#1A0F0A]/30 px-6 py-10 text-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#8C765C]">
        Empty Dossier · 卷宗为空
      </div>
      <div className="mt-3 text-[15px] font-bold tracking-tight text-[#1A0F0A]">
        档案室空无一人
      </div>
      <div className="mt-1.5 text-[13px] leading-relaxed text-[#1A0F0A]/70">
        先去添加几位 AI 角色，
        <br />
        他们才能上桌当今晚的汤主。
      </div>
    </div>
  );
}
