import { useRef, useState, type DragEvent } from 'react';
import { ArrowUp } from 'lucide-react';

interface Props {
  onFile: (file: File) => void;
}

export function DropZoneView({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      data-testid="upload-drop-zone"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setActive(true); }}
      onDragLeave={() => setActive(false)}
      onDrop={handleDrop}
      className={`min-h-[180px] rounded-[14px] border-2 border-dashed bg-white
        flex flex-col items-center justify-center text-center px-4 py-5 cursor-pointer
        transition-colors
        ${active
          ? 'border-[var(--color-systemBlue)]'
          : 'border-[rgba(0,122,255,0.4)]'}`}
    >
      <ArrowUp size={34} strokeWidth={1.75}
        className="text-[var(--color-systemBlue)]" />
      <div className="text-[14px] font-semibold text-[var(--color-label)] mt-2">
        拖入或点击选择
      </div>
      <div className="text-[11px] text-[var(--color-secondaryLabel)] mt-1">
        需包含 manifest.json + 入口 TSX
      </div>
      <input
        ref={inputRef}
        data-testid="upload-file-input"
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
