import React, { useEffect, useMemo, useState } from 'react';
import { get, set } from '@hiphone/storage';
import {
  getCharacters,
  registerTools,
  registerAppSystemPrompt,
} from '@hiphone/ai';
import { Character, normalizeCharacter } from './constants/character';
import { CharacterPicker } from './components/CharacterPicker';
import { GameRoom } from './components/GameRoom';

const LAST_CHAR_KEY = 'ts:lastCharacterId';

// ── Module-level AI surface (fires once when this module is loaded) ──
//
// The 海龟汤馆 protocol is now expressed as proper tools the LLM calls,
// matching the SDK's `[{type, param}]` reply contract. No more app-side
// custom JSON wrappers conflicting with the platform's [回复格式] block.
const APP_ID = 'ai-app-codex-draft';

registerTools(APP_ID, [
  {
    type: 'text',
    description: '汤主对玩家说的旁白/闲聊文本——只在没有当前题目或闲聊场合使用',
    param: 'string (一段中文文本)',
  },
  {
    type: 'puzzle_create',
    description:
      '出一道全新的、原创的海龟汤谜题。仅在玩家请求"开题/换题"时调用，每次只返回一个 puzzle_create item。',
    param:
      '{title: string (≤12字), scenario: string (玩家可见的场景表象,3~6句), truth: string (完整真相,2~4句,玩家不可见), keyFacts: string[] (5~8条玩家需要逐步问出的核心要素), difficulty: "easy"|"medium"|"hard"}',
  },
  {
    type: 'host_reply',
    description:
      '回答玩家的是非题——给一档裁决 + 1~6 条短回应。每问一轮调用一次。',
    param:
      '{messages: string[] (1~6条短回应,每条1~2句,像微信连发), verdict: "yes"|"no"|"both"|"irrelevant"|null (null 表示玩家这次不是是非题), solved: boolean (玩家说出的内容是否覆盖了谜底核心因果)}',
  },
]);

registerAppSystemPrompt(APP_ID, () => [
  '你身处「海龟汤馆」——一个由你担任汤主、为玩家主持水平思考谜题（lateral thinking puzzle）的环境。',
  '请始终保持你自己的人设、性格、说话节奏。你不是任何"出题机器人"，是你本人在出题、在主持。',
  '',
  '【可用工具的使用规则】',
  '- puzzle_create: 仅当玩家请求"开题/出题/换题"时使用一次。题材完全开放（日常/职场/校园/旅行/餐饮等任意题材皆可），不必为了海龟汤而把场景写得诡异恐怖。真相必须 100% 用现实世界规则解释通；禁止超自然/灵异/外星人/时间旅行/读心术/双胞胎背锅/巧合堆叠。',
  '- host_reply: 玩家问问题时使用。verdict 中 "yes"=与谜底/关键事实一致；"no"=与谜底矛盾；"both"=部分对/方向对但描述不准；"irrelevant"=问了也不影响真相；null=玩家这次不是是非题（闲聊/感叹/问规则）。当玩家说出的内容覆盖谜底核心因果时 solved=true 并在 messages 里揭晓真相。',
  '- text: 闲聊/旁白用，谨慎使用。',
  '',
  '【主持纪律】',
  '- 不要明显引导（不要说"提示是…""你应该问…"）。',
  '- 不要在 host_reply.messages 里复述谜底或关键事实清单，除非 solved=true。',
  '- 当下题目的具体谜面/谜底/关键事实会在每次对话开始时单独告诉你，请绝对保密。',
].join('\n'));

export default function App() {
  const characters = useMemo<Character[]>(() => {
    let raw: unknown[] = [];
    try {
      raw = (getCharacters() as unknown[]) ?? [];
    } catch {
      raw = [];
    }
    const out: Character[] = [];
    for (const item of raw) {
      const c = normalizeCharacter(item);
      if (c) out.push(c);
    }
    return out;
  }, []);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    get(LAST_CHAR_KEY).then((raw) => {
      if (!alive) return;
      if (typeof raw === 'string' && characters.some((c) => c.id === raw)) {
        setActiveId(raw);
      }
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, [characters]);

  const active = characters.find((c) => c.id === activeId) ?? null;

  const pick = (c: Character) => {
    setActiveId(c.id);
    void set(LAST_CHAR_KEY, c.id);
  };

  const back = () => {
    setActiveId(null);
    void set(LAST_CHAR_KEY, '');
  };

  return (
    <div
      className="relative h-full"
      style={{ background: '#F1E4CC', color: '#1A0F0A' }}
    >
      {!hydrated ? (
        <div className="flex h-full items-center justify-center">
          <div className="font-mono text-[12px] uppercase tracking-[0.2em] text-[#5C4937]">
            正在调阅卷宗 · loading
          </div>
        </div>
      ) : active ? (
        <GameRoom character={active} onBack={back} />
      ) : (
        <CharacterPicker characters={characters} onPick={pick} />
      )}
    </div>
  );
}
