import { buildAgentSystemPrompt } from './builderAgentPrompt';
import { getCapabilityTopics } from './builderTools';

const DEFAULT_EXPORT_DRAFT_ID = 'ai-app-codex-draft';

const TOPIC_ORDER = [
  'sdk',
  'sandbox',
  'styling',
  'multifile',
  'sdk.react',
  'sdk.ui',
  'sdk.storage',
  'sdk.ai',
  'sdk.hooks',
  'sdk.nav',
  'sdk.toast',
  'sdk.banner',
  'sdk.motion',
  'sdk.perspective',
  'sdk.services',
  'translate-blueprint',
];

const LEGACY_TOPIC_ALIASES = new Set(['storage', 'ai', 'motion']);

export interface AIWorkshopCodexKitOptions {
  draftId?: string;
  generatedAt?: Date;
}

export interface DownloadedAIWorkshopCodexKit {
  filename: string;
  bytes: number;
}

function formatDateForFilename(date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatGeneratedAt(date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function orderedTopics(topics: Record<string, string>): string[] {
  const known = TOPIC_ORDER.filter((topic) => topic in topics);
  const rest = Object.keys(topics)
    .filter((topic) => !TOPIC_ORDER.includes(topic) && !LEGACY_TOPIC_ALIASES.has(topic))
    .sort();
  return [...known, ...rest];
}

export function getAIWorkshopCodexKitFilename(date = new Date()): string {
  return `ai-workshop-codex-kit-${formatDateForFilename(date)}.md`;
}

export function buildAIWorkshopCodexKitMarkdown(
  options: AIWorkshopCodexKitOptions = {},
): string {
  const generatedAt = options.generatedAt ?? new Date();
  const draftId = options.draftId ?? DEFAULT_EXPORT_DRAFT_ID;
  const prompt = buildAgentSystemPrompt(draftId);
  const topics = getCapabilityTopics();
  const topicSections = orderedTopics(topics)
    .map((topic) => [`## ${topic}`, '', topics[topic]!.trim()].join('\n'))
    .join('\n\n');

  return [
    '# AI 工坊 Codex 开发包',
    '',
    `生成时间: ${formatGeneratedAt(generatedAt)}`,
    `默认 draftId: \`${draftId}\``,
    '',
    '## 使用方式',
    '',
    '把本 Markdown 提供给 Codex 或其他代码生成工具, 再描述你要开发的 hiPhone user app。',
    '生成代码时必须遵守 system prompt、manifest 规范、SDK 白名单和 sandbox 限制。',
    '如果要安装到 hiPhone, 输出文件至少应包含 `manifest.json` 和入口 `App.tsx`。',
    '',
    'Legacy topic aliases: `storage` -> `sdk.storage`, `ai` -> `sdk.ai`, `motion` -> `sdk.motion`.',
    '',
    '## Agent System Prompt',
    '',
    '````text',
    prompt,
    '````',
    '',
    '# Capability Documents',
    '',
    topicSections,
    '',
  ].join('\n');
}

export function triggerAIWorkshopCodexKitDownload(
  options: AIWorkshopCodexKitOptions = {},
): DownloadedAIWorkshopCodexKit {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('download is only available in a browser environment');
  }

  const generatedAt = options.generatedAt ?? new Date();
  const content = buildAIWorkshopCodexKitMarkdown({ ...options, generatedAt });
  const filename = getAIWorkshopCodexKitFilename(generatedAt);
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return { filename, bytes: blob.size };
}
