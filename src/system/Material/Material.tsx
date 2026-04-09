import type { HTMLAttributes, ReactNode } from 'react';
import { type MaterialVariant, materials } from '@/platform/design-tokens';
import { usePerfDebugStore } from '@/platform/stores/perfDebugStore';

interface MaterialProps extends HTMLAttributes<HTMLDivElement> {
  variant?: MaterialVariant;
  children?: ReactNode;
  disableBackdrop?: boolean;
}

/**
 * Liquid Glass material container.
 * This is the ONLY component allowed to use backdrop-filter directly.
 */
export function Material({
  variant = 'regular',
  className,
  children,
  disableBackdrop = false,
  style,
  ...props
}: MaterialProps) {
  const mat = materials[variant];
  const reduceTransparency = usePerfDebugStore((state) => state.reduceTransparency);
  const backdropEnabled = !(disableBackdrop || reduceTransparency);

  return (
    <div
      {...props}
      className={className}
      data-perf-layer={`material:${variant}`}
      data-perf-backdrop-active={String(backdropEnabled)}
      style={{
        backdropFilter: backdropEnabled ? `blur(${mat.blur}px) saturate(${mat.saturate}%)` : 'none',
        WebkitBackdropFilter: backdropEnabled ? `blur(${mat.blur}px) saturate(${mat.saturate}%)` : 'none',
        backgroundColor: mat.background,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
