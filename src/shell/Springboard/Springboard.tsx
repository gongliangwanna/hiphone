import { useState, useRef, useCallback } from 'react';
import { apps, dock } from './apps.data';
import { IconGrid } from './IconGrid';
import { Dock } from './Dock';
import { PageIndicator } from './PageIndicator';

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

export function Springboard() {
  const [currentPage, setCurrentPage] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragRef = useRef({ startX: 0, startTime: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = true;
    dragRef.current = {
      startX: e.clientX,
      startTime: Date.now(),
    };
    setIsDragging(true);
    setDragOffset(0);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragRef.current.startX;

      let offset = dx;
      if (currentPage === 0 && dx > 0) {
        offset = dx * 0.3;
      } else if (currentPage === TOTAL_PAGES - 1 && dx < 0) {
        offset = dx * 0.3;
      }

      setDragOffset(offset);
    },
    [currentPage],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;

      const dx = e.clientX - dragRef.current.startX;
      const dt = Date.now() - dragRef.current.startTime;
      const velocity = dt > 0 ? dx / dt : 0;

      const THRESHOLD = 50;
      const VELOCITY_THRESHOLD = 0.3;

      let nextPage = currentPage;
      if (dx < -THRESHOLD || velocity < -VELOCITY_THRESHOLD) {
        nextPage = Math.min(currentPage + 1, TOTAL_PAGES - 1);
      } else if (dx > THRESHOLD || velocity > VELOCITY_THRESHOLD) {
        nextPage = Math.max(currentPage - 1, 0);
      }

      setIsDragging(false);
      setDragOffset(0);
      setCurrentPage(nextPage);
    },
    [currentPage],
  );

  const viewportWidth = viewportRef.current?.offsetWidth || 393;
  const baseOffset = currentPage * 100;
  const dragPercent = (dragOffset / viewportWidth) * 100;
  const translateX = baseOffset - dragPercent;

  return (
    <div className="flex h-full flex-col" data-testid="springboard">
      <div
        ref={viewportRef}
        className="flex-1 overflow-hidden pt-2"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          className={`flex ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
          style={{ transform: `translateX(-${translateX}%)` }}
        >
          {pages.map((pageApps, i) => (
            <div key={i} className="w-full flex-shrink-0 px-[22px] pt-4">
              <IconGrid apps={pageApps} />
            </div>
          ))}
        </div>
      </div>

      <PageIndicator totalPages={TOTAL_PAGES} currentPage={currentPage} />
      <Dock apps={dock} />
    </div>
  );
}
