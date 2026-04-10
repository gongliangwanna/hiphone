import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { TextArea } from '@/system';

export function SystemPromptEditPage() {
  const value = useAIConfigStore((s) => s.systemPrompt);
  const setValue = useAIConfigStore((s) => s.setSystemPrompt);

  return (
    <div
      className="h-full overflow-auto p-4"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
    >
      <div
        className="mb-2"
        style={{
          fontSize: 'var(--font-size-footnote)',
          color: 'var(--color-secondaryLabel)',
        }}
      >
        系统提示词会作为第一条 system 消息发送给 AI。留空则使用默认。
      </div>
      <TextArea
        value={value}
        onChange={setValue}
        placeholder="你是一个住在手机里的 AI 伴侣……"
        rows={12}
        autoGrow
        testId="system-prompt-edit"
      />
    </div>
  );
}

export function PostHistoryEditPage() {
  const value = useAIConfigStore((s) => s.postHistoryInstructions);
  const setValue = useAIConfigStore((s) => s.setPostHistoryInstructions);

  return (
    <div
      className="h-full overflow-auto p-4"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
    >
      <div
        className="mb-2"
        style={{
          fontSize: 'var(--font-size-footnote)',
          color: 'var(--color-secondaryLabel)',
        }}
      >
        历史后置指令会在聊天历史之后、AI 回复之前注入。适合用来强调角色行为约束。
      </div>
      <TextArea
        value={value}
        onChange={setValue}
        placeholder="回复时请注意以下几点：……"
        rows={12}
        autoGrow
        testId="post-history-edit"
      />
    </div>
  );
}
