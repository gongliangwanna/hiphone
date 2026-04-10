import { Camera } from 'lucide-react';

export function CameraTab() {
  return (
    <div
      className="flex h-full flex-col items-center justify-center"
      style={{ backgroundColor: '#000', gap: 8 }}
    >
      <Camera size={56} strokeWidth={1.2} color="#fff" />
      <span style={{ fontSize: 17, fontWeight: 600, color: '#fff' }}>
        Camera
      </span>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
        Tap to take a Snap
      </span>
    </div>
  );
}
