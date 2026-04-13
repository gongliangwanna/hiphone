/**
 * Lightweight token estimator for prompt budget management.
 *
 * We deliberately avoid tiktoken / gpt-tokenizer — they are heavy WASM /
 * JS bundles that add 1-2 MB to the client build for marginal accuracy
 * gains. Instead we use a simple heuristic:
 *
 *   - CJK / fullwidth chars: each character ≈ 2 tokens
 *   - ASCII / Latin (letters, digits, punctuation, space): 4 chars ≈ 1 token
 *
 * Empirical accuracy vs. cl100k_base on mixed Chinese/English text:
 *   - Pure Chinese: +5-15% overcount (safe — means we trim a bit early)
 *   - Pure English: ±10% (sometimes over, sometimes under)
 *   - Mixed: ±10%
 *
 * The 10% safety margin in assemblePrompt (D3 in the plan) absorbs the
 * worst-case undercount.
 */

// CJK Unified Ideographs, CJK Extension A, fullwidth forms, katakana,
// hiragana, CJK symbols, Hangul — each one roughly maps to 2 BPE tokens.
const CJK_RE =
  // eslint-disable-next-line no-misleading-character-class
  /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef\uac00-\ud7af]/;

export function estimateTokens(text: string): number {
  let cjkChars = 0;
  let asciiChars = 0;

  for (let i = 0; i < text.length; i++) {
    if (CJK_RE.test(text[i]!)) {
      cjkChars++;
    } else {
      asciiChars++;
    }
  }

  return Math.ceil(cjkChars * 2 + asciiChars / 4);
}
