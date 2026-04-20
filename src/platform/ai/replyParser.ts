// src/platform/ai/replyParser.ts
/**
 * Parse the LLM's raw reply string into a unified `ReplyItem[]` shape.
 *
 * Wire format (M4.2.5+):
 *   [
 *     { "type": "<tool-type>", "param": <any JSON value> },
 *     ...
 *   ]
 *
 * `parseReply` validates:
 *   1. The outer value is a JSON array (or extractable from code block).
 *   2. Each item is an object with a string `type` field.
 *   3. Each item's `type` is in the `knownTypes` whitelist.
 *
 * It does NOT validate `param` shape against any schema — that's the
 * tool handler's responsibility (see spec D5).
 *
 * Returns `{ items, error }`:
 *   - error === null → all items valid; `items` is the parsed array
 *   - error !== null → parsing or validation failed; `items` is `[]`
 *     (caller — session retry loop — decides whether to retry)
 *
 * See docs/superpowers/specs/2026-04-20-m4.2.5-unified-tool-wire-format-design.md §3
 */

export interface ReplyItem {
  /** Tool identifier (matches ToolDefinition.type). */
  type: string;
  /** Tool-specific parameter; shape determined by the tool. */
  param: unknown;
}

export type ParseError =
  | { kind: 'not-json' }
  | { kind: 'wrong-shape' }
  | { kind: 'unknown-type'; badType: string };

export interface ParseReplyResult {
  items: ReplyItem[];
  error: ParseError | null;
}

/**
 * Try to extract a JSON array from the raw LLM response.
 * Fallback chain: direct parse → ```json code block → first [...] substring.
 */
export function parseReply(
  raw: string,
  knownTypes: ReadonlySet<string>,
): ParseReplyResult {
  const trimmed = raw.trim();
  if (!trimmed) return { items: [], error: { kind: 'not-json' } };

  const parsed = tryExtractArray(trimmed);
  if (parsed === null) return { items: [], error: { kind: 'not-json' } };

  const items: ReplyItem[] = [];
  for (const entry of parsed) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      typeof (entry as { type?: unknown }).type !== 'string'
    ) {
      return { items: [], error: { kind: 'wrong-shape' } };
    }
    const record = entry as { type: string; param?: unknown };
    const type = record.type;
    if (knownTypes.size > 0 && !knownTypes.has(type)) {
      return { items: [], error: { kind: 'unknown-type', badType: type } };
    }
    items.push({ type, param: record.param });
  }
  return { items, error: null };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function tryExtractArray(trimmed: string): unknown[] | null {
  // Attempt 1 — direct parse
  const direct = tryParseArray(trimmed);
  if (direct) return direct;

  // Attempt 2 — ```json ... ``` code block
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    const inner = tryParseArray(codeBlockMatch[1]!.trim());
    if (inner) return inner;
  }

  // Attempt 3 — first [...] substring
  const bracketStart = trimmed.indexOf('[');
  const bracketEnd = trimmed.lastIndexOf(']');
  if (bracketStart >= 0 && bracketEnd > bracketStart) {
    const inner = tryParseArray(trimmed.slice(bracketStart, bracketEnd + 1));
    if (inner) return inner;
  }

  return null;
}

function tryParseArray(text: string): unknown[] | null {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}
