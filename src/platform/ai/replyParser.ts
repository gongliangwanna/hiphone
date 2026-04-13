/**
 * Parse structured AI reply JSON into an array of message items.
 *
 * Expected format from LLM:
 * ```json
 * [
 *   { "type": "text", "content": "你好呀" },
 *   { "type": "text", "content": "今天过得怎么样？" }
 * ]
 * ```
 *
 * Includes fallback logic: if JSON parsing fails, treats the raw text
 * as a single text message.
 *
 * See docs/plan/2026-04-12-1700-m3-structured-output.md
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReplyTextItem {
  type: 'text';
  content: string;
}

export interface ReplyStickerItem {
  type: 'sticker';
  content: string; // sticker description (for lastMsg preview)
  stickerId: string;
}

export interface ReplySignatureItem {
  type: 'signature';
  text: string;
}

export type ReplyItem = ReplyTextItem | ReplyStickerItem | ReplySignatureItem;

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Try to extract a JSON array from the raw LLM response.
 * Attempts in order:
 * 1. Direct JSON.parse on the full string
 * 2. Extract from ```json ... ``` code block
 * 3. Extract first [...] substring
 * Falls back to single text message on failure.
 */
export function parseReply(raw: string): ReplyItem[] {
  const trimmed = raw.trim();
  if (!trimmed) return [{ type: 'text', content: '' }];

  // Attempt 1: direct parse
  const direct = tryParseItems(trimmed);
  if (direct) return direct;

  // Attempt 2: extract from ```json ... ``` code block
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    const inner = tryParseItems(codeBlockMatch[1]!.trim());
    if (inner) return inner;
  }

  // Attempt 3: find first [...] in the string
  const bracketStart = trimmed.indexOf('[');
  const bracketEnd = trimmed.lastIndexOf(']');
  if (bracketStart >= 0 && bracketEnd > bracketStart) {
    const inner = tryParseItems(trimmed.slice(bracketStart, bracketEnd + 1));
    if (inner) return inner;
  }

  // Attempt 4: find first {...} (AI returned a single object instead of array)
  const braceStart = trimmed.indexOf('{');
  const braceEnd = trimmed.lastIndexOf('}');
  if (braceStart >= 0 && braceEnd > braceStart) {
    const inner = tryParseItems(trimmed.slice(braceStart, braceEnd + 1));
    if (inner) return inner;
  }

  // Fallback: treat entire raw text as a single text message
  return [{ type: 'text', content: trimmed }];
}

function tryParseItems(text: string): ReplyItem[] | null {
  try {
    const parsed = JSON.parse(text);

    // Normalise: single object → array of one
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    if (arr.length === 0) return null;

    const items: ReplyItem[] = [];
    for (const item of arr) {
      if (typeof item !== 'object' || item === null) continue;
      if (item.type === 'text' && typeof item.content === 'string' && item.content.trim()) {
        items.push({ type: 'text', content: item.content.trim() });
      } else if (
        item.type === 'sticker' &&
        typeof item.stickerId === 'string' &&
        item.stickerId.trim()
      ) {
        items.push({
          type: 'sticker',
          content: typeof item.content === 'string' ? item.content.trim() : '[表情]',
          stickerId: item.stickerId.trim(),
        });
      } else if (
        item.type === 'signature' &&
        typeof item.text === 'string' &&
        item.text.trim()
      ) {
        items.push({ type: 'signature', text: item.text.trim() });
      }
    }
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}
