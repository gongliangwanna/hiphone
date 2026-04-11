import { type CSSProperties, type ReactNode, forwardRef } from 'react';
import type { WidgetSize } from '@/platform/stores/springboardLayoutStore';

interface WidgetShellProps {
  size: WidgetSize;
  children: ReactNode;
  /**
   * Drawer preview variant uses a fixed pixel box so the same widget
   * component can render in the picker without depending on the grid.
   */
  variant?: 'placed' | 'drawer';
  /** Only used when variant === 'drawer' */
  previewWidth?: number;
  className?: string;
  style?: CSSProperties;
  testId?: string;
  onClick?: () => void;
}

/**
 * iOS-style widget container.
 *
 * ## Performance: deliberately NOT a `<Material>` component
 *
 * Earlier this shell wrapped its children in `<Material variant="chrome">`,
 * which writes `backdrop-filter: blur(50px) saturate(...)`. That cost was
 * the dominant cause of springboard swipe jank: every widget on the moving
 * track was re-sampling and re-blurring a 50px-radius backdrop region every
 * frame, because its on-screen position relative to the (fixed) wallpaper
 * changed each frame. `backdrop-filter` cannot be cached when the input
 * pixels move beneath it.
 *
 * The win: every concrete widget already paints its own opaque background
 * (Clock = dark gradient, Date = white card, Weather = sky gradient,
 * Music = blurred album art, Photo = full-bleed photo) — there is nothing
 * to see through. Removing the backdrop layer is therefore visually a
 * no-op while erasing the per-frame paint cost. We keep the rounded
 * corners, the shadow, and the 1px inner highlight that gives every iOS
 * widget its subtle "chrome" border.
 */
export const WidgetShell = forwardRef<HTMLDivElement, WidgetShellProps>(
  function WidgetShell(
    { size, children, variant = 'placed', previewWidth = 150, className, style, testId, onClick },
    ref,
  ) {
    // Preview pixel dimensions keep the visual aspect ratio so the gallery
    // mirrors the real placed size.
    const isDrawer = variant === 'drawer';
    const dims = isDrawer ? getPreviewDims(size, previewWidth) : undefined;

    return (
      <div
        ref={ref}
        className={className}
        onClick={onClick}
        data-testid={testId}
        style={{
          width: isDrawer ? dims!.width : '100%',
          height: isDrawer ? dims!.height : '100%',
          ...style,
        }}
      >
        <div
          className="relative h-full w-full"
          style={{
            borderRadius: 22,
            // Tiny opaque tint as belt-and-braces against any future widget
            // forgetting its own background. Cheap, no compositor cost.
            backgroundColor: '#1c1c1e',
            boxShadow:
              '0 10px 28px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.14)',
            overflow: 'hidden',
            color: 'white',
            display: 'flex',
          }}
        >
          {children}
          {/* 1px inner highlight that matches iOS widget chrome — sits above
              the widget content but is non-interactive. */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 22,
              boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.08)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    );
  },
);

function getPreviewDims(size: WidgetSize, baseCell: number): { width: number; height: number } {
  // baseCell is "1 widget unit" — a 2x2 widget is baseCell x baseCell
  // A 4x2 widget is 2*baseCell x baseCell, and 4x4 is 2*baseCell x 2*baseCell.
  // This matches Apple's Widget Gallery aspect ratios.
  switch (size) {
    case '2x2':
      return { width: baseCell, height: baseCell };
    case '4x2':
      return { width: baseCell * 2 + 12, height: baseCell };
    case '4x4':
      return { width: baseCell * 2 + 12, height: baseCell * 2 + 12 };
  }
}
