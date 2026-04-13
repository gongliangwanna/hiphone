import React, { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BOARD_SIZE, useGomokuStore, type Stone } from './gomokuStore';

const CELL_SIZE = 22; // px per cell
const STONE_R = 9.5;    // stone radius in px
const PADDING = 18;   // board padding
const BOARD_PX = CELL_SIZE * (BOARD_SIZE - 1) + PADDING * 2;

/** Single stone with spring-in animation */
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
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      style={{ originX: `${cx}px`, originY: `${cy}px` }}
    >
      {/* Shadow */}
      <circle cx={cx} cy={cy + 1.5} r={STONE_R} fill="rgba(0,0,0,0.15)" filter="url(#stoneShadow)" />
      
      {/* Stone body */}
      <circle
        cx={cx}
        cy={cy}
        r={STONE_R}
        fill={stone === 'black' ? 'url(#blackStone)' : 'url(#whiteStone)'}
        stroke={stone === 'white' ? 'rgba(0,0,0,0.04)' : 'none'}
        strokeWidth={stone === 'white' ? 0.5 : 0}
      />
      
      {/* Highlight on stone to make it glossy */}
      <circle
        cx={cx - 2.5}
        cy={cy - 2.5}
        r={STONE_R * 0.8}
        fill={stone === 'black' ? 'url(#blackHighlight)' : 'url(#whiteHighlight)'}
        opacity={0.8}
      />

      {/* Last move indicator */}
      {isLast && !isWinStone && (
        <motion.circle
          cx={cx}
          cy={cy}
          r={2.5}
          fill={stone === 'black' ? '#ff4757' : '#ff6b81'}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
        />
      )}
      
      {/* Win glow */}
      {isWinStone && (
        <motion.circle
          cx={cx}
          cy={cy}
          r={STONE_R + 3}
          fill="none"
          stroke="#FF9F43"
          strokeWidth={2}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: [0.3, 0.8, 0.3], scale: [1, 1.05, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </motion.g>
  );
}

export function GomokuBoard() {
  const board = useGomokuStore((s) => s.board);
  const moves = useGomokuStore((s) => s.moves);
  const result = useGomokuStore((s) => s.result);
  const placeStone = useGomokuStore((s) => s.placeStone);
  const svgRef = useRef<SVGSVGElement>(null);

  const lastMove = moves.length > 0 ? moves[moves.length - 1] : null;
  const winSet = new Set(result?.line.map(([r, c]) => `${r},${c}`) ?? []);

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = BOARD_PX / rect.width;
      const scaleY = BOARD_PX / rect.height;

      let clientX: number, clientY: number;
      if ('touches' in e) {
        const touch = e.touches[0] ?? e.changedTouches[0];
        if (!touch) return;
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

      if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return;
      placeStone(row, col);
    },
    [placeStone],
  );

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
        stroke="#D4C8B2"
        strokeWidth={1}
        strokeLinecap="round"
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
        stroke="#D4C8B2"
        strokeWidth={1}
        strokeLinecap="round"
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
      stroke="#FF9F43"
      strokeWidth={3}
      strokeLinecap="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 0.9 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    />
  ) : null;

  return (
    <div className="flex w-full items-center justify-center">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${BOARD_PX} ${BOARD_PX}`}
        className="w-full max-w-[360px] touch-none select-none"
        style={{
          aspectRatio: '1 / 1',
          borderRadius: 16,
          background: 'linear-gradient(180deg, #FDFBF7 0%, #EBE5D9 100%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08), inset 0 2px 4px rgba(255,255,255,0.8)',
        }}
        onClick={handleClick}
      >
        <defs>
          <filter id="stoneShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.25" />
          </filter>
          
          <radialGradient id="blackStone" cx="35%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#4A4A4A" />
            <stop offset="40%" stopColor="#222222" />
            <stop offset="100%" stopColor="#0A0A0A" />
          </radialGradient>
          
          <radialGradient id="whiteStone" cx="35%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="70%" stopColor="#F0F0F0" />
            <stop offset="100%" stopColor="#D4D4D4" />
          </radialGradient>

          <radialGradient id="blackHighlight" cx="30%" cy="30%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          
          <radialGradient id="whiteHighlight" cx="30%" cy="30%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* Grid */}
        {gridLines}

        {/* Star points */}
        {starPoints.map(([r, c]) => (
          <circle
            key={`star-${r}-${c}`}
            cx={PADDING + c * CELL_SIZE}
            cy={PADDING + r * CELL_SIZE}
            r={3}
            fill="#B3A387"
          />
        ))}

        {/* Win line */}
        {winLineElement}

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
  );
}
