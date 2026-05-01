/**
 * AI 工坊 builtin app — top-level composition.
 *
 * Full-screen chat layout. Generated apps are not previewed in-place
 * (the half-screen sandbox preview broke too many user-app layouts on
 * narrow phone widths). The flow is: chat → install → springboard,
 * where the user opens the new app from its springboard icon.
 *
 * Owns the agent-loop orchestration. BuilderChat reports onSend; this
 * component decides startNewDraft vs appendUserMessage, dispatches
 * runBuilderAgent, and lets the agent's onTurn events stream through
 * to the store via append* helpers.
 */

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Plus, Download, Layers, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import { AppScreen } from '@/system';
import { spring } from '@/platform/design-tokens/motion';
import { show as toastShow } from '@/platform/userApp/sdk/toast';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { useAIAppBuilderStore } from './aiAppBuilderStore';
import { runBuilderAgent } from './agent/builderAgent';
import { installDraft, triggerDraftZipDownload } from './builderInstaller';
import { BuilderChat } from './BuilderChat';
import { DraftsSheet } from './DraftsSheet';

export function AIAppBuilderApp() {
  const draftId = useAIAppBuilderStore((s) => s.draftId);
  const draftFiles = useAIAppBuilderStore((s) => s.draftFiles);
  const status = useAIAppBuilderStore((s) => s.status);
  const draftCount = useAIAppBuilderStore((s) => Object.keys(s.drafts).length);
  const goHome = useAppRuntimeStore((s) => s.goHome);
  const [sheetOpen, setSheetOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const runSeqRef = useRef(0);

  const handleSend = useCallback(async (text: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runSeq = ++runSeqRef.current;

    const store = useAIAppBuilderStore.getState();
    if (!store.draftId) {
      // No active draft: create one seeded with this user prompt.
      store.createDraft(text);
    } else if (store.chatHistory.length === 0) {
      // Active draft is empty (created by clicking "+" with no message yet).
      // Re-seed it with the user prompt instead of appending — keeps the
      // chat history clean and gives the agent a proper first turn.
      store.appendUserMessage(text);
      store.setStatus('generating');
    } else {
      store.appendUserMessage(text);
      store.setStatus('generating');
    }

    const { draftId: id } = useAIAppBuilderStore.getState();
    if (!id) return;

    try {
      await runBuilderAgent({
        draftId: id,
        userMessage: text,
        signal: controller.signal,
        onTurn: (event) => {
          if (controller.signal.aborted || runSeqRef.current !== runSeq) return;
          const s = useAIAppBuilderStore.getState();
          switch (event.kind) {
            case 'agent-text':
              s.appendAgentMessage(event.text);
              break;
            case 'tool-call':
              s.appendToolCall(event.tool, event.args, event.result, event.ok);
              break;
            case 'plan-update':
              s.appendPlanUpdate(event.steps);
              break;
            case 'finish':
              s.appendFinish(event.summary);
              s.setStatus('ready');
              break;
          }
        },
      });
    } catch (err) {
      if (controller.signal.aborted || runSeqRef.current !== runSeq) return;
      const msg = err instanceof Error ? err.message : String(err);
      useAIAppBuilderStore.getState().appendAgentMessage(`[运行失败] ${msg}`);
      useAIAppBuilderStore.getState().setStatus('idle');
    }

    if (runSeqRef.current !== runSeq) return;
    if (abortRef.current === controller) {
      abortRef.current = null;
    }
    // Defensive: if the loop exited without a finish event (e.g., abort, max-iter),
    // make sure we don't leave the UI stuck in 'generating'.
    const finalState = useAIAppBuilderStore.getState();
    if (finalState.status === 'generating') {
      finalState.setStatus('idle');
    }
  }, []);

  const handleAbort = useCallback(() => {
    const controller = abortRef.current;
    if (controller && !controller.signal.aborted) {
      controller.abort();
    }
    abortRef.current = null;
    runSeqRef.current++;

    const store = useAIAppBuilderStore.getState();
    if (store.status === 'generating') {
      store.appendAgentMessage('已停止生成');
      store.setStatus('idle');
    }
  }, []);

  const handleNewDraft = useCallback(() => {
    if (status === 'generating') {
      toastShow('生成中,请稍后再新建');
      return;
    }
    // V1.1: non-destructive. The previous draft stays in `drafts`; a new
    // empty draft becomes active and the chat clears. The user can return
    // to the prior draft via the drafts sheet.
    useAIAppBuilderStore.getState().createDraft('');
  }, [status]);

  const handleInstall = useCallback(async () => {
    if (!draftId) return;
    if (Object.keys(draftFiles).length === 0) {
      toastShow('当前没有可安装的草稿');
      return;
    }
    try {
      const result = await installDraft(draftId, draftFiles);
      toastShow(result.isUpgrade ? '已更新到桌面' : '已安装到桌面');
      goHome();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toastShow(`安装失败: ${msg}`);
      useAIAppBuilderStore.getState().appendAgentMessage(`安装失败: ${msg}`);
    }
  }, [draftId, draftFiles, goHome]);

  const handleDownload = useCallback(async () => {
    if (!draftId) return;
    if (Object.keys(draftFiles).length === 0) {
      toastShow('当前没有可下载的草稿');
      return;
    }
    try {
      await triggerDraftZipDownload(draftId, draftFiles);
      toastShow('已下载 ZIP');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toastShow(`下载失败: ${msg}`);
      useAIAppBuilderStore.getState().appendAgentMessage(`下载失败: ${msg}`);
    }
  }, [draftId, draftFiles]);

  const actionReady = draftId !== null && Object.keys(draftFiles).length > 0 && status !== 'generating';

  return (
    <AppScreen backgroundColor="#f7f9fd">
      <div
        style={{
          flexShrink: 0,
          padding: '18px 16px 10px',
          backgroundColor: 'rgba(247,249,253,0.92)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 34,
              lineHeight: 1.05,
              fontWeight: 800,
              color: 'var(--color-label)',
              letterSpacing: 0,
            }}
          >
            AI 工坊
          </h1>
          <motion.button
            type="button"
            onClick={handleNewDraft}
            whileTap={{ scale: 0.92 }}
            transition={spring.snappy}
            aria-label="新建草稿"
            data-testid="builder-new-draft"
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              border: '0.5px solid rgba(60,60,67,0.12)',
              backgroundColor: 'rgba(255,255,255,0.92)',
              color: 'var(--color-label)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 10px 28px rgba(15,23,42,0.10)',
            }}
          >
            <Plus size={28} strokeWidth={2.4} />
          </motion.button>
        </div>

        <div
          style={{
            minHeight: 58,
            borderRadius: 18,
            border: '0.5px solid rgba(60,60,67,0.14)',
            backgroundColor: 'rgba(255,255,255,0.82)',
            boxShadow: '0 12px 32px rgba(15,23,42,0.07)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            overflow: 'hidden',
          }}
        >
          <motion.button
            type="button"
            onClick={() => setSheetOpen(true)}
            whileTap={{ scale: 0.97 }}
            transition={spring.snappy}
            aria-label="草稿列表"
            data-testid="builder-drafts-list"
            style={{
              flex: '1 1 auto',
              minWidth: 0,
              height: 42,
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: 0,
              color: 'var(--color-label)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: 'rgba(0,122,255,0.12)',
                color: 'var(--color-label)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Layers size={20} strokeWidth={2.4} />
            </span>
            <span
              style={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 17,
                fontWeight: 700,
              }}
            >
              草稿 {draftCount}
            </span>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: 'rgba(0,122,255,0.45)',
                flexShrink: 0,
              }}
            />
          </motion.button>

          <ActionButton
            icon={<Download size={18} strokeWidth={2.2} />}
            onClick={handleDownload}
            disabled={!actionReady}
            variant="secondary"
            ariaLabel="下载 ZIP"
            testId="builder-download-zip"
          />
          <ActionButton
            icon={<Upload size={20} strokeWidth={2.25} />}
            onClick={handleInstall}
            disabled={!actionReady}
            variant="primary"
            ariaLabel="安装或更新"
            testId="builder-install"
          />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <BuilderChat onSend={handleSend} onAbort={handleAbort} />
      </div>

      <DraftsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreateNew={handleNewDraft}
      />
    </AppScreen>
  );
}

function ActionButton({
  icon,
  onClick,
  disabled,
  variant,
  ariaLabel,
  testId,
}: {
  icon: ReactNode;
  onClick: () => void;
  disabled: boolean;
  variant: 'primary' | 'secondary';
  ariaLabel: string;
  testId: string;
}) {
  const primary = variant === 'primary';
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={!disabled ? { scale: 0.96 } : undefined}
      transition={spring.snappy}
      aria-label={ariaLabel}
      data-testid={testId}
      style={{
        height: 44,
        flex: primary ? '0 0 52px' : '0 0 46px',
        borderRadius: primary ? 17 : 15,
        border: primary ? 'none' : '0.5px solid rgba(60,60,67,0.18)',
        backgroundColor: primary ? 'var(--color-systemBlue)' : 'rgba(255,255,255,0.92)',
        color: primary ? 'white' : 'var(--color-label)',
        opacity: disabled ? 0.45 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        boxShadow: primary && !disabled ? '0 8px 18px rgba(0,122,255,0.22)' : 'none',
      }}
    >
      {icon}
    </motion.button>
  );
}
