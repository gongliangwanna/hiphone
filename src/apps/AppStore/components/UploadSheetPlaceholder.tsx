import { X } from 'lucide-react';
import { UploadPage } from '../UploadPage';

interface Props {
  onClose: () => void;
}

/**
 * P2 temporary sheet shell wrapping existing UploadPage.
 * P3 replaces with full UploadSheet state machine
 * (idle → installing → needsUpgradeConfirm → success/error).
 */
export function UploadSheetPlaceholder({ onClose }: Props) {
  return (
    <div
      data-testid="appstore-upload-sheet"
      className="absolute inset-0 z-20 flex flex-col"
    >
      <div
        role="presentation"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative mt-auto bg-[var(--color-background)] rounded-t-[14px] flex flex-col min-h-[60%] max-h-[90%]">
        <div className="relative flex items-center justify-between px-4 py-3 border-b border-[var(--color-separator)]">
          <div className="w-[36px] h-[5px] rounded-full bg-[var(--color-fill-tertiary)] absolute left-1/2 -translate-x-1/2 top-2" />
          <span className="text-[17px] font-semibold text-[var(--color-label)] mt-2">
            上传 App
          </span>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-fill-secondary)]"
          >
            <X size={16} strokeWidth={2.5} className="text-[var(--color-secondaryLabel)]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <UploadPage />
        </div>
      </div>
    </div>
  );
}
