import React, { useState, useMemo } from 'react';
import { MessageCircle } from 'lucide-react';
import {
  chatWithCharacter,
  getCharacters,
  extractPlainText,
  AIUnavailableError,
  type ChatSession,
  type CharacterInfo,
} from '@hiphone/ai';

type Msg = { role: 'user' | 'assistant'; text: string };

export default function AIChatApp() {
  const characters: CharacterInfo[] = useMemo(() => getCharacters(), []);
  const [charId, setCharId] = useState(characters[0]?.id ?? '');
  const [persistent, setPersistent] = useState(false);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const start = () => {
    if (!charId) return;
    try {
      const s = chatWithCharacter(charId, { persistent });
      setSession(s);
      setMsgs([]);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const sendOne = async () => {
    if (!session || !input.trim()) return;
    const text = input;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text }]);
    setBusy(true);
    try {
      const raw = await session.send(text);
      const plain = extractPlainText(raw) || raw;
      setMsgs((m) => [...m, { role: 'assistant', text: plain }]);
    } catch (e) {
      const msg = e instanceof AIUnavailableError
        ? 'AI 未配置 · 去 设置 → AI 服务'
        : e instanceof Error ? e.message : String(e);
      setMsgs((m) => [...m, { role: 'assistant', text: `⚠️ ${msg}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="aichat-root" className="flex flex-col h-full bg-gray-50">
      <header className="bg-white px-5 pt-5 pb-4 border-b border-gray-200 flex items-center gap-3">
        <MessageCircle size={28} strokeWidth={1.8} color="#34C759" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI 陪聊</h1>
          <p className="text-sm text-gray-500 mt-0.5">session-based demo</p>
        </div>
      </header>

      {!session && (
        <div className="p-4 flex flex-col gap-3">
          {characters.length === 0 ? (
            <div className="bg-white rounded-2xl p-4 border border-gray-100 text-sm text-gray-500">
              还没有配置角色 · 去 星语 添加一个
            </div>
          ) : (
            <>
              <label className="text-sm text-gray-700">选择角色</label>
              <select
                data-testid="aichat-select"
                value={charId}
                onChange={(e) => setCharId(e.target.value)}
                className="p-2 border border-gray-200 rounded-lg text-base bg-white"
              >
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-700 bg-white rounded-lg p-3 border border-gray-100">
                <input
                  type="checkbox"
                  data-testid="aichat-persistent"
                  checked={persistent}
                  onChange={(e) => setPersistent(e.target.checked)}
                />
                persistent — 写入角色记忆（和 XingYu 共享）
              </label>
              <button
                type="button"
                data-testid="aichat-start"
                onClick={start}
                className="mt-2 bg-blue-500 text-white rounded-lg py-2 text-sm font-medium active:bg-blue-600"
              >
                开始
              </button>
            </>
          )}
        </div>
      )}

      {session && (
        <>
          <div className="flex-1 overflow-auto p-4 flex flex-col gap-2">
            {msgs.map((m, i) => (
              <div
                key={i}
                data-testid={`aichat-msg-${m.role}`}
                className={
                  m.role === 'user'
                    ? 'self-end bg-blue-500 text-white rounded-2xl px-3 py-2 max-w-[80%] text-sm whitespace-pre-wrap'
                    : 'self-start bg-white rounded-2xl px-3 py-2 max-w-[80%] text-sm border border-gray-200 whitespace-pre-wrap'
                }
              >
                {m.text}
              </div>
            ))}
            {busy && (
              <div className="self-start text-xs text-gray-400">对方正在输入…</div>
            )}
          </div>
          <div className="p-4 bg-white border-t border-gray-200 flex gap-2">
            <input
              data-testid="aichat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 p-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500"
              placeholder="说点什么..."
              onKeyDown={(e) => { if (e.key === 'Enter' && !busy) void sendOne(); }}
            />
            <button
              type="button"
              data-testid="aichat-send"
              onClick={sendOne}
              disabled={busy}
              className={
                busy
                  ? 'bg-gray-200 text-gray-400 rounded-lg px-4 py-2 text-sm font-medium cursor-not-allowed'
                  : 'bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium active:bg-blue-600'
              }
            >
              发送
            </button>
          </div>
        </>
      )}
    </div>
  );
}
