import { useCallback, useEffect, useRef, useState } from 'react';
import { complete } from '@hiphone/ai';
import type { Language } from '../constants/languages';

export type TranslateStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseTranslateResult {
  targetText: string;
  status: TranslateStatus;
  error: Error | null;
  translate: (sourceText: string, sourceLang: Language, targetLang: Language) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

/**
 * Build the prompt messages for one translation call.
 *
 * Exported (not just used internally) so the host unit test can verify
 * prompt shape without spinning up the whole hook.
 */
export function buildTranslateMessages(
  sourceText: string,
  sourceLang: Language,
  targetLang: Language,
): { role: 'system' | 'user'; content: string }[] {
  const sourceIsAuto = sourceLang.code === 'auto';
  const sourceName = sourceIsAuto ? 'the input language (auto-detect)' : sourceLang.name;
  const system =
    `You are a professional translator. ` +
    `Translate the user's text from ${sourceName} to ${targetLang.name}. ` +
    `Output ONLY the translation — no quotes, no commentary, no language labels. ` +
    `Preserve formatting (line breaks, lists). If input is empty, output empty.` +
    (sourceIsAuto ? ' Detect the source language automatically.' : '');
  return [
    { role: 'system', content: system },
    { role: 'user', content: sourceText },
  ];
}

export function useTranslate(): UseTranslateResult {
  const [targetText, setTargetText] = useState('');
  const [status, setStatus] = useState<TranslateStatus>('idle');
  const [error, setError] = useState<Error | null>(null);

  // Each translate() generates a fresh token. Older tokens silently
  // discard their result if a newer one has started — implements "cancel
  // pending request when a newer one comes in" without needing the
  // streamComplete signal pathway.
  const tokenRef = useRef(0);

  const cancel = useCallback(() => {
    tokenRef.current++;
    setStatus('idle');
  }, []);

  const reset = useCallback(() => {
    tokenRef.current++;
    setTargetText('');
    setStatus('idle');
    setError(null);
  }, []);

  // Discard in-flight requests on unmount.
  useEffect(() => () => {
    tokenRef.current++;
  }, []);

  const translate = useCallback(
    async (sourceText: string, sourceLang: Language, targetLang: Language) => {
      const trimmed = sourceText.trim();
      if (!trimmed) {
        setTargetText('');
        setStatus('idle');
        setError(null);
        return;
      }
      const myToken = ++tokenRef.current;
      setStatus('loading');
      setError(null);
      try {
        const messages = buildTranslateMessages(trimmed, sourceLang, targetLang);
        const reply = await complete(messages, { temperature: 0.3 });
        if (myToken !== tokenRef.current) return; // superseded
        setTargetText(reply);
        setStatus('success');
      } catch (err) {
        if (myToken !== tokenRef.current) return;
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        setStatus('error');
      }
    },
    [],
  );

  return { targetText, status, error, translate, cancel, reset };
}
