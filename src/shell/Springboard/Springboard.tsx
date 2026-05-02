import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  type AppInfo,
  getAppsWithUserInstalled,
  getDockAppsFromIds,
} from './apps.data';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
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
  resolveDock,
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

  // Subscribe to installed user apps. The reference changes on add/remove,
  // which invalidates the `apps` memo below so newly-installed icons land
  // on the grid without waiting for an unrelated layout change.
  const installedUserApps = useInstalledUserAppsStore((s) => s.apps);

  // Layout store
  const appOrder = useSpringboardLayoutStore((s) => s.appOrder);
  const pageWidgets = useSpringboardLayoutStore((s) => s.pageWidgets);
  const dockOrder = useSpringboardLayoutStore((s) => s.dockOrder);
  const isEditMode = useSpringboardLayoutStore((s) => s.isEditMode);
  const removeWidget = useSpringboardLayoutStore((s) => s.removeWidget);
  const setCurrentSpringboardPage = useSpringboardLayoutStore(
    (s) => s.setCurrentSpringboardPage,
  );

  // Resolve the dock first so the grid resolution can exclude its apps.
  // `dockIds` is the canonical source of truth for what's in the dock right
  // now; `dockApps` is the AppInfo list for rendering.
  const dockIds = useMemo(() => resolveDock(dockOrder), [dockOrder]);
  const dockApps = useMemo(() => getDockAppsFromIds(dockIds), [dockIds]);
  const apps = useMemo(
    () => getAppsWithUserInstalled(dockIds),
    [dockIds, installedUserApps],
  );

  // Resolve unified slot pages, then split into parallel app / widget views.
  // The drag system only touches apps; widgets render in-place via CSS grid span.
  // Pass `apps` so user-installed apps appear alongside builtins.
  const slotPages = useMemo(
    () => resolveSlotPages(appOrder, pageWidgets, apps),
    [appOrder, pageWidgets, apps],
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

  // When a drag-created extra page first appears, navigate to that scratch
  // page. Later real page-count changes from committing the drop must not
  // auto-advance to a new trailing empty page.
  const prevExtraPageRef = useRef(extraPage);
  useEffect(() => {
    if (extraPage && !prevExtraPageRef.current) {
      goToPage(totalPages - 1);
    }
    prevExtraPageRef.current = extraPage;
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
    dockApps,
    metrics,
    viewportWidth,
    currentPage,
    totalPages,
    goToPage,
    cancelSwipe,
    gestureAreaRef,
    onRequestExtraPage: () => setExtraPage(true),
  });

  useLayoutEffect(() => {
    if (extraPage && !iconDrag.dragPos && !iconDrag.widgetDrag && !iconDrag.isSettling) {
      setExtraPage(false);
    }
  }, [extraPage, iconDrag.dragPos, iconDrag.widgetDrag, iconDrag.isSettling]);

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
    // Springboard root is the stacking context for drag overlays — they're
    // rendered as siblings of the gesture surface (and the Dock) so they
    // (a) aren't clipped by the gesture surface's overflow:hidden when the
    // user drags an icon down toward the Dock, and (b) paint above the Dock
    // (which is in normal flex flow with no z-index).
    <div
      className="relative flex h-full flex-col"
      data-testid="springboard"
      // Icon-drag pointer handlers live at the Springboard ROOT so they
      // catch pointer events from the Dock too (the Dock is a sibling of
      // the gesture surface in the DOM — events from there don't bubble
      // through the gesture surface). This removes the dependency on
      // `setPointerCapture` succeeding from a long-press timer callback,
      // which silently fails in some browsers (the call is no longer in
      // a trusted pointer-event context). Without this, dragging a Dock
      // icon via long-press did nothing until a grid drag had already
      // primed the pointer-capture path.
      onPointerMove={iconDrag.onPointerMove}
      onPointerUp={iconDrag.onPointerUp}
      onPointerCancel={iconDrag.onPointerCancel}
    >
      <div
        ref={gestureAreaRef}
        className="relative flex-1 overflow-hidden"
        data-testid="springboard-gesture-surface"
        style={{
          paddingTop: 'var(--springboard-top-padding)',
          touchAction: 'pan-y',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
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
      </div>

      <PageIndicator totalPages={totalPages} currentPage={currentPage} />
      <Dock
        apps={dockApps}
        metrics={metrics}
        reduceTransparency={isPageDragging}
        hideIconImages={hideIconImages}
        isEditMode={isEditMode}
        dragPreview={iconDrag.dockDragPreview}
        onDragStart={iconDrag.onDragStart}
        onOpen={handleOpenApp}
      />

      {/*
        Drag overlays live at the Springboard root level — siblings of the
        gesture surface and the Dock — so they:
          1. Are NOT clipped by the gesture surface's overflow:hidden when
             the dragged icon travels down toward the Dock.
          2. Paint above the Dock in stacking order (z-50 vs unstacked Dock).
        `dragX` / `dragY` are computed against the gesture surface's
        bounding rect, which starts at (0, 0) of the Springboard root (the
        gesture surface is the first flex child with no offset above it),
        so coordinates remain valid here.
      */}
      {iconDrag.dragPos && iconDrag.dragApp && (
        <DragOverlay
          app={iconDrag.dragApp}
          metrics={metrics}
          x={iconDrag.dragX}
          y={iconDrag.dragY}
          hideIconImages={hideIconImages}
          isSettling={iconDrag.isSettling}
        />
      )}

      {/* Static overlay snapshot — covers the grid slot for one paint frame
          while it renders underneath. Prevents the 1-frame flash on
          settle → grid-slot swap. */}
      {iconDrag.overlayLingering && iconDrag.overlayLingerData && (
        <div
          className="pointer-events-none absolute left-0 top-0 z-50"
          style={{
            width: iconDrag.overlayLingerData.size,
            height: iconDrag.overlayLingerData.size,
            transform: `translate3d(${iconDrag.overlayLingerData.x}px,${iconDrag.overlayLingerData.y}px,0)`,
            willChange: 'transform',
            filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.35))',
          }}
        >
          <div
            className="h-full w-full overflow-hidden"
            style={{ borderRadius: 'var(--radius-icon)' }}
          >
            {hideIconImages ? (
              <div className="h-full w-full bg-gray-400" />
            ) : (
              <img
                src={iconDrag.overlayLingerData.icon}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            )}
          </div>
        </div>
      )}

      {iconDrag.widgetDrag && (
        <WidgetDragOverlay
          widget={iconDrag.widgetDrag.widget}
          metrics={metrics}
          viewportWidth={viewportWidth}
          x={iconDrag.dragX}
          y={iconDrag.dragY}
          isSettling={iconDrag.isSettling}
        />
      )}
    </div>
  );
}
