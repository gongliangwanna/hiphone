import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Undo2, Trash2 } from 'lucide-react';
import { T } from '../theme';

const BRUSH_COLORS = [
  '#1A1425', // dark
  '#BA90C6', // accent purple
  '#E8A0BF', // pink
  '#D4A0A0', // rose
  '#9DC5BB', // mint
  '#9BB5D0', // sky
  '#D4B896', // gold
  '#FF6B6B', // red
];

const BRUSH_SIZES = [3, 6, 10];

interface DrawingCanvasProps {
  visible: boolean;
  onSend: (dataUrl: string) => void;
  onClose: () => void;
}

interface PathPoint {
  x: number;
  y: number;
}

interface DrawPath {
  points: PathPoint[];
  color: string;
  size: number;
}

export function DrawingCanvas({ visible, onSend, onClose }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [currentPath, setCurrentPath] = useState<PathPoint[]>([]);
  const [color, setColor] = useState(BRUSH_COLORS[0]!);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]!);
  const isDrawingRef = useRef(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const path of paths) {
      if (path.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.size;
      ctx.moveTo(path.points[0]!.x, path.points[0]!.y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i]!.x, path.points[i]!.y);
      }
      ctx.stroke();
    }

    // Draw current path
    if (currentPath.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.moveTo(currentPath[0]!.x, currentPath[0]!.y);
      for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(currentPath[i]!.x, currentPath[i]!.y);
      }
      ctx.stroke();
    }
  }, [paths, currentPath, color, brushSize]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Resize canvas to fit container
  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    redraw();
  }, [visible, redraw]);

  const getPos = (e: React.TouchEvent | React.PointerEvent): PathPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return null;
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const pos = getPos(e);
    if (!pos) return;
    isDrawingRef.current = true;
    setCurrentPath([pos]);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawingRef.current) return;
    const pos = getPos(e);
    if (!pos) return;
    setCurrentPath((prev) => [...prev, pos]);
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (currentPath.length >= 2) {
      setPaths((prev) => [...prev, { points: currentPath, color, size: brushSize }]);
    }
    setCurrentPath([]);
  };

  const handleUndo = () => {
    setPaths((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPaths([]);
    setCurrentPath([]);
  };

  const handleSend = () => {
    const canvas = canvasRef.current;
    if (!canvas || paths.length === 0) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSend(dataUrl);
    setPaths([]);
    setCurrentPath([]);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute inset-0 z-50 flex flex-col"
          style={{ backgroundColor: T.bg }}
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        >
          {/* Header */}
          <div
            className="flex shrink-0 items-center justify-between px-3"
            style={{ height: 52, borderBottom: `0.5px solid ${T.separator}` }}
          >
            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.9 }}
              className="flex items-center justify-center"
              style={{ width: 36, height: 36 }}
            >
              <X size={20} strokeWidth={2} color={T.textSecondary} />
            </motion.button>
            <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>画画</span>
            <motion.button
              onClick={handleSend}
              whileTap={paths.length > 0 ? { scale: 0.9 } : undefined}
              className="flex items-center gap-1.5 rounded-full"
              style={{
                padding: '6px 14px',
                background: paths.length > 0 ? T.accentGrad : T.border,
                opacity: paths.length > 0 ? 1 : 0.5,
              }}
              disabled={paths.length === 0}
            >
              <Send size={13} strokeWidth={2.2} color={paths.length > 0 ? T.textOnAccent : T.textMuted} />
              <span style={{ fontSize: 12, fontWeight: 600, color: paths.length > 0 ? T.textOnAccent : T.textMuted }}>
                发送
              </span>
            </motion.button>
          </div>

          {/* Canvas */}
          <div className="relative min-h-0 flex-1" style={{ backgroundColor: '#fff' }}>
            <canvas
              ref={canvasRef}
              className="absolute inset-0 touch-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              style={{ cursor: 'crosshair' }}
            />
          </div>

          {/* Tools */}
          <div
            className="shrink-0 px-3 py-3"
            style={{
              backgroundColor: T.overlay,
              borderTop: `0.5px solid ${T.separator}`,
            }}
          >
            {/* Colors */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {BRUSH_COLORS.map((c) => (
                  <motion.button
                    key={c}
                    className="rounded-full"
                    style={{
                      width: 24,
                      height: 24,
                      backgroundColor: c,
                      border: color === c ? `2.5px solid ${T.accent}` : '2px solid transparent',
                      boxShadow: color === c ? T.shadow2 : 'none',
                    }}
                    onClick={() => setColor(c)}
                    whileTap={{ scale: 0.85 }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1">
                {BRUSH_SIZES.map((s) => (
                  <motion.button
                    key={s}
                    className="flex items-center justify-center rounded-full"
                    style={{
                      width: 28,
                      height: 28,
                      backgroundColor: brushSize === s ? `${T.accent}20` : 'transparent',
                    }}
                    onClick={() => setBrushSize(s)}
                    whileTap={{ scale: 0.85 }}
                  >
                    <div
                      className="rounded-full"
                      style={{ width: s + 2, height: s + 2, backgroundColor: T.textPrimary }}
                    />
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-2 flex items-center justify-center gap-4">
              <motion.button
                className="flex items-center gap-1.5 rounded-lg"
                style={{ padding: '6px 12px', backgroundColor: T.card }}
                onClick={handleUndo}
                whileTap={{ scale: 0.9 }}
                disabled={paths.length === 0}
              >
                <Undo2 size={15} strokeWidth={1.8} color={paths.length > 0 ? T.textSecondary : T.textMuted} />
                <span style={{ fontSize: 12, color: paths.length > 0 ? T.textSecondary : T.textMuted }}>撤销</span>
              </motion.button>
              <motion.button
                className="flex items-center gap-1.5 rounded-lg"
                style={{ padding: '6px 12px', backgroundColor: T.card }}
                onClick={handleClear}
                whileTap={{ scale: 0.9 }}
                disabled={paths.length === 0}
              >
                <Trash2 size={15} strokeWidth={1.8} color={paths.length > 0 ? T.rose : T.textMuted} />
                <span style={{ fontSize: 12, color: paths.length > 0 ? T.rose : T.textMuted }}>清空</span>
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
