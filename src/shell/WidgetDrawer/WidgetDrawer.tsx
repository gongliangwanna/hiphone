import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { X, Check } from 'lucide-react';
import { Material } from '@/system/Material/Material';
import { spring } from '@/platform/design-tokens/motion';
import {
  useSpringboardLayoutStore,
  type WidgetKind,
  type WidgetSize,
} from '@/platform/stores/springboardLayoutStore';
import { widgetCatalog, type WidgetCatalogEntry } from '../Widgets/registry';

/**
 * Widget gallery sheet that slides up from the bottom of the device.
 *
 * Mirrors the iOS "Add Widget" drawer: a category list on the left (kind
 * chooser) plus a gallery on the right showing each supported size as a
 * tappable preview card. Tapping a card adds the widget to the page the
 * user is currently viewing and closes the drawer.
 *
 * Composition lives in `Device.tsx`; this component just renders the
 * sheet when `isWidgetDrawerOpen` is true.
 */
export function WidgetDrawer() {
  const isOpen = useSpringboardLayoutStore((s) => s.isWidgetDrawerOpen);
  const closeDrawer = useSpringboardLayoutStore((s) => s.closeWidgetDrawer);
  const addWidget = useSpringboardLayoutStore((s) => s.addWidget);
  const currentPage = useSpringboardLayoutStore((s) => s.currentSpringboardPage);

  const [selectedKind, setSelectedKind] = useState<WidgetKind>('clock');
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectedEntry = useMemo<WidgetCatalogEntry>(
    () =>
      widgetCatalog.find((e) => e.kind === selectedKind) ??
      widgetCatalog[0]!,
    [selectedKind],
  );

  if (!isOpen) return null;

  const handleAdd = (kind: WidgetKind, size: WidgetSize) => {
    const id = addWidget(currentPage, kind, size);
    if (id) {
      setFeedback(`已添加 ${sizeLabel(size)} ${selectedEntry.name}`);
      closeDrawer();
    } else {
      setFeedback('此页已满 — 请先删除一个小组件或 App');
      // auto-hide after a moment
      window.setTimeout(() => setFeedback(null), 1800);
    }
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={spring.smooth}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        top: '22%',
        zIndex: 30,
      }}
      data-testid="widget-drawer"
    >
      <Material
        variant="thick"
        className="flex h-full w-full flex-col"
        style={{
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          backgroundColor: 'rgba(22, 22, 24, 0.82)',
          color: 'white',
          boxShadow: '0 -12px 32px rgba(0,0,0,0.35)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* drag handle */}
        <div
          className="mx-auto mt-2"
          style={{
            width: 40,
            height: 5,
            borderRadius: 3,
            backgroundColor: 'rgba(255,255,255,0.32)',
          }}
        />

        <header
          className="flex items-center justify-between"
          style={{ padding: '12px 20px 4px' }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.01em',
            }}
          >
            小组件
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            className="flex items-center justify-center"
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: 'rgba(120,120,128,0.3)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
            data-testid="widget-drawer-close"
            aria-label="关闭小组件抽屉"
          >
            <X size={16} strokeWidth={3} />
          </button>
        </header>

        <div
          className="px-5 pb-1"
          style={{
            fontSize: 13,
            color: 'rgba(235,235,245,0.55)',
          }}
        >
          从类别中选择，再点击尺寸即可添加到第 {currentPage + 1} 页
        </div>

        {/* category selector (horizontal scroll pill row) */}
        <nav
          className="flex gap-2 overflow-x-auto"
          style={{
            padding: '12px 20px 8px',
            scrollbarWidth: 'none',
          }}
          data-testid="widget-drawer-category-nav"
        >
          {widgetCatalog.map((entry) => {
            const active = entry.kind === selectedKind;
            return (
              <button
                key={entry.kind}
                type="button"
                onClick={() => setSelectedKind(entry.kind)}
                className="flex-shrink-0"
                style={{
                  padding: '8px 16px',
                  borderRadius: 18,
                  backgroundColor: active
                    ? 'rgba(255,255,255,0.92)'
                    : 'rgba(120,120,128,0.28)',
                  color: active ? '#1c1c1e' : 'white',
                  fontSize: 14,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                data-testid={`widget-drawer-category-${entry.kind}`}
                aria-pressed={active}
              >
                {entry.name}
              </button>
            );
          })}
        </nav>

        {/* gallery */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ padding: '8px 20px 28px' }}
          data-testid="widget-drawer-gallery"
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'rgba(235,235,245,0.85)',
              marginBottom: 6,
            }}
          >
            {selectedEntry.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'rgba(235,235,245,0.55)',
              marginBottom: 18,
            }}
          >
            {selectedEntry.tagline}
          </div>

          <div className="flex flex-col items-center gap-6">
            {selectedEntry.sizes.map((size) => {
              const Component = selectedEntry.component;
              return (
                <div key={size} className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => handleAdd(selectedEntry.kind, size)}
                    className="flex items-center justify-center"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                    }}
                    data-testid={`widget-drawer-card-${selectedEntry.kind}-${size}`}
                    aria-label={`添加 ${sizeLabel(size)} ${selectedEntry.name}`}
                  >
                    <Component
                      size={size}
                      variant="drawer"
                      previewWidth={140}
                    />
                  </button>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: 'rgba(235,235,245,0.65)',
                    }}
                  >
                    {sizeLabel(size)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {feedback && (
          <div
            className="pointer-events-none absolute left-1/2 flex items-center gap-1.5"
            style={{
              bottom: 22,
              transform: 'translateX(-50%)',
              padding: '8px 14px',
              borderRadius: 14,
              backgroundColor: 'rgba(28,28,30,0.92)',
              fontSize: 13,
              color: 'white',
              boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
            }}
            data-testid="widget-drawer-feedback"
          >
            <Check size={14} strokeWidth={3} />
            {feedback}
          </div>
        )}
      </Material>
    </motion.div>
  );
}

function sizeLabel(size: WidgetSize): string {
  switch (size) {
    case '2x2':
      return '小';
    case '4x2':
      return '中';
    case '4x4':
      return '大';
  }
}
