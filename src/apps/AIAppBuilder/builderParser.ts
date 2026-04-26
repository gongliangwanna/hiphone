/**
 * Parse the LLM's response into a `Record<path, content>`.
 *
 * Strategy (in order):
 *   1. Direct JSON.parse of the trimmed reply.
 *   2. Strip ```json fences if present, retry.
 *   3. Find the first `{` and last `}` and parse the substring between
 *      (handles "好的:{...}" prefixes).
 *   4. Return null → caller treats as parse failure (auto-retry once).
 *
 * On any successful parse, validate the shape:
 *   - Top-level object has `files` array.
 *   - Each entry has non-empty string `path` and string `content`.
 *   - At least 1 valid entry must remain after filtering.
 */

interface FileEntry {
  path: string;
  content: string;
}

export function parseGeneratedFiles(raw: string): Record<string, string> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const candidates: string[] = [trimmed];

  // Strip ```json fence if present
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  if (fenceMatch?.[1]) candidates.push(fenceMatch[1].trim());

  // Slice between first `{` and last `}`
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    const result = tryParseFiles(candidate);
    if (result) return result;
  }
  return null;
}

function tryParseFiles(text: string): Record<string, string> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as { files?: unknown }).files)
  ) {
    return null;
  }

  const filesArr = (parsed as { files: unknown[] }).files;
  const out: Record<string, string> = {};
  for (const entry of filesArr) {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as FileEntry).path === 'string' &&
      typeof (entry as FileEntry).content === 'string' &&
      (entry as FileEntry).path.length > 0
    ) {
      const e = entry as FileEntry;
      out[e.path] = e.content;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}
