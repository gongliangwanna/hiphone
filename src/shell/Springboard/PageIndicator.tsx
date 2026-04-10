import { memo } from 'react';

interface PageIndicatorProps {
  totalPages: number;
  currentPage: number;
}

export const PageIndicator = memo(function PageIndicator({ totalPages, currentPage }: PageIndicatorProps) {
  return (
    <div className="flex justify-center gap-1.5 py-2" data-testid="page-indicator">
      {Array.from({ length: totalPages }, (_, i) => (
        <div
          key={i}
          data-testid={`page-dot-${i}`}
          className="rounded-full transition-opacity"
          style={{
            width: 7,
            height: 7,
            backgroundColor: 'white',
            opacity: i === currentPage ? 1 : 0.3,
            boxShadow: '0 0 3px rgba(0,0,0,0.3)',
          }}
        />
      ))}
    </div>
  );
});
