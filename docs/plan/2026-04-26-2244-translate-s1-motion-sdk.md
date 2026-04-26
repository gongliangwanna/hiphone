# 翻译 App S1 — `@hiphone/motion` SDK

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在用户 APP SDK 里新增 `@hiphone/motion` 模块，把 `motion/react` 和项目自有 spring 预设暴露给沙箱里的用户 APP，使其能写出 iOS 仿真度的动效。

**Architecture:** 新增 `src/platform/userApp/sdk/motion.ts`，re-export `motion/react` 全表面 + 直接 re-export `@/platform/design-tokens/motion` 里的 `spring` / `duration` / `ease`（不镜像、不复制数值，避免漂移）。在 `sdk/index.ts` 的 `moduleMap` 加一条 `'@hiphone/motion'` → 模块对象。最后加单测覆盖 export 表面 + 沙箱内 `import { motion } from '@hiphone/motion'` 不抛错。

**Tech Stack:** TypeScript / Vitest / motion (v11) / Sucrase（已存在管道）

**Spec 来源：** `docs/superpowers/specs/2026-04-26-translate-app-design.md` §3.4

---

### Task 1: 创建 `sdk/motion.ts`

**Files:**
- Create: `src/platform/userApp/sdk/motion.ts`
- Reference: `src/platform/userApp/sdk/ui.ts`（参考最简风格）
- Reference: `src/platform/design-tokens/motion.ts`（被 re-export 的源）

- [ ] **Step 1: 写文件内容**

```ts
/**
 * @hiphone/motion — animation primitives for user apps.
 *
 * Re-exports motion/react's component & hook surface plus the project's
 * stable spring / duration / ease tokens. User apps build iOS-fidelity
 * animations on top of these without re-tuning physics parameters.
 *
 * Sandbox rationale: motion/react is a bare-import module and would fail
 * sandbox resolution unless whitelisted here. Tokens are re-exported
 * directly from the design-tokens module (not mirrored) so they stay in
 * sync with system code automatically.
 */
export {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useSpring,
  useAnimate,
  useMotionValueEvent,
  useScroll,
  useInView,
} from 'motion/react';

export { spring, duration, ease } from '@/platform/design-tokens/motion';
```

- [ ] **Step 2: 验证文件无 TS 错误**

Run: `pnpm tsc --noEmit`
Expected: 通过（不引入 `motion/react` 类型问题；`spring` 等 re-export 直接复用源类型）

- [ ] **Step 3: Commit**

```bash
git add src/platform/userApp/sdk/motion.ts
git commit -m "feat(sdk): add @hiphone/motion module — re-exports motion/react + design-tokens"
```

---

### Task 2: 把 `@hiphone/motion` 注册进 `moduleMap`

**Files:**
- Modify: `src/platform/userApp/sdk/index.ts`
- Test: `src/platform/userApp/sdk/__tests__/index.test.ts`

- [ ] **Step 1: 写失败测试**

打开 `src/platform/userApp/sdk/__tests__/index.test.ts`，找到 "exposes known specifiers" 块（如不存在则在文件底部新增）。追加：

```ts
import { describe, it, expect } from 'vitest';
import { resolveModule } from '../index';

describe('@hiphone/motion', () => {
  it('exposes motion/react surface', () => {
    const mod = resolveModule('@hiphone/motion') as Record<string, unknown>;
    expect(typeof mod.motion).toBe('object'); // motion is a proxy/object factory
    expect(typeof mod.AnimatePresence).toBe('function');
    expect(typeof mod.useMotionValue).toBe('function');
    expect(typeof mod.useTransform).toBe('function');
    expect(typeof mod.useSpring).toBe('function');
  });

  it('exposes design-token spring presets', () => {
    const mod = resolveModule('@hiphone/motion') as {
      spring: Record<string, { stiffness: number; damping: number; mass: number }>;
      duration: Record<string, number>;
      ease: { standard: [number, number, number, number] };
    };
    expect(mod.spring.snappy).toEqual({ stiffness: 500, damping: 38, mass: 1 });
    expect(mod.spring.bouncy).toEqual({ stiffness: 220, damping: 18, mass: 1 });
    expect(mod.spring.smooth).toEqual({ stiffness: 280, damping: 28, mass: 1 });
    expect(mod.duration.fast).toBe(200);
    expect(mod.ease.standard).toEqual([0.4, 0, 0.2, 1]);
  });
});
```

- [ ] **Step 2: 跑测试确认 FAIL**

Run: `pnpm vitest run src/platform/userApp/sdk/__tests__/index.test.ts`
Expected: 上面两个测试都 FAIL（错误形如 `Module not found in hiPhone user-app SDK: "@hiphone/motion"`）

- [ ] **Step 3: 在 `index.ts` 里注册**

修改 `src/platform/userApp/sdk/index.ts`：

```ts
import React from 'react';
import * as lucide from 'lucide-react';
import * as hiphoneUi from './ui';
import * as hiphoneStorage from './storage';
import * as hiphonePerspective from './perspective';
import * as hiphoneHooks from './hooks';
import * as hiphoneNav from './nav';
import * as hiphoneToast from './toast';
import * as hiphoneBanner from './banner';
import * as hiphoneServices from './services';
import * as hiphoneAi from './ai';
import * as hiphoneMotion from './motion';

const moduleMap: Record<string, unknown> = {
  react: React,
  'lucide-react': lucide,
  '@hiphone/ui': hiphoneUi,
  '@hiphone/storage': hiphoneStorage,
  '@hiphone/perspective': hiphonePerspective,
  '@hiphone/hooks': hiphoneHooks,
  '@hiphone/nav': hiphoneNav,
  '@hiphone/toast': hiphoneToast,
  '@hiphone/banner': hiphoneBanner,
  '@hiphone/services': hiphoneServices,
  '@hiphone/ai': hiphoneAi,
  '@hiphone/motion': hiphoneMotion,
};

export function resolveModule(specifier: string): unknown {
  const ObjectWithHasOwn = Object as ObjectConstructor & {
    hasOwn(o: object, v: PropertyKey): boolean;
  };
  if (ObjectWithHasOwn.hasOwn(moduleMap, specifier)) return moduleMap[specifier];
  throw new Error(
    `Module not found in hiPhone user-app SDK: "${specifier}". ` +
      `Available: ${Object.keys(moduleMap).join(', ')}`,
  );
}
```

只新增 `import * as hiphoneMotion from './motion';` 和 moduleMap 里 `'@hiphone/motion': hiphoneMotion,` 这两行；其余原样。

- [ ] **Step 4: 跑测试确认 PASS**

Run: `pnpm vitest run src/platform/userApp/sdk/__tests__/index.test.ts`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/platform/userApp/sdk/index.ts src/platform/userApp/sdk/__tests__/index.test.ts
git commit -m "feat(sdk): register @hiphone/motion in moduleMap + tests"
```

---

### Task 3: 沙箱端到端测试 — 用户 APP 里 `import { motion } from '@hiphone/motion'` 能跑

**Files:**
- Create: `src/platform/userApp/sdk/__tests__/motion.sandbox.test.ts`

这个测试不只验证 export，更重要的是验证**真实编译 + 沙箱执行**链路里 `@hiphone/motion` 不会因为 Sucrase 编译产物或 sandbox shadow 把它干掉。

- [ ] **Step 1: 写测试**

```ts
/**
 * Sandbox-level smoke test: a user-app TSX source that imports from
 * @hiphone/motion compiles, executes, and yields a working component.
 *
 * Catches regressions in:
 *   - Sucrase dropping the import when binding is used (CLAUDE.md note 1)
 *   - sdk/index.ts forgetting to register the module
 *   - motion/react bundle interop with the sandbox shape
 */
import { describe, it, expect } from 'vitest';
import { compileTsx } from '../../compiler';
import { executeSandboxed } from '../../sandbox';
import { resolveModule } from '../index';

const SOURCE = `
import React from 'react';
import { motion, AnimatePresence, spring } from '@hiphone/motion';

export default function Demo() {
  return (
    <AnimatePresence>
      <motion.div
        key="x"
        animate={{ opacity: 1 }}
        transition={spring.snappy}
      />
    </AnimatePresence>
  );
}
`;

describe('@hiphone/motion in sandbox', () => {
  it('compiles + sandboxes a component using motion + spring', async () => {
    const compiled = await compileTsx(SOURCE, 'motion-smoke.tsx');
    const Component = executeSandboxed(compiled, resolveModule);
    expect(typeof Component).toBe('function');
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `pnpm vitest run src/platform/userApp/sdk/__tests__/motion.sandbox.test.ts`
Expected: PASS。

如果 FAIL：
- 报 "Module not found ..." → 回 Task 2 确认 `index.ts` 注册成功
- 报 "spring is not defined" 之类的 → 检查 `motion.ts` 是否成功 re-export `spring`
- 报编译错误 → 看 Sucrase 输出里是否丢了 motion 的 import binding（按 CLAUDE.md 踩坑 1）

- [ ] **Step 3: Commit**

```bash
git add src/platform/userApp/sdk/__tests__/motion.sandbox.test.ts
git commit -m "test(sdk): sandbox smoke test for @hiphone/motion compile+execute"
```

---

### Task 4: 文档更新 — `userApp/CLAUDE.md` 反映 SDK 表面新增

**Files:**
- Modify: `src/platform/userApp/CLAUDE.md`

- [ ] **Step 1: 加一条记录**

打开 `src/platform/userApp/CLAUDE.md`，在 "扩展 SDK 的规则" 章节下方（或文件末尾的"已落地的架构决策"块）追加：

```markdown
## SDK 表面（截至 2026-04-26）

| 模块 | 来源 | 说明 |
|------|------|------|
| `react` | host React | 完整命名空间 |
| `lucide-react` | host lucide | 完整图标库 |
| `@hiphone/ui` | `sdk/ui.ts` | NavBar |
| `@hiphone/ai` | `sdk/ai.ts` | complete / streamComplete / chatWithCharacter |
| `@hiphone/storage` | `sdk/storage.ts` | per-owner + global KV |
| `@hiphone/perspective` | `sdk/perspective.ts` | useCurrentOwner / getCurrentOwner |
| `@hiphone/hooks` | `sdk/hooks.ts` | 跨层 React hook |
| `@hiphone/nav` | `sdk/nav.ts` | 应用内导航 |
| `@hiphone/toast` | `sdk/toast.ts` | show |
| `@hiphone/banner` | `sdk/banner.ts` | 顶部横幅 |
| `@hiphone/services` | `sdk/services.ts` | 服务注册 |
| `@hiphone/motion` | `sdk/motion.ts` | motion/react 表面 + design-token spring/duration/ease |

新增 `@hiphone/motion` 的动机：用户 APP 写 iOS-fidelity 动效需要 motion/react，
但裸 import 在沙箱里会被 resolveModule 拒绝。motion/react 在 host 已经被 bundle，
re-export 是零额外成本。spring/duration/ease 直接 re-export 自
`@/platform/design-tokens/motion`，不复制数值，token 演进自动跟随。
```

- [ ] **Step 2: 跑全量单测确保没破其它**

Run: `pnpm vitest run src/platform/userApp`
Expected: 全 PASS（应有 motion 相关 3 个新测）

- [ ] **Step 3: Commit**

```bash
git add src/platform/userApp/CLAUDE.md
git commit -m "docs(sdk): document @hiphone/motion in userApp/CLAUDE.md"
```

---

### Task 5: 收尾验证

- [ ] **Step 1: 跑全量测试**

Run: `pnpm vitest run`
Expected: 全 PASS

- [ ] **Step 2: 跑生产构建（不部署）**

Run: `pnpm build`
Expected: 构建成功；`dist/` 生成完成。motion/react 已经被宿主 bundle（它本来就在 `package.json` deps），无新增 chunk 风险。

注：S1 阶段还**没有**让 Sucrase 进生产 bundle —— 那是 S2 的任务。本阶段只确认现有构建不被打破。

- [ ] **Step 3: 确认 dist 大小没爆炸**

Run: `du -sh dist/assets/*.js | sort -h | tail -5`
Expected: 最大 chunk 不超过 1MB（参考基线，超出说明 motion/react 被重复 bundle 了）

- [ ] **Step 4: Commit any pending docs**

如果有 lint 或 docs 顺手改动，单独一个 commit。否则跳过。

---

## Self-Review

**Spec 覆盖：**
- spec §3.4 SDK motion → Task 1 + Task 2 ✓
- spec §2.5 "spring 预设镜像 design-tokens" → Task 1 (re-export 而非镜像，已在 plan 顶部说明取舍) ✓
- spec §4.1 "resolveModule('@hiphone/motion') 测试" → Task 2 ✓
- spec §4.1 "springs 与 design-tokens 同步测试" → Task 2 是直接 re-export，免去同步测试需求；硬编码值的 expect 即等同于同步验证 ✓

**Placeholder 扫描：** 全部步骤含完整代码与命令，无 TBD/TODO/"省略" ✓

**类型 / 命名一致：** `motion` / `AnimatePresence` / `useMotionValue` / `spring` / `duration` / `ease` 在 Task 1 / 2 / 3 / 4 均一致 ✓

**Spec 与 plan 的偏差（已修复）：** spec §3.4 提的 `springs.bouncy/snappy/gentle` 三件套 → 实际 design-token 是 `spring.snappy/smooth/bouncy/interactive/appLaunch/appClose/criticalDamped`，plan 已统一改为直接 re-export `spring` 对象，避免命名漂移。spec 后续阶段引用动效预设时同步用 design-token 的真实键名。

---

## 执行选择

S1 plan 已写好。两条路径选一：

1. **Subagent-Driven（推荐）**——我每个 Task 派一个 subagent 跑，跑完我审，问题立刻反馈
2. **Inline Execution**——本会话直接顺序跑，每两三个 task 一个 checkpoint

您选哪个？
