import { describe, expect, it } from 'vitest';
import {
  buildAIWorkshopCodexKitMarkdown,
  getAIWorkshopCodexKitFilename,
} from '../builderPromptExport';

describe('builderPromptExport', () => {
  it('builds a Markdown Codex kit from the live prompt and capability docs', () => {
    const markdown = buildAIWorkshopCodexKitMarkdown({
      draftId: 'ai-app-export-test',
      generatedAt: new Date(2026, 4, 1, 14, 9),
    });

    expect(markdown).toContain('# AI 工坊 Codex 开发包');
    expect(markdown).toContain('默认 draftId: `ai-app-export-test`');
    expect(markdown).toContain('你是 hiPhone "AI 工坊" 的代理式代码生成助手');
    expect(markdown).toContain('## sdk.storage');
    expect(markdown).toContain("import { get, set } from '@hiphone/storage'");
    expect(markdown).toContain('## sdk.ai');
    expect(markdown).toContain("import { complete } from '@hiphone/ai'");
    expect(markdown).toContain('## sandbox');
    expect(markdown).toContain('不要 import host 私有路径');
    expect(markdown).not.toContain('上限 25 轮工具调用');
  });

  it('uses a stable date-based filename', () => {
    expect(getAIWorkshopCodexKitFilename(new Date(2026, 4, 1))).toBe(
      'ai-workshop-codex-kit-2026-05-01.md',
    );
  });
});
