# API 预设系统 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户在 AI 服务设置页保存任意多套命名预设（provider + apiKey + apiEndpoint + model + fetchedModels），并通过顶部切换器一键切换；自动迁移已有配置。

**Architecture:** `aiConfigStore` 持久化结构升级到 v2，新增 `presets[]` 与 `activePresetId`；同时**保留**现有顶层连接字段（`apiKey/apiEndpoint/model/provider/fetchedModels`）作为激活预设的镜像，setter 一并写到预设和镜像 —— 这样 6+ 个外部消费者（heartbeatAgent、aiChatEngine、userApp/sdk/ai 等）零改动。AI 服务页顶部新增预设行 + 底部 sheet（沿用 MusicShareSheet 的 motion 模式），独立 `AIPresetsPage` 提供管理（重命名 / 右滑删除 / 新建空预设）。

**Tech Stack:** TypeScript + React + Zustand persist (v2 migrate) + motion/react + lucide-react + Vitest + jsdom。

**Spec:** `docs/superpowers/specs/2026-05-01-api-presets-design.md`

**关键文件清单：**

| 类型 | 路径 | 责任 |
|------|------|------|
| 改造 | `src/platform/stores/aiConfigStore.ts` | 数据模型 + migrate + 预设 CRUD + setter 写穿 |
| 新建 | `src/platform/stores/__tests__/aiConfigStore.test.ts` | store 单测（项目内目前没有，新建）|
| 改造 | `src/apps/Settings/settingsNavStore.ts` | 加 `'aiPresets'` 页 key |
| 改造 | `src/apps/Settings/SettingsApp.tsx` | 注册新页面 + 标题 |
| 改造 | `src/apps/Settings/pages/AIServicePage.tsx` | 顶部预设行 + sheet 唤起 |
| 新建 | `src/apps/Settings/pages/AIPresetsPage.tsx` | 预设管理页 |
| 新建 | `src/apps/Settings/pages/PresetSwitcherSheet.tsx` | 底部切换 sheet |
| 新建 | `src/apps/Settings/pages/__tests__/AIPresetsPage.test.tsx` | 管理页单测 |
| 新建 | `src/apps/Settings/pages/__tests__/AIServicePage.test.tsx` | 服务页预设行单测 |

**说明 — 命名 / 重命名 UI 模式：** 项目已有惯例使用 `window.confirm()`（见 `WorldBookEditPage`、`GroupSettings` 等）。预设的命名 / 重命名延续这个简单原则用 `window.prompt()`，jsdom 下测试用 `vi.spyOn(window, 'prompt')` mock。

---

## Task 1: 在 aiConfigStore 增加 ApiPreset 类型与新 state 字段（不改行为）

**Files:**
- Modify: `src/platform/stores/aiConfigStore.ts`
- Test: `src/platform/stores/__tests__/aiConfigStore.test.ts` (CREATE)

- [ ] **Step 1: 写失败测试**

`src/platform/stores/__tests__/aiConfigStore.test.ts`：

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAIConfigStore, type ApiPreset } from '../aiConfigStore';

function resetStore() {
  // Hard-reset persisted state and store; tests run in jsdom with fake idb
  useAIConfigStore.setState((s) => ({
    ...s,
    presets: [],
    activePresetId: '',
  }));
}

describe('aiConfigStore — preset state shape', () => {
  beforeEach(resetStore);

  it('exposes presets array and activePresetId', () => {
    const s = useAIConfigStore.getState();
    expect(Array.isArray(s.presets)).toBe(true);
    expect(typeof s.activePresetId).toBe('string');
  });

  it('ApiPreset has expected keys', () => {
    const sample: ApiPreset = {
      id: 'p1',
      name: 'demo',
      provider: 'openrouter',
      apiKey: 'k',
      apiEndpoint: '',
      model: '',
      fetchedModels: [],
    };
    expect(Object.keys(sample).sort()).toEqual(
      ['apiEndpoint', 'apiKey', 'fetchedModels', 'id', 'model', 'name', 'provider'].sort(),
    );
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts
```

Expected: FAIL — `ApiPreset` 未导出，`presets`/`activePresetId` 字段不存在。

- [ ] **Step 3: 实现最小通过**

修改 `src/platform/stores/aiConfigStore.ts`：

a) 在 `ProviderConfig` 下方新增：

```ts
export interface ApiPreset {
  id: string;
  name: string;
  provider: ProviderId;
  apiKey: string;
  apiEndpoint: string;
  model: string;
  fetchedModels: ModelInfo[];
}
```

b) 在 `AIConfigState` 接口中加入（紧跟 `model: string;` 之后）：

```ts
  // Presets
  presets: ApiPreset[];
  activePresetId: string;
```

c) 在 store 默认 state 中初始化（紧跟 `model: '',` 之后）：

```ts
      presets: [],
      activePresetId: '',
```

d) 把 `presets` 与 `activePresetId` 加入 `partialize` 返回对象：

```ts
        presets: s.presets,
        activePresetId: s.activePresetId,
```

- [ ] **Step 4: 验证测试通过**

```bash
pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/platform/stores/aiConfigStore.ts src/platform/stores/__tests__/aiConfigStore.test.ts
git commit -m "feat(aiConfig): add ApiPreset type and preset state fields"
```

---

## Task 2: 实现 createEmptyPreset action

**Files:**
- Modify: `src/platform/stores/aiConfigStore.ts`
- Test: `src/platform/stores/__tests__/aiConfigStore.test.ts`

- [ ] **Step 1: 写失败测试**

在测试文件追加：

```ts
describe('createEmptyPreset', () => {
  beforeEach(resetStore);

  it('appends a new preset with empty connection fields and returns its id', () => {
    const id = useAIConfigStore.getState().createEmptyPreset('我的预设');
    const { presets } = useAIConfigStore.getState();
    expect(presets).toHaveLength(1);
    expect(presets[0]!.id).toBe(id);
    expect(presets[0]!.name).toBe('我的预设');
    expect(presets[0]!.provider).toBe('openrouter');
    expect(presets[0]!.apiKey).toBe('');
    expect(presets[0]!.apiEndpoint).toBe('');
    expect(presets[0]!.model).toBe('');
    expect(presets[0]!.fetchedModels).toEqual([]);
  });

  it('falls back to "预设 N" when name is blank', () => {
    useAIConfigStore.getState().createEmptyPreset('   ');
    const { presets } = useAIConfigStore.getState();
    expect(presets[0]!.name).toBe('预设 1');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts -t "createEmptyPreset"
```

Expected: FAIL — `createEmptyPreset` 不存在。

- [ ] **Step 3: 实现**

a) 顶部 import `uid`（注意：avoid relative paths，沿用项目 `@/` 风格）：

```ts
import { uid } from '@/platform/utils/uid';
```

b) 在 `AIConfigState` 接口的 actions 区域加：

```ts
  // Actions — presets
  createEmptyPreset: (name: string) => string;
```

c) 在 store 内实现（放在 `// ── Connection actions ──` 上方新区块 `// ── Preset actions ──`）：

```ts
      // ── Preset actions ──

      createEmptyPreset: (name) => {
        const trimmed = name.trim();
        const { presets } = get();
        const finalName = trimmed === '' ? `预设 ${presets.length + 1}` : trimmed;
        const newPreset: ApiPreset = {
          id: uid(),
          name: finalName,
          provider: 'openrouter',
          apiKey: '',
          apiEndpoint: '',
          model: '',
          fetchedModels: [],
        };
        set({ presets: [...presets, newPreset] });
        return newPreset.id;
      },
```

- [ ] **Step 4: 验证测试通过**

```bash
pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts -t "createEmptyPreset"
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/platform/stores/aiConfigStore.ts src/platform/stores/__tests__/aiConfigStore.test.ts
git commit -m "feat(aiConfig): add createEmptyPreset action"
```

---

## Task 3: 实现 setActivePreset（切换激活预设并镜像到顶层连接字段）

**Files:**
- Modify: `src/platform/stores/aiConfigStore.ts`
- Test: `src/platform/stores/__tests__/aiConfigStore.test.ts`

**关键约束**：保持顶层 `apiKey/apiEndpoint/model/provider/fetchedModels` 与激活预设同步，让外部消费者无感知。

- [ ] **Step 1: 写失败测试**

```ts
describe('setActivePreset', () => {
  beforeEach(resetStore);

  it('mirrors active preset fields onto top-level state', () => {
    // Bootstrap: create a preset and set its fields directly
    const id = useAIConfigStore.getState().createEmptyPreset('A');
    useAIConfigStore.setState((s) => ({
      ...s,
      presets: s.presets.map((p) =>
        p.id === id
          ? { ...p, provider: 'siliconflow', apiKey: 'k1', apiEndpoint: 'https://api.example', model: 'm1', fetchedModels: [] }
          : p,
      ),
    }));

    useAIConfigStore.getState().setActivePreset(id);

    const s = useAIConfigStore.getState();
    expect(s.activePresetId).toBe(id);
    expect(s.provider).toBe('siliconflow');
    expect(s.apiKey).toBe('k1');
    expect(s.apiEndpoint).toBe('https://api.example');
    expect(s.model).toBe('m1');
    expect(s.fetchedModels).toEqual([]);
  });

  it('clears transient model-list error/loading on switch', () => {
    const id = useAIConfigStore.getState().createEmptyPreset('A');
    useAIConfigStore.setState((s) => ({ ...s, modelListError: 'old err', modelListLoading: true }));
    useAIConfigStore.getState().setActivePreset(id);
    const s = useAIConfigStore.getState();
    expect(s.modelListError).toBeNull();
    expect(s.modelListLoading).toBe(false);
  });

  it('does nothing if id does not exist', () => {
    useAIConfigStore.getState().createEmptyPreset('A');
    const before = useAIConfigStore.getState().activePresetId;
    useAIConfigStore.getState().setActivePreset('nonexistent');
    expect(useAIConfigStore.getState().activePresetId).toBe(before);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts -t "setActivePreset"
```

Expected: FAIL — `setActivePreset` 不存在。

- [ ] **Step 3: 实现**

a) 在 `AIConfigState` 接口的 preset actions 区加：

```ts
  setActivePreset: (id: string) => void;
```

b) 在 store 实现：

```ts
      setActivePreset: (id) => {
        const { presets } = get();
        const target = presets.find((p) => p.id === id);
        if (!target) return;
        set({
          activePresetId: id,
          provider: target.provider,
          apiKey: target.apiKey,
          apiEndpoint: target.apiEndpoint,
          model: target.model,
          fetchedModels: target.fetchedModels,
          modelListError: null,
          modelListLoading: false,
        });
      },
```

- [ ] **Step 4: 验证测试通过**

```bash
pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts -t "setActivePreset"
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/platform/stores/aiConfigStore.ts src/platform/stores/__tests__/aiConfigStore.test.ts
git commit -m "feat(aiConfig): add setActivePreset that mirrors fields to top-level"
```

---

## Task 4: 实现 createPresetFromCurrent（用当前激活预设字段快照成新预设）

**Files:**
- Modify: `src/platform/stores/aiConfigStore.ts`
- Test: `src/platform/stores/__tests__/aiConfigStore.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
describe('createPresetFromCurrent', () => {
  beforeEach(resetStore);

  it('snapshots current top-level fields into a new preset and switches active', () => {
    const aId = useAIConfigStore.getState().createEmptyPreset('A');
    useAIConfigStore.setState((s) => ({
      ...s,
      presets: s.presets.map((p) =>
        p.id === aId ? { ...p, apiKey: 'k1', model: 'm1' } : p,
      ),
    }));
    useAIConfigStore.getState().setActivePreset(aId);

    const newId = useAIConfigStore.getState().createPresetFromCurrent('副本');
    const s = useAIConfigStore.getState();
    expect(s.presets).toHaveLength(2);
    const copy = s.presets.find((p) => p.id === newId)!;
    expect(copy.name).toBe('副本');
    expect(copy.apiKey).toBe('k1');
    expect(copy.model).toBe('m1');
    expect(s.activePresetId).toBe(newId);
    // Original untouched
    expect(s.presets.find((p) => p.id === aId)!.apiKey).toBe('k1');
  });

  it('uses fallback name when blank', () => {
    useAIConfigStore.getState().createEmptyPreset('A'); // presets.length will be 1 before snapshot
    useAIConfigStore.getState().setActivePreset(useAIConfigStore.getState().presets[0]!.id);
    useAIConfigStore.getState().createPresetFromCurrent('  ');
    const s = useAIConfigStore.getState();
    // After snapshot length is 2; fallback computed at action time uses pre-add length+1 = 2
    expect(s.presets[1]!.name).toBe('预设 2');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts -t "createPresetFromCurrent"
```

Expected: FAIL — action 不存在。

- [ ] **Step 3: 实现**

a) 接口：

```ts
  createPresetFromCurrent: (name: string) => string;
```

b) 实现：

```ts
      createPresetFromCurrent: (name) => {
        const trimmed = name.trim();
        const { presets, provider, apiKey, apiEndpoint, model, fetchedModels } = get();
        const finalName = trimmed === '' ? `预设 ${presets.length + 1}` : trimmed;
        const newPreset: ApiPreset = {
          id: uid(),
          name: finalName,
          provider,
          apiKey,
          apiEndpoint,
          model,
          fetchedModels,
        };
        set({
          presets: [...presets, newPreset],
          activePresetId: newPreset.id,
        });
        return newPreset.id;
      },
```

- [ ] **Step 4: 验证**

```bash
pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts -t "createPresetFromCurrent"
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -u
git commit -m "feat(aiConfig): add createPresetFromCurrent snapshot action"
```

---

## Task 5: 实现 renamePreset

**Files:**
- Modify: `src/platform/stores/aiConfigStore.ts`
- Test: `src/platform/stores/__tests__/aiConfigStore.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
describe('renamePreset', () => {
  beforeEach(resetStore);

  it('updates name', () => {
    const id = useAIConfigStore.getState().createEmptyPreset('A');
    useAIConfigStore.getState().renamePreset(id, '新名字');
    expect(useAIConfigStore.getState().presets[0]!.name).toBe('新名字');
  });

  it('falls back to "预设 N" for blank name', () => {
    const id = useAIConfigStore.getState().createEmptyPreset('A');
    useAIConfigStore.getState().renamePreset(id, '   ');
    // List has 1 preset; N = length = 1
    expect(useAIConfigStore.getState().presets[0]!.name).toBe('预设 1');
  });

  it('no-op for unknown id', () => {
    useAIConfigStore.getState().createEmptyPreset('A');
    expect(() => useAIConfigStore.getState().renamePreset('nope', 'X')).not.toThrow();
    expect(useAIConfigStore.getState().presets[0]!.name).toBe('A');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts -t "renamePreset"
```

Expected: FAIL。

- [ ] **Step 3: 实现**

a) 接口：

```ts
  renamePreset: (id: string, name: string) => void;
```

b) 实现：

```ts
      renamePreset: (id, name) => {
        const { presets } = get();
        if (!presets.some((p) => p.id === id)) return;
        const trimmed = name.trim();
        const finalName = trimmed === '' ? `预设 ${presets.length}` : trimmed;
        set({
          presets: presets.map((p) => (p.id === id ? { ...p, name: finalName } : p)),
        });
      },
```

- [ ] **Step 4: 验证**

```bash
pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts -t "renamePreset"
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -u
git commit -m "feat(aiConfig): add renamePreset action"
```

---

## Task 6: 实现 deletePreset（含删激活自动切换、剩 1 个时拒绝）

**Files:**
- Modify: `src/platform/stores/aiConfigStore.ts`
- Test: `src/platform/stores/__tests__/aiConfigStore.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
describe('deletePreset', () => {
  beforeEach(resetStore);

  it('deletes a non-active preset', () => {
    const aId = useAIConfigStore.getState().createEmptyPreset('A');
    const bId = useAIConfigStore.getState().createEmptyPreset('B');
    useAIConfigStore.getState().setActivePreset(aId);
    expect(useAIConfigStore.getState().deletePreset(bId)).toBe(true);
    expect(useAIConfigStore.getState().presets.map((p) => p.id)).toEqual([aId]);
    expect(useAIConfigStore.getState().activePresetId).toBe(aId);
  });

  it('switches to next preset when deleting active', () => {
    const aId = useAIConfigStore.getState().createEmptyPreset('A');
    const bId = useAIConfigStore.getState().createEmptyPreset('B');
    useAIConfigStore.getState().setActivePreset(aId);
    useAIConfigStore.getState().deletePreset(aId);
    expect(useAIConfigStore.getState().activePresetId).toBe(bId);
  });

  it('switches to previous preset when deleting active and no next exists', () => {
    const aId = useAIConfigStore.getState().createEmptyPreset('A');
    const bId = useAIConfigStore.getState().createEmptyPreset('B');
    useAIConfigStore.getState().setActivePreset(bId);
    useAIConfigStore.getState().deletePreset(bId);
    expect(useAIConfigStore.getState().activePresetId).toBe(aId);
  });

  it('refuses to delete the last preset and returns false', () => {
    const id = useAIConfigStore.getState().createEmptyPreset('A');
    useAIConfigStore.getState().setActivePreset(id);
    expect(useAIConfigStore.getState().deletePreset(id)).toBe(false);
    expect(useAIConfigStore.getState().presets).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts -t "deletePreset"
```

Expected: FAIL。

- [ ] **Step 3: 实现**

a) 接口：

```ts
  deletePreset: (id: string) => boolean;
```

b) 实现：

```ts
      deletePreset: (id) => {
        const { presets, activePresetId } = get();
        if (presets.length <= 1) return false;
        const idx = presets.findIndex((p) => p.id === id);
        if (idx === -1) return false;
        const next = presets.filter((p) => p.id !== id);
        // If deleting active preset, switch to next-or-previous
        if (id === activePresetId) {
          const fallback = next[idx] ?? next[idx - 1] ?? next[0]!;
          set({
            presets: next,
            activePresetId: fallback.id,
            provider: fallback.provider,
            apiKey: fallback.apiKey,
            apiEndpoint: fallback.apiEndpoint,
            model: fallback.model,
            fetchedModels: fallback.fetchedModels,
            modelListError: null,
            modelListLoading: false,
          });
        } else {
          set({ presets: next });
        }
        return true;
      },
```

- [ ] **Step 4: 验证**

```bash
pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts -t "deletePreset"
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -u
git commit -m "feat(aiConfig): add deletePreset with auto-switch fallback"
```

---

## Task 7: 让 setApiKey / setApiEndpoint / setModel 写穿到激活预设

**Files:**
- Modify: `src/platform/stores/aiConfigStore.ts`
- Test: `src/platform/stores/__tests__/aiConfigStore.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
describe('setApiKey/Endpoint/Model write through to active preset', () => {
  beforeEach(resetStore);

  it('setApiKey updates active preset and top-level mirror', () => {
    const id = useAIConfigStore.getState().createEmptyPreset('A');
    useAIConfigStore.getState().setActivePreset(id);
    useAIConfigStore.getState().setApiKey('NEW');
    const s = useAIConfigStore.getState();
    expect(s.apiKey).toBe('NEW');
    expect(s.presets[0]!.apiKey).toBe('NEW');
  });

  it('setApiEndpoint write-through', () => {
    const id = useAIConfigStore.getState().createEmptyPreset('A');
    useAIConfigStore.getState().setActivePreset(id);
    useAIConfigStore.getState().setApiEndpoint('https://x');
    expect(useAIConfigStore.getState().presets[0]!.apiEndpoint).toBe('https://x');
  });

  it('setModel write-through', () => {
    const id = useAIConfigStore.getState().createEmptyPreset('A');
    useAIConfigStore.getState().setActivePreset(id);
    useAIConfigStore.getState().setModel('gpt-4o');
    expect(useAIConfigStore.getState().presets[0]!.model).toBe('gpt-4o');
  });

  it('only modifies active preset, leaves others intact', () => {
    const aId = useAIConfigStore.getState().createEmptyPreset('A');
    const bId = useAIConfigStore.getState().createEmptyPreset('B');
    useAIConfigStore.getState().setActivePreset(aId);
    useAIConfigStore.getState().setApiKey('only-A');
    const bPreset = useAIConfigStore.getState().presets.find((p) => p.id === bId)!;
    expect(bPreset.apiKey).toBe('');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts -t "write through to active preset"
```

Expected: FAIL — 现行 setter 只改顶层。

- [ ] **Step 3: 实现**

替换 `setApiKey` / `setApiEndpoint` / `setModel`：

```ts
      setApiKey: (k) => {
        const { activePresetId, presets } = get();
        set({
          apiKey: k,
          presets: presets.map((p) => (p.id === activePresetId ? { ...p, apiKey: k } : p)),
        });
      },
      setApiEndpoint: (url) => {
        const { activePresetId, presets } = get();
        set({
          apiEndpoint: url,
          presets: presets.map((p) => (p.id === activePresetId ? { ...p, apiEndpoint: url } : p)),
        });
      },
      setModel: (m) => {
        const { activePresetId, presets } = get();
        set({
          model: m,
          presets: presets.map((p) => (p.id === activePresetId ? { ...p, model: m } : p)),
        });
      },
```

- [ ] **Step 4: 验证**

```bash
pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts -t "write through to active preset"
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -u
git commit -m "refactor(aiConfig): route setApiKey/Endpoint/Model through active preset"
```

---

## Task 8: 重写 setProvider，去掉 providerConfigs 自动切换逻辑

**Files:**
- Modify: `src/platform/stores/aiConfigStore.ts`
- Test: `src/platform/stores/__tests__/aiConfigStore.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
describe('setProvider write through', () => {
  beforeEach(resetStore);

  it('writes provider into active preset, does not touch other presets', () => {
    const aId = useAIConfigStore.getState().createEmptyPreset('A');
    const bId = useAIConfigStore.getState().createEmptyPreset('B');
    useAIConfigStore.getState().setActivePreset(aId);
    useAIConfigStore.getState().setProvider('siliconflow');
    const s = useAIConfigStore.getState();
    expect(s.provider).toBe('siliconflow');
    expect(s.presets.find((p) => p.id === aId)!.provider).toBe('siliconflow');
    expect(s.presets.find((p) => p.id === bId)!.provider).toBe('openrouter');
  });

  it('no longer references providerConfigs', () => {
    // providerConfigs field is gone from state
    const s = useAIConfigStore.getState() as Record<string, unknown>;
    expect(s.providerConfigs).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts -t "setProvider write through"
```

Expected: FAIL。

- [ ] **Step 3: 实现**

a) 替换 `setProvider`：

```ts
      setProvider: (p) => {
        const { activePresetId, presets } = get();
        set({
          provider: p,
          presets: presets.map((pr) => (pr.id === activePresetId ? { ...pr, provider: p } : pr)),
          modelListError: null,
        });
      },
```

b) 从 `AIConfigState` 接口移除 `providerConfigs: Record<string, ProviderConfig>;`

c) 从默认 state 移除 `providerConfigs: {},`

d) 从 `partialize` 移除 `providerConfigs: s.providerConfigs,`

e) 删除文件中孤立的 `ProviderConfig` interface（如果不再被引用 — 用 grep 确认后再删）：

```bash
grep -rn "ProviderConfig" src --include="*.ts" --include="*.tsx"
```

如果只剩 `aiConfigStore.ts` 自己导出，删 `ProviderConfig` 定义和 `export`。

- [ ] **Step 4: 验证**

```bash
pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts
pnpm typecheck
```

Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add -u
git commit -m "refactor(aiConfig): drop providerConfigs, route setProvider through active preset"
```

---

## Task 9: 让 fetchModels 把结果写入激活预设

**Files:**
- Modify: `src/platform/stores/aiConfigStore.ts`
- Test: `src/platform/stores/__tests__/aiConfigStore.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { vi } from 'vitest';
import * as providers from '@/platform/ai/providers';

describe('fetchModels persists to active preset', () => {
  beforeEach(resetStore);

  it('updates active preset fetchedModels when fetch succeeds', async () => {
    const id = useAIConfigStore.getState().createEmptyPreset('A');
    useAIConfigStore.getState().setActivePreset(id);
    const fakeModels = [{ id: 'm1', name: 'Model 1', contextLength: 4096 }];
    const adapter = providers.getAdapter('openrouter')!;
    const spy = vi.spyOn(adapter, 'fetchModels').mockResolvedValue(fakeModels);

    await useAIConfigStore.getState().fetchModels();
    const s = useAIConfigStore.getState();
    expect(s.fetchedModels).toEqual(fakeModels);
    expect(s.presets.find((p) => p.id === id)!.fetchedModels).toEqual(fakeModels);

    spy.mockRestore();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts -t "fetchModels persists"
```

Expected: FAIL — 现行 fetchModels 只写顶层。

- [ ] **Step 3: 实现**

替换 `fetchModels` 函数体内的 `set({ fetchedModels: models, modelListLoading: false });` 为：

```ts
          const { activePresetId, presets } = get();
          set({
            fetchedModels: models,
            modelListLoading: false,
            presets: presets.map((p) =>
              p.id === activePresetId ? { ...p, fetchedModels: models } : p,
            ),
          });
```

- [ ] **Step 4: 验证**

```bash
pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts -t "fetchModels persists"
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -u
git commit -m "refactor(aiConfig): persist fetched models into active preset"
```

---

## Task 10: 持久化迁移（v1 → v2）+ 启动 bootstrap 兜底

**Files:**
- Modify: `src/platform/stores/aiConfigStore.ts`
- Test: `src/platform/stores/__tests__/aiConfigStore.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { migrateToV2, ensureAtLeastOnePreset } from '../aiConfigStore';

describe('persisted state migration v1 → v2', () => {
  it('builds a "默认" preset from top-level fields', () => {
    const persisted = {
      provider: 'openrouter',
      apiKey: 'sk-x',
      apiEndpoint: 'https://or.example',
      model: 'claude',
      fetchedModels: [{ id: 'claude', name: 'C' }],
    };
    const result = migrateToV2(persisted);
    expect(result.presets).toHaveLength(1);
    expect(result.presets[0]!.name).toBe('默认');
    expect(result.presets[0]!.apiKey).toBe('sk-x');
    expect(result.activePresetId).toBe(result.presets[0]!.id);
    // Top-level fields preserved (mirrors)
    expect(result.apiKey).toBe('sk-x');
    expect(result.fetchedModels).toEqual([{ id: 'claude', name: 'C' }]);
    // Old field removed
    expect((result as Record<string, unknown>).providerConfigs).toBeUndefined();
  });

  it('expands providerConfigs entries into separate presets', () => {
    const persisted = {
      provider: 'openrouter',
      apiKey: 'sk-or',
      apiEndpoint: '',
      model: 'm-or',
      fetchedModels: [],
      providerConfigs: {
        siliconflow: { apiKey: 'sk-sf', apiEndpoint: '', model: 'm-sf', fetchedModels: [] },
      },
    };
    const result = migrateToV2(persisted);
    expect(result.presets).toHaveLength(2);
    const orPreset = result.presets.find((p) => p.provider === 'openrouter')!;
    const sfPreset = result.presets.find((p) => p.provider === 'siliconflow')!;
    expect(orPreset.apiKey).toBe('sk-or');
    expect(sfPreset.apiKey).toBe('sk-sf');
    expect(result.activePresetId).toBe(orPreset.id);
  });

  it('creates an empty "预设 1" for fully blank state', () => {
    const persisted = {};
    const result = migrateToV2(persisted);
    expect(result.presets).toHaveLength(1);
    expect(result.presets[0]!.name).toBe('预设 1');
    expect(result.presets[0]!.apiKey).toBe('');
    expect(result.activePresetId).toBe(result.presets[0]!.id);
  });

  it('passes through state already on v2 (idempotent)', () => {
    const v2 = {
      presets: [{ id: 'x', name: 'A', provider: 'openrouter', apiKey: 'k', apiEndpoint: '', model: '', fetchedModels: [] }],
      activePresetId: 'x',
    };
    const result = migrateToV2(v2);
    expect(result.presets).toEqual(v2.presets);
    expect(result.activePresetId).toBe('x');
  });
});

describe('ensureAtLeastOnePreset', () => {
  it('adds an empty "预设 1" when presets is empty', () => {
    const out = ensureAtLeastOnePreset({ presets: [], activePresetId: '' });
    expect(out.presets).toHaveLength(1);
    expect(out.activePresetId).toBe(out.presets[0]!.id);
  });

  it('is a no-op when at least one preset exists and active id is valid', () => {
    const seed = { presets: [{ id: 'a', name: 'A', provider: 'openrouter', apiKey: '', apiEndpoint: '', model: '', fetchedModels: [] }], activePresetId: 'a' };
    expect(ensureAtLeastOnePreset(seed)).toBe(seed);
  });

  it('repoints activePresetId to first preset if it dangles', () => {
    const seed = { presets: [{ id: 'a', name: 'A', provider: 'openrouter', apiKey: '', apiEndpoint: '', model: '', fetchedModels: [] }], activePresetId: 'missing' };
    const out = ensureAtLeastOnePreset(seed);
    expect(out.activePresetId).toBe('a');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts -t "migration\|ensureAtLeastOnePreset"
```

Expected: FAIL — `migrateToV2` 与 `ensureAtLeastOnePreset` 未导出。

- [ ] **Step 3: 实现**

a) 在 store 文件最末尾（`export type` 之后）追加导出函数：

```ts
// ── Migration helpers (exported for tests) ──

type LegacyProviderConfig = {
  apiKey?: string;
  apiEndpoint?: string;
  model?: string;
  fetchedModels?: ModelInfo[];
};

type LegacyPersisted = {
  provider?: ProviderId;
  apiKey?: string;
  apiEndpoint?: string;
  model?: string;
  fetchedModels?: ModelInfo[];
  providerConfigs?: Record<string, LegacyProviderConfig>;
  presets?: ApiPreset[];
  activePresetId?: string;
};

export function migrateToV2(persisted: LegacyPersisted): LegacyPersisted & {
  presets: ApiPreset[];
  activePresetId: string;
} {
  // Idempotent — already v2
  if (Array.isArray(persisted.presets) && persisted.presets.length > 0 && persisted.activePresetId) {
    return persisted as LegacyPersisted & { presets: ApiPreset[]; activePresetId: string };
  }

  const presets: ApiPreset[] = [];
  let activeId = '';

  const hasTopLevel =
    !!persisted.apiKey || !!persisted.model || !!persisted.apiEndpoint || !!persisted.provider;
  if (hasTopLevel) {
    const main: ApiPreset = {
      id: uid(),
      name: '默认',
      provider: (persisted.provider ?? 'openrouter') as ProviderId,
      apiKey: persisted.apiKey ?? '',
      apiEndpoint: persisted.apiEndpoint ?? '',
      model: persisted.model ?? '',
      fetchedModels: persisted.fetchedModels ?? [],
    };
    presets.push(main);
    activeId = main.id;
  }

  if (persisted.providerConfigs) {
    for (const [providerId, cfg] of Object.entries(persisted.providerConfigs)) {
      if (providerId === persisted.provider) continue; // already covered by main
      const isEmpty = !cfg.apiKey && !cfg.model && !cfg.apiEndpoint;
      if (isEmpty) continue;
      presets.push({
        id: uid(),
        name: `默认 - ${providerId}`,
        provider: providerId as ProviderId,
        apiKey: cfg.apiKey ?? '',
        apiEndpoint: cfg.apiEndpoint ?? '',
        model: cfg.model ?? '',
        fetchedModels: cfg.fetchedModels ?? [],
      });
    }
  }

  if (presets.length === 0) {
    const empty: ApiPreset = {
      id: uid(),
      name: '预设 1',
      provider: 'openrouter',
      apiKey: '',
      apiEndpoint: '',
      model: '',
      fetchedModels: [],
    };
    presets.push(empty);
    activeId = empty.id;
  }

  // Drop legacy field
  const cleaned = { ...persisted } as LegacyPersisted;
  delete cleaned.providerConfigs;

  // Mirror the active preset onto top-level (so consumers can read directly)
  const active = presets.find((p) => p.id === activeId)!;
  return {
    ...cleaned,
    presets,
    activePresetId: activeId,
    provider: active.provider,
    apiKey: active.apiKey,
    apiEndpoint: active.apiEndpoint,
    model: active.model,
    fetchedModels: active.fetchedModels,
  };
}

export function ensureAtLeastOnePreset<T extends { presets: ApiPreset[]; activePresetId: string }>(state: T): T {
  if (state.presets.length === 0) {
    const seed: ApiPreset = {
      id: uid(),
      name: '预设 1',
      provider: 'openrouter',
      apiKey: '',
      apiEndpoint: '',
      model: '',
      fetchedModels: [],
    };
    return { ...state, presets: [seed], activePresetId: seed.id };
  }
  if (!state.presets.some((p) => p.id === state.activePresetId)) {
    return { ...state, activePresetId: state.presets[0]!.id };
  }
  return state;
}
```

b) 把 `version: 2 + migrate + onRehydrateStorage` 接入 persist options：

```ts
    {
      name: 'hiPhone-ai-config',
      version: 2,
      storage: idbStorage,
      migrate: (persisted, version) => {
        if (version < 2) return migrateToV2(persisted as LegacyPersisted);
        return persisted;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const fixed = ensureAtLeastOnePreset(state);
        if (fixed !== state) {
          useAIConfigStore.setState(fixed);
          // Also mirror active preset to top-level
          const active = fixed.presets.find((p) => p.id === fixed.activePresetId)!;
          useAIConfigStore.setState({
            provider: active.provider,
            apiKey: active.apiKey,
            apiEndpoint: active.apiEndpoint,
            model: active.model,
            fetchedModels: active.fetchedModels,
          });
        }
      },
      partialize: (s) => ({ /* unchanged */ }),
    },
```

c) Store 初始 state 的兜底（同步路径，不依赖 hydrate）：在 store 创建后立即追加：

```ts
// Bootstrap: ensure at least one preset exists even before hydration completes
{
  const s = useAIConfigStore.getState();
  if (s.presets.length === 0) {
    const id = s.createEmptyPreset('预设 1');
    s.setActivePreset(id);
  }
}
```

放在 `useAIConfigStore` 定义之后，文件末尾 helper 之前。

- [ ] **Step 4: 验证**

```bash
pnpm vitest run src/platform/stores/__tests__/aiConfigStore.test.ts
pnpm typecheck
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -u
git commit -m "feat(aiConfig): add v1→v2 migration and bootstrap fallback"
```

---

## Task 11: 在 settingsNavStore 注册 'aiPresets' 页面

**Files:**
- Modify: `src/apps/Settings/settingsNavStore.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/apps/Settings/__tests__/settingsNavStore.test.ts (CREATE)
import { describe, it, expect } from 'vitest';
import { useSettingsNavStore, type SettingsPageId } from '../settingsNavStore';

describe('settingsNavStore', () => {
  it('accepts aiPresets as a page id', () => {
    const id: SettingsPageId = 'aiPresets';
    useSettingsNavStore.getState().reset();
    useSettingsNavStore.getState().push(id);
    const stack = useSettingsNavStore.getState().stack;
    expect(stack[stack.length - 1]?.page).toBe('aiPresets');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm vitest run src/apps/Settings/__tests__/settingsNavStore.test.ts
```

Expected: FAIL — `'aiPresets'` 不在 `SettingsPageId` 联合类型里，typecheck 报错。

- [ ] **Step 3: 实现**

修改 `src/apps/Settings/settingsNavStore.ts`，在 `SettingsPageId` 联合的合适位置（紧跟 `'aiSettings'` 之后）添加：

```ts
  | 'aiSettings'
  | 'aiPresets'
  | 'aiTools'
```

- [ ] **Step 4: 验证**

```bash
pnpm vitest run src/apps/Settings/__tests__/settingsNavStore.test.ts
pnpm typecheck
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -u
git commit -m "feat(settings): register aiPresets page id"
```

---

## Task 12: 创建 AIPresetsPage 骨架（列表 + 当前激活 ✓）

**Files:**
- Create: `src/apps/Settings/pages/AIPresetsPage.tsx`
- Test: `src/apps/Settings/pages/__tests__/AIPresetsPage.test.tsx` (CREATE)

- [ ] **Step 1: 写失败测试**

```tsx
// src/apps/Settings/pages/__tests__/AIPresetsPage.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AIPresetsPage } from '../AIPresetsPage';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';

function seedTwoPresets() {
  useAIConfigStore.setState((s) => ({ ...s, presets: [], activePresetId: '' }));
  const aId = useAIConfigStore.getState().createEmptyPreset('日常 OR');
  useAIConfigStore.setState((s) => ({
    ...s,
    presets: s.presets.map((p) =>
      p.id === aId ? { ...p, provider: 'openrouter', model: 'claude' } : p,
    ),
  }));
  const bId = useAIConfigStore.getState().createEmptyPreset('便宜 SF');
  useAIConfigStore.setState((s) => ({
    ...s,
    presets: s.presets.map((p) =>
      p.id === bId ? { ...p, provider: 'siliconflow', model: 'qwen' } : p,
    ),
  }));
  useAIConfigStore.getState().setActivePreset(aId);
  return { aId, bId };
}

describe('AIPresetsPage — list', () => {
  beforeEach(() => {
    seedTwoPresets();
  });

  it('renders all preset names', () => {
    render(<AIPresetsPage />);
    expect(screen.getByText('日常 OR')).toBeInTheDocument();
    expect(screen.getByText('便宜 SF')).toBeInTheDocument();
  });

  it('renders provider · model summary line', () => {
    render(<AIPresetsPage />);
    expect(screen.getByText(/openrouter.*claude/)).toBeInTheDocument();
    expect(screen.getByText(/siliconflow.*qwen/)).toBeInTheDocument();
  });

  it('marks the active preset row with data-testid', () => {
    const { aId } = seedTwoPresets();
    render(<AIPresetsPage />);
    expect(screen.getByTestId(`preset-row-${aId}`)).toHaveAttribute('data-active', 'true');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm vitest run src/apps/Settings/pages/__tests__/AIPresetsPage.test.tsx
```

Expected: FAIL — `AIPresetsPage` 不存在。

- [ ] **Step 3: 实现最小版本**

```tsx
// src/apps/Settings/pages/AIPresetsPage.tsx
import { Check } from 'lucide-react';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';

export function AIPresetsPage() {
  const presets = useAIConfigStore((s) => s.presets);
  const activeId = useAIConfigStore((s) => s.activePresetId);

  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
    >
      <div
        className="mx-4 mt-5 mb-5 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        {presets.map((p, i) => {
          const isActive = p.id === activeId;
          const isLast = i === presets.length - 1;
          return (
            <div
              key={p.id}
              data-testid={`preset-row-${p.id}`}
              data-active={isActive ? 'true' : 'false'}
              className="flex items-center gap-3 px-4"
              style={{
                minHeight: 60,
                borderBottom: isLast ? 'none' : '0.5px solid var(--color-separator)',
              }}
            >
              <div className="min-w-0 flex-1">
                <div
                  className="truncate"
                  style={{
                    fontSize: 'var(--font-size-body)',
                    color: 'var(--color-label)',
                    fontWeight: 600,
                  }}
                >
                  {p.name}
                </div>
                <div
                  className="truncate"
                  style={{
                    fontSize: 'var(--font-size-footnote)',
                    color: 'var(--color-secondaryLabel)',
                    marginTop: 2,
                  }}
                >
                  {p.provider} · {p.model || '未选择模型'}
                </div>
              </div>
              {isActive && <Check size={20} color="var(--color-systemBlue)" strokeWidth={2.5} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 验证**

```bash
pnpm vitest run src/apps/Settings/pages/__tests__/AIPresetsPage.test.tsx
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/apps/Settings/pages/AIPresetsPage.tsx src/apps/Settings/pages/__tests__/AIPresetsPage.test.tsx
git commit -m "feat(settings): add AIPresetsPage list skeleton"
```

---

## Task 13: AIPresetsPage 点击行 → window.prompt 重命名

**Files:**
- Modify: `src/apps/Settings/pages/AIPresetsPage.tsx`
- Modify: `src/apps/Settings/pages/__tests__/AIPresetsPage.test.tsx`

- [ ] **Step 1: 写失败测试**

追加到测试文件：

```tsx
import { vi } from 'vitest';
import { fireEvent } from '@testing-library/react';

describe('AIPresetsPage — rename', () => {
  beforeEach(() => seedTwoPresets());

  it('calls window.prompt and updates name on confirm', () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('新名字');
    render(<AIPresetsPage />);
    fireEvent.click(screen.getByText('日常 OR'));
    expect(promptSpy).toHaveBeenCalled();
    expect(useAIConfigStore.getState().presets[0]!.name).toBe('新名字');
    promptSpy.mockRestore();
  });

  it('no-ops on cancel (prompt returns null)', () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
    render(<AIPresetsPage />);
    fireEvent.click(screen.getByText('日常 OR'));
    expect(useAIConfigStore.getState().presets[0]!.name).toBe('日常 OR');
    promptSpy.mockRestore();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm vitest run src/apps/Settings/pages/__tests__/AIPresetsPage.test.tsx -t "rename"
```

Expected: FAIL。

- [ ] **Step 3: 实现**

把 row `<div>` 改成 `<button>` 并接 `onClick`。改动 row 的最外层：

```tsx
const renamePreset = useAIConfigStore((s) => s.renamePreset);

const handleRename = (id: string, currentName: string) => {
  const next = window.prompt('为预设命名', currentName);
  if (next === null) return;
  renamePreset(id, next);
};
```

```tsx
<button
  key={p.id}
  type="button"
  onClick={() => handleRename(p.id, p.name)}
  data-testid={`preset-row-${p.id}`}
  data-active={isActive ? 'true' : 'false'}
  className="flex w-full items-center gap-3 px-4 text-left"
  style={{ ... }}
>
```

- [ ] **Step 4: 验证**

```bash
pnpm vitest run src/apps/Settings/pages/__tests__/AIPresetsPage.test.tsx -t "rename"
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -u
git commit -m "feat(settings): tap preset row to rename via prompt"
```

---

## Task 14: AIPresetsPage 「+ 新建空预设」按钮（pop 回 AI 服务页）

**Files:**
- Modify: `src/apps/Settings/pages/AIPresetsPage.tsx`
- Modify: `src/apps/Settings/pages/__tests__/AIPresetsPage.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
import { useSettingsNavStore } from '../../settingsNavStore';

describe('AIPresetsPage — new empty preset', () => {
  beforeEach(() => {
    seedTwoPresets();
    useSettingsNavStore.getState().reset();
    useSettingsNavStore.getState().push('aiPresets');
  });

  it('creates a new preset, switches to it, and pops back', () => {
    render(<AIPresetsPage />);
    const beforeLen = useAIConfigStore.getState().presets.length;
    fireEvent.click(screen.getByTestId('preset-create-empty'));
    const after = useAIConfigStore.getState();
    expect(after.presets).toHaveLength(beforeLen + 1);
    const newPreset = after.presets[after.presets.length - 1]!;
    expect(after.activePresetId).toBe(newPreset.id);
    expect(after.apiKey).toBe(''); // mirrored
    // Nav popped back
    const stack = useSettingsNavStore.getState().stack;
    expect(stack[stack.length - 1]?.page).not.toBe('aiPresets');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm vitest run src/apps/Settings/pages/__tests__/AIPresetsPage.test.tsx -t "new empty preset"
```

Expected: FAIL — 按钮不存在。

- [ ] **Step 3: 实现**

在 `AIPresetsPage` 末尾、列表外加按钮：

```tsx
import { Plus } from 'lucide-react';
import { useSettingsNavStore } from '../settingsNavStore';

// inside component:
const createEmpty = useAIConfigStore((s) => s.createEmptyPreset);
const setActive = useAIConfigStore((s) => s.setActivePreset);
const pop = useSettingsNavStore((s) => s.pop);

const handleCreate = () => {
  const presets = useAIConfigStore.getState().presets;
  const id = createEmpty(`预设 ${presets.length + 1}`);
  setActive(id);
  pop();
};
```

JSX (在分组列表 `</div>` 之后)：

```tsx
<div className="mx-4 mb-5">
  <button
    type="button"
    data-testid="preset-create-empty"
    onClick={handleCreate}
    className="flex w-full items-center justify-center gap-2"
    style={{
      minHeight: 44,
      borderRadius: 'var(--radius-group)',
      backgroundColor: 'var(--color-tertiarySystemBackground)',
      color: 'var(--color-systemBlue)',
      fontSize: 'var(--font-size-body)',
      fontWeight: 600,
    }}
  >
    <Plus size={18} strokeWidth={2.5} />
    新建空预设
  </button>
</div>
```

- [ ] **Step 4: 验证**

```bash
pnpm vitest run src/apps/Settings/pages/__tests__/AIPresetsPage.test.tsx
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -u
git commit -m "feat(settings): AIPresetsPage adds new-empty-preset button"
```

---

## Task 15: AIPresetsPage 右滑删除（沿用 SwipeableNoteRow 模式）

**Files:**
- Modify: `src/apps/Settings/pages/AIPresetsPage.tsx`
- Modify: `src/apps/Settings/pages/__tests__/AIPresetsPage.test.tsx`

**说明：** 不抽离公共组件 — 直接内联 swipe 逻辑（参考 `src/apps/Notes/SwipeableNoteRow.tsx`）。在测试里用 `fireEvent.click` 调用暴露的删除按钮即可，不模拟 pan 手势（手势已在 Notes 测试覆盖）。

- [ ] **Step 1: 写失败测试**

```tsx
describe('AIPresetsPage — delete', () => {
  beforeEach(() => seedTwoPresets());

  it('deletes a non-active preset when delete button is clicked', () => {
    const { bId } = seedTwoPresets();
    render(<AIPresetsPage />);
    fireEvent.click(screen.getByTestId(`preset-delete-${bId}`));
    const presets = useAIConfigStore.getState().presets;
    expect(presets.find((p) => p.id === bId)).toBeUndefined();
  });

  it('hides delete button when only one preset remains', () => {
    useAIConfigStore.setState((s) => ({ ...s, presets: [], activePresetId: '' }));
    const id = useAIConfigStore.getState().createEmptyPreset('Solo');
    useAIConfigStore.getState().setActivePreset(id);
    render(<AIPresetsPage />);
    expect(screen.queryByTestId(`preset-delete-${id}`)).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm vitest run src/apps/Settings/pages/__tests__/AIPresetsPage.test.tsx -t "delete"
```

Expected: FAIL — 没有 delete 按钮。

- [ ] **Step 3: 实现**

把每个 row 改造成 `SwipeablePresetRow` —— 在文件内部直接定义一个本地组件（沿用 Notes 的 OPEN_WIDTH/threshold 结构，**省略**展开 — 直接给个简化版：用 `useState` 控制展开，`onPan` 阈值开/关，行下层放红色删除按钮）。或者更简单——先内联静态删除按钮显示在右侧（不做 swipe），后续可换成 SwipeableRow，这里先确保功能可达。

**简化路线（推荐落地速度）**：行尾追加一个 trash icon 小按钮（只在 `presets.length > 1` 时显示），点击 → 调 `deletePreset`。手势 swipe 留给后续优化。

```tsx
import { Trash2 } from 'lucide-react';

const presetCount = presets.length;
const deletePreset = useAIConfigStore((s) => s.deletePreset);

// inside row JSX, before the active checkmark:
{presetCount > 1 && (
  <button
    type="button"
    data-testid={`preset-delete-${p.id}`}
    onClick={(e) => {
      e.stopPropagation();
      if (window.confirm(`删除预设「${p.name}」？`)) deletePreset(p.id);
    }}
    className="flex flex-shrink-0 items-center justify-center"
    style={{
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255,59,48,0.12)',
    }}
  >
    <Trash2 size={16} color="var(--color-systemRed)" />
  </button>
)}
```

将 `confirm` 也 mock 掉（test 里再加一个 spy）。补充测试：

```tsx
beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());
```

- [ ] **Step 4: 验证**

```bash
pnpm vitest run src/apps/Settings/pages/__tests__/AIPresetsPage.test.tsx
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -u
git commit -m "feat(settings): AIPresetsPage adds inline delete button"
```

---

## Task 16: 把 AIPresetsPage 接入 SettingsApp 路由

**Files:**
- Modify: `src/apps/Settings/SettingsApp.tsx`

- [ ] **Step 1: 写测试**（验证页面挂载）

```ts
// src/apps/Settings/__tests__/SettingsApp.test.tsx — extend existing test if any, else create:
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsApp } from '../SettingsApp';
import { useSettingsNavStore } from '../settingsNavStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';

describe('SettingsApp — aiPresets route', () => {
  beforeEach(() => {
    useSettingsNavStore.getState().reset();
    useAIConfigStore.setState((s) => ({ ...s, presets: [], activePresetId: '' }));
    useAIConfigStore.getState().createEmptyPreset('Solo');
    useAIConfigStore.getState().setActivePreset(useAIConfigStore.getState().presets[0]!.id);
  });

  it('renders AIPresetsPage when navigating to aiPresets', () => {
    useSettingsNavStore.getState().push('aiPresets');
    render(<SettingsApp />);
    expect(screen.getByText('Solo')).toBeInTheDocument();
  });

  it('NavBar shows "预设管理" title', () => {
    useSettingsNavStore.getState().push('aiPresets');
    render(<SettingsApp />);
    expect(screen.getByText('预设管理')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm vitest run src/apps/Settings/__tests__/SettingsApp.test.tsx -t "aiPresets route"
```

Expected: FAIL — 路由未注册。

- [ ] **Step 3: 实现**

修改 `src/apps/Settings/SettingsApp.tsx`：

a) Import：

```ts
import { AIPresetsPage } from './pages/AIPresetsPage';
```

b) 在 `PAGE_TITLES` 中（紧跟 `aiSettings:` 之后）：

```ts
  aiPresets: '预设管理',
```

c) 在 `PAGE_COMPONENTS` 中（紧跟 `aiSettings:` 之后）：

```ts
  aiPresets: asPage(AIPresetsPage),
```

- [ ] **Step 4: 验证**

```bash
pnpm vitest run src/apps/Settings/__tests__/SettingsApp.test.tsx -t "aiPresets route"
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -u
git commit -m "feat(settings): wire AIPresetsPage into navigation"
```

---

## Task 17: 创建 PresetSwitcherSheet 底部弹层

**Files:**
- Create: `src/apps/Settings/pages/PresetSwitcherSheet.tsx`
- Create: `src/apps/Settings/pages/__tests__/PresetSwitcherSheet.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PresetSwitcherSheet } from '../PresetSwitcherSheet';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';

function seed() {
  useAIConfigStore.setState((s) => ({ ...s, presets: [], activePresetId: '' }));
  const a = useAIConfigStore.getState().createEmptyPreset('A');
  const b = useAIConfigStore.getState().createEmptyPreset('B');
  useAIConfigStore.getState().setActivePreset(a);
  return { a, b };
}

describe('PresetSwitcherSheet', () => {
  beforeEach(() => seed());

  it('renders all presets and active checkmark', () => {
    const { a } = seed();
    render(<PresetSwitcherSheet onClose={() => {}} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByTestId(`switcher-row-${a}`)).toHaveAttribute('data-active', 'true');
  });

  it('switches active and closes on row click', () => {
    const onClose = vi.fn();
    const { b } = seed();
    render(<PresetSwitcherSheet onClose={onClose} />);
    fireEvent.click(screen.getByTestId(`switcher-row-${b}`));
    expect(useAIConfigStore.getState().activePresetId).toBe(b);
    expect(onClose).toHaveBeenCalled();
  });

  it('"new from current" calls prompt and creates preset', () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('副本');
    const onClose = vi.fn();
    render(<PresetSwitcherSheet onClose={onClose} />);
    const beforeLen = useAIConfigStore.getState().presets.length;
    fireEvent.click(screen.getByTestId('switcher-create-from-current'));
    expect(useAIConfigStore.getState().presets).toHaveLength(beforeLen + 1);
    expect(useAIConfigStore.getState().presets.at(-1)!.name).toBe('副本');
    expect(onClose).toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('cancelling prompt does not create preset', () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
    render(<PresetSwitcherSheet onClose={() => {}} />);
    const beforeLen = useAIConfigStore.getState().presets.length;
    fireEvent.click(screen.getByTestId('switcher-create-from-current'));
    expect(useAIConfigStore.getState().presets).toHaveLength(beforeLen);
    promptSpy.mockRestore();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm vitest run src/apps/Settings/pages/__tests__/PresetSwitcherSheet.test.tsx
```

Expected: FAIL — 文件不存在。

- [ ] **Step 3: 实现**

```tsx
// src/apps/Settings/pages/PresetSwitcherSheet.tsx
import { motion } from 'motion/react';
import { Check, Plus, X } from 'lucide-react';
import { spring } from '@/platform/design-tokens/motion';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';

interface Props {
  onClose: () => void;
}

export function PresetSwitcherSheet({ onClose }: Props) {
  const presets = useAIConfigStore((s) => s.presets);
  const activeId = useAIConfigStore((s) => s.activePresetId);
  const setActive = useAIConfigStore((s) => s.setActivePreset);
  const createFromCurrent = useAIConfigStore((s) => s.createPresetFromCurrent);

  const handlePick = (id: string) => {
    setActive(id);
    onClose();
  };

  const handleCreateFromCurrent = () => {
    const name = window.prompt('为预设命名', '');
    if (name === null) return;
    createFromCurrent(name);
    onClose();
  };

  return (
    <motion.div
      className="absolute inset-0 z-[60] flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <motion.div
        className="relative mt-auto flex flex-col"
        style={{
          backgroundColor: 'var(--color-secondarySystemBackground)',
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          maxHeight: '60%',
          paddingBottom: 'var(--app-safe-bottom, 0px)',
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', ...spring.smooth }}
      >
        <div className="flex justify-center py-2">
          <div style={{ width: 36, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(120,120,128,0.3)' }} />
        </div>

        <div className="flex items-center justify-between px-4 pb-3">
          <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-label)' }}>
            切换预设
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center"
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: 'rgba(120,120,128,0.18)',
              color: 'var(--color-secondaryLabel)',
            }}
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="overflow-y-auto px-4">
          <div
            className="overflow-hidden"
            style={{
              backgroundColor: 'var(--color-tertiarySystemBackground)',
              borderRadius: 'var(--radius-group)',
            }}
          >
            {presets.map((p, i) => {
              const isActive = p.id === activeId;
              const isLast = i === presets.length - 1;
              return (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`switcher-row-${p.id}`}
                  data-active={isActive ? 'true' : 'false'}
                  onClick={() => handlePick(p.id)}
                  className="flex w-full items-center gap-3 px-4 text-left"
                  style={{
                    minHeight: 60,
                    borderBottom: isLast ? 'none' : '0.5px solid var(--color-separator)',
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate"
                      style={{
                        fontSize: 'var(--font-size-body)',
                        color: 'var(--color-label)',
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      className="truncate"
                      style={{
                        fontSize: 'var(--font-size-footnote)',
                        color: 'var(--color-secondaryLabel)',
                        marginTop: 2,
                      }}
                    >
                      {p.provider} · {p.model || '未选择模型'}
                    </div>
                  </div>
                  {isActive && <Check size={20} color="var(--color-systemBlue)" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            data-testid="switcher-create-from-current"
            onClick={handleCreateFromCurrent}
            className="mt-3 flex w-full items-center justify-center gap-2"
            style={{
              minHeight: 44,
              borderRadius: 'var(--radius-group)',
              backgroundColor: 'var(--color-tertiarySystemBackground)',
              color: 'var(--color-systemBlue)',
              fontSize: 'var(--font-size-body)',
              fontWeight: 600,
            }}
          >
            <Plus size={18} strokeWidth={2.5} />
            用当前配置新建预设
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 4: 验证**

```bash
pnpm vitest run src/apps/Settings/pages/__tests__/PresetSwitcherSheet.test.tsx
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/apps/Settings/pages/PresetSwitcherSheet.tsx src/apps/Settings/pages/__tests__/PresetSwitcherSheet.test.tsx
git commit -m "feat(settings): add PresetSwitcherSheet bottom sheet"
```

---

## Task 18: AIServicePage 顶部新增预设行 + 接入 sheet 与管理页

**Files:**
- Modify: `src/apps/Settings/pages/AIServicePage.tsx`
- Create: `src/apps/Settings/pages/__tests__/AIServicePage.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// src/apps/Settings/pages/__tests__/AIServicePage.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AIServicePage } from '../AIServicePage';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useSettingsNavStore } from '../../settingsNavStore';

function seed() {
  useAIConfigStore.setState((s) => ({ ...s, presets: [], activePresetId: '' }));
  const a = useAIConfigStore.getState().createEmptyPreset('日常 OR');
  useAIConfigStore.setState((s) => ({
    ...s,
    presets: s.presets.map((p) => (p.id === a ? { ...p, model: 'claude' } : p)),
  }));
  useAIConfigStore.getState().createEmptyPreset('便宜 SF');
  useAIConfigStore.getState().setActivePreset(a);
  return { a };
}

describe('AIServicePage — preset row', () => {
  beforeEach(() => {
    useSettingsNavStore.getState().reset();
    seed();
  });

  it('renders active preset name in the top picker', () => {
    render(<AIServicePage />);
    expect(screen.getByTestId('preset-picker-name')).toHaveTextContent('日常 OR');
  });

  it('opens switcher sheet when picker is clicked', () => {
    render(<AIServicePage />);
    fireEvent.click(screen.getByTestId('preset-picker-button'));
    expect(screen.getByText('切换预设')).toBeInTheDocument();
  });

  it('manage button pushes aiPresets', () => {
    render(<AIServicePage />);
    fireEvent.click(screen.getByTestId('preset-manage-button'));
    const stack = useSettingsNavStore.getState().stack;
    expect(stack.at(-1)?.page).toBe('aiPresets');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm vitest run src/apps/Settings/pages/__tests__/AIServicePage.test.tsx
```

Expected: FAIL — 顶部行未实现。

- [ ] **Step 3: 实现**

修改 `AIServicePage.tsx`：

a) 顶部 import 追加：

```ts
import { useState } from 'react';                       // 已 import — 跳过
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useSettingsNavStore } from '../settingsNavStore';
import { PresetSwitcherSheet } from './PresetSwitcherSheet';
```

b) 在组件函数顶部新增 state：

```ts
  const presets = useAIConfigStore((s) => s.presets);
  const activePresetId = useAIConfigStore((s) => s.activePresetId);
  const activePreset = presets.find((p) => p.id === activePresetId);
  const pushNav = useSettingsNavStore((s) => s.push);
  const [sheetOpen, setSheetOpen] = useState(false);
```

c) 在 `return (...)` 内的最顶端 (在 `{/* ── Provider Selection ── */}` 之前) 加：

```tsx
      {/* ── Preset picker ── */}
      <SectionHeader title="预设" />
      <div className="mx-4 mb-5 flex gap-2">
        <button
          type="button"
          data-testid="preset-picker-button"
          onClick={() => setSheetOpen(true)}
          className="flex flex-1 items-center gap-2 px-4 text-left"
          style={{
            minHeight: 52,
            borderRadius: 'var(--radius-group)',
            backgroundColor: 'var(--color-tertiarySystemBackground)',
          }}
        >
          <div className="min-w-0 flex-1">
            <div
              data-testid="preset-picker-name"
              className="truncate"
              style={{
                fontSize: 'var(--font-size-body)',
                color: 'var(--color-label)',
                fontWeight: 600,
              }}
            >
              {activePreset?.name ?? '未选择预设'}
            </div>
            <div
              className="truncate"
              style={{
                fontSize: 'var(--font-size-caption1)',
                color: 'var(--color-secondaryLabel)',
                marginTop: 2,
              }}
            >
              {activePreset?.provider} · {activePreset?.model || '未选择模型'}
            </div>
          </div>
          <ChevronDown size={18} color="var(--color-secondaryLabel)" />
        </button>

        <button
          type="button"
          data-testid="preset-manage-button"
          onClick={() => pushNav('aiPresets')}
          className="flex items-center justify-center"
          style={{
            width: 52,
            height: 52,
            borderRadius: 'var(--radius-group)',
            backgroundColor: 'var(--color-tertiarySystemBackground)',
            color: 'var(--color-secondaryLabel)',
          }}
        >
          <MoreHorizontal size={20} />
        </button>
      </div>
```

d) 在 return 的最后（外层 div 之内、`{/* Bottom spacer */}` 之前或之后）加：

```tsx
      <AnimatePresence>
        {sheetOpen && <PresetSwitcherSheet onClose={() => setSheetOpen(false)} />}
      </AnimatePresence>
```

- [ ] **Step 4: 验证**

```bash
pnpm vitest run src/apps/Settings/pages/__tests__/AIServicePage.test.tsx
pnpm typecheck
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/apps/Settings/pages/AIServicePage.tsx src/apps/Settings/pages/__tests__/AIServicePage.test.tsx
git commit -m "feat(settings): add preset picker row to AIServicePage"
```

---

## Task 19: 全套验证 — 类型检查 + 全测试 + 构建

**Files:** —

- [ ] **Step 1: 跑全测**

```bash
pnpm test
```

Expected: 全部 PASS。

如果有现有测试因 `providerConfigs` 移除而坏掉（grep 验证）：

```bash
grep -rn "providerConfigs" src --include="*.ts" --include="*.tsx"
```

修掉相应测试或调用方。

- [ ] **Step 2: 类型检查**

```bash
pnpm typecheck
```

Expected: PASS。

- [ ] **Step 3: 构建**

```bash
pnpm build
```

Expected: PASS。

- [ ] **Step 4: 手验**（设置页打开 → 顶部预设行可见 → 弹 sheet 切换 → 编辑 key 字段，切回原预设字段不受影响 → 进管理页能改名/删除/新建）

不强求 commit；这一步是 sanity check。如发现问题，回到对应 Task 修补再 commit。

- [ ] **Step 5: 标记里程碑提交（如需）**

```bash
git log --oneline -20
```

确认所有 task 提交都在分支上。无新代码改动则不再 commit。

---

## Self-Review Notes

**Spec coverage:**
- §3 数据模型 → Task 1, 8
- §3 actions → Task 2-9
- §3 迁移 → Task 10
- §3 兜底 → Task 10 (`ensureAtLeastOnePreset`)
- §4.1 顶部预设行 → Task 18
- §4.2 底部 sheet → Task 17
- §4.3 管理页 → Task 12-15
- §4.4 导航接入 → Task 11, 16
- §5.1 至少一个预设 → Task 6, 10
- §5.2 名字处理 → Task 2, 5
- §5.3 切换清空瞬态 → Task 3
- §6 测试 → 每个 Task 内 TDD

**Type/method consistency:**
- `createEmptyPreset(name): string` — Task 2, used Task 14, 19 ✓
- `setActivePreset(id): void` — Task 3 ✓
- `createPresetFromCurrent(name): string` — Task 4, used Task 17 ✓
- `renamePreset(id, name): void` — Task 5, used Task 13 ✓
- `deletePreset(id): boolean` — Task 6, used Task 15 ✓
- 顶层镜像字段：`apiKey/apiEndpoint/model/provider/fetchedModels` 在 Task 3, 7, 8, 9, 10 中一致维护 ✓

**Out-of-scope reminder:** swipe-to-delete 手势（Task 15 用了简化的 trash 按钮）、生成参数预设、跨设备同步 — 见 spec §8。
