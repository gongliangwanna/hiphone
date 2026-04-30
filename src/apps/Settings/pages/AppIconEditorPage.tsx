import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { Check, ImagePlus } from 'lucide-react';
import {
  getResolvedAppMetadata,
  type ResolvedAppMetadata,
} from '@/platform/appMetadataResolver';
import {
  useAppProfileStore,
  type AppIconCrop,
} from '@/platform/stores/appProfileStore';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import { List, ListSection } from '@/system';

const ICON_OUTPUT_SIZE = 512;
const ICON_OUTPUT_MIME_TYPE = 'image/jpeg';
const ICON_OUTPUT_QUALITY = 0.82;
const ICON_OUTPUT_BACKGROUND = '#fff';
const PREVIEW_FALLBACK_SIZE = 240;
const CROP_FRAME_RATIO = 0.68;
const CROP_FRAME_PERCENT = CROP_FRAME_RATIO * 100;
const CROP_FRAME_INSET_PERCENT = (100 - CROP_FRAME_PERCENT) / 2;
const CROP_FRAME_RADIUS_STAGE_PERCENT = 12;
const CROP_FRAME_RADIUS_PERCENT =
  (CROP_FRAME_RADIUS_STAGE_PERCENT / CROP_FRAME_PERCENT) * 100;
const MIN_SCALE = 1;
const MAX_SCALE = 5;

interface AppIconEditorPageProps {
  params?: Record<string, string>;
}

interface LoadedImageSource {
  dataUrl: string;
  width: number;
  height: number;
}

type IconSourceOrigin = 'app' | 'upload' | 'saved';

interface CropOptions {
  outputSize?: number;
  minScale?: number;
  maxScale?: number;
}

export interface PinchInput {
  previousCenterX: number;
  previousCenterY: number;
  nextCenterX: number;
  nextCenterY: number;
  previousDistance?: number;
  nextDistance?: number;
  nextScale?: number;
}

interface ActivePointer {
  id: number;
  x: number;
  y: number;
}

export function clampScale(
  scale: number,
  minScale: number = MIN_SCALE,
  maxScale: number = MAX_SCALE,
): number {
  if (!Number.isFinite(scale)) return minScale;
  return Math.min(maxScale, Math.max(minScale, scale));
}

function getRenderedImageSize(crop: AppIconCrop, outputSize: number) {
  if (crop.sourceWidth <= 0 || crop.sourceHeight <= 0) {
    return { width: outputSize, height: outputSize };
  }

  const coverScale = Math.max(
    outputSize / crop.sourceWidth,
    outputSize / crop.sourceHeight,
  );

  return {
    width: crop.sourceWidth * coverScale * crop.scale,
    height: crop.sourceHeight * coverScale * crop.scale,
  };
}

function clampOffset(offset: number, maxOffset: number): number {
  if (!Number.isFinite(offset)) return 0;
  return Math.min(maxOffset, Math.max(-maxOffset, offset));
}

function constrainCrop(crop: AppIconCrop, options: CropOptions = {}) {
  const outputSize = options.outputSize ?? ICON_OUTPUT_SIZE;
  const scale = clampScale(
    crop.scale,
    options.minScale ?? MIN_SCALE,
    options.maxScale ?? MAX_SCALE,
  );
  const sizedCrop = { ...crop, scale };
  const renderedSize = getRenderedImageSize(sizedCrop, outputSize);
  const maxOffsetX = Math.max(0, (renderedSize.width - outputSize) / 2);
  const maxOffsetY = Math.max(0, (renderedSize.height - outputSize) / 2);

  return {
    ...sizedCrop,
    offsetX: clampOffset(crop.offsetX, maxOffsetX),
    offsetY: clampOffset(crop.offsetY, maxOffsetY),
  };
}

export function applyPan(
  crop: AppIconCrop,
  deltaX: number,
  deltaY: number,
  options: CropOptions = {},
): AppIconCrop {
  return constrainCrop(
    {
      ...crop,
      offsetX: crop.offsetX + deltaX,
      offsetY: crop.offsetY + deltaY,
    },
    options,
  );
}

export function applyPinch(
  crop: AppIconCrop,
  input: PinchInput,
  options: CropOptions = {},
): AppIconCrop {
  const currentScale = clampScale(
    crop.scale,
    options.minScale ?? MIN_SCALE,
    options.maxScale ?? MAX_SCALE,
  );
  const nextScale =
    input.nextScale ??
    (input.previousDistance && input.previousDistance > 0 && input.nextDistance
      ? currentScale * (input.nextDistance / input.previousDistance)
      : currentScale);
  const clampedNextScale = clampScale(
    nextScale,
    options.minScale ?? MIN_SCALE,
    options.maxScale ?? MAX_SCALE,
  );
  const scaleRatio = clampedNextScale / currentScale;

  return constrainCrop(
    {
      ...crop,
      scale: clampedNextScale,
      offsetX:
        input.nextCenterX - (input.previousCenterX - crop.offsetX) * scaleRatio,
      offsetY:
        input.nextCenterY - (input.previousCenterY - crop.offsetY) * scaleRatio,
    },
    options,
  );
}

export function createCroppedIconDataUrl(
  sourceDataUrl: string,
  crop: AppIconCrop,
  outputSize: number = ICON_OUTPUT_SIZE,
): Promise<string> {
  return loadImage(sourceDataUrl).then(({ image }) => {
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context is unavailable.');
    }

    context.clearRect(0, 0, outputSize, outputSize);
    context.fillStyle = ICON_OUTPUT_BACKGROUND;
    context.fillRect(0, 0, outputSize, outputSize);
    const normalizedCrop = constrainCrop(crop, { outputSize });
    const coverScale = Math.max(
      outputSize / normalizedCrop.sourceWidth,
      outputSize / normalizedCrop.sourceHeight,
    );
    const drawWidth =
      normalizedCrop.sourceWidth * coverScale * normalizedCrop.scale;
    const drawHeight =
      normalizedCrop.sourceHeight * coverScale * normalizedCrop.scale;
    const drawX = (outputSize - drawWidth) / 2 + normalizedCrop.offsetX;
    const drawY = (outputSize - drawHeight) / 2 + normalizedCrop.offsetY;

    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

    return canvas.toDataURL(ICON_OUTPUT_MIME_TYPE, ICON_OUTPUT_QUALITY);
  });
}

function loadImage(dataUrl: string): Promise<{
  image: HTMLImageElement;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();

    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;

      if (width <= 0 || height <= 0) {
        reject(new Error('Image dimensions are unavailable.'));
        return;
      }

      resolve({ image, width, height });
    };
    image.onerror = () => reject(new Error('Image failed to load.'));
    image.src = dataUrl;
  });
}

function createInitialCrop(width: number, height: number): AppIconCrop {
  return {
    sourceWidth: width,
    sourceHeight: height,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  };
}

function getSortedPointers(
  pointers: Map<number, { x: number; y: number }>,
): ActivePointer[] {
  return Array.from(pointers, ([id, point]) => ({
    id,
    x: point.x,
    y: point.y,
  })).sort((a, b) => a.id - b.id);
}

function getPairMetrics(pointerA: ActivePointer, pointerB: ActivePointer) {
  const centerX = (pointerA.x + pointerB.x) / 2;
  const centerY = (pointerA.y + pointerB.y) / 2;
  const distance = Math.hypot(pointerA.x - pointerB.x, pointerA.y - pointerB.y);

  return { centerX, centerY, distance };
}

function findPointerById(pointers: ActivePointer[], id: number) {
  return pointers.find((pointer) => pointer.id === id);
}

export function AppIconEditorPage({ params }: AppIconEditorPageProps) {
  const appId = params?.appId;
  const installedApps = useInstalledUserAppsStore((state) => state.apps);
  const profiles = useAppProfileStore((state) => state.profiles);
  const setIcon = useAppProfileStore((state) => state.setIcon);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageLoadRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const lastInitializedAppIdRef = useRef<string | null>(null);
  const sourceOriginRef = useRef<IconSourceOrigin>('app');
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(
    new Map(),
  );
  const cropRef = useRef<AppIconCrop | null>(null);
  const [source, setSource] = useState<LoadedImageSource | null>(null);
  const [crop, setCrop] = useState<AppIconCrop | null>(null);
  const [sourceOrigin, setSourceOrigin] = useState<IconSourceOrigin>('app');
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState('');

  const app = useMemo(
    () => (appId ? getResolvedAppMetadata(appId) : undefined),
    [appId, installedApps, profiles],
  );

  const setLoadedSource = (
    dataUrl: string,
    width: number,
    height: number,
    origin: IconSourceOrigin,
  ) => {
    const nextCrop = createInitialCrop(width, height);
    setSource({ dataUrl, width, height });
    setCrop(nextCrop);
    setSourceOrigin(origin);
    sourceOriginRef.current = origin;
    cropRef.current = nextCrop;
    activePointersRef.current.clear();
  };

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      imageLoadRequestIdRef.current += 1;
      activePointersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const requestId = imageLoadRequestIdRef.current + 1;
    imageLoadRequestIdRef.current = requestId;
    const appIdChanged = app?.id !== lastInitializedAppIdRef.current;
    lastInitializedAppIdRef.current = app?.id ?? null;

    if (!appIdChanged && sourceOriginRef.current !== 'app') {
      return;
    }

    activePointersRef.current.clear();
    if (appIdChanged) {
      setStatusText('');
      setSourceOrigin('app');
      sourceOriginRef.current = 'app';
    }

    if (!app?.displayIcon) {
      setSource(null);
      setCrop(null);
      cropRef.current = null;
      setSourceOrigin('app');
      sourceOriginRef.current = 'app';
      return;
    }

    loadImage(app.displayIcon)
      .then(({ width, height }) => {
        if (!alive || imageLoadRequestIdRef.current !== requestId) return;
        const appIcon = app.displayIcon!;
        setLoadedSource(appIcon, width, height, 'app');
      })
      .catch(() => {
        if (!alive || imageLoadRequestIdRef.current !== requestId) return;
        setSource(null);
        setCrop(null);
        cropRef.current = null;
        setSourceOrigin('app');
        sourceOriginRef.current = 'app';
      });

    return () => {
      alive = false;
    };
  }, [app?.id, app?.displayIcon]);

  if (!app) {
    return <MissingAppState />;
  }

  const commitCrop = (nextCrop: AppIconCrop) => {
    cropRef.current = nextCrop;
    setCrop(nextCrop);
  };

  const resetSource = (
    dataUrl: string,
    width: number,
    height: number,
  ) => {
    setLoadedSource(dataUrl, width, height, 'upload');
    setStatusText('');
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const requestId = imageLoadRequestIdRef.current + 1;
    imageLoadRequestIdRef.current = requestId;
    setStatusText('');

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      if (!dataUrl) return;

      void loadImage(dataUrl)
        .then(({ width, height }) => {
          if (
            !isMountedRef.current ||
            imageLoadRequestIdRef.current !== requestId
          ) {
            return;
          }
          resetSource(dataUrl, width, height);
        })
        .catch(() => {
          if (
            isMountedRef.current &&
            imageLoadRequestIdRef.current === requestId
          ) {
            setStatusText('读取失败');
          }
        });
    };
    reader.onerror = () => {
      if (isMountedRef.current && imageLoadRequestIdRef.current === requestId) {
        setStatusText('读取失败');
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const getPointInIconSpace = (
    element: HTMLDivElement,
    clientX: number,
    clientY: number,
  ) => {
    const rect = element.getBoundingClientRect();
    const stageSize = rect.width || PREVIEW_FALLBACK_SIZE;
    const frameSize = stageSize * CROP_FRAME_RATIO;
    const stageCenterX = rect.left + stageSize / 2;
    const stageCenterY = rect.top + stageSize / 2;
    const scale = ICON_OUTPUT_SIZE / frameSize;

    return {
      x: (clientX - stageCenterX) * scale,
      y: (clientY - stageCenterY) * scale,
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!cropRef.current) return;

    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can be unavailable for synthetic or interrupted events.
    }
    activePointersRef.current.set(
      event.pointerId,
      getPointInIconSpace(event.currentTarget, event.clientX, event.clientY),
    );
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!cropRef.current || !activePointersRef.current.has(event.pointerId)) {
      return;
    }

    event.preventDefault();
    const previousPointers = getSortedPointers(activePointersRef.current);
    activePointersRef.current.set(
      event.pointerId,
      getPointInIconSpace(event.currentTarget, event.clientX, event.clientY),
    );
    const nextPointers = getSortedPointers(activePointersRef.current);
    const currentCrop = cropRef.current;

    if (previousPointers.length >= 2 && nextPointers.length >= 2) {
      const previousA = previousPointers[0]!;
      const previousB = previousPointers[1]!;
      const nextA = findPointerById(nextPointers, previousA.id);
      const nextB = findPointerById(nextPointers, previousB.id);

      if (!nextA || !nextB) return;

      const previousMetrics = getPairMetrics(previousA, previousB);
      const nextMetrics = getPairMetrics(nextA, nextB);
      commitCrop(
        applyPinch(currentCrop, {
          previousCenterX: previousMetrics.centerX,
          previousCenterY: previousMetrics.centerY,
          nextCenterX: nextMetrics.centerX,
          nextCenterY: nextMetrics.centerY,
          previousDistance: previousMetrics.distance,
          nextDistance: nextMetrics.distance,
        }),
      );
      return;
    }

    if (previousPointers.length === 1 && nextPointers.length === 1) {
      const previousPointer = previousPointers[0]!;
      const nextPointer = nextPointers[0]!;
      commitCrop(
        applyPan(
          currentCrop,
          nextPointer.x - previousPointer.x,
          nextPointer.y - previousPointer.y,
        ),
      );
    }
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The browser may already have released capture before this handler runs.
    }
  };

  const handleWheel = (event: WheelEvent, element: HTMLDivElement) => {
    if (!cropRef.current) return;

    event.preventDefault();
    const anchor = getPointInIconSpace(element, event.clientX, event.clientY);
    const scaleFactor = event.deltaY < 0 ? 1.08 : 0.92;
    const currentCrop = cropRef.current;

    commitCrop(
      applyPinch(currentCrop, {
        previousCenterX: anchor.x,
        previousCenterY: anchor.y,
        nextCenterX: anchor.x,
        nextCenterY: anchor.y,
        nextScale: currentCrop.scale * scaleFactor,
      }),
    );
  };

  const handleSave = async () => {
    if (!source || !crop || isSaving) return;

    setIsSaving(true);
    setStatusText('');

    try {
      const normalizedCrop = constrainCrop(crop);
      const dataUrl = await createCroppedIconDataUrl(source.dataUrl, normalizedCrop);
      setIcon(app.id, {
        dataUrl,
        crop: normalizedCrop,
      });
      setLoadedSource(
        dataUrl,
        ICON_OUTPUT_SIZE,
        ICON_OUTPUT_SIZE,
        'saved',
      );
      setStatusText('已保存');
    } catch {
      setStatusText('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const isEditingIcon = sourceOrigin !== 'app' && source !== null && crop !== null;

  return (
    <div data-testid="app-icon-editor-page" className="h-full min-h-0">
      <List>
        <section className="flex flex-col items-center px-4 pb-6 pt-3">
          {isEditingIcon ? (
            <IconPreview
              app={app}
              source={source}
              crop={crop}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onLostPointerCapture={handlePointerEnd}
              onWheelNative={handleWheel}
            />
          ) : (
            <CurrentIconPreview app={app} source={source} />
          )}
          {!isEditingIcon && (
            <div
              className="mt-4 max-w-full truncate text-center"
              style={{
                color: 'var(--color-label)',
                fontSize: 'var(--font-size-title3)',
                fontWeight: 'var(--font-weight-semibold)',
              }}
            >
              {app.displayName}
            </div>
          )}
        </section>

        <ListSection title="图标">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div
              className="min-w-0 flex-1"
              style={{
                color: 'var(--color-label)',
                fontSize: 'var(--font-size-body)',
              }}
            >
              {isEditingIcon ? '更换图片' : '选择图片'}
            </div>
            <button
              type="button"
              data-testid="app-icon-upload-button"
              onClick={handleUploadClick}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-4"
              style={{
                minHeight: 34,
                backgroundColor: 'rgba(0,122,255,0.12)',
                color: 'var(--color-systemBlue)',
                fontSize: 'var(--font-size-callout)',
                fontWeight: 'var(--font-weight-semibold)',
              }}
            >
              <ImagePlus size={16} strokeWidth={2.2} />
              <span>选择</span>
            </button>
            <input
              ref={fileInputRef}
              data-testid="app-icon-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </ListSection>

        {isEditingIcon && (
          <ListSection>
            <button
              type="button"
              data-testid="app-icon-save"
              disabled={isSaving}
              onClick={handleSave}
              className="flex w-full items-center justify-center gap-2 px-4"
              style={{
                minHeight: 50,
                color: !isSaving
                  ? 'var(--color-systemBlue)'
                  : 'var(--color-tertiaryLabel)',
                fontSize: 'var(--font-size-body)',
                fontWeight: 'var(--font-weight-semibold)',
              }}
            >
              <Check size={18} strokeWidth={2.4} />
              <span>{isSaving ? '保存中' : '保存图标'}</span>
            </button>
          </ListSection>
        )}

        {statusText && (
          <div
            data-testid="app-icon-save-status"
            className="px-4 text-center"
            style={{
              color:
                statusText === '已保存'
                  ? 'var(--color-systemGreen)'
                  : 'var(--color-systemRed)',
              fontSize: 'var(--font-size-footnote)',
            }}
          >
            {statusText}
          </div>
        )}
      </List>
    </div>
  );
}

function CurrentIconPreview({
  app,
  source,
}: {
  app: ResolvedAppMetadata;
  source: LoadedImageSource | null;
}) {
  const iconSrc = source?.dataUrl ?? app.displayIcon;

  return (
    <div
      data-testid="app-icon-current-preview"
      className="flex items-center justify-center overflow-hidden"
      style={{
        width: 112,
        height: 112,
        borderRadius: 25,
        backgroundColor: 'var(--color-systemGray5)',
        boxShadow: '0 14px 34px rgba(0,0,0,0.16)',
      }}
    >
      {iconSrc ? (
        <img
          src={iconSrc}
          alt={`${app.displayName} 当前图标`}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <span
          style={{
            color: 'var(--color-secondaryLabel)',
            fontSize: 44,
            fontWeight: 'var(--font-weight-semibold)',
          }}
        >
          {app.displayName.slice(0, 1)}
        </span>
      )}
    </div>
  );
}

function IconPreview({
  app,
  source,
  crop,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  onWheelNative,
}: {
  app: ResolvedAppMetadata;
  source: LoadedImageSource;
  crop: AppIconCrop;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
  onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => void;
  onWheelNative: (event: WheelEvent, element: HTMLDivElement) => void;
}) {
  const cropAreaRef = useRef<HTMLDivElement>(null);
  const imageStyle = getPreviewImageStyle(source, crop);
  const maskId = `app-icon-crop-mask-${app.id}`;

  useEffect(() => {
    const element = cropAreaRef.current;
    if (!element) return;

    const handleWheel = (event: WheelEvent) => {
      onWheelNative(event, element);
    };

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [onWheelNative]);

  return (
    <div
      ref={cropAreaRef}
      data-testid="app-icon-crop-area"
      role="img"
      aria-label={`${app.displayName} 图标预览`}
      className="relative flex touch-none select-none items-center justify-center overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onLostPointerCapture}
      style={{
        width: 'min(86vw, 328px)',
        aspectRatio: '1 / 1',
        backgroundColor: 'transparent',
        cursor: 'grab',
      }}
    >
      <img
        data-testid="app-icon-preview-image"
        src={source.dataUrl}
        alt=""
        draggable={false}
        className="absolute max-w-none select-none"
        style={imageStyle}
      />
      <svg
        data-testid="app-icon-crop-mask"
        className="pointer-events-none absolute inset-0"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <mask
            id={maskId}
            x="0"
            y="0"
            width="100"
            height="100"
            maskUnits="userSpaceOnUse"
            maskContentUnits="userSpaceOnUse"
          >
            <rect x="0" y="0" width="100" height="100" fill="white" />
            <rect
              x={CROP_FRAME_INSET_PERCENT}
              y={CROP_FRAME_INSET_PERCENT}
              width={CROP_FRAME_PERCENT}
              height={CROP_FRAME_PERCENT}
              rx={CROP_FRAME_RADIUS_STAGE_PERCENT}
              ry={CROP_FRAME_RADIUS_STAGE_PERCENT}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100"
          height="100"
          fill="rgba(0,0,0,0.34)"
          mask={`url(#${maskId})`}
        />
      </svg>
      <div
        data-testid="app-icon-crop-frame"
        className="pointer-events-none absolute"
        style={{
          left: `${CROP_FRAME_INSET_PERCENT}%`,
          top: `${CROP_FRAME_INSET_PERCENT}%`,
          width: `${CROP_FRAME_PERCENT}%`,
          height: `${CROP_FRAME_PERCENT}%`,
          borderRadius: `${CROP_FRAME_RADIUS_PERCENT}%`,
          border: '2px solid rgba(255,255,255,0.96)',
          boxShadow:
            '0 0 0 1px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(0,0,0,0.12)',
        }}
      />
    </div>
  );
}

function getPreviewImageStyle(
  source: LoadedImageSource,
  crop: AppIconCrop,
): CSSProperties {
  const aspectRatio = source.width / source.height;
  const baseWidthPercent = aspectRatio >= 1 ? aspectRatio * 100 : 100;
  const baseHeightPercent = aspectRatio >= 1 ? 100 : (1 / aspectRatio) * 100;

  return {
    width: `${baseWidthPercent * crop.scale * CROP_FRAME_RATIO}%`,
    height: `${baseHeightPercent * crop.scale * CROP_FRAME_RATIO}%`,
    left: `calc(50% + ${
      (crop.offsetX / ICON_OUTPUT_SIZE) * CROP_FRAME_PERCENT
    }%)`,
    top: `calc(50% + ${
      (crop.offsetY / ICON_OUTPUT_SIZE) * CROP_FRAME_PERCENT
    }%)`,
    transform: 'translate(-50%, -50%)',
    objectFit: 'fill',
  };
}

function MissingAppState() {
  return (
    <div
      data-testid="app-icon-editor-empty"
      className="flex h-full items-center justify-center px-8 text-center"
    >
      <div>
        <div
          className="mx-auto mb-4 flex items-center justify-center"
          style={{
            width: 76,
            height: 76,
            borderRadius: 18,
            backgroundColor: 'var(--color-tertiarySystemBackground)',
            color: 'var(--color-tertiaryLabel)',
            fontSize: 32,
            fontWeight: 'var(--font-weight-semibold)',
          }}
        >
          ?
        </div>
        <div
          style={{
            color: 'var(--color-label)',
            fontSize: 'var(--font-size-title3)',
            fontWeight: 'var(--font-weight-semibold)',
          }}
        >
          App 不存在
        </div>
      </div>
    </div>
  );
}
