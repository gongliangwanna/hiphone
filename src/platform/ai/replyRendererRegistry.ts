/**
 * Platform Reply Renderer Registry — per-app lossless conversion from a
 * raw LLM reply string into natural-language memory text.
 *
 * The renderer runs after `session.send` completes; its output is what
 * memoryStore persists as the assistant entry's content. Renderers MUST
 * preserve every decision-relevant field (type / param) into the
 * rendered text so subsequent prompts still have full context.
 * See spec §2 + D2.
 *
 * `DEFAULT_REPLY_RENDERER` re-exports the platform-default implementation
 * in `defaultReplyRenderer.ts`. Consumers always go through the registry.
 *
 * See docs/superpowers/specs/2026-04-20-m4.2.5-unified-tool-wire-format-design.md §1 + §2
 */

import type { ToolDefinition } from './toolRegistry';
import { defaultReplyRenderer } from './defaultReplyRenderer';

export interface ReplyRenderContext {
  /** Display name of the character whose reply this is. */
  speakerName: string;
  /** Session's captured tool list — renderers may use this to format actions. */
  tools: ToolDefinition[];
}

export interface ReplyRenderer {
  render(raw: string, ctx: ReplyRenderContext): string;
}

/**
 * `DEFAULT_REPLY_RENDERER` re-exports the platform-default implementation
 * in `defaultReplyRenderer.ts`. Consumers always go through the registry.
 */
export const DEFAULT_REPLY_RENDERER: ReplyRenderer = defaultReplyRenderer;

const registry = new Map<string, ReplyRenderer>();

export function registerReplyRenderer(appId: string, renderer: ReplyRenderer): void {
  registry.set(appId, renderer);
}

export function getReplyRenderer(appId: string): ReplyRenderer {
  return registry.get(appId) ?? DEFAULT_REPLY_RENDERER;
}

export function unregisterApp(appId: string): void {
  registry.delete(appId);
}

/** Test-only: wipe the registry between tests. */
export function _resetReplyRendererRegistryForTests(): void {
  registry.clear();
}
