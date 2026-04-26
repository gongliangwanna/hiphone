# 翻译 App S4 — LangSheet（精选 10）+ CustomLangInput（自定义）+ 接线

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** 让用户能从底部 sheet 选择源/目标语种（含"自动检测"和"自定义..."入口），自定义入口弹二级抽屉自由输入语种名（如"古希腊语"），输入后被原样塞进 prompt 交给 AI。LangBar 的语种按钮从 S3 的 no-op 接通到 sheet。

**Architecture:** 新增两个组件 `selectors/LangSheet.tsx`（一级）和 `selectors/CustomLangInput.tsx`（二级）。`TranslateApp.tsx` 持有 `pickerOpen: 'source' | 'target' | null` 与 `customLangOpen: boolean` 状态，driving 两层 sheet。LangBar 接 `onTapSource` / `onTapTarget` 回调。sheet 用 `motion` + `AnimatePresence` 做 y 100% → 0 弹起 + 背景遮罩淡入。

**Tech Stack:** React / motion/react / Tailwind / Vitest

**Spec 来源：** `docs/superpowers/specs/2026-04-26-translate-app-design.md` §2.3 (语种 A+C), §3.7 表（"选语种" + "自定义..."），§3.5 (自由输入语种直接塞 prompt)

**前置依赖：** S3 已完成（LangBar 已就绪，缺 `onTapSource/Target` 实现）

---

## 关键决策

1. **Sheet 形态**：底部抓手 + 圆角 16px 顶部，背景遮罩 `rgba(0,0,0,0.4)`，点击遮罩关闭。不强求 backdrop-filter（沙箱无法用 system/Material/）。
2. **二级抽屉叠在一级之上**：`CustomLangInput` 自己一层 sheet，覆盖一级 LangSheet。一级保留 mounted 但视觉被遮罩盖住——这样关闭二级后无需重新计算一级的位置。
3. **CustomLanguage 数据**：用户输入的字符串构造为 `{ code: 'custom:<text>', name: <text>, native: <text> }`——`code` 前缀 `custom:` 用于 S5 历史去重区分自定义/精选条目。
4. **可访问性**：sheet 加 `role="dialog"` + `aria-modal="true"` + `aria-labelledby`。CustomLangInput 的 `<input>` 拿到 autoFocus。
5. **自动检测可选位置**：仅源语言能选"自动检测"。目标语言的 sheet 不显示该项（spec §2.3 隐含约束）。
6. **关闭手势**：本阶段 **不** 实现下滑关闭（M2 SheetGesture 是 system 层，沙箱拿不到）。点击遮罩 / 取消按钮关闭即可，符合 iOS 风格 fallback。

---

### Task 1: `LangSheet.tsx` 组件 + 单测

**Files:**
- Create: `src/apps/translate/selectors/LangSheet.tsx`
- Create: `src/apps/translate/selectors/__tests__/LangSheet.test.tsx`

- [ ] **Step 1: 写测试（先写测试，测试要求把组件 import 到 host vitest，不走沙箱）**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LangSheet } from '../LangSheet';
import { CURATED_LANGUAGES, AUTO_LANG } from '../../constants/languages';

describe('LangSheet', () => {
  it('does not render when open=false', () => {
    render(
      <LangSheet
        open={false}
        showAuto
        onPick={() => {}}
        onPickCustom={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders 10 curated languages + auto + custom entry when source mode', () => {
    render(
      <LangSheet
        open
        showAuto
        onPick={() => {}}
        onPickCustom={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(AUTO_LANG.native)).toBeTruthy();
    for (const lang of CURATED_LANGUAGES) {
      expect(screen.getByText(lang.native)).toBeTruthy();
    }
    expect(screen.getByText(/自定义/)).toBeTruthy();
  });

  it('hides 自动检测 when showAuto=false (target mode)', () => {
    render(
      <LangSheet
        open
        showAuto={false}
        onPick={() => {}}
        onPickCustom={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText(AUTO_LANG.native)).toBeNull();
  });

  it('clicking a language calls onPick with that lang', () => {
    const onPick = vi.fn();
    render(
      <LangSheet
        open
        showAuto
        onPick={onPick}
        onPickCustom={() => {}}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('English'));
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'en' }),
    );
  });

  it('clicking custom row fires onPickCustom (not onPick)', () => {
    const onPick = vi.fn();
    const onPickCustom = vi.fn();
    render(
      <LangSheet
        open
        showAuto
        onPick={onPick}
        onPickCustom={onPickCustom}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByText(/自定义/));
    expect(onPickCustom).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('clicking the backdrop closes the sheet', () => {
    const onClose = vi.fn();
    render(
      <LangSheet
        open
        showAuto
        onPick={() => {}}
        onPickCustom={() => {}}
        onClose={onClose}
      />,
    );
    // backdrop has aria-label="关闭" via the test fixture below
    fireEvent.click(screen.getByLabelText('关闭'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 写实现**

```tsx
import React from 'react';
import { motion, AnimatePresence } from '@hiphone/motion';
import { spring } from '@hiphone/motion';
import { Sparkles } from 'lucide-react';
import {
  CURATED_LANGUAGES,
  AUTO_LANG,
  type Language,
} from '../constants/languages';

export interface LangSheetProps {
  open: boolean;
  showAuto: boolean;
  /** Called when the user taps a curated or auto language. */
  onPick: (lang: Language) => void;
  /** Called when the user taps the "自定义..." row. Caller opens CustomLangInput. */
  onPickCustom: () => void;
  onClose: () => void;
}

const SHEET_STYLE: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'var(--color-secondarySystemBackground)',
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  padding: '12px 0 24px',
  maxHeight: '70%',
  overflowY: 'auto',
};

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  minHeight: 48,
  padding: '12px 20px',
  border: 'none',
  background: 'transparent',
  fontSize: 17,
  textAlign: 'left',
  color: 'var(--color-label)',
  cursor: 'pointer',
};

const HANDLE_STYLE: React.CSSProperties = {
  width: 36,
  height: 5,
  borderRadius: 3,
  margin: '0 auto 8px',
  backgroundColor: 'var(--color-tertiaryLabel)',
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--color-secondaryLabel)',
  padding: '4px 20px 8px',
};

const BACKDROP_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.4)',
  border: 'none',
  cursor: 'pointer',
};

const CONTAINER_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 100,
};

export function LangSheet({
  open,
  showAuto,
  onPick,
  onPickCustom,
  onClose,
}: LangSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <div style={CONTAINER_STYLE} role="dialog" aria-modal="true" aria-labelledby="langsheet-title">
          <motion.button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={spring.smooth}
            style={BACKDROP_STYLE}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring.snappy}
            style={SHEET_STYLE}
          >
            <div style={HANDLE_STYLE} />
            <div id="langsheet-title" style={TITLE_STYLE}>选择语言</div>

            {showAuto && (
              <button type="button" style={ROW_STYLE} onClick={() => onPick(AUTO_LANG)}>
                {AUTO_LANG.native}
              </button>
            )}
            {CURATED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                style={ROW_STYLE}
                onClick={() => onPick(lang)}
              >
                {lang.native}
              </button>
            ))}

            <div style={{ height: 1, backgroundColor: 'var(--color-separator)', margin: '8px 20px' }} />

            <button
              type="button"
              style={{ ...ROW_STYLE, color: 'var(--color-systemBlue)' }}
              onClick={onPickCustom}
            >
              <Sparkles size={18} strokeWidth={2.2} style={{ marginRight: 10 }} />
              自定义…
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 3: 跑测试**

Run: `pnpm vitest run src/apps/translate/selectors/__tests__/LangSheet.test.tsx`
Expected: 6/6 PASS

注意 motion 在 jsdom 里的初始位置：`initial y 100%` → animate → 实际不会等动画完成，DOM 立刻挂载，testing-library 能直接命中按钮。无需 `waitFor`。

- [ ] **Step 4: Commit**

```bash
git add src/apps/translate/selectors/LangSheet.tsx \
        src/apps/translate/selectors/__tests__/LangSheet.test.tsx
git commit -m "feat(translate): LangSheet — curated 10 + auto + 自定义 entry"
```

---

### Task 2: `CustomLangInput.tsx` 组件 + 单测

**Files:**
- Create: `src/apps/translate/selectors/CustomLangInput.tsx`
- Create: `src/apps/translate/selectors/__tests__/CustomLangInput.test.tsx`

二级抽屉，单一 textinput + 取消/确认按钮。提交时调 `onSubmit(lang)`，构造 `{ code: 'custom:<text>', name: <text>, native: <text> }`。

- [ ] **Step 1: 写测试**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomLangInput } from '../CustomLangInput';

describe('CustomLangInput', () => {
  it('does not render when open=false', () => {
    render(<CustomLangInput open={false} onSubmit={() => {}} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders an input + 取消 + 确认 buttons', () => {
    render(<CustomLangInput open onSubmit={() => {}} onClose={() => {}} />);
    expect(screen.getByPlaceholderText(/古希腊语|文言文|输入语种/)).toBeTruthy();
    expect(screen.getByText('取消')).toBeTruthy();
    expect(screen.getByText('确认')).toBeTruthy();
  });

  it('确认 with empty input is disabled and does not call onSubmit', () => {
    const onSubmit = vi.fn();
    render(<CustomLangInput open onSubmit={onSubmit} onClose={() => {}} />);
    const btn = screen.getByText('确认').closest('button')!;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('typing then 确认 calls onSubmit with constructed Language and closes', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<CustomLangInput open onSubmit={onSubmit} onClose={onClose} />);
    const input = screen.getByPlaceholderText(/古希腊语|文言文|输入语种/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '古希腊语' } });
    fireEvent.click(screen.getByText('确认'));
    expect(onSubmit).toHaveBeenCalledWith({
      code: 'custom:古希腊语',
      name: '古希腊语',
      native: '古希腊语',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('取消 calls onClose without onSubmit', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<CustomLangInput open onSubmit={onSubmit} onClose={onClose} />);
    fireEvent.click(screen.getByText('取消'));
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('trims whitespace before submitting; whitespace-only is rejected', () => {
    const onSubmit = vi.fn();
    render(<CustomLangInput open onSubmit={onSubmit} onClose={() => {}} />);
    const input = screen.getByPlaceholderText(/古希腊语|文言文|输入语种/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });
    expect(screen.getByText('确认').closest('button')!.disabled).toBe(true);

    fireEvent.change(input, { target: { value: '  Klingon  ' } });
    fireEvent.click(screen.getByText('确认'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Klingon', code: 'custom:Klingon' }),
    );
  });

  it('opening clears the previous input', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <CustomLangInput open onSubmit={onSubmit} onClose={() => {}} />,
    );
    const input = screen.getByPlaceholderText(/古希腊语|文言文|输入语种/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Klingon' } });
    rerender(<CustomLangInput open={false} onSubmit={onSubmit} onClose={() => {}} />);
    rerender(<CustomLangInput open onSubmit={onSubmit} onClose={() => {}} />);
    const reopened = screen.getByPlaceholderText(/古希腊语|文言文|输入语种/) as HTMLInputElement;
    expect(reopened.value).toBe('');
  });
});
```

- [ ] **Step 2: 写实现**

```tsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from '@hiphone/motion';
import { spring } from '@hiphone/motion';
import type { Language } from '../constants/languages';

export interface CustomLangInputProps {
  open: boolean;
  onSubmit: (lang: Language) => void;
  onClose: () => void;
}

const CONTAINER_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 110, // above LangSheet (100)
};

const BACKDROP_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.4)',
  border: 'none',
  cursor: 'pointer',
};

const SHEET_STYLE: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'var(--color-secondarySystemBackground)',
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  padding: 16,
};

const HANDLE_STYLE: React.CSSProperties = {
  width: 36,
  height: 5,
  borderRadius: 3,
  margin: '0 auto 12px',
  backgroundColor: 'var(--color-tertiaryLabel)',
};

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '10px 12px',
  fontSize: 17,
  borderRadius: 10,
  border: 'none',
  outline: 'none',
  backgroundColor: 'var(--color-tertiarySystemFill)',
  color: 'var(--color-label)',
  marginBottom: 12,
};

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: 8,
};

function makeCustomLang(name: string): Language {
  return { code: `custom:${name}`, name, native: name };
}

export function CustomLangInput({ open, onSubmit, onClose }: CustomLangInputProps) {
  const [value, setValue] = useState('');

  // Clear value whenever the sheet (re)opens — feels right for iOS dialogs:
  // each invocation is fresh.
  useEffect(() => {
    if (open) setValue('');
  }, [open]);

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(makeCustomLang(trimmed));
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div style={CONTAINER_STYLE} role="dialog" aria-modal="true" aria-label="自定义语种">
          <motion.button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={spring.smooth}
            style={BACKDROP_STYLE}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring.snappy}
            style={SHEET_STYLE}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={HANDLE_STYLE} />
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 12, color: 'var(--color-label)' }}>
              输入语种名
            </div>
            <input
              autoFocus
              type="text"
              placeholder="如：古希腊语、文言文、Klingon... 输入语种名"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              style={INPUT_STYLE}
            />
            <div style={ROW_STYLE}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 10,
                  border: 'none',
                  fontSize: 17,
                  fontWeight: 500,
                  backgroundColor: 'var(--color-tertiarySystemFill)',
                  color: 'var(--color-label)',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 10,
                  border: 'none',
                  fontSize: 17,
                  fontWeight: 600,
                  backgroundColor: canSubmit
                    ? 'var(--color-systemBlue)'
                    : 'var(--color-tertiarySystemFill)',
                  color: canSubmit ? 'white' : 'var(--color-tertiaryLabel)',
                  cursor: canSubmit ? 'pointer' : 'default',
                }}
              >
                确认
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 3: 跑测试**

Run: `pnpm vitest run src/apps/translate/selectors/__tests__/CustomLangInput.test.tsx`
Expected: 7/7 PASS

可能踩坑：`autoFocus` 在 jsdom 不可靠，用 `placeholder` 文本定位 input 更稳。

- [ ] **Step 4: Commit**

```bash
git add src/apps/translate/selectors/CustomLangInput.tsx \
        src/apps/translate/selectors/__tests__/CustomLangInput.test.tsx
git commit -m "feat(translate): CustomLangInput — free-form language entry"
```

---

### Task 3: `TranslateApp.tsx` 接线 — 打开 sheet, 接收选择

**Files:**
- Modify: `src/apps/translate/TranslateApp.tsx`

加状态：`pickerOpen: 'source' | 'target' | null`、`customOpen: boolean`。LangBar 的 `onTapSource/Target` 接通。`LangSheet.onPick` 设对应 lang 后关 sheet。`LangSheet.onPickCustom` 关闭一级、打开二级。`CustomLangInput.onSubmit` 同样写入对应 lang。

- [ ] **Step 1: 修改 TranslateApp.tsx**

读现有内容，然后在 import + 状态 + JSX 三处叠加（不替换整个文件，避免回归）：

新增 import：

```tsx
import { LangSheet } from './selectors/LangSheet';
import { CustomLangInput } from './selectors/CustomLangInput';
```

新增状态（在 `const [sourceText, setSourceText] = useState('');` 下方）：

```tsx
const [pickerOpen, setPickerOpen] = useState<'source' | 'target' | null>(null);
const [customOpen, setCustomOpen] = useState(false);
```

新增回调：

```tsx
const onPickLang = useCallback(
  (lang: Language) => {
    if (pickerOpen === 'source') setSourceLang(lang);
    else if (pickerOpen === 'target') setTargetLang(lang);
    setPickerOpen(null);
    reset();
  },
  [pickerOpen, reset],
);

const onPickCustom = useCallback(() => {
  setCustomOpen(true);
}, []);

const onCustomSubmit = useCallback(
  (lang: Language) => {
    if (pickerOpen === 'source') setSourceLang(lang);
    else if (pickerOpen === 'target') setTargetLang(lang);
    setCustomOpen(false);
    setPickerOpen(null);
    reset();
  },
  [pickerOpen, reset],
);
```

修改 LangBar 调用，传入 onTap：

```tsx
<LangBar
  sourceLang={sourceLang}
  targetLang={targetLang}
  onSwap={onSwap}
  onTapSource={() => setPickerOpen('source')}
  onTapTarget={() => setPickerOpen('target')}
/>
```

在 root `<div style={APP_STYLE}>` 内最末尾（在 `</div>` 之前）追加 sheet：

```tsx
<LangSheet
  open={pickerOpen !== null && !customOpen}
  showAuto={pickerOpen === 'source'}
  onPick={onPickLang}
  onPickCustom={onPickCustom}
  onClose={() => setPickerOpen(null)}
/>
<CustomLangInput
  open={customOpen}
  onSubmit={onCustomSubmit}
  onClose={() => setCustomOpen(false)}
/>
```

注意：`pickerOpen !== null && !customOpen` 让一级在二级打开时收起（视觉上更干净，避免两层叠加重复滚动）。如果觉得保留一级 mounted 更稳定，改成 `open={pickerOpen !== null}`。先按 `&& !customOpen` 试，挂了再调。

- [ ] **Step 2: 类型检查**

Run: `pnpm tsc --noEmit`
Expected: 通过

- [ ] **Step 3: 跑沙箱 smoke 重测**

Run: `pnpm vitest run src/platform/userApp/__tests__/translate.sandbox.test.ts`
Expected: 2/2 PASS（现有测试不依赖 sheet 行为，只测翻译流程）

- [ ] **Step 4: Commit**

```bash
git add src/apps/translate/TranslateApp.tsx
git commit -m "feat(translate): wire LangSheet + CustomLangInput into TranslateApp"
```

---

### Task 4: 沙箱端到端 smoke — 选语种 → 翻译

**Files:**
- Modify: `src/platform/userApp/__tests__/translate.sandbox.test.ts`

新增一条测试：打开源语种 sheet → 选 "中文" → 输入 → 翻译 → 检查 prompt 用了"中文"作为源语言。

- [ ] **Step 1: 加测试 case**

在 `describe('translate user-app — sandbox smoke', () => { ... })` 内末尾追加：

```ts
it('opening source picker → choosing 中文 → translating uses 中文 as source', async () => {
  completeMock.mockResolvedValueOnce('Hello');
  await mountBuiltinUserApps();
  const entry = appRegistry.get('translate')!;
  render(React.createElement(entry.component));

  // Default source is "自动检测"; tap to open picker, pick 中文.
  fireEvent.click(screen.getByLabelText(/源语言/));
  // The picker is now open — find the curated 中文 row and click it.
  // Multiple rows may share the substring "中" — use exact native text.
  fireEvent.click(screen.getByText('中文'));

  fireEvent.change(screen.getByPlaceholderText(/输入要翻译的文本/), {
    target: { value: '你好' },
  });
  fireEvent.click(screen.getByRole('button', { name: '翻译' }));

  expect(completeMock).toHaveBeenCalledTimes(1);
  const messages = completeMock.mock.calls[0][0];
  // System prompt should contain "中文" as the source language name.
  expect(messages[0].content).toContain('中文');
  expect(messages[0].content).not.toContain('Detect the source language automatically.');
  cleanup();
});

it('custom language flow: 自定义 → 输入 Klingon → 翻译用 Klingon 作为源', async () => {
  completeMock.mockResolvedValueOnce('Qapla\'!');
  await mountBuiltinUserApps();
  const entry = appRegistry.get('translate')!;
  render(React.createElement(entry.component));

  fireEvent.click(screen.getByLabelText(/源语言/));
  fireEvent.click(screen.getByText(/自定义/));
  // Two-stage drawer — input is now visible.
  const input = screen.getByPlaceholderText(/古希腊语|文言文|输入语种/) as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'Klingon' } });
  fireEvent.click(screen.getByText('确认'));

  fireEvent.change(screen.getByPlaceholderText(/输入要翻译的文本/), {
    target: { value: 'hello' },
  });
  fireEvent.click(screen.getByRole('button', { name: '翻译' }));

  expect(completeMock).toHaveBeenCalledTimes(1);
  const messages = completeMock.mock.calls[0][0];
  expect(messages[0].content).toContain('Klingon');
  cleanup();
});
```

- [ ] **Step 2: 跑测试**

Run: `pnpm vitest run src/platform/userApp/__tests__/translate.sandbox.test.ts`
Expected: 4/4 PASS

可能踩坑：
- `getByLabelText(/源语言/)` 匹配 LangBar 那两个 `aria-label` 包含 "源语言 ${name}" 的按钮。如果同时匹配多个（unlikely 因为 aria-label 文本不同），用 first match 或更精确的 regex。
- AnimatePresence enter 在 jsdom 下是同步的（initial → animate 立刻提交），所以测试不需要 `waitFor`。如果挂在"找不到 sheet 内的按钮"，加一行 `await screen.findByText('English')` 缓冲一帧。

- [ ] **Step 3: Commit**

```bash
git add src/platform/userApp/__tests__/translate.sandbox.test.ts
git commit -m "test(translate): sandbox smoke — sheet pick + custom language flows"
```

---

### Task 5: 文档收尾 + 全量验证

- [ ] **Step 1: 跑全部测试**

Run: `pnpm vitest run`
Expected: 全 PASS（应有 ~13 个新测）

- [ ] **Step 2: 跑生产构建 + Sucrase 验证**

Run: `pnpm build && node scripts/check-sucrase-in-prod.mjs`
Expected: build 成功 + Sucrase OK。bundle 增量应在 ~5KB 内（两个组件 + 几个 motion 调用）。

- [ ] **Step 3: 在 `src/apps/translate/CLAUDE.md` 末尾追加 S4 备注**

```markdown
## S4：sheet 接线
- LangSheet：精选 10 + auto + 自定义入口；点击行 → onPick 回调；点击 backdrop → onClose
- CustomLangInput：二级抽屉，构造 `{ code: 'custom:<text>', ... }` Language，code 前缀供 S5 历史区分
- 关闭手势 deferred：M2 SheetGesture 是 system 层，沙箱拿不到；点击 backdrop / 取消按钮已经够 iOS-fidelity
```

- [ ] **Step 4: Commit**

```bash
git add src/apps/translate/CLAUDE.md
git commit -m "docs(translate): record S4 — sheet wiring + custom language entry"
```

---

## Self-Review

**Spec 覆盖：**
- §2.3 A+C 语种 → Task 1 LangSheet + Task 2 CustomLangInput ✓
- §3.7 选语种动效（y 100% → 0 + snappy）→ Task 1/2 motion 设置 ✓
- §3.7 自定义二级抽屉 → Task 2 ✓
- §3.5 自由输入语种直接塞 prompt → Task 4 sandbox smoke 验证 ✓

**Placeholder 扫描：** 没有 TODO / TBD ✓

**类型一致性：**
- `Language.code = 'custom:<text>'` 在 Task 2/4 一致 ✓
- LangSheet props (`open/showAuto/onPick/onPickCustom/onClose`) 在 Task 1/3 一致 ✓
- CustomLangInput props (`open/onSubmit/onClose`) 在 Task 2/3 一致 ✓

**已知局限：**
- 不实现下滑关闭 sheet 手势（M2 SheetGesture 是 system 层）
- 自定义语种不持久化（S5 接 storage 后历史/收藏会带）

---

## 执行选择

S4 plan 写好。直接交给 implementer subagent 跑。
