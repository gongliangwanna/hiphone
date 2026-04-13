import { useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Undo2, Users, Bot, Trophy } from 'lucide-react';
import { AppScreen, NavBar, Material } from '@/system';
import { useGomokuStore } from './gomokuStore';
import { GomokuBoard } from './GomokuBoard';
import { getAIMove } from './gomokuAI';
import { wasAppKilled, clearAppKilled } from '@/platform/stores/appRuntimeStore';

export function GomokuApp() {
  const currentPlayer = useGomokuStore((s) => s.currentPlayer);
  const result = useGomokuStore((s) => s.result);
  const mode = useGomokuStore((s) => s.mode);
  const moves = useGomokuStore((s) => s.moves);
  const scores = useGomokuStore((s) => s.scores);
  const placeStone = useGomokuStore((s) => s.placeStone);
  const undo = useGomokuStore((s) => s.undo);
  const reset = useGomokuStore((s) => s.reset);
  const setMode = useGomokuStore((s) => s.setMode);
  const aiThinking = useRef(false);

  // Handle app kill
  useEffect(() => {
    if (wasAppKilled('gomoku')) {
      clearAppKilled('gomoku');
    }
  }, []);

  // AI move
  useEffect(() => {
    if (mode !== 'pve') return;
    if (result) return;
    if (currentPlayer !== 'white') return;
    if (aiThinking.current) return;

    aiThinking.current = true;
    const timer = setTimeout(() => {
      const board = useGomokuStore.getState().board;
      const move = getAIMove(board, 'white');
      if (move) {
        placeStone(move[0], move[1]);
      }
      aiThinking.current = false;
    }, 500); // More natural thinking delay

    return () => {
      clearTimeout(timer);
      aiThinking.current = false;
    };
  }, [currentPlayer, mode, result, placeStone]);

  const handleModeToggle = useCallback(() => {
    setMode(mode === 'pvp' ? 'pve' : 'pvp');
  }, [mode, setMode]);

  const isAITurn = mode === 'pve' && currentPlayer === 'white' && !result;

  return (
    <AppScreen backgroundColor="#F2F2F7">
      <NavBar
        title="五子棋"
        rightButtons={[
          {
            icon: mode === 'pve' ? <Bot size={22} strokeWidth={1.8} /> : <Users size={22} strokeWidth={1.8} />,
            onClick: handleModeToggle,
            testId: 'gomoku-mode-btn',
          },
        ]}
      />

      <div className="flex min-h-0 flex-1 flex-col pb-safe">
        {/* Score & Status Bar */}
        <div className="mx-4 mt-6 flex items-center justify-between rounded-2xl bg-white px-5 py-3 shadow-sm">
          {/* Black score */}
          <div className="flex flex-col items-center gap-1">
            <div
              className="h-6 w-6 rounded-full shadow-md"
              style={{
                background: 'radial-gradient(circle at 35% 30%, #4A4A4A 0%, #222222 40%, #0A0A0A 100%)',
              }}
            />
            <span className="text-xs font-semibold text-gray-800">
              {mode === 'pve' ? '你' : '黑棋'} · {scores.black}
            </span>
          </div>

          {/* Turn indicator */}
          <AnimatePresence mode="wait">
            <motion.div
              key={result ? 'result' : currentPlayer}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center justify-center"
            >
              {result ? (
                <div className="flex flex-col items-center gap-1">
                  <Trophy size={20} className="text-orange-500" strokeWidth={2} />
                  <span className="text-sm font-bold text-orange-600">
                    {result.winner === 'black'
                      ? mode === 'pve' ? '你赢了!' : '黑棋胜!'
                      : mode === 'pve' ? 'AI 胜!' : '白棋胜!'}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-medium text-gray-500">
                    {isAITurn ? '思考中...' : '等待落子'}
                  </span>
                  <div className="flex h-1.5 w-12 overflow-hidden rounded-full bg-gray-100">
                    {isAITurn ? (
                      <motion.div
                        className="h-full bg-blue-500"
                        initial={{ width: '0%', marginLeft: '0%' }}
                        animate={{ width: ['20%', '20%', '20%'], marginLeft: ['0%', '80%', '0%'] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    ) : (
                      <div className={`h-full w-full transition-colors duration-300 ${currentPlayer === 'black' ? 'bg-gray-800' : 'bg-gray-300'}`} />
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* White score */}
          <div className="flex flex-col items-center gap-1">
            <div
              className="h-6 w-6 rounded-full border border-gray-200 shadow-md"
              style={{
                background: 'radial-gradient(circle at 35% 30%, #FFFFFF 0%, #F0F0F0 70%, #D4D4D4 100%)',
              }}
            />
            <span className="text-xs font-semibold text-gray-800">
              {mode === 'pve' ? 'AI' : '白棋'} · {scores.white}
            </span>
          </div>
        </div>

        {/* Board */}
        <div className="flex flex-1 items-center justify-center px-4">
          <GomokuBoard />
        </div>

        {/* Controls - iOS Bottom Toolbar */}
        <div className="absolute bottom-0 left-0 right-0">
          <Material variant="chrome" className="flex items-center justify-between px-8 pb-safe pt-3 border-t border-black/5 dark:border-white/10">
            <button
              onClick={undo}
              disabled={moves.length === 0 || isAITurn}
              className="flex flex-col items-center gap-1 active:opacity-60 disabled:opacity-30 transition-opacity"
            >
              <Undo2 size={24} className="text-blue-500" strokeWidth={2} />
              <span className="text-[10px] font-medium text-blue-500">悔棋</span>
            </button>

            <button
              onClick={reset}
              className="flex flex-col items-center gap-1 active:opacity-60 transition-opacity"
            >
              <RotateCcw size={24} className="text-blue-500" strokeWidth={2} />
              <span className="text-[10px] font-medium text-blue-500">新局</span>
            </button>
          </Material>
        </div>
      </div>
    </AppScreen>
  );
}
