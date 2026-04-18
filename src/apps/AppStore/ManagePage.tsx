/**
 * Manage tab placeholder — full implementation in M3 S3.
 *
 * S2 scope: just render a "coming soon" surface so the tab switcher has
 * a valid target. Tests for the full manage page live in S3.
 */
export function ManagePage() {
  return (
    <div
      data-testid="appstore-manage-page"
      className="flex flex-1 flex-col items-center justify-center gap-2"
      style={{ padding: 'var(--spacing-6)', color: 'var(--color-secondaryLabel)' }}
    >
      <div style={{ fontSize: 16, fontWeight: 500 }}>管理页开发中</div>
      <div style={{ fontSize: 13 }}>本阶段（M3 S2）暂未实现，下一 stage 接手</div>
    </div>
  );
}
