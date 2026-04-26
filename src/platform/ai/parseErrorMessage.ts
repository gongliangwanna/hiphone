/**
 * Build the system-role correction message shown to the LLM after a
 * parse failure, so it can self-correct on retry.
 *
 * Shared by:
 *   - src/platform/userApp/sdk/ai.ts (ChatSession retry loop)
 *   - src/platform/ai/heartbeatAgent.ts (ReAct iteration retry)
 */

import type { ParseError } from './replyParser';

export function buildParseErrorMessage(
  error: ParseError,
  knownTypes: string[],
): string {
  switch (error.kind) {
    case 'not-json':
      return '[格式错误] 上条回复不是合法 JSON。你必须只输出 JSON 数组,形如 ' +
             '[{"type":"<type>","param":<param>}],不要任何其他文字。';
    case 'wrong-shape':
      return '[格式错误] 上条回复不符合 {type, param} 结构(有 item 缺少 type 或格式不对)。' +
             '请按 [回复格式] 要求重新输出 JSON 数组。';
    case 'unknown-type':
      // Invariant: knownTypes is non-empty here. parseReply only returns
      // 'unknown-type' when validating against a non-empty whitelist.
      return `[格式错误] 你使用了未注册的 type "${error.badType}"。` +
             `当前可用 type 只有: ${knownTypes.join(', ')}。请只使用这些。`;
  }
}
