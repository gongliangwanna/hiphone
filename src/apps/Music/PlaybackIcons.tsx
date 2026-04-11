export function PlayIcon({ size = 24, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M6.5 4.5v15L19.5 12 6.5 4.5z" />
    </svg>
  );
}

export function PauseIcon({ size = 24, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="4.5" width="4.5" height="15" rx="1.5" />
      <rect x="13.5" y="4.5" width="4.5" height="15" rx="1.5" />
    </svg>
  );
}

export function SkipNextIcon({ size = 24, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M5 4.5v15L16 12 5 4.5z" />
      <rect x="17" y="4.5" width="2" height="15" rx="1" />
    </svg>
  );
}

export function SkipPrevIcon({ size = 24, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M19 19.5v-15L8 12l11 7.5z" />
      <rect x="5" y="4.5" width="2" height="15" rx="1" />
    </svg>
  );
}
