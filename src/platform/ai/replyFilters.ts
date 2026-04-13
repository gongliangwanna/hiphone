/**
 * Post-processing filters for AI replies.
 *
 * Applied after the LLM stream completes, before the text is written
 * into the message store. Prevents common LLM failure modes:
 * - Self-identifying as AI / language model
 * - Markdown formatting artifacts (code blocks, headers, bold wrapping)
 *
 * See docs/plan/2026-04-12-1630-m2-liveness.md
 */

// ---------------------------------------------------------------------------
// Filter rules
// ---------------------------------------------------------------------------

const REPLY_FILTERS: [RegExp, string][] = [
  // Prevent character from self-identifying as AI
  [/我(是|只是)(一个?)?(人工智能|AI|语言模型|机器人|虚拟助手|大语言模型|聊天机器人)/g, '我'],
  // Remove markdown code blocks
  [/```[\s\S]*?```/g, ''],
  // Remove markdown headers
  [/^#{1,6}\s/gm, ''],
  // Remove markdown bold wrapping entire lines
  [/^\*\*(.+)\*\*$/gm, '$1'],
  // Remove markdown italic wrapping entire lines
  [/^_(.+)_$/gm, '$1'],
  // Clean up excessive newlines (3+ → 2)
  [/\n{3,}/g, '\n\n'],
];

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Apply all reply filters to the raw LLM output.
 * Returns cleaned text, trimmed of leading/trailing whitespace.
 */
export function filterReply(text: string): string {
  let result = text;
  for (const [pattern, replacement] of REPLY_FILTERS) {
    result = result.replace(pattern, replacement);
  }
  return result.trim();
}
