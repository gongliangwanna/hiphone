import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { dock, type AppInfo } from './apps.data';
import { IconGrid, type AppDragPreview, type WidgetDragPreview } from './IconGrid';
import { Dock } from './Dock';
import { PageIndicator } from './PageIndicator';
import { DragOverlay } from './DragOverlay';
import { WidgetDragOverlay } from './WidgetDragOverlay';
import { getSpringboardMetrics, type SizeTier } from '../Device/viewportProfile';
import { usePageSwipe } from './usePageSwipe';
import { useAppRuntimeStore, type AppOrigin } from '@/platform/stores/appRuntimeStore';
import { usePerfDebugStore } from '@/platform/stores/perfDebugStore';
import {
  useSpringboardLayoutStore,
  resolveSlotPages,
  type Slot,
  type WidgetInstance,
} from '@/platform/stores/springboardLayoutStore';
import { useIconDrag } from './useIconDrag';
import { ActivePagesProvider } from '@/shell/Widgets/activePage';

interface SpringboardProps {
  sizeTier: SizeTier;
  viewportWidth: number;
}

export function Springboard({ sizeTier, viewportWidth }: SpringboardProps) {
  const metrics = getSpringboardMetrics(sizeTier);
  const openApp = useAppRuntimeStore((s) => s.openApp);
  const hideIconImages = usePerfDebugStore((s) => s.hideIconImages);

  // Layout store
  const appOrder = useSpringboardLayoutStore((s) => s.appOrder);
  const pageWidgets = useSpringboardLayoutStore((s) => s.pageWidgets);
  const isEditMode = useSpringboardLayoutStore((s) => s.isEditMode);
  const removeWidget = useSpringboardLayoutStore((s) => s.removeWidget);
  const setCurrentSpringboardPage = useSpringboardLayoutStore(
    (s) => s.setCurrentSpringboardPage,
  );

  // Resolve unified slot pages, then split into parallel app / widget views.
  // The drag system only touches apps; widgets render in-place via CSS grid span.
  const slotPages = useMemo(
    () => resolveSlotPages(appOrder, pageWidgets),
    [appOrder, pageWidgets],
  );
  const appPages = useMemo<AppInfo[][]>(
    () =>
      slotPages.map((slots) =>
        slots.filter((s): s is Extract<Slot, { type: 'app' }> => s.type === 'app').map((s) => s.app),
      ),
    [slotPages],
  );
  const widgetPages = useMemo<WidgetInstance[][]>(
    () =>
      slotPages.map((slots) =>
        slots
          .filter((s): s is Extract<Slot, { type: 'widget' }> => s.type === 'widget')
          .map((s) => s.widget),
      ),
    [slotPages],
  );

  // Extra empty page for drag-to-create (only in edit mode while dragging)
  const [extraPage, setExtraPage] = useState(false);
  const displayPages: AppInfo[][] = extraPage ? [...appPages, []] : appPages;
  const displayWidgetPages: WidgetInstance[][] = extraPage
    ? [...widgetPages, []]
    : widgetPages;
  const totalPages = displayPages.length;

  // Clean up extra page when exiting edit mode
  useEffect(() => {
    if (!isEditMode) setExtraPage(false);
  }, [isEditMode]);

  const handleOpenApp = useCallback(
    (id: string, origin: AppOrigin) => {
      if (isEditMode) return;
      openApp(id, origin);
    },
    [openApp, isEditMode],
  );

  const {
    currentPage,
    isDragging: isPageDragging,
    trackX,
    goToPage,
    cancelSwipe,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
  } = usePageSwipe({
    pageCount: totalPages,
    viewportWidth,
  });

  // When extra page is created, navigate to it
  const prevTotalPagesRef = useRef(totalPages);
  useEffect(() => {
    if (totalPages > prevTotalPagesRef.current && extraPage) {
      goToPage(totalPages - 1);
    }
    prevTotalPagesRef.current = totalPages;
  }, [totalPages, extraPage, goToPage]);

  // Publish the active page to the layout store so the widget drawer
  // knows which page to drop newly-added widgets onto.
  useEffect(() => {
    setCurrentSpringboardPage(currentPage);
  }, [currentPage, setCurrentSpringboardPage]);

  // Icon drag system
  const gestureAreaRef = useRef<HTMLDivElement>(null);
  const iconDrag = useIconDrag({
    pages: displayPages,
    widgetPages: displayWidgetPages,
    metrics,
    viewportWidth,
    currentPage,
    totalPages,
    goToPage,
    cancelSwipe,
    gestureAreaRef,
    onRequestExtraPage: () => setExtraPage(true),
  });

  // Compose a single drag-preview snapshot that every IconGrid reads from.
  // Having the source + target in one object lets each page decide whether
  // to hide / relocate / insert the dragging widget consistently.
  const widgetDragPreview = useMemo<WidgetDragPreview | null>(() => {
    if (!iconDrag.widgetDrag) return null;
    return {
      widget: iconDrag.widgetDrag.widget,
      fromPage: iconDrag.widgetDrag.fromPage,
      target: iconDrag.widgetDropPos
        ? {
            page: iconDrag.widgetDropPos.page,
            col: iconDrag.widgetDropPos.col,
            row: iconDrag.widgetDropPos.row,
          }
        : null,
    };
  }, [iconDrag.widgetDrag, iconDrag.widgetDropPos]);

  // Symmetric snapshot for app drags. Lets every IconGrid reorder its apps
  // live so neighbours slide aside as the user drags an icon.
  const appDragPreview = useMemo<AppDragPreview | null>(() => {
    if (!iconDrag.dragPos || !iconDrag.dragApp) return null;
    return {
      app: iconDrag.dragApp,
      fromPage: iconDrag.dragPos.page,
      fromLocalIndex: iconDrag.dragPos.localIndex,
      target: iconDrag.dropPos
        ? { page: iconDrag.dropPos.page, localIndex: iconDrag.dropPos.localIndex }
        : null,
    };
  }, [iconDrag.dragPos, iconDrag.dragApp, iconDrag.dropPos]);

  // Widgets on pages other than the focused one should not run their
  // high-frequency ticks (clock interval, music progress subscription,
  // Ken Burns keyframe). During an icon drag we want every page to tick
  // normally so previews stay accurate.
  const isAnyDragActive = iconDrag.dragPos !== null || iconDrag.widgetDrag !== null;

  return (
    <div className="flex h-full flex-col" data-testid="springboard">
      <div
        ref={gestureAreaRef}
        className="relative flex-1 overflow-hidden"
        data-testid="springboard-gesture-surface"
        style={{
          paddingTop: 'var(--springboard-top-padding)',
          touchAction: 'pan-y',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => {
          onPointerMove(e);
          iconDrag.onPointerMove(e);
        }}
        onPointerUp={(e) => {
          onPointerUp(e);
          iconDrag.onPointerUp(e);
        }}
        onPointerCancel={(e) => {
          onPointerCancel(e);
          iconDrag.onPointerCancel(e);
        }}
        onLostPointerCapture={onLostPointerCapture}
      >
        <ActivePagesProvider
          currentPage={currentPage}
          forceAllActive={isAnyDragActive}
        >
        <motion.div
          className="flex will-change-transform"
          data-testid="springboard-track"
          style={{ x: trackX }}
        >
          {displayPages.map((pageApps, i) => (
            <div
              key={i}
              className="w-full flex-shrink-0"
              style={{
                paddingInline: 'var(--shell-side-padding)',
                // Promote each page to its own compositor layer so a paint
                // invalidation inside one page (e.g. ClockWidget tick) does
                // not dirty the parent track that's animating the swipe.
                // `contain: layout paint` also prevents layout thrash from
                // crossing page boundaries.
                contain: 'layout paint',
                transform: 'translateZ(0)',
              }}
            >
              {pageApps.length > 0 || (displayWidgetPages[i]?.length ?? 0) > 0 ? (
                <IconGrid
                  apps={pageApps}
                  widgets={displayWidgetPages[i]}
                  metrics={metrics}
                  viewportWidth={viewportWidth}
                  hideIconImages={hideIconImages}
                  isEditMode={isEditMode}
                  pageIndex={i}
                  appDragPreview={appDragPreview}
                  widgetDragPreview={widgetDragPreview}
                  onDragStart={iconDrag.onDragStart}
                  onWidgetDragStart={iconDrag.onWidgetDragStart}
                  onOpen={handleOpenApp}
                  onRemoveWidget={removeWidget}
                />
              ) : (
                <div className="h-full" data-testid="empty-page" />
              )}
            </div>
          ))}
        </motion.div>
        </ActivePagesProvider>

        {iconDrag.dragPos && iconDrag.dragApp && (
          <DragOverlay
            app={iconDrag.dragApp}
            metrics={metrics}
            x={iconDrag.dragX}
            y={iconDrag.dragY}
            hideIconImages={hideIconImages}
          />
        )}

        {iconDrag.widgetDrag && (
          <WidgetDragOverlay
            widget={iconDrag.widgetDrag.widget}
            metrics={metrics}
            viewportWidth={viewportWidth}
            x={iconDrag.dragX}
            y={iconDrag.dragY}
          />
        )}
      </div>

      <PageIndicator totalPages={totalPages} currentPage={currentPage} />
      <Dock apps={dock} metrics={metrics} reduceTransparency={isPageDragging} hideIconImages={hideIconImages} onOpen={handleOpenApp} />
    </div>
  );
}
