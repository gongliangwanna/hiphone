import type { HTMLAttributes, ReactNode } from 'react';
import { type MaterialVariant, materials } from '@/platform/design-tokens';

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

  return (
    <div
      {...props}
      className={className}
      style={{
        backdropFilter: disableBackdrop ? 'none' : `blur(${mat.blur}px) saturate(${mat.saturate}%)`,
        WebkitBackdropFilter: disableBackdrop ? 'none' : `blur(${mat.blur}px) saturate(${mat.saturate}%)`,
        backgroundColor: mat.background,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
