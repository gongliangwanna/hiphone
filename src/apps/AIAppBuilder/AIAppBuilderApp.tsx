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

import { useCallback, useRef } from 'react';
import { Plus, Download } from 'lucide-react';
import { AppScreen, NavBar } from '@/system';
import { show as toastShow } from '@/platform/userApp/sdk/toast';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { useAIAppBuilderStore } from './aiAppBuilderStore';
import { runBuilderAgent } from './agent/builderAgent';
import { installDraft } from './builderInstaller';
import { BuilderChat } from './BuilderChat';

export function AIAppBuilderApp() {
  const draftId = useAIAppBuilderStore((s) => s.draftId);
  const draftFiles = useAIAppBuilderStore((s) => s.draftFiles);
  const status = useAIAppBuilderStore((s) => s.status);
  const goHome = useAppRuntimeStore((s) => s.goHome);

  const abortRef = useRef<AbortController | null>(null);

  const handleSend = useCallback(async (text: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const store = useAIAppBuilderStore.getState();
    if (!store.draftId) {
      store.startNewDraft(text);
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
      const msg = err instanceof Error ? err.message : String(err);
      useAIAppBuilderStore.getState().appendAgentMessage(`[运行失败] ${msg}`);
      useAIAppBuilderStore.getState().setStatus('idle');
    }

    // Defensive: if the loop exited without a finish event (e.g., abort, max-iter),
    // make sure we don't leave the UI stuck in 'generating'.
    const finalState = useAIAppBuilderStore.getState();
    if (finalState.status === 'generating') {
      finalState.setStatus('idle');
    }
  }, []);

  const handleNewDraft = useCallback(() => {
    if (status === 'generating') {
      toastShow('生成中,无法新建');
      return;
    }
    if (!confirm('新建会丢弃当前草稿,确定继续吗?')) return;
    useAIAppBuilderStore.setState({
      draftId: null,
      draftFiles: {},
      chatHistory: [],
      status: 'idle',
      lastError: null,
    });
  }, [status]);

  const handleInstall = useCallback(async () => {
    if (!draftId) return;
    if (Object.keys(draftFiles).length === 0) {
      toastShow('当前没有可安装的草稿');
      return;
    }
    try {
      await installDraft(draftId, draftFiles);
      toastShow('已安装到桌面');
      goHome();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toastShow(`安装失败: ${msg}`);
      useAIAppBuilderStore.getState().appendAgentMessage(`安装失败: ${msg}`);
    }
  }, [draftId, draftFiles, goHome]);

  const canInstall = draftId !== null && Object.keys(draftFiles).length > 0 && status !== 'generating';

  // NavBar's rightButtons[] takes {icon, onClick}. Conditional render for the
  // install button so it just disappears when not available — NavBar doesn't
  // surface a disabled state visually.
  const rightButtons = [
    { icon: <Plus size={18} />, onClick: handleNewDraft, testId: 'builder-new-draft' },
    ...(canInstall
      ? [{ icon: <Download size={18} />, onClick: handleInstall, testId: 'builder-install' }]
      : []),
  ];

  return (
    <AppScreen backgroundColor="var(--color-systemBackground)">
      <NavBar title="AI 工坊" rightButtons={rightButtons} />

      <div style={{ flex: 1, minHeight: 0 }}>
        <BuilderChat onSend={handleSend} onAbort={() => abortRef.current?.abort()} />
      </div>
    </AppScreen>
  );
}
