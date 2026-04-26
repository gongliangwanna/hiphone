# 翻译 App S3 — 核心翻译流（LangBar / SourcePanel / TargetPanel / useTranslate）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 替换 S2 的 placeholder TSX，让翻译 App 能完成一次端到端翻译：默认中→英、用户输入文本、点击翻译按钮、AI 返回结果显示、可复制。LangSheet（S4）和历史/收藏（S5）暂不接，LangBar 上的语种按钮 S3 内为静态展示（默认中/英 + 工作中的交换按钮）。

**Architecture:** 翻译 App 的源码已在 `builtinUserApps.ts` 内以 TSX 字符串形式存在。S3 把单个占位文件扩展成多文件 map：`TranslateApp.tsx`（入口 + 状态机）、`panels/SourcePanel.tsx`、`panels/TargetPanel.tsx`、`selectors/LangBar.tsx`、`hooks/useTranslate.ts`、`constants/languages.ts`。所有这些代码物理上居于 `src/apps/translate/`（IDE 高亮 / 类型检查友好），通过 Vite 的 `?raw` import 把字符串拉进 `builtinUserApps.ts` 的 `files` map（同一份源既能编译进 host 测试又能塞进沙箱 — 不需要双份维护）。

**Tech Stack:** TypeScript / React / Tailwind / motion/react / Vite raw imports / Vitest

**Spec 来源：** `docs/superpowers/specs/2026-04-26-translate-app-design.md` §3.3, §3.5, §3.7（动效中"翻译"+"复制"两条），§3.8（错误处理）

**前置依赖：** S2 已完成（builtin 注册管道就绪）

---

## 关键决策

1. **源码物理位置：`src/apps/translate/`**。理由：放在沙箱字符串里的 TSX 享受不到 IDE / TS / ESLint，开发体验差。改成 host 文件 + Vite `?raw` 导入字符串，host 单元测试和沙箱编译共用同一份源。`installer.ts` 已用相同模式（multi-file `files` map）。
2. **`?raw` 是 Vite 内置 query**，构建时把文件原文当字符串注入。Vitest 默认支持。无需新增 plugin。
3. **AbortController 通过 `streamComplete`（已有 signal 参数）实现取消**。`complete()` 没有 signal 参数，但 `streamComplete` 有，且当前实现等价于一次性返回 — 这是文档承诺的稳定行为。S3 直接用 `streamComplete` 收一次输出。
4. **S3 不接 LangSheet**：LangBar 的源/目标语种按钮**仅展示**默认值（中/英），点击不弹 sheet。交换按钮**工作**（互换源/目标 + 互换文本）。语种状态用 `useState` 持有，等 S4 接 sheet。
5. **复制走 `navigator.clipboard.writeText`**（沙箱未遮蔽 navigator）。失败用 `toast.error`。
6. **错误处理走 `@hiphone/toast`**：`AIUnavailableError` → "请先在设置里配置 AI"，其它错误 → `err.message`，`AIAbortedError` 静默。

---

### Task 1: 建立 `src/apps/translate/` 目录骨架 + 语种常量

**Files:**
- Create: `src/apps/translate/constants/languages.ts`
- Create: `src/apps/translate/CLAUDE.md`

- [ ] **Step 1: 写 `constants/languages.ts`**

```ts
/**
 * Curated language list for the translate app.
 *
 * `code` is loosely ISO 639-1 (with two-letter exceptions like 'zh' for
 * Mandarin). It's only used as an opaque identifier for storage dedup keys
 * and to pick a label — the AI prompt sends the human-readable `name`,
 * not the code.
 *
 * `auto` is a sentinel: when `sourceLang.code === 'auto'`, the prompt
 * appends a "detect source" instruction.
 */

export interface Language {
  /** Stable identifier; ISO 639-1 where it exists, otherwise hand-picked. */
  code: string;
  /** Display string shown in UI AND injected into the AI prompt. */
  name: string;
  /** Native form, used in the language picker UI. */
  native: string;
}

export const AUTO_LANG: Language = {
  code: 'auto',
  name: '自动检测',
  native: '自动检测',
};

export const CURATED_LANGUAGES: readonly Language[] = [
  { code: 'zh', name: '中文', native: '中文' },
  { code: 'en', name: '英语', native: 'English' },
  { code: 'ja', name: '日语', native: '日本語' },
  { code: 'ko', name: '韩语', native: '한국어' },
  { code: 'fr', name: '法语', native: 'Français' },
  { code: 'es', name: '西班牙语', native: 'Español' },
  { code: 'de', name: '德语', native: 'Deutsch' },
  { code: 'it', name: '意大利语', native: 'Italiano' },
  { code: 'ru', name: '俄语', native: 'Русский' },
  { code: 'ar', name: '阿拉伯语', native: 'العربية' },
] as const;

export const DEFAULT_SOURCE_LANG: Language = AUTO_LANG;
export const DEFAULT_TARGET_LANG: Language = CURATED_LANGUAGES[1]!; // 英语
```

- [ ] **Step 2: 单测 `constants/languages.test.ts`**

Create `src/apps/translate/constants/__tests__/languages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CURATED_LANGUAGES,
  AUTO_LANG,
  DEFAULT_SOURCE_LANG,
  DEFAULT_TARGET_LANG,
} from '../languages';

describe('CURATED_LANGUAGES', () => {
  it('has exactly 10 entries (spec 2.3)', () => {
    expect(CURATED_LANGUAGES).toHaveLength(10);
  });

  it('every entry has code, name, native', () => {
    for (const lang of CURATED_LANGUAGES) {
      expect(lang.code).toBeTruthy();
      expect(lang.name).toBeTruthy();
      expect(lang.native).toBeTruthy();
    }
  });

  it('codes are unique', () => {
    const codes = CURATED_LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('does NOT collide with the auto sentinel', () => {
    expect(CURATED_LANGUAGES.find((l) => l.code === AUTO_LANG.code)).toBeUndefined();
  });

  it('default source is auto, default target is 英语', () => {
    expect(DEFAULT_SOURCE_LANG.code).toBe('auto');
    expect(DEFAULT_TARGET_LANG.code).toBe('en');
  });
});
```

- [ ] **Step 3: 写 `src/apps/translate/CLAUDE.md`**

```markdown
# src/apps/translate/

翻译 App 的源码物理位置。每个 .tsx / .ts 文件被 `builtinUserApps.ts`
通过 Vite `?raw` import 拉成字符串塞进沙箱编译。同一份代码同时被
host vitest 直接当 module 引（用于 hook / pure-logic 单测）。

## 双重身份的代价
- 不能 `import` host 的内部模块（`@/system` / `@/platform` 都不行），
  只能 import 公开 SDK：`@hiphone/*` + `react` + `lucide-react`。沙箱
  resolver 不识别其他 specifier，编译时不报错但运行时抛 ReferenceError。
- 不能用 css module / scss — 只用 inline style + tailwind utility。
- 状态只用 `useState` / `useRef`，不引 Zustand。持久化走 `@hiphone/storage`。

## 单测约定
hook 和 pure logic 文件可以直接被 host 测试（`*.test.ts(x)` 走 vitest）。
组件级测试在 `src/platform/userApp/__tests__/` 用沙箱 smoke 跑（验证字符串
源能 compile + render，不抛错就算通过）。
```

- [ ] **Step 4: 跑测试**

Run: `pnpm vitest run src/apps/translate/constants/__tests__/languages.test.ts`
Expected: 5/5 PASS

- [ ] **Step 5: Commit**

```bash
git add src/apps/translate/constants/languages.ts \
        src/apps/translate/constants/__tests__/languages.test.ts \
        src/apps/translate/CLAUDE.md
git commit -m "feat(translate): curated language metadata + scope CLAUDE.md"
```

---

### Task 2: `useTranslate` hook（host 单测可达）

**Files:**
- Create: `src/apps/translate/hooks/useTranslate.ts`
- Create: `src/apps/translate/hooks/__tests__/useTranslate.test.ts`

`useTranslate` 接收源/目标语种 + 文本，返回 `{ targetText, status, error, translate, cancel }`。状态机：`idle` → `loading` → `success | error | aborted`。新调用 cancel 老调用。

- [ ] **Step 1: 写 hook**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { complete, AIUnavailableError } from '@hiphone/ai';
import type { Language } from '../constants/languages';

export type TranslateStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseTranslateResult {
  targetText: string;
  status: TranslateStatus;
  error: Error | null;
  translate: (sourceText: string, sourceLang: Language, targetLang: Language) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

/**
 * Build the prompt messages for one translation call.
 *
 * Exported (not just used internally) so the host unit test can verify
 * prompt shape without spinning up the whole hook.
 */
export function buildTranslateMessages(
  sourceText: string,
  sourceLang: Language,
  targetLang: Language,
): { role: 'system' | 'user'; content: string }[] {
  const sourceIsAuto = sourceLang.code === 'auto';
  const sourceName = sourceIsAuto ? 'the input language (auto-detect)' : sourceLang.name;
  const system =
    `You are a professional translator. ` +
    `Translate the user's text from ${sourceName} to ${targetLang.name}. ` +
    `Output ONLY the translation — no quotes, no commentary, no language labels. ` +
    `Preserve formatting (line breaks, lists). If input is empty, output empty.` +
    (sourceIsAuto ? ' Detect the source language automatically.' : '');
  return [
    { role: 'system', content: system },
    { role: 'user', content: sourceText },
  ];
}

export function useTranslate(): UseTranslateResult {
  const [targetText, setTargetText] = useState('');
  const [status, setStatus] = useState<TranslateStatus>('idle');
  const [error, setError] = useState<Error | null>(null);

  // Each translate() generates a fresh token. Older tokens silently
  // discard their result if a newer one has started — implements "cancel
  // pending request when a newer one comes in" without needing the
  // streamComplete signal pathway.
  const tokenRef = useRef(0);

  const cancel = useCallback(() => {
    tokenRef.current++;
    setStatus('idle');
  }, []);

  const reset = useCallback(() => {
    tokenRef.current++;
    setTargetText('');
    setStatus('idle');
    setError(null);
  }, []);

  // Discard in-flight requests on unmount.
  useEffect(() => () => {
    tokenRef.current++;
  }, []);

  const translate = useCallback(
    async (sourceText: string, sourceLang: Language, targetLang: Language) => {
      const trimmed = sourceText.trim();
      if (!trimmed) {
        setTargetText('');
        setStatus('idle');
        setError(null);
        return;
      }
      const myToken = ++tokenRef.current;
      setStatus('loading');
      setError(null);
      try {
        const messages = buildTranslateMessages(sourceText, sourceLang, targetLang);
        const reply = await complete(messages, { temperature: 0.3 });
        if (myToken !== tokenRef.current) return; // superseded
        setTargetText(reply);
        setStatus('success');
      } catch (err) {
        if (myToken !== tokenRef.current) return;
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        setStatus('error');
      }
    },
    [],
  );

  return { targetText, status, error, translate, cancel, reset };
}
```

- [ ] **Step 2: 写测试**

Create `src/apps/translate/hooks/__tests__/useTranslate.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { buildTranslateMessages, useTranslate } from '../useTranslate';
import { AUTO_LANG, CURATED_LANGUAGES } from '../../constants/languages';

vi.mock('@hiphone/ai', () => ({
  complete: vi.fn(),
  AIUnavailableError: class extends Error {},
}));
const aiMock = await import('@hiphone/ai');

const ZH = CURATED_LANGUAGES.find((l) => l.code === 'zh')!;
const EN = CURATED_LANGUAGES.find((l) => l.code === 'en')!;

describe('buildTranslateMessages', () => {
  it('emits system + user pair, source name in system prompt', () => {
    const msgs = buildTranslateMessages('你好', ZH, EN);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toContain('中文');
    expect(msgs[0].content).toContain('英语');
    expect(msgs[0].content).not.toContain('Detect the source language');
    expect(msgs[1].role).toBe('user');
    expect(msgs[1].content).toBe('你好');
  });

  it('appends auto-detect instruction when source is the auto sentinel', () => {
    const msgs = buildTranslateMessages('hi', AUTO_LANG, EN);
    expect(msgs[0].content).toContain('Detect the source language');
    expect(msgs[0].content).toContain('英语');
  });
});

describe('useTranslate', () => {
  beforeEach(() => {
    vi.mocked(aiMock.complete).mockReset();
  });

  it('starts idle, loading on translate, success when complete resolves', async () => {
    vi.mocked(aiMock.complete).mockResolvedValueOnce('Hello');
    const { result } = renderHook(() => useTranslate());
    expect(result.current.status).toBe('idle');
    await act(async () => {
      await result.current.translate('你好', ZH, EN);
    });
    expect(result.current.status).toBe('success');
    expect(result.current.targetText).toBe('Hello');
    expect(result.current.error).toBeNull();
  });

  it('on error, status=error and error is captured', async () => {
    const err = new Error('network down');
    vi.mocked(aiMock.complete).mockRejectedValueOnce(err);
    const { result } = renderHook(() => useTranslate());
    await act(async () => {
      await result.current.translate('hi', AUTO_LANG, EN);
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe('network down');
    expect(result.current.targetText).toBe(''); // not overwritten
  });

  it('superseded translate calls discard their result', async () => {
    let resolveFirst: (s: string) => void = () => {};
    vi.mocked(aiMock.complete).mockImplementationOnce(
      () => new Promise<string>((r) => { resolveFirst = r; }),
    );
    vi.mocked(aiMock.complete).mockResolvedValueOnce('Second');
    const { result } = renderHook(() => useTranslate());
    let firstPromise!: Promise<void>;
    act(() => {
      firstPromise = result.current.translate('a', ZH, EN);
    });
    await act(async () => {
      await result.current.translate('b', ZH, EN);
    });
    // Resolve the first call AFTER the second already won — its result
    // must be silently discarded.
    await act(async () => {
      resolveFirst('First (stale)');
      await firstPromise;
    });
    expect(result.current.targetText).toBe('Second');
  });

  it('empty input clears output and returns to idle without calling complete', async () => {
    const { result } = renderHook(() => useTranslate());
    await act(async () => {
      await result.current.translate('   ', ZH, EN);
    });
    expect(aiMock.complete).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(result.current.targetText).toBe('');
  });

  it('reset clears output, error, and status', async () => {
    vi.mocked(aiMock.complete).mockResolvedValueOnce('Hello');
    const { result } = renderHook(() => useTranslate());
    await act(async () => {
      await result.current.translate('你好', ZH, EN);
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.targetText).toBe('');
    expect(result.current.error).toBeNull();
  });
});
```

- [ ] **Step 3: 跑测试**

Run: `pnpm vitest run src/apps/translate/hooks/__tests__/useTranslate.test.ts`
Expected: all PASS

如果 "superseded translate calls" 那条挂了，检查 `tokenRef` 在 setState 之前是否真的累加；async/await 执行顺序在 jsdom 下不一定按写就行，必要时用更明确的 `vi.fn().mockImplementationOnce(() => new Promise(...))` 控制 timing。

- [ ] **Step 4: Commit**

```bash
git add src/apps/translate/hooks/useTranslate.ts \
        src/apps/translate/hooks/__tests__/useTranslate.test.ts
git commit -m "feat(translate): useTranslate hook + buildTranslateMessages"
```

---

### Task 3: 三个 React 组件 — `LangBar` / `SourcePanel` / `TargetPanel`

**Files:**
- Create: `src/apps/translate/selectors/LangBar.tsx`
- Create: `src/apps/translate/panels/SourcePanel.tsx`
- Create: `src/apps/translate/panels/TargetPanel.tsx`

这三个文件**不能** import host 任何东西，只能用 SDK + react + lucide-react。

- [ ] **Step 1: `LangBar.tsx`**

```tsx
import React from 'react';
import { motion } from '@hiphone/motion';
import { spring } from '@hiphone/motion';
import { ArrowLeftRight } from 'lucide-react';
import type { Language } from '../constants/languages';

export interface LangBarProps {
  sourceLang: Language;
  targetLang: Language;
  onSwap: () => void;
  /** S4 will wire these to open LangSheet. S3 keeps them as no-op stubs. */
  onTapSource?: () => void;
  onTapTarget?: () => void;
}

const PILL_STYLE: React.CSSProperties = {
  flex: 1,
  height: 44,
  borderRadius: 22,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 17,
  fontWeight: 500,
  color: 'var(--color-label)',
  backgroundColor: 'var(--color-secondarySystemFill)',
  cursor: 'pointer',
  userSelect: 'none',
};

export function LangBar({
  sourceLang,
  targetLang,
  onSwap,
  onTapSource,
  onTapTarget,
}: LangBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
      }}
    >
      <button
        type="button"
        style={{ ...PILL_STYLE, border: 'none' }}
        onClick={onTapSource}
        aria-label={`源语言 ${sourceLang.name}`}
      >
        {sourceLang.native}
      </button>

      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={onSwap}
        aria-label="交换语种"
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          border: 'none',
          backgroundColor: 'var(--color-systemBlue)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <motion.span
          // 360 each toggle keeps the icon visually rotating each tap.
          animate={{ rotate: 0 }}
          whileTap={{ rotate: 180 }}
          transition={spring.bouncy}
          style={{ display: 'inline-flex' }}
        >
          <ArrowLeftRight size={20} strokeWidth={2.2} />
        </motion.span>
      </motion.button>

      <button
        type="button"
        style={{ ...PILL_STYLE, border: 'none' }}
        onClick={onTapTarget}
        aria-label={`目标语言 ${targetLang.name}`}
      >
        {targetLang.native}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: `SourcePanel.tsx`**

```tsx
import React from 'react';
import { X } from 'lucide-react';

export interface SourcePanelProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SourcePanel({
  value,
  onChange,
  placeholder = '输入要翻译的文本',
  disabled,
}: SourcePanelProps) {
  return (
    <div
      style={{
        position: 'relative',
        margin: '0 16px',
        backgroundColor: 'var(--color-tertiarySystemBackground)',
        borderRadius: 12,
        padding: 12,
        minHeight: 140,
      }}
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={5}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 116,
          border: 'none',
          outline: 'none',
          resize: 'none',
          background: 'transparent',
          fontSize: 17,
          lineHeight: 1.4,
          color: 'var(--color-label)',
          fontFamily: 'inherit',
        }}
      />
      {value.length > 0 && !disabled && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="清空"
          style={{
            position: 'absolute',
            right: 8,
            top: 8,
            width: 28,
            height: 28,
            borderRadius: 14,
            border: 'none',
            backgroundColor: 'var(--color-tertiarySystemFill)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--color-secondaryLabel)',
          }}
        >
          <X size={16} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: `TargetPanel.tsx`**

```tsx
import React from 'react';
import { motion, AnimatePresence } from '@hiphone/motion';
import { spring } from '@hiphone/motion';
import { Copy } from 'lucide-react';
import { show as toastShow, error as toastError } from '@hiphone/toast';

export type TargetStatus = 'idle' | 'loading' | 'success' | 'error';

export interface TargetPanelProps {
  text: string;
  status: TargetStatus;
  errorMessage?: string;
}

export function TargetPanel({ text, status, errorMessage }: TargetPanelProps) {
  const onCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toastShow('已复制');
    } catch {
      toastError('复制失败');
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        margin: '12px 16px 0',
        backgroundColor: 'var(--color-secondarySystemBackground)',
        borderRadius: 12,
        padding: 12,
        minHeight: 140,
        color: 'var(--color-label)',
      }}
    >
      <AnimatePresence mode="wait">
        {status === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={spring.smooth}
            style={{
              fontSize: 15,
              color: 'var(--color-secondaryLabel)',
            }}
          >
            翻译中…
          </motion.div>
        )}
        {status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={spring.smooth}
            style={{
              fontSize: 15,
              color: 'var(--color-systemRed)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {errorMessage ?? '翻译失败'}
          </motion.div>
        )}
        {(status === 'success' || (status === 'idle' && text)) && text && (
          <motion.div
            key="text"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={spring.smooth}
            style={{
              fontSize: 17,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
              paddingRight: 32,
            }}
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>

      {text && status !== 'loading' && (
        <motion.button
          type="button"
          onClick={onCopy}
          whileTap={{ scale: 1.15 }}
          transition={spring.bouncy}
          aria-label="复制译文"
          style={{
            position: 'absolute',
            right: 8,
            bottom: 8,
            width: 32,
            height: 32,
            borderRadius: 16,
            border: 'none',
            backgroundColor: 'var(--color-tertiarySystemFill)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--color-systemBlue)',
          }}
        >
          <Copy size={16} strokeWidth={2.2} />
        </motion.button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 类型检查**

Run: `pnpm tsc --noEmit`
Expected: 通过

- [ ] **Step 5: Commit**

```bash
git add src/apps/translate/selectors/LangBar.tsx \
        src/apps/translate/panels/SourcePanel.tsx \
        src/apps/translate/panels/TargetPanel.tsx
git commit -m "feat(translate): LangBar + SourcePanel + TargetPanel components"
```

---

### Task 4: `TranslateApp.tsx` 入口（拼装 + 翻译按钮 + 错误处理）

**Files:**
- Create: `src/apps/translate/TranslateApp.tsx`

入口持有所有 state（源/目标语种、源文本），用 `useTranslate` 拿到 targetText/status，渲染 NavBar + LangBar + SourcePanel + 翻译按钮 + TargetPanel。

- [ ] **Step 1: 写文件**

```tsx
import React, { useState, useCallback } from 'react';
import { NavBar } from '@hiphone/ui';
import { motion } from '@hiphone/motion';
import { spring } from '@hiphone/motion';
import { error as toastError } from '@hiphone/toast';
import { AIUnavailableError } from '@hiphone/ai';
import { LangBar } from './selectors/LangBar';
import { SourcePanel } from './panels/SourcePanel';
import { TargetPanel } from './panels/TargetPanel';
import { useTranslate } from './hooks/useTranslate';
import {
  CURATED_LANGUAGES,
  AUTO_LANG,
  DEFAULT_SOURCE_LANG,
  DEFAULT_TARGET_LANG,
  type Language,
} from './constants/languages';

export default function TranslateApp() {
  const [sourceLang, setSourceLang] = useState<Language>(DEFAULT_SOURCE_LANG);
  const [targetLang, setTargetLang] = useState<Language>(DEFAULT_TARGET_LANG);
  const [sourceText, setSourceText] = useState('');
  const { targetText, status, error, translate, reset } = useTranslate();

  const onSwap = useCallback(() => {
    // Don't swap "auto" into target — degrades to 中文 if user swaps an
    // auto source.
    const nextSource: Language =
      targetLang.code === AUTO_LANG.code
        ? CURATED_LANGUAGES.find((l) => l.code === 'zh')!
        : targetLang;
    setSourceLang(nextSource);
    setTargetLang(sourceLang.code === AUTO_LANG.code ? CURATED_LANGUAGES.find((l) => l.code === 'zh')! : sourceLang);
    if (targetText) {
      setSourceText(targetText);
      reset();
    }
  }, [sourceLang, targetLang, targetText, reset]);

  const onTranslate = useCallback(async () => {
    await translate(sourceText, sourceLang, targetLang);
  }, [translate, sourceText, sourceLang, targetLang]);

  // Toast on errors. The hook already captures into `error`, here we
  // surface them via the platform toast (spec §3.8).
  React.useEffect(() => {
    if (status === 'error' && error) {
      if (error instanceof AIUnavailableError) {
        toastError('请先在设置里配置 AI');
      } else {
        toastError(error.message || '翻译失败');
      }
    }
  }, [status, error]);

  const canTranslate = sourceText.trim().length > 0 && status !== 'loading';

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-systemBackground)',
      }}
    >
      <NavBar title="翻译" />

      <LangBar
        sourceLang={sourceLang}
        targetLang={targetLang}
        onSwap={onSwap}
      />

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
        <SourcePanel
          value={sourceText}
          onChange={setSourceText}
          disabled={status === 'loading'}
        />

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
          <motion.button
            type="button"
            disabled={!canTranslate}
            onClick={onTranslate}
            whileTap={canTranslate ? { scale: 0.96 } : undefined}
            transition={spring.snappy}
            style={{
              padding: '10px 28px',
              minHeight: 44,
              borderRadius: 22,
              border: 'none',
              fontSize: 17,
              fontWeight: 600,
              backgroundColor: canTranslate
                ? 'var(--color-systemBlue)'
                : 'var(--color-tertiarySystemFill)',
              color: canTranslate ? 'white' : 'var(--color-tertiaryLabel)',
              cursor: canTranslate ? 'pointer' : 'default',
            }}
          >
            {status === 'loading' ? '翻译中…' : '翻译'}
          </motion.button>
        </div>

        <TargetPanel
          text={targetText}
          status={status}
          errorMessage={error?.message}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查**

Run: `pnpm tsc --noEmit`
Expected: 通过

- [ ] **Step 3: Commit**

```bash
git add src/apps/translate/TranslateApp.tsx
git commit -m "feat(translate): TranslateApp entry — swap + translate button + toast errors"
```

---

### Task 5: 把源码字符串注入 `builtinUserApps.ts`（替换 placeholder）

**Files:**
- Modify: `src/platform/userApp/builtinUserApps.ts`

用 Vite `?raw` 拿到 7 个文件的字符串内容（不含 `*.test.ts`、`CLAUDE.md`），构造成 `files` map。entry 改为 `TranslateApp.tsx`。

注意路径细节：沙箱 resolver 处理相对 import（`./constants/languages` → `constants/languages.tsx?` 或 `.ts`）。`createUserAppRuntime` 内部会按 entry 文件目录解析相对路径（参考 `installer.ts` / `moduleResolver.ts` 已有逻辑）。键名要保留扩展名以便 resolver 命中。

- [ ] **Step 1: 改写 `builtinUserApps.ts`**

```ts
/**
 * Built-in user apps: ship with hiPhone, run through the user-app
 * sandbox pipeline (compile → sandbox → register), but cannot be
 * uninstalled and don't appear in App Store's "installed" list.
 *
 * Source files for each app live under src/apps/<id>/ as real .tsx/.ts
 * files (IDE highlight + tsc + ESLint friendly), and are pulled in here
 * as raw strings via Vite's ?raw query so the sandbox can compile them.
 */

import { appRegistry } from '@/platform/appRegistry';
import { compileTsx } from './compiler';
import { createUserAppRuntime } from './moduleResolver';
import { resolveModule } from './sdk';
import { wrapUserComponent } from './sdk/wrap';

// Translate app source files (S3 — core translate flow; S4/S5 will add sheets + history).
import translateAppSrc from '@/apps/translate/TranslateApp.tsx?raw';
import translateLangBarSrc from '@/apps/translate/selectors/LangBar.tsx?raw';
import translateSourcePanelSrc from '@/apps/translate/panels/SourcePanel.tsx?raw';
import translateTargetPanelSrc from '@/apps/translate/panels/TargetPanel.tsx?raw';
import translateUseTranslateSrc from '@/apps/translate/hooks/useTranslate.ts?raw';
import translateLanguagesSrc from '@/apps/translate/constants/languages.ts?raw';

export interface BuiltinUserApp {
  id: string;
  name: string;
  files: Record<string, string>;
  entry: string;
  perspectiveAware: boolean;
  globalData: boolean;
}

export const BUILTIN_USER_APPS: BuiltinUserApp[] = [
  {
    id: 'translate',
    name: '翻译',
    entry: 'TranslateApp.tsx',
    files: {
      'TranslateApp.tsx': translateAppSrc,
      'selectors/LangBar.tsx': translateLangBarSrc,
      'panels/SourcePanel.tsx': translateSourcePanelSrc,
      'panels/TargetPanel.tsx': translateTargetPanelSrc,
      'hooks/useTranslate.ts': translateUseTranslateSrc,
      'constants/languages.ts': translateLanguagesSrc,
    },
    perspectiveAware: true,
    globalData: false,
  },
];

export async function mountBuiltinUserApps(): Promise<void> {
  for (const app of BUILTIN_USER_APPS) {
    try {
      const compiledMap: Record<string, string> = {};
      for (const [path, source] of Object.entries(app.files)) {
        compiledMap[path] = await compileTsx(source, `${app.id}/${path}`);
      }
      const RawComponent = createUserAppRuntime(
        compiledMap,
        app.entry,
        resolveModule,
        app.id,
      );
      const WrappedComponent = wrapUserComponent(RawComponent);
      appRegistry.register({
        id: app.id,
        name: app.name,
        type: 'builtin',
        component: WrappedComponent,
        perspectiveAware: app.perspectiveAware,
        globalData: app.globalData,
      });
    } catch (err) {
      console.error(`[builtinUserApps] failed to mount "${app.id}":`, err);
    }
  }
}
```

- [ ] **Step 2: 跑现有 builtinUserApps 测试**

Run: `pnpm vitest run src/platform/userApp/__tests__/builtinUserApps.test.ts`
Expected: 4/4 PASS

如果 "registered component renders without throwing" 挂了（最可能的失败点 — 真实组件有更多依赖），看 console.error 拿到具体 ReferenceError，对照 SDK resolver 是否有遗漏的 specifier。

可能踩坑：
- `motion/react` 已经 SDK 化（`@hiphone/motion`），✓
- `lucide-react` ✓ 在 resolver
- 相对路径 `./constants/languages` 解析依赖 `moduleResolver.ts` 的实现。如果 resolver 默认期望 `.tsx` 但 source 写 `import './constants/languages'`（无扩展名），需要 resolver 支持扩展名 fallback。**先跑测试，挂了再读 `moduleResolver.ts` 的相关代码并补 fallback**——别预先复杂化。

- [ ] **Step 3: 跑 sandbox smoke test 看老的 motion smoke 还过**

Run: `pnpm vitest run src/platform/userApp/sdk/__tests__/motion.sandbox.test.ts`
Expected: PASS（保护 SDK 接面没退化）

- [ ] **Step 4: 跑全部用户 app 相关测试**

Run: `pnpm vitest run src/platform/userApp src/apps/translate`
Expected: 全 PASS

- [ ] **Step 5: Commit**

```bash
git add src/platform/userApp/builtinUserApps.ts
git commit -m "feat(translate): wire real translate sources into builtinUserApps via ?raw"
```

---

### Task 6: 沙箱集成 smoke 测试（端到端）

**Files:**
- Create: `src/platform/userApp/__tests__/translate.sandbox.test.ts`

验证：翻译 App 在沙箱里能编译、能 render、模拟点击翻译按钮调用 `complete` 后能更新 TargetPanel。

- [ ] **Step 1: 写测试**

```ts
/**
 * Sandbox-level smoke for the translate user-app: compile → register →
 * render → click translate → see result.
 *
 * Mocks @hiphone/ai's complete() so the test doesn't hit a real LLM.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { appRegistry } from '@/platform/appRegistry';
import { mountBuiltinUserApps } from '../builtinUserApps';

// Mock the AI surface so complete() returns predictably without provider
// config. The mock has to reach the SDK module that user-app code resolves
// through, which is `src/platform/userApp/sdk/ai.ts`.
const completeMock = vi.fn();
vi.mock('@/platform/userApp/sdk/ai', async () => {
  const actual = await vi.importActual<typeof import('@/platform/userApp/sdk/ai')>(
    '@/platform/userApp/sdk/ai',
  );
  return {
    ...actual,
    complete: (...args: unknown[]) => completeMock(...args),
  };
});

describe('translate user-app — sandbox smoke', () => {
  beforeEach(() => {
    appRegistry.unregister('translate');
    completeMock.mockReset();
  });

  it('compiles, registers, and renders without throwing', async () => {
    await mountBuiltinUserApps();
    const entry = appRegistry.get('translate');
    expect(entry).toBeDefined();
    expect(entry!.type).toBe('builtin');

    expect(() => render(React.createElement(entry!.component))).not.toThrow();
    cleanup();
  });

  it('typing + clicking 翻译 calls AI and updates target panel', async () => {
    completeMock.mockResolvedValueOnce('Hello');
    await mountBuiltinUserApps();
    const entry = appRegistry.get('translate')!;
    render(React.createElement(entry.component));

    const textarea = screen.getByPlaceholderText(/输入要翻译的文本/);
    fireEvent.change(textarea, { target: { value: '你好' } });

    const translateBtn = screen.getByRole('button', { name: '翻译' });
    fireEvent.click(translateBtn);

    expect(completeMock).toHaveBeenCalledTimes(1);
    const messages = completeMock.mock.calls[0][0];
    expect(messages[1].content).toBe('你好');

    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeTruthy();
    });
    cleanup();
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `pnpm vitest run src/platform/userApp/__tests__/translate.sandbox.test.ts`
Expected: 2/2 PASS

可能踩坑：
- 翻译按钮的 `aria-label` / accessible name —— 上面用了 `getByRole('button', { name: '翻译' })`，如果按钮 disabled 或 testing-library 找不到，改用 `screen.getByText('翻译').closest('button')`
- AnimatePresence 在 jsdom 里的 exit 动画行为 — 用 `waitFor` 而不是同步断言，给 framer 一帧时间
- mock 路径：必须 mock `@/platform/userApp/sdk/ai`（resolver 拿的是这个 module），不是 `@hiphone/ai`（那只是 alias）

- [ ] **Step 3: Commit**

```bash
git add src/platform/userApp/__tests__/translate.sandbox.test.ts
git commit -m "test(translate): sandbox smoke — compile, render, end-to-end translate"
```

---

### Task 7: 全量验证 + 文档收尾

- [ ] **Step 1: 跑全部测试**

Run: `pnpm vitest run`
Expected: 全 PASS（应有 ~10+ 个新测）

- [ ] **Step 2: 跑 build + Sucrase 验证**

Run: `pnpm build && node scripts/check-sucrase-in-prod.mjs`
Expected: build 成功 + `OK — Sucrase found in <chunk>`

如果 build fail 或 chunk size 报警异常（`>>> 50KB` 量级以上的额外增长），不要直接 commit；分析 dist size 报告，多半是某个 import 把 host 模块拽进了沙箱字符串源（这是禁区）。

- [ ] **Step 3: 更新 `src/platform/userApp/CLAUDE.md`**

在"已落地的架构决策"章节追加：

```markdown
- **Built-in user apps source layout via Vite `?raw`** (S3). 内置 user app 的源码物理上在 `src/apps/<id>/`，享受 IDE / TS / ESLint。`builtinUserApps.ts` 用 `?raw` query 把每个文件读成字符串塞进沙箱编译。同一份源既可被 host vitest 直接 import 测 hook / pure logic，又能塞进沙箱跑组件级 smoke 测试，**避免双份维护**。
```

- [ ] **Step 4: Commit**

```bash
git add src/platform/userApp/CLAUDE.md
git commit -m "docs(userApp): record S3 — translate app sources via Vite ?raw"
```

---

## Self-Review

**Spec 覆盖：**
- §3.3 翻译 App 内部结构 → Task 1-4 涵盖 6 个文件中的 6 个（剩下 LangSheet/CustomLangInput/RecentsSheet/FavoritesSheet/RecentRow/useHistory 在 S4-S5）✓
- §3.5 AI Prompt 策略（temperature 0.3, system+user, auto detect 指令）→ Task 2 `buildTranslateMessages` ✓
- §3.7 翻译 + 复制两条动效 → Task 3 (`TargetPanel` AnimatePresence + 复制按钮 scale) + Task 4 (按钮 whileTap) ✓
- §3.7 交换语种动效（180° 旋转） → Task 3 LangBar `whileTap rotate` ✓
- §3.8 错误处理 → Task 4 `useEffect`：AIUnavailableError → 配置提示, 其它 → message ✓

**Placeholder 扫描：** Task 6 的 "可能踩坑" 列表是诊断指引，不是 placeholder。代码块都是完整可运行内容 ✓

**类型一致性：**
- `Language` 接口在 constants 定义后，hook / 组件 / 入口都一致引用 ✓
- `TranslateStatus` ↔ `TargetStatus` 用相同四态字符串字面量 ✓
- `useTranslate` 返回 `{ targetText, status, error, translate, cancel, reset }` 在 Task 2/4 一致 ✓

**已知局限（写入文档而非偷偷藏起来）：**
- LangBar 的 `onTapSource` / `onTapTarget` S3 不生效，是占位等 S4 接 sheet
- 没有翻译历史，不持久化任何数据 — S5 才接 storage
- 沙箱 mock 的 `getByRole('button', { name: '翻译' })` 在按钮文本变成"翻译中…"时找不到 — 测试只用初始态那次

---

## 执行选择

S3 plan 写好。直接交给 implementer subagent 跑。
