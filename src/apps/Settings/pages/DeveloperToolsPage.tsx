import { usePerfDebugStore } from '@/platform/stores/perfDebugStore';
import { List, ListSection, ListRow } from '@/system';

export function DeveloperToolsPage() {
  const perfEnabled = usePerfDebugStore((s) => s.enabled);
  const setEnabled = usePerfDebugStore((s) => s.setEnabled);

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
    </List>
  );
}
