import React, { useState } from 'react';
import { Languages } from 'lucide-react';
import { complete, AIUnavailableError } from '@hiphone/ai';

export default function TranslatorApp() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const translate = async () => {
    if (!input.trim()) return;
    setBusy(true);
    setError(null);
    setOutput('');
    try {
      const reply = await complete([
        { role: 'system', content: '你是一个翻译助手。把用户输入的中文翻译成地道的英文，只输出译文。' },
        { role: 'user', content: input },
      ]);
      setOutput(reply);
    } catch (e) {
      if (e instanceof AIUnavailableError) {
        setError('AI 未配置 · 去 设置 → AI 服务 填一下');
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="translator-root"
      className="flex flex-col h-full bg-gray-50"
    >
      <header className="bg-white px-5 pt-5 pb-4 border-b border-gray-200 flex items-center gap-3">
        <Languages size={28} strokeWidth={1.8} color="#007AFF" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">AI 翻译</h1>
          <p className="text-sm text-gray-500 mt-0.5">中文 → 英文</p>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <label className="text-xs text-gray-500">输入</label>
          <textarea
            data-testid="translator-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full mt-2 p-2 border border-gray-200 rounded-lg text-base outline-none focus:border-blue-500"
            rows={4}
            placeholder="输入要翻译的中文..."
          />
          <button
            type="button"
            data-testid="translator-go"
            onClick={translate}
            disabled={busy}
            className={
              busy
                ? 'mt-3 w-full bg-gray-200 text-gray-400 rounded-lg py-2 text-sm font-medium cursor-not-allowed'
                : 'mt-3 w-full bg-blue-500 text-white rounded-lg py-2 text-sm font-medium active:bg-blue-600 hover:bg-blue-600 transition-colors'
            }
          >
            {busy ? '翻译中…' : '翻译'}
          </button>
        </div>

        {error && (
          <div
            data-testid="translator-error"
            className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600"
          >
            {error}
          </div>
        )}

        {output && (
          <div
            data-testid="translator-output"
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
          >
            <label className="text-xs text-gray-500">译文</label>
            <p className="mt-2 text-base text-gray-900 whitespace-pre-wrap">{output}</p>
          </div>
        )}
      </div>
    </div>
  );
}
