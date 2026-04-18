interface Props {
  appName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UninstallConfirm({ appName, onConfirm, onCancel }: Props) {
  return (
    <div
      data-testid="uninstall-confirm-backdrop"
      onClick={onCancel}
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        padding: 'var(--spacing-6)',
      }}
    >
      <div
        data-testid="uninstall-confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 270,
          borderRadius: 14,
          backgroundColor: 'var(--color-systemBackground)',
          overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
        }}
      >
        <div
          style={{
            padding: 'var(--spacing-4) var(--spacing-4) var(--spacing-3)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-label)' }}>
            卸载 {appName}？
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 13,
              color: 'var(--color-secondaryLabel)',
              lineHeight: 1.4,
            }}
          >
            此 App 及其所有数据将被删除。
          </div>
        </div>

        <div style={{ display: 'flex', borderTop: '1px solid var(--color-separator)' }}>
          <button
            type="button"
            data-testid="uninstall-cancel"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '11px 0',
              fontSize: 17,
              fontWeight: 400,
              border: 'none',
              borderRight: '1px solid var(--color-separator)',
              background: 'transparent',
              color: 'var(--color-systemBlue)',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            type="button"
            data-testid="uninstall-confirm"
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '11px 0',
              fontSize: 17,
              fontWeight: 600,
              border: 'none',
              background: 'transparent',
              color: 'var(--color-systemRed)',
              cursor: 'pointer',
            }}
          >
            卸载
          </button>
        </div>
      </div>
    </div>
  );
}
