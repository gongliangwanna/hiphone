/**
 * Platform Reply Renderer Registry — per-app lossless conversion from a
 * raw LLM reply string into natural-language memory text.
 *
 * The renderer runs after `session.send` completes; its output is what
 * memoryStore persists as the assistant entry's content. Renderers MUST
 * preserve every decision-relevant field (stickerId, action params) into
 * the rendered text so subsequent prompts still have full context. See
 * spec §2 + D2.
 *
 * S1 ships a stub default renderer so the module wires cleanly; S3
 * replaces DEFAULT_XINGYU_RENDERER with the full no-loss implementation
 * in defaultXingYuRenderer.ts.
 *
 * See docs/superpowers/specs/2026-04-19-m4.2-tool-registry-and-rendering-design.md §1 + §2
 */

import type { ToolDefinition } from './toolRegistry';
import { defaultXingYuRenderer } from './defaultXingYuRenderer';

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
 * The canonical default renderer, used when no app-specific renderer is
 * registered. Implemented in `defaultXingYuRenderer.ts` — re-exported
 * here so the registry is the single entry point for consumers.
 */
export const DEFAULT_XINGYU_RENDERER: ReplyRenderer = defaultXingYuRenderer;

const registry = new Map<string, ReplyRenderer>();

export function registerReplyRenderer(appId: string, renderer: ReplyRenderer): void {
  registry.set(appId, renderer);
}

export function getReplyRenderer(appId: string): ReplyRenderer {
  return registry.get(appId) ?? DEFAULT_XINGYU_RENDERER;
}

export function unregisterApp(appId: string): void {
  registry.delete(appId);
}

/** Test-only: wipe the registry between tests. */
export function _resetReplyRendererRegistryForTests(): void {
  registry.clear();
}
