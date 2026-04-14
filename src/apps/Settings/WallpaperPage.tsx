import { useRef } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { useSystemStore } from '@/platform/stores/systemStore';
import { wallpapers } from '@/shell/Springboard/apps.data';
import { List, ListSection } from '@/system';

const MAX_WIDTH = 1080;
const JPEG_QUALITY = 0.85;

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = reject;
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > MAX_WIDTH) {
          h = Math.round(h * (MAX_WIDTH / w));
          w = MAX_WIDTH;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function CheckMark() {
  return (
    <div
      data-testid="wallpaper-check"
      className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full"
      style={{ backgroundColor: 'var(--color-systemBlue)' }}
    >
      <Check size={12} strokeWidth={3} color="white" />
    </div>
  );
}

function WallpaperThumb({
  id,
  src,
  isSelected,
  onSelect,
  onDelete,
}: {
  id: string;
  src: string;
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      data-testid={`wallpaper-thumb-${id}`}
      onClick={onSelect}
      className="relative cursor-pointer overflow-hidden bg-cover bg-center"
      style={{
        aspectRatio: '9 / 19.5',
        borderRadius: 'var(--radius-button)',
        backgroundImage: `url(${src})`,
        outline: isSelected ? '3px solid var(--color-systemBlue)' : 'none',
        outlineOffset: '-1px',
      }}
    >
      {onDelete && (
        <div
          data-testid={`wallpaper-delete-${id}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(e);
          }}
          className="absolute top-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/50"
        >
          <X size={12} color="white" />
        </div>
      )}
      {isSelected && <CheckMark />}
    </div>
  );
}

export function WallpaperPage() {
  const wallpaperId = useSystemStore((s) => s.wallpaperId);
  const setWallpaper = useSystemStore((s) => s.setWallpaper);
  const customWallpapers = useSystemStore((s) => s.customWallpapers);
  const addCustomWallpaper = useSystemStore((s) => s.addCustomWallpaper);
  const removeCustomWallpaper = useSystemStore((s) => s.removeCustomWallpaper);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = await resizeImage(file);
    const id = `custom-${Date.now()}`;
    addCustomWallpaper({ id, src });
    setWallpaper(id);
    e.target.value = '';
  };

  const currentWallpaper =
    customWallpapers.find((w) => w.id === wallpaperId) ??
    wallpapers.find((w) => w.id === wallpaperId) ??
    wallpapers[0]!;

  return (
    <div data-testid="wallpaper-page" className="h-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        data-testid="wallpaper-file-input"
      />

      <List>
        {/* Compact current wallpaper preview */}
        <ListSection title="当前壁纸">
          <div className="flex justify-center px-3 py-4">
            <div
              data-testid="wallpaper-preview"
              className="relative overflow-hidden bg-cover bg-center shadow-lg"
              style={{
                width: '40%',
                aspectRatio: '9 / 19.5',
                borderRadius: 'var(--radius-card)',
                backgroundImage: `url(${currentWallpaper.src})`,
              }}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  borderRadius: 'var(--radius-card)',
                  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
                }}
              />
            </div>
          </div>
        </ListSection>

        {/* Custom wallpapers with upload */}
        <ListSection title="我的壁纸">
          <div className="grid grid-cols-3 gap-3 p-3">
            <div
              data-testid="wallpaper-upload-btn"
              onClick={handleUpload}
              className="flex cursor-pointer items-center justify-center overflow-hidden"
              style={{
                aspectRatio: '9 / 19.5',
                borderRadius: 'var(--radius-button)',
                backgroundColor: 'var(--color-tertiarySystemBackground)',
                border: '2px dashed var(--color-separator)',
              }}
            >
              <Plus size={28} color="var(--color-secondaryLabel)" />
            </div>

            {customWallpapers.map((w) => (
              <WallpaperThumb
                key={w.id}
                id={w.id}
                src={w.src}
                isSelected={w.id === wallpaperId}
                onSelect={() => setWallpaper(w.id)}
                onDelete={() => removeCustomWallpaper(w.id)}
              />
            ))}
          </div>
        </ListSection>

        {/* System default wallpapers */}
        <ListSection title="系统壁纸">
          <div className="grid grid-cols-3 gap-3 p-3">
            {wallpapers.map((w) => (
              <WallpaperThumb
                key={w.id}
                id={w.id}
                src={w.src}
                isSelected={w.id === wallpaperId}
                onSelect={() => setWallpaper(w.id)}
              />
            ))}
          </div>
        </ListSection>
      </List>
    </div>
  );
}
