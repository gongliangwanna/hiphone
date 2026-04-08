import { type MaterialVariant, materials } from '@/platform/design-tokens';

interface MaterialProps {
  variant?: MaterialVariant;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Liquid Glass material container.
 * This is the ONLY component allowed to use backdrop-filter directly.
 */
export function Material({ variant = 'regular', className, children }: MaterialProps) {
  const mat = materials[variant];

  return (
    <div
      className={className}
      style={{
        backdropFilter: `blur(${mat.blur}px) saturate(${mat.saturate}%)`,
        WebkitBackdropFilter: `blur(${mat.blur}px) saturate(${mat.saturate}%)`,
        backgroundColor: mat.background,
      }}
    >
      {children}
    </div>
  );
}
