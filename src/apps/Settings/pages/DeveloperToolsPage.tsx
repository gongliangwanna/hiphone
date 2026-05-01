import { Download } from 'lucide-react';
import { triggerAIWorkshopCodexKitDownload } from '@/apps/AIAppBuilder/agent/builderPromptExport';
import { usePerfDebugStore } from '@/platform/stores/perfDebugStore';
import { show as toastShow } from '@/platform/userApp/sdk/toast';
import { List, ListSection, ListRow } from '@/system';

export function DeveloperToolsPage() {
  const perfEnabled = usePerfDebugStore((s) => s.enabled);
  const setEnabled = usePerfDebugStore((s) => s.setEnabled);

  const handleExportAIWorkshopKit = () => {
    try {
      const result = triggerAIWorkshopCodexKitDownload();
      toastShow(`已导出 ${result.filename}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toastShow(`导出失败: ${message}`);
    }
  };

  return (
    <List>
      <ListSection footer="开启后在屏幕上显示实时帧率悬浮球，可拖拽移动，点击展开详细帧率统计。">
        <ListRow
          title="性能悬浮球"
          onClick={() => setEnabled(!perfEnabled)}
          rightContent={
            <div
              style={{
                width: 51,
                height: 31,
                borderRadius: 16,
                backgroundColor: perfEnabled
                  ? 'var(--color-systemGreen)'
                  : 'rgba(120,120,128,0.16)',
                padding: 2,
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              <div
                style={{
                  width: 27,
                  height: 27,
                  borderRadius: 14,
                  backgroundColor: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  transform: perfEnabled ? 'translateX(20px)' : 'translateX(0)',
                  transition: 'transform 0.2s',
                }}
              />
            </div>
          }
          isLast
        />
      </ListSection>

      <ListSection footer="导出 Markdown，包含 AI 工坊 system prompt、SDK 使用示例、沙箱限制和推荐文件结构，可交给 Codex 辅助开发 user app。">
        <ListRow
          icon={<Download size={17} />}
          iconColor="#007AFF"
          title="导出 AI 工坊开发包"
          detail="Markdown"
          onClick={handleExportAIWorkshopKit}
          isLast
        />
      </ListSection>
    </List>
  );
}
