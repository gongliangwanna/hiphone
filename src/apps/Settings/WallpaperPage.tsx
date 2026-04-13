import { useRef } from 'react';
import { Plus, X } from 'lucide-react';
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
      style={{
        position: 'absolute',
        bottom: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: '50%',
        backgroundColor: 'var(--color-systemBlue)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M2 7L5.5 10.5L12 4"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
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

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeCustomWallpaper(id);
  };

  const gridStyle = {
    padding: 'var(--spacing-3)',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 'var(--spacing-3)',
  };

  const thumbStyle = {
    position: 'relative' as const,
    aspectRatio: '9 / 16',
    borderRadius: 'var(--radius-chip)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    cursor: 'pointer',
    overflow: 'hidden' as const,
  };

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

      {/* Custom wallpapers section — always shown so user can upload */}
      <List>
        <ListSection title="自定义壁纸">
          <div style={gridStyle}>
            {/* Upload button */}
            <div
              data-testid="wallpaper-upload-btn"
              onClick={handleUpload}
              style={{
                ...thumbStyle,
                backgroundColor: 'var(--color-tertiarySystemBackground)',
                border: '2px dashed var(--color-separator)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={32} color="var(--color-secondaryLabel)" />
            </div>

            {/* Custom wallpaper thumbnails */}
            {customWallpapers.map((w) => {
              const isSelected = w.id === wallpaperId;
              return (
                <div
                  key={w.id}
                  data-testid={`wallpaper-thumb-${w.id}`}
                  onClick={() => setWallpaper(w.id)}
                  style={{ ...thumbStyle, backgroundImage: `url(${w.src})` }}
                >
                  {/* Delete button */}
                  <div
                    data-testid={`wallpaper-delete-${w.id}`}
                    onClick={(e) => handleRemove(e, w.id)}
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1,
                    }}
                  >
                    <X size={14} color="white" />
                  </div>
                  {isSelected && <CheckMark />}
                </div>
              );
            })}
          </div>
        </ListSection>
      </List>

      {/* Stock wallpapers section */}
      <List>
        <ListSection title="选取新壁纸">
          <div style={gridStyle}>
            {wallpapers.map((w) => {
              const isSelected = w.id === wallpaperId;
              return (
                <div
                  key={w.id}
                  data-testid={`wallpaper-thumb-${w.id}`}
                  onClick={() => setWallpaper(w.id)}
                  style={{ ...thumbStyle, backgroundImage: `url(${w.src})` }}
                >
                  {isSelected && <CheckMark />}
                </div>
              );
            })}
          </div>
        </ListSection>
      </List>
    </div>
  );
}
