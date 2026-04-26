import React, { useState, useCallback } from 'react';
import { NavBar } from '@hiphone/ui';
import { motion } from '@hiphone/motion';
import { spring } from '@hiphone/motion';
import { error as toastError } from '@hiphone/toast';
import { AIUnavailableError } from '@hiphone/ai';
import { LangBar } from './selectors/LangBar';
import { LangSheet } from './selectors/LangSheet';
import { CustomLangInput } from './selectors/CustomLangInput';
import { SourcePanel } from './panels/SourcePanel';
import { TargetPanel } from './panels/TargetPanel';
import { useTranslate } from './hooks/useTranslate';
import {
  CURATED_LANGUAGES,
  AUTO_LANG,
  DEFAULT_SOURCE_LANG,
  DEFAULT_TARGET_LANG,
  type Language,
} from './constants/languages';

const APP_STYLE: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: 'var(--color-systemBackground)',
};

export default function TranslateApp() {
  const [sourceLang, setSourceLang] = useState<Language>(DEFAULT_SOURCE_LANG);
  const [targetLang, setTargetLang] = useState<Language>(DEFAULT_TARGET_LANG);
  const [sourceText, setSourceText] = useState('');
  const { targetText, status, error, translate, reset } = useTranslate();
  const [pickerOpen, setPickerOpen] = useState<'source' | 'target' | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  const onSwap = useCallback(() => {
    // Don't swap "auto" into target — degrades to 中文 if user swaps an
    // auto source.
    const nextSource: Language =
      targetLang.code === AUTO_LANG.code
        ? CURATED_LANGUAGES.find((l) => l.code === 'zh')!
        : targetLang;
    const nextTarget: Language =
      sourceLang.code === AUTO_LANG.code
        ? CURATED_LANGUAGES.find((l) => l.code === 'zh')!
        : sourceLang;
    setSourceLang(nextSource);
    setTargetLang(nextTarget);
    if (targetText) {
      setSourceText(targetText);
    }
    // Always reset — even when no targetText yet, an in-flight request
    // started under the old language pair must be abandoned, otherwise
    // its result lands in the post-swap state with mismatched directions.
    reset();
  }, [sourceLang, targetLang, targetText, reset]);

  const onTranslate = useCallback(async () => {
    await translate(sourceText, sourceLang, targetLang);
  }, [translate, sourceText, sourceLang, targetLang]);

  const onPickLang = useCallback(
    (lang: Language) => {
      if (pickerOpen === 'source') setSourceLang(lang);
      else if (pickerOpen === 'target') setTargetLang(lang);
      setPickerOpen(null);
      reset();
    },
    [pickerOpen, reset],
  );

  const onPickCustom = useCallback(() => {
    setCustomOpen(true);
  }, []);

  const onCustomSubmit = useCallback(
    (lang: Language) => {
      if (pickerOpen === 'source') setSourceLang(lang);
      else if (pickerOpen === 'target') setTargetLang(lang);
      setCustomOpen(false);
      setPickerOpen(null);
      reset();
    },
    [pickerOpen, reset],
  );

  // Toast on errors. The hook already captures into `error`, here we
  // surface them via the platform toast (spec §3.8).
  React.useEffect(() => {
    if (status === 'error' && error) {
      if (error instanceof AIUnavailableError) {
        toastError('请先在设置里配置 AI');
      } else {
        toastError(error.message || '翻译失败');
      }
    }
  }, [status, error]);

  const canTranslate = sourceText.trim().length > 0 && status !== 'loading';

  return (
    <div style={APP_STYLE}>
      <NavBar title="翻译" />

      <LangBar
        sourceLang={sourceLang}
        targetLang={targetLang}
        onSwap={onSwap}
        onTapSource={() => setPickerOpen('source')}
        onTapTarget={() => setPickerOpen('target')}
      />

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
        <SourcePanel
          value={sourceText}
          onChange={setSourceText}
          disabled={status === 'loading'}
        />

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
          <motion.button
            type="button"
            disabled={!canTranslate}
            onClick={onTranslate}
            whileTap={canTranslate ? { scale: 0.96 } : undefined}
            transition={spring.snappy}
            style={{
              padding: '10px 28px',
              minHeight: 44,
              borderRadius: 22,
              border: 'none',
              fontSize: 17,
              fontWeight: 600,
              backgroundColor: canTranslate
                ? 'var(--color-systemBlue)'
                : 'var(--color-tertiarySystemFill)',
              color: canTranslate ? 'white' : 'var(--color-tertiaryLabel)',
              cursor: canTranslate ? 'pointer' : 'default',
            }}
          >
            {status === 'loading' ? '翻译中…' : '翻译'}
          </motion.button>
        </div>

        <TargetPanel
          text={targetText}
          status={status}
          errorMessage={error?.message}
        />
      </div>

      <LangSheet
        open={pickerOpen !== null && !customOpen}
        showAuto={pickerOpen === 'source'}
        onPick={onPickLang}
        onPickCustom={onPickCustom}
        onClose={() => setPickerOpen(null)}
      />
      <CustomLangInput
        open={customOpen}
        onSubmit={onCustomSubmit}
        onClose={() => setCustomOpen(false)}
      />
    </div>
  );
}
