import { useEffect, useMemo, useRef, useState } from 'react';
import { get, set } from '@hiphone/storage';
import { chatWithCharacter, extractPlainText } from '@hiphone/ai';
import { Character } from '../constants/character';
import { Drink } from '../constants/drinks';
import { stageOf } from '../constants/drunkStates';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  drunkAt?: number;
  drinkId?: string;
}

interface BarState {
  messages: ChatMessage[];
  drunk: number;
  drinks: { drinkId: string; at: number }[];
}

interface ChatSessionLike {
  send: (text: string) => Promise<{ raw: unknown }>;
}

const EMPTY_STATE: BarState = { messages: [], drunk: 0, drinks: [] };

function storageKey(characterId: string) {
  return 'bar:char:' + characterId;
}

function isBarState(raw: unknown): raw is BarState {
  if (!raw || typeof raw !== 'object') return false;
  const v = raw as Partial<BarState>;
  return Array.isArray(v.messages) && typeof v.drunk === 'number' && Array.isArray(v.drinks);
}

function pickReplyText(reply: { raw: unknown } | unknown, fallback: string): string {
  try {
    if (reply && typeof reply === 'object' && 'raw' in (reply as object)) {
      const text = extractPlainText((reply as { raw: unknown }).raw);
      if (typeof text === 'string' && text.trim()) return text.trim();
    }
    const direct = extractPlainText(reply as never);
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
  } catch {
    // ignore and fall through
  }
  return fallback;
}

export function useBarSession(character: Character) {
  const [state, setState] = useState<BarState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState(false);
  const stateRef = useRef<BarState>(EMPTY_STATE);
  stateRef.current = state;
  const sessionRef = useRef<ChatSessionLike | null>(null);

  useEffect(() => {
    let alive = true;
    setHydrated(false);
    setState(EMPTY_STATE);
    sessionRef.current = null;

    try {
      sessionRef.current = chatWithCharacter(character.id, {
        persistent: false,
      }) as unknown as ChatSessionLike;
    } catch {
      sessionRef.current = null;
    }

    get(storageKey(character.id)).then((raw) => {
      if (!alive) return;
      if (isBarState(raw)) setState(raw);
      setHydrated(true);
    });

    return () => {
      alive = false;
    };
  }, [character.id]);

  const persist = (next: BarState) => {
    stateRef.current = next;
    setState(next);
    void set(storageKey(character.id), next);
  };

  const stage = useMemo(() => stageOf(state.drunk), [state.drunk]);

  const orderDrink = (drink: Drink) => {
    const current = stateRef.current;
    const nextDrunk = Math.min(100, current.drunk + drink.alcohol);
    persist({
      drunk: nextDrunk,
      drinks: [...current.drinks, { drinkId: drink.id, at: Date.now() }],
      messages: [
        ...current.messages,
        {
          id: 'd_' + Date.now(),
          role: 'system',
          text: '你点了一杯' + drink.name + ' ' + drink.emoji,
          drinkId: drink.id,
          drunkAt: nextDrunk,
        },
      ],
    });
  };

  const sober = () => {
    persist({ ...stateRef.current, drunk: 0 });
  };

  const reset = () => {
    persist(EMPTY_STATE);
  };

  const buildScenePrefix = (drunk: number) => {
    const s = stageOf(drunk);
    return [
      '【场景】我们正在一家昏黄灯光的小酒馆里坐着喝酒聊天。',
      '【你现在的状态】「' + s.label + '」（醉度 ' + Math.round(drunk) + ' / 100）。',
      '【表达要求】' + s.promptStyle,
      '回应限制：始终中文；控制在 1~3 句；不要描写动作和括号旁白；不要复述我说的话；可以反问我一个问题让聊天继续。',
      '——以下是我对你说的话——',
    ].join('\n');
  };

  const send = async (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed || pending) return;

    const before = stateRef.current;
    const userMsg: ChatMessage = {
      id: 'u_' + Date.now(),
      role: 'user',
      text: trimmed,
      drunkAt: before.drunk,
    };
    persist({ ...before, messages: [...before.messages, userMsg] });
    setPending(true);

    try {
      const session = sessionRef.current;
      if (!session) throw new Error('当前角色无法对话');

      const prefixed = buildScenePrefix(stateRef.current.drunk) + '\n' + trimmed;
      const reply = await session.send(prefixed);
      const text = pickReplyText(
        reply,
        '……（' + character.name + '只是举起杯子看着你，没说话）',
      );

      const assistantMsg: ChatMessage = {
        id: 'a_' + Date.now(),
        role: 'assistant',
        text,
        drunkAt: stateRef.current.drunk,
      };
      persist({ ...stateRef.current, messages: [...stateRef.current.messages, assistantMsg] });
    } catch (err) {
      const reason = err instanceof Error ? err.message : '酒吧太吵没听清';
      const assistantMsg: ChatMessage = {
        id: 'a_err_' + Date.now(),
        role: 'assistant',
        text: '（' + character.name + '没接上话：' + reason + '）',
        drunkAt: stateRef.current.drunk,
      };
      persist({ ...stateRef.current, messages: [...stateRef.current.messages, assistantMsg] });
    } finally {
      setPending(false);
    }
  };

  return {
    messages: state.messages,
    drunk: state.drunk,
    stage,
    drinkCount: state.drinks.length,
    hydrated,
    pending,
    orderDrink,
    send,
    sober,
    reset,
  };
}
