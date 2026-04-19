import React, { useEffect, useMemo, useState } from 'react';
import {
  chatWithCharacter,
  getCharacters,
  registerTools,
  registerReplyRenderer,
  registerAppSystemPrompt,
  injectSystemEvent,
  AIUnavailableError,
  type CharacterInfo,
  type ChatSession,
  type ChatReply,
  type ReplyRenderContext,
} from '@hiphone/ai';
import { Gavel } from 'lucide-react';

const APP_ID = 'ai-auction';

// ── App-local store for auction state ─────────────────────────────
// NOTE: the sandbox moduleMap does not expose `zustand`, so we roll a
// minimal subscription-based store using a module-level object + a
// listener set. `useAuctionState` subscribes by forcing a re-render on
// every store mutation — semantically equivalent to a Zustand selector
// over the whole state for this tiny fixture.
interface AuctionItem { id: string; name: string; startPrice: number }
interface AuctionState {
  items: AuctionItem[];
  activeItemId: string | null;
  highBid: { bidder: string; amount: number } | null;
  announcements: string[];
}

let state: AuctionState = {
  items: [
    { id: 'lot-1', name: '翡翠龙佩', startPrice: 500 },
    { id: 'lot-2', name: '青花瓷瓶', startPrice: 800 },
    { id: 'lot-3', name: '宋代古琴', startPrice: 1200 },
  ],
  activeItemId: null,
  highBid: null,
  announcements: [],
};
const listeners = new Set<() => void>();

function setStoreState(
  patch: Partial<AuctionState> | ((s: AuctionState) => Partial<AuctionState>),
): void {
  const delta = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...delta };
  listeners.forEach((l) => l());
}

function useAuctionState(): AuctionState {
  const [, force] = useState({});
  useEffect(() => {
    const l = () => force({});
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}

// Action helpers that would have lived in the Zustand store:
function setActive(id: string | null): void {
  setStoreState({ activeItemId: id, highBid: null });
}
function acceptBid(p: { bidder: string; amount: number }): void {
  setStoreState({ highBid: { bidder: p.bidder, amount: p.amount } });
}
function hammerDown(p: { item: string; winner: string; final: number }): void {
  setStoreState((s) => ({
    announcements: [
      ...s.announcements,
      `${p.item} 落槌 → ${p.winner} @ ${p.final}`,
    ],
    activeItemId: null,
    highBid: null,
  }));
}
function pushAnnouncement(t: string): void {
  setStoreState((s) => ({ announcements: [...s.announcements, t] }));
}

// ── Register AI surface at module top level ───────────────────────
registerTools(APP_ID, [
  {
    name: 'bid_call',
    description: '宣布叫价。item 是拍品名，min 是起拍价。',
    parameters: { item: 'string', min: 'number' },
  },
  {
    name: 'accept_bid',
    description: '接受一位买家的出价。bidder 是买家名字/ID，amount 是出价金额。',
    parameters: { bidder: 'string', amount: 'number' },
  },
  {
    name: 'hammer_down',
    description: '落槌成交。item 是拍品，winner 是赢家，final 是成交价。',
    parameters: { item: 'string', winner: 'string', final: 'number' },
  },
]);

registerReplyRenderer(APP_ID, {
  render(raw: string, ctx: ReplyRenderContext): string {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return `${ctx.speakerName}: ${raw}`;
      return parsed
        .map((item) => {
          if (!item || typeof item !== 'object') return '';
          const it = item as Record<string, unknown>;
          if (it.type === 'text' && typeof it.content === 'string') {
            return `${ctx.speakerName}: ${it.content}`;
          }
          if (
            it.type === 'action' &&
            typeof it.name === 'string' &&
            it.params &&
            typeof it.params === 'object'
          ) {
            const ps = Object.entries(it.params as Record<string, unknown>)
              .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
              .join(' ');
            return `${ctx.speakerName}: 【${it.name}】${ps}`;
          }
          return '';
        })
        .filter((s) => s.length > 0)
        .join('\n');
    } catch {
      return `${ctx.speakerName}: ${raw}`;
    }
  },
});

registerAppSystemPrompt(APP_ID, () => {
  const items = state.items;
  if (items.length === 0) return '你是一场拍卖会主持人。暂无拍品。';
  return (
    '你是一场拍卖会主持人。按顺序唱报每一件拍品。\n拍品清单：\n' +
    items.map((i) => `#${i.id} ${i.name}（起拍价 ${i.startPrice}）`).join('\n') +
    '\n规则：每次加价至少 10%；若出价三次无人应答则 hammer_down 落槌。'
  );
});

// ── UI ────────────────────────────────────────────────────────────
export default function AuctionApp() {
  const characters: CharacterInfo[] = useMemo(() => getCharacters(), []);
  const [charId, setCharId] = useState(characters[0]?.id ?? '');
  const [session, setSession] = useState<ChatSession | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const auction = useAuctionState();
  const { items, activeItemId: active, highBid, announcements } = auction;

  const start = () => {
    if (!charId) return;
    try {
      setSession(chatWithCharacter(charId, { persistent: true }));
      setLog([]);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const dispatchActions = (reply: ChatReply) => {
    for (const a of reply.actions) {
      if (a.name === 'bid_call') {
        const item = String(a.params.item ?? '');
        setActive(item);
        setLog((l) => [...l, `🔨 叫价 ${item}`]);
      } else if (a.name === 'accept_bid') {
        acceptBid({
          bidder: String(a.params.bidder ?? ''),
          amount: Number(a.params.amount ?? 0),
        });
        setLog((l) => [
          ...l,
          `✅ 接受出价：${a.params.bidder} @ ${a.params.amount}`,
        ]);
      } else if (a.name === 'hammer_down') {
        hammerDown({
          item: String(a.params.item ?? ''),
          winner: String(a.params.winner ?? ''),
          final: Number(a.params.final ?? 0),
        });
        setLog((l) => [
          ...l,
          `🏆 落槌：${a.params.item} → ${a.params.winner} @ ${a.params.final}`,
        ]);
      }
    }
    if (reply.text) setLog((l) => [...l, `🗣️ ${reply.text}`]);
  };

  const sendBid = async (amount: number) => {
    if (!session || !active) return;
    setBusy(true);
    try {
      const reply = await session.send(`我出 ${amount} 两`);
      dispatchActions(reply);
    } catch (e) {
      setLog((l) => [
        ...l,
        e instanceof AIUnavailableError
          ? 'AI 未配置 · 去 设置 → AI 服务'
          : e instanceof Error
          ? e.message
          : String(e),
      ]);
    } finally {
      setBusy(false);
    }
  };

  const forceNoBid = async () => {
    if (!session || !active || !charId) return;
    injectSystemEvent(charId, `[拍卖] 拍品 ${active} 无人应价`);
    pushAnnouncement(`拍品 ${active} 无人应价 — 等待主持人响应`);
    setBusy(true);
    try {
      const reply = await session.replyToLast();
      dispatchActions(reply);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-amber-50">
      <header className="bg-white px-5 pt-5 pb-4 border-b border-gray-200 flex items-center gap-3">
        <Gavel size={28} strokeWidth={1.8} color="#F97316" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI 拍卖会</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tool Registry demo</p>
        </div>
      </header>

      {!session && (
        <div className="p-4">
          <label className="block text-sm text-gray-600 mb-2">主持人</label>
          <select
            value={charId}
            onChange={(e) => setCharId(e.target.value)}
            className="w-full border rounded px-2 py-1 mb-3"
          >
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button onClick={start} className="w-full bg-orange-500 text-white rounded py-2">
            开拍
          </button>
        </div>
      )}

      {session && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4">
            <h2 className="font-semibold mb-2">拍品</h2>
            <div className="grid grid-cols-3 gap-2">
              {items.map((i) => (
                <button
                  key={i.id}
                  onClick={() => setActive(i.id)}
                  className={`border rounded p-2 text-sm ${active === i.id ? 'bg-orange-100 border-orange-400' : 'bg-white'}`}
                >
                  <div className="font-medium">{i.name}</div>
                  <div className="text-xs text-gray-500">起 {i.startPrice}</div>
                </button>
              ))}
            </div>
          </div>
          {active && (
            <div className="px-4 pb-3">
              <div className="text-sm text-gray-600 mb-2">
                当前拍品：<b>{active}</b>
                {highBid && <span className="ml-2 text-orange-700">最高出价 {highBid.amount} / {highBid.bidder}</span>}
              </div>
              <div className="flex gap-2">
                {[100, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => sendBid((highBid?.amount ?? 0) + amt)}
                    disabled={busy}
                    className="flex-1 bg-orange-500 text-white rounded py-2 text-sm"
                  >
                    +{amt}
                  </button>
                ))}
                <button onClick={forceNoBid} disabled={busy} className="bg-gray-600 text-white rounded px-3 text-sm">
                  无人应
                </button>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-auto px-4 pb-4 text-sm font-mono">
            {log.map((l, i) => (
              <div key={i} className="py-1">{l}</div>
            ))}
            {announcements.length > 0 && (
              <div className="mt-3 border-t pt-2 text-orange-700">
                {announcements.map((a, i) => (
                  <div key={i}>📢 {a}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
