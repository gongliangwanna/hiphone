import React, { useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BOARD_SIZE,
  useGomokuStore,
  type PlayerStone,
  type Stone,
} from './gomokuStore';

const CELL_SIZE = 22; // px per cell
const STONE_R = 9.8;    // stone radius in px
const PADDING = 20;   // board padding
const BOARD_PX = CELL_SIZE * (BOARD_SIZE - 1) + PADDING * 2;

/** Single stone */
function StoneView({
  row,
  col,
  stone,
  isLast,
  isWinStone,
}: {
  row: number;
  col: number;
  stone: Stone;
  isLast: boolean;
  isWinStone: boolean;
}) {
  if (!stone) return null;

  const cx = PADDING + col * CELL_SIZE;
  const cy = PADDING + row * CELL_SIZE;

  return (
    <motion.g 
      style={{ transformOrigin: `${cx}px ${cy}px` }}
      initial={{ scale: 1.5, opacity: 0, y: -20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 450, damping: 25 }}
    >
      {/* Shadow */}
      <circle cx={cx + 1} cy={cy + 2} r={STONE_R} fill="rgba(0,0,0,0.3)" filter="url(#stoneShadow)" />
      
      {/* Stone body */}
      <circle
        cx={cx}
        cy={cy}
        r={STONE_R}
        fill={stone === 'black' ? 'url(#blackStone)' : 'url(#whiteStone)'}
        stroke={stone === 'white' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'}
        strokeWidth={0.5}
      />
      
      {/* Highlight on stone to make it glossy (Yunzi/Shell effect) */}
      <ellipse
        cx={cx - 2}
        cy={cy - 3}
        rx={STONE_R * 0.6}
        ry={STONE_R * 0.4}
        fill={stone === 'black' ? 'url(#blackHighlight)' : 'url(#whiteHighlight)'}
        transform={`rotate(-30 ${cx - 2} ${cy - 3})`}
      />

      {/* Last move indicator */}
      {isLast && !isWinStone && (
        <circle
          cx={cx}
          cy={cy}
          r={2.5}
          fill={stone === 'black' ? '#ff4757' : '#ff6b81'}
        />
      )}
      
      {/* Win glow */}
      {isWinStone && (
        <motion.circle
          cx={cx}
          cy={cy}
          r={STONE_R + 4}
          fill="none"
          stroke="#FFD700"
          strokeWidth={2.5}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0.4, 0.8] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ filter: 'drop-shadow(0 0 4px rgba(255,215,0,0.8))' }}
        />
      )}
    </motion.g>
  );
}

export function GomokuBoard({
  disabled = false,
  onPlaceStone,
  previewStone,
}: {
  disabled?: boolean;
  onPlaceStone?: (row: number, col: number) => void;
  previewStone?: PlayerStone;
}) {
  const board = useGomokuStore((s) => s.board);
  const moves = useGomokuStore((s) => s.moves);
  const result = useGomokuStore((s) => s.result);
  const placeStone = useGomokuStore((s) => s.placeStone);
  const currentPlayer = useGomokuStore((s) => s.currentPlayer);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverCell, setHoverCell] = useState<{row: number, col: number} | null>(null);

  const lastMove = moves.length > 0 ? moves[moves.length - 1] : null;
  const winSet = new Set(result?.line.map(([r, c]) => `${r},${c}`) ?? []);
  const isLocked = disabled || Boolean(result);

  const getCellFromEvent = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = BOARD_PX / rect.width;
    const scaleY = BOARD_PX / rect.height;

    let clientX: number, clientY: number;
    if ('touches' in e) {
      const touch = e.touches[0] ?? e.changedTouches[0];
      if (!touch) return null;
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const col = Math.round((x - PADDING) / CELL_SIZE);
    const row = Math.round((y - PADDING) / CELL_SIZE);

    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
    return { row, col };
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
      if (isLocked) return;
      const cell = getCellFromEvent(e);
      if (cell) {
        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(10);
        if (onPlaceStone) {
          onPlaceStone(cell.row, cell.col);
        } else {
          placeStone(cell.row, cell.col);
        }
        setHoverCell(null);
      }
    },
    [placeStone, getCellFromEvent, isLocked, onPlaceStone],
  );

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isLocked) {
      setHoverCell(null);
      return;
    }
    const cell = getCellFromEvent(e);
    if (cell && !board[cell.row]?.[cell.col]) {
      setHoverCell(cell);
    } else {
      setHoverCell(null);
    }
  }, [getCellFromEvent, board, isLocked]);

  const handlePointerLeave = useCallback(() => {
    setHoverCell(null);
  }, []);

  // Grid lines
  const gridLines: React.JSX.Element[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const pos = PADDING + i * CELL_SIZE;
    // horizontal
    gridLines.push(
      <line
        key={`h${i}`}
        x1={PADDING}
        y1={pos}
        x2={PADDING + (BOARD_SIZE - 1) * CELL_SIZE}
        y2={pos}
        stroke="#5C4033"
        strokeWidth={0.8}
        strokeOpacity={0.6}
        strokeLinecap="square"
      />,
    );
    // vertical
    gridLines.push(
      <line
        key={`v${i}`}
        x1={pos}
        y1={PADDING}
        x2={pos}
        y2={PADDING + (BOARD_SIZE - 1) * CELL_SIZE}
        stroke="#5C4033"
        strokeWidth={0.8}
        strokeOpacity={0.6}
        strokeLinecap="square"
      />,
    );
  }

  // Star points (天元 + 4 corners)
  const starPoints: [number, number][] = [
    [7, 7],
    [3, 3], [3, 11], [11, 3], [11, 11],
  ];

  // Win line
  const winLine = result?.line;
  const winLineElement = winLine && winLine.length >= 2 && winLine[0] && winLine[winLine.length - 1] ? (
    <motion.line
      x1={PADDING + winLine[0][1] * CELL_SIZE}
      y1={PADDING + winLine[0][0] * CELL_SIZE}
      x2={PADDING + winLine[winLine.length - 1]![1] * CELL_SIZE}
      y2={PADDING + winLine[winLine.length - 1]![0] * CELL_SIZE}
      stroke="url(#winGradient)"
      strokeWidth={6}
      strokeLinecap="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 0.8 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      style={{ filter: 'drop-shadow(0 0 6px rgba(255,215,0,0.6))' }}
    />
  ) : null;

  return (
    <div className="flex w-full items-center justify-center p-2">
      <div 
        className="relative w-full max-w-[360px]"
        style={{
          borderRadius: 20,
          background: 'linear-gradient(135deg, #a46d33 0%, #824b17 100%)', // Wood border color
          boxShadow: '0 12px 32px rgba(0,0,0,0.2), inset 0 2px 5px rgba(255,255,255,0.1)',
          padding: 6, // Border thickness
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${BOARD_PX} ${BOARD_PX}`}
          className="w-full h-full touch-none select-none block"
          style={{
            borderRadius: 14,
            background: 'linear-gradient(135deg, #DEB887 0%, #C89445 100%)', // Inner wood board color
            boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.4), inset 0 -4px 10px rgba(0,0,0,0.1)',
          }}
          onClick={handleClick}
          onMouseMove={handlePointerMove}
          onTouchMove={handlePointerMove}
          onMouseLeave={handlePointerLeave}
          onTouchEnd={handlePointerLeave}
        >
          <defs>
            <filter id="stoneShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.4" />
            </filter>
            
            <radialGradient id="blackStone" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#4A4A4A" />
              <stop offset="30%" stopColor="#222222" />
              <stop offset="70%" stopColor="#0A0A0A" />
              <stop offset="100%" stopColor="#050505" />
            </radialGradient>
            
            <radialGradient id="whiteStone" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="40%" stopColor="#F8F8F8" />
              <stop offset="80%" stopColor="#E0E0E0" />
              <stop offset="100%" stopColor="#C8C8C8" />
            </radialGradient>

            <linearGradient id="blackHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
            
            <linearGradient id="whiteHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>

            <linearGradient id="winGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFD700" />
              <stop offset="50%" stopColor="#FFA500" />
              <stop offset="100%" stopColor="#FF8C00" />
            </linearGradient>
          </defs>

          {/* Grid */}
          {gridLines}

          {/* Star points */}
          {starPoints.map(([r, c]) => (
            <circle
              key={`star-${r}-${c}`}
              cx={PADDING + c * CELL_SIZE}
              cy={PADDING + r * CELL_SIZE}
              r={3.5}
              fill="#6b4c2a"
            />
          ))}

          {/* Win line */}
          {winLineElement}

          {/* Hover indicator */}
          {hoverCell && !isLocked && (
            <circle
              cx={PADDING + hoverCell.col * CELL_SIZE}
              cy={PADDING + hoverCell.row * CELL_SIZE}
              r={STONE_R}
              fill={(previewStone ?? currentPlayer) === 'black' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.4)'}
              style={{ transition: 'all 0.1s ease-out' }}
            />
          )}

          {/* Stones */}
          <AnimatePresence>
            {board.map((row, ri) =>
              row.map((cell, ci) =>
                cell ? (
                  <StoneView
                    key={`${ri}-${ci}`}
                    row={ri}
                    col={ci}
                    stone={cell}
                    isLast={lastMove?.row === ri && lastMove?.col === ci}
                    isWinStone={winSet.has(`${ri},${ci}`)}
                  />
                ) : null,
              ),
            )}
          </AnimatePresence>
        </svg>
      </div>
    </div>
  );
}
