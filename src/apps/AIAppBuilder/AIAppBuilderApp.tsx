/**
 * AI 工坊 builtin app — top-level composition.
 *
 * Layout:
 *   ┌──────── NavBar (新建 + 安装到桌面) ────────┐
 *   │ Preview pane (50%)                       │
 *   ├──────────────────────────────────────────┤
 *   │ Chat pane    (50%)                       │
 *   └──────────────────────────────────────────┘
 *
 * Owns the generate-orchestrate-store glue. BuilderChat reports
 * onSend; this component decides startNewDraft vs appendUserMessage,
 * fires generateDraft, and threads the result back into the store.
 */

import { useCallback } from 'react';
import { Plus, Download } from 'lucide-react';
import { AppScreen, NavBar } from '@/system';
import { show as toastShow } from '@/platform/userApp/sdk/toast';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { useAIAppBuilderStore } from './aiAppBuilderStore';
import { generateDraft } from './builderGenerator';
import { installDraft } from './builderInstaller';
import { BuilderPreview } from './BuilderPreview';
import { BuilderChat } from './BuilderChat';

export function AIAppBuilderApp() {
  const draftId = useAIAppBuilderStore((s) => s.draftId);
  const draftFiles = useAIAppBuilderStore((s) => s.draftFiles);
  const status = useAIAppBuilderStore((s) => s.status);
  const goHome = useAppRuntimeStore((s) => s.goHome);

  const handleSend = useCallback(async (text: string) => {
    const store = useAIAppBuilderStore.getState();
    if (!store.draftId) {
      // First message → start new draft
      store.startNewDraft(text);
    } else {
      store.appendUserMessage(text);
      store.setStatus('generating');
    }

    const { draftId: id, chatHistory } = useAIAppBuilderStore.getState();
    if (!id) return; // shouldn't happen

    const result = await generateDraft({ draftId: id, chatHistory });

    const after = useAIAppBuilderStore.getState();
    switch (result.kind) {
      case 'success':
        after.appendBuilderMessage('已生成,请在上方预览', result.files);
        after.setStatus('ready');
        break;
      case 'parse-error':
        after.appendBuilderMessage('生成结果格式不对,自动重试也失败了。请重新描述或换个说法。');
        after.setStatus('idle');
        break;
      case 'api-error':
        after.appendBuilderMessage(`API 错误: ${result.message}`);
        after.setError(result.message);
        break;
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
      useAIAppBuilderStore.getState().appendBuilderMessage(`安装失败: ${msg}`);
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

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ flex: 1, minHeight: 0, borderBottom: '0.5px solid var(--color-separator)' }}>
          <BuilderPreview />
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <BuilderChat onSend={handleSend} />
        </div>
      </div>
    </AppScreen>
  );
}
