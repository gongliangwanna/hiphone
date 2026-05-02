import { useEffect, useRef, useState } from 'react';
import { get, set } from '@hiphone/storage';
import { chatWithCharacter } from '@hiphone/ai';
import { Character } from '../constants/character';
import {
  ChatTurn,
  EMPTY_GAME,
  GameState,
  Puzzle,
  Verdict,
  isGameState,
  isPuzzle,
} from '../constants/types';

interface ReplyItemLike {
  type: string;
  param: unknown;
}

interface ChatReplyLike {
  raw: string;
  rendered: string;
  items: ReplyItemLike[];
}

interface ChatSessionLike {
  send: (
    text: string,
    opts?: { mirror?: boolean },
  ) => Promise<ChatReplyLike>;
  append?: (
    entry: { role: 'user' | 'assistant'; content: string },
    opts?: { mirror?: boolean },
  ) => void;
}

function storageKey(characterId: string) {
  return 'ts:char:' + characterId;
}

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function normalizeVerdict(v: unknown): Verdict {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') return null;
  const lower = v.toLowerCase();
  if (lower === 'yes' || lower === 'y' || lower === '是') return 'yes';
  if (lower === 'no' || lower === 'n' || lower === '否' || lower === '不是') return 'no';
  if (lower === 'both' || lower === '是也不是' || lower === 'partial') return 'both';
  if (lower === 'irrelevant' || lower === '无关' || lower === 'unrelated') return 'irrelevant';
  return null;
}

function normalizeMessages(raw: unknown, fallback: string): string[] {
  if (Array.isArray(raw)) {
    const out = raw
      .map((m) => (typeof m === 'string' ? m.trim() : ''))
      .filter((m) => m.length > 0);
    if (out.length > 0) return out.slice(0, 6);
  }
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
  if (fallback.trim()) return [fallback.trim()];
  return [];
}

function findItem(items: ReplyItemLike[], type: string): ReplyItemLike | null {
  for (const it of items) {
    if (it.type === type) return it;
  }
  return null;
}

function collectTextItems(items: ReplyItemLike[]): string[] {
  const out: string[] = [];
  for (const it of items) {
    if (it.type === 'text' && typeof it.param === 'string' && it.param.trim()) {
      out.push(it.param.trim());
    }
  }
  return out;
}

/**
 * Build the per-puzzle system suffix that's frozen into the host session at
 * creation time. Carries the truth + keyFacts + judging rules so every
 * subsequent send() only needs to ship the user's actual question.
 *
 * `appSystemPromptSuffix` is byte-stable for the session's lifetime → KV
 * cache hits across all turns of one puzzle.
 */
function buildHostSuffix(p: Puzzle): string {
  return [
    '【当前主持的题目（绝对保密，不可直接说出谜底）】',
    '谜面（玩家已看到）：' + p.scenario,
    '谜底（玩家不知道）：' + p.truth,
    '关键事实（玩家需要逐步问出）：',
    ...p.keyFacts.map((f, i) => '  ' + (i + 1) + '. ' + f),
    '',
    '回复玩家时使用 host_reply 工具：判断这一轮是否是非题、给 verdict、给 1~6 条短回应。',
    '玩家说出的内容覆盖谜底核心因果时，host_reply.solved=true 并在 messages 里揭晓真相。',
  ].join('\n');
}

/**
 * Replay persisted user/assistant turns into the host session's buffer so
 * the LLM has cross-reopen continuity. Uses mirror:false so nothing leaks
 * to long-term memory.
 *
 * Assistant turns are reconstructed in the SDK's `[{type, param}]` array
 * shape — same format the LLM used when it produced them — so the model
 * sees a coherent conversation history.
 */
function replayHistoryToSession(session: ChatSessionLike, gameState: GameState) {
  if (!session.append) return;
  for (const t of gameState.turns) {
    if (t.role === 'user' && t.text) {
      session.append({ role: 'user', content: t.text }, { mirror: false });
    } else if (t.role === 'assistant') {
      const messages = t.messages && t.messages.length > 0
        ? t.messages
        : t.text
        ? [t.text]
        : [];
      const items = [
        {
          type: 'host_reply',
          param: {
            messages,
            verdict: t.verdict ?? null,
            solved: false,
          },
        },
      ];
      session.append(
        { role: 'assistant', content: JSON.stringify(items) },
        { mirror: false },
      );
    }
  }
}

function makeHostSession(characterId: string, puzzle: Puzzle | null): ChatSessionLike | null {
  try {
    return chatWithCharacter(characterId, {
      persistent: false,
      appSystemPromptSuffix: puzzle ? buildHostSuffix(puzzle) : undefined,
    }) as unknown as ChatSessionLike;
  } catch {
    return null;
  }
}

export function useTurtleSoup(character: Character) {
  const [state, setState] = useState<GameState>(EMPTY_GAME);
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState<null | 'generate' | 'reply'>(null);
  const stateRef = useRef<GameState>(EMPTY_GAME);
  stateRef.current = state;
  const sessionRef = useRef<ChatSessionLike | null>(null);

  useEffect(() => {
    let alive = true;
    setHydrated(false);
    setState(EMPTY_GAME);
    sessionRef.current = null;

    get(storageKey(character.id)).then((raw) => {
      if (!alive) return;
      if (isGameState(raw)) {
        setState(raw);
        const sess = makeHostSession(character.id, raw.puzzle);
        sessionRef.current = sess;
        if (sess) replayHistoryToSession(sess, raw);
      } else {
        sessionRef.current = makeHostSession(character.id, null);
      }
      setHydrated(true);
    });

    return () => {
      alive = false;
    };
  }, [character.id]);

  const persist = (next: GameState) => {
    stateRef.current = next;
    setState(next);
    void set(storageKey(character.id), next);
  };

  const startNewGame = async () => {
    if (pending) return;
    setPending('generate');

    persist({
      puzzle: null,
      turns: [
        {
          id: 's_' + Date.now(),
          role: 'system',
          text: '正在出新题…',
          createdAt: Date.now(),
        },
      ],
      solved: false,
      revealed: false,
      questionCount: 0,
    });

    try {
      // EPHEMERAL session for puzzle generation — inherits the character's
      // persona + memory snapshot so the题 reflects this汤主's voice. No
      // suffix; the static appSystemPrompt + registered `puzzle_create`
      // tool are enough for the LLM.
      const genSession = chatWithCharacter(character.id, {
        persistent: false,
      }) as unknown as ChatSessionLike;

      const reply = await genSession.send(
        '请出一道全新的、原创的海龟汤谜题。用 puzzle_create 工具返回。',
        { mirror: false },
      );

      const item = findItem(reply.items, 'puzzle_create');
      if (!item) {
        throw new Error('汤主没出题，再点一次试试');
      }
      const param = asObject(item.param);
      if (!param || !isPuzzle(param)) {
        throw new Error('题目格式错误，再点一次试试');
      }
      const puzzle: Puzzle = {
        title: param.title.slice(0, 24),
        scenario: param.scenario.trim(),
        truth: param.truth.trim(),
        keyFacts: param.keyFacts
          .map((s) => (typeof s === 'string' ? s.trim() : ''))
          .filter(Boolean)
          .slice(0, 8),
        difficulty:
          param.difficulty === 'easy' || param.difficulty === 'hard'
            ? param.difficulty
            : 'medium',
        createdAt: Date.now(),
      };

      // Recreate host session WITH the new puzzle as suffix (frozen for KV
      // cache stability across all subsequent ask turns).
      sessionRef.current = makeHostSession(character.id, puzzle);

      persist({
        puzzle,
        turns: [
          {
            id: 'sys_open_' + Date.now(),
            role: 'system',
            text: '【新题已出】' + puzzle.title,
            createdAt: Date.now(),
          },
          {
            id: 'a_open_' + Date.now(),
            role: 'assistant',
            messages: [
              '题目准备好了，看上面那张卡片。',
              '我只回答 是 / 不是 / 是也不是。开始问吧。',
            ],
            verdict: null,
            createdAt: Date.now() + 1,
          },
        ],
        solved: false,
        revealed: false,
        questionCount: 0,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '出题失败';
      persist({
        ...stateRef.current,
        turns: [
          ...stateRef.current.turns,
          {
            id: 'err_' + Date.now(),
            role: 'system',
            text: '出题失败：' + msg,
            createdAt: Date.now(),
          },
        ],
      });
    } finally {
      setPending(null);
    }
  };

  const ask = async (userText: string) => {
    const trimmed = userText.trim();
    const current = stateRef.current;
    if (!trimmed || pending || !current.puzzle || current.solved) return;

    const userTurn: ChatTurn = {
      id: 'u_' + Date.now(),
      role: 'user',
      text: trimmed,
      createdAt: Date.now(),
    };
    const nextQCount = current.questionCount + 1;
    persist({ ...current, turns: [...current.turns, userTurn], questionCount: nextQCount });
    setPending('reply');

    try {
      const session = sessionRef.current;
      if (!session) throw new Error('无法连接到角色');

      // Clean user message — puzzle context lives in appSystemPromptSuffix
      // (frozen at session creation), so each turn only ships the question.
      const reply = await session.send(trimmed, { mirror: false });

      // Prefer host_reply tool item; fall back to text items if present.
      let messages: string[] = [];
      let verdict: Verdict = null;
      let solved = false;

      const hostItem = findItem(reply.items, 'host_reply');
      if (hostItem) {
        const p = asObject(hostItem.param);
        if (p) {
          messages = normalizeMessages(p.messages, '');
          verdict = normalizeVerdict(p.verdict);
          solved = p.solved === true;
        }
      }

      if (messages.length === 0) {
        // Graceful degradation — LLM might have replied with text item(s)
        // instead of host_reply (e.g., a chit-chat turn).
        const texts = collectTextItems(reply.items);
        messages = texts.length > 0 ? texts : ['……（没听清）'];
      }

      const aiTurn: ChatTurn = {
        id: 'a_' + Date.now(),
        role: 'assistant',
        messages,
        verdict,
        createdAt: Date.now(),
      };

      persist({
        ...stateRef.current,
        turns: [...stateRef.current.turns, aiTurn],
        solved: stateRef.current.solved || solved,
        revealed: stateRef.current.revealed || solved,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '通讯失败';
      persist({
        ...stateRef.current,
        turns: [
          ...stateRef.current.turns,
          {
            id: 'err_' + Date.now(),
            role: 'system',
            text: '出错：' + msg,
            createdAt: Date.now(),
          },
        ],
      });
    } finally {
      setPending(null);
    }
  };

  const giveUp = () => {
    const current = stateRef.current;
    if (!current.puzzle || current.revealed) return;
    persist({
      ...current,
      revealed: true,
      turns: [
        ...current.turns,
        {
          id: 'sys_giveup_' + Date.now(),
          role: 'system',
          text: '你按下了"我投降"，谜底已揭晓。',
          createdAt: Date.now(),
        },
      ],
    });
  };

  const resetAll = () => {
    persist(EMPTY_GAME);
  };

  return {
    state,
    hydrated,
    pending,
    startNewGame,
    ask,
    giveUp,
    resetAll,
  };
}
