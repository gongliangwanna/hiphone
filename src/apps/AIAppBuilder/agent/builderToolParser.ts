/**
 * Parse the agent's LLM reply into a `{thought?, tool, args}` object.
 *
 * Strategy (in order):
 *   1. Direct JSON.parse of the trimmed reply.
 *   2. Strip ```json or ``` fences if present, retry.
 *   3. Find the first `{` and last `}` and parse the substring between
 *      (handles "好的:{...}" prefixes).
 *   4. Return null → caller treats as parse failure.
 *
 * On any successful parse, validate the shape:
 *   - Result must be a non-null object.
 *   - `tool` field must be a non-empty string; otherwise return null.
 *   - `args` is taken as-is, except: if null, undefined, or missing,
 *     coerce to `{}`. Any other value passes through unchanged.
 *   - `thought` field is optional. If present and a non-empty string,
 *     copy it onto the result; otherwise omit entirely.
 */

export interface ParsedToolCall {
  thought?: string;
  tool: string;
  args: unknown;
}

export function parseToolCall(raw: string): ParsedToolCall | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const candidates: string[] = [trimmed];

  // Strip ```json or ``` fence if present
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  if (fenceMatch?.[1]) candidates.push(fenceMatch[1].trim());

  // Slice between first `{` and last `}`
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    const result = tryParseToolCall(candidate);
    if (result) return result;
  }
  return null;
}

function tryParseToolCall(text: string): ParsedToolCall | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;
  const tool = obj.tool;

  // tool must be a non-empty string
  if (typeof tool !== 'string' || tool.length === 0) {
    return null;
  }

  // Coerce args: null, undefined, or missing → {}; otherwise pass through
  let args = obj.args;
  if (args === null || args === undefined) {
    args = {};
  }

  const result: ParsedToolCall = {
    tool,
    args,
  };

  // thought is optional: only include if it's a non-empty string
  const thought = obj.thought;
  if (typeof thought === 'string' && thought.length > 0) {
    result.thought = thought;
  }

  return result;
}
