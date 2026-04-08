import { motion } from 'motion/react';
import { apps, dock } from './apps.data';
import { IconGrid } from './IconGrid';
import { Dock } from './Dock';
import { PageIndicator } from './PageIndicator';
import { getSpringboardMetrics, type SizeTier } from '../Device/viewportProfile';
import { usePageSwipe } from './usePageSwipe';

const COLS = 4;
const ROWS = 5;
const PAGE_SIZE = COLS * ROWS; // 20

function paginate(appList: typeof apps, size: number) {
  const pages: typeof apps[] = [];
  for (let i = 0; i < appList.length; i += size) {
    pages.push(appList.slice(i, i + size));
  }
  return pages;
}

const pages = paginate(apps, PAGE_SIZE);
const TOTAL_PAGES = pages.length;

interface SpringboardProps {
  sizeTier: SizeTier;
  viewportWidth: number;
}

export function Springboard({ sizeTier, viewportWidth }: SpringboardProps) {
  const metrics = getSpringboardMetrics(sizeTier);
  const {
    currentPage,
    isDragging,
    trackX,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
  } = usePageSwipe({
    pageCount: TOTAL_PAGES,
    viewportWidth,
  });

  return (
    <div className="flex h-full flex-col" data-testid="springboard">
      <div
        className="flex-1 overflow-hidden"
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
        <motion.div
          className="flex will-change-transform"
          data-testid="springboard-track"
          style={{ x: trackX }}
        >
          {pages.map((pageApps, i) => (
            <div
              key={i}
              className="w-full flex-shrink-0"
              style={{ paddingInline: 'var(--shell-side-padding)' }}
            >
              <IconGrid apps={pageApps} metrics={metrics} />
            </div>
          ))}
        </motion.div>
      </div>

      <PageIndicator totalPages={TOTAL_PAGES} currentPage={currentPage} />
      <Dock apps={dock} metrics={metrics} reduceTransparency={isDragging} />
    </div>
  );
}
