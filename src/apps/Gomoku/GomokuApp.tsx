import { useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Undo2, Users, Bot, Trophy } from 'lucide-react';
import { AppScreen, NavBar } from '@/system';
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
        <div className="mx-4 mt-6">
          <div
            className="flex items-center justify-between rounded-[24px] px-6 py-4"
            style={{ backgroundColor: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '0.5px solid rgba(0,0,0,0.06)' }}
          >
            {/* Black score */}
            <div className="flex flex-col items-center gap-1.5 min-w-[60px]">
              <div
                className="h-8 w-8 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.3)] relative"
                style={{
                  background: 'radial-gradient(circle at 30% 30%, #4A4A4A 0%, #222222 30%, #0A0A0A 70%, #050505 100%)',
                }}
              >
                <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 50%)' }} />
              </div>
              <span className="text-[14px] font-bold text-gray-900 drop-shadow-sm">
                {mode === 'pve' ? '你' : '黑棋'} · {scores.black}
              </span>
            </div>

            {/* Turn indicator */}
            <AnimatePresence mode="wait">
              <motion.div
                key={result ? 'result' : currentPlayer}
                initial={{ opacity: 0, scale: 0.9, y: 5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -5 }}
                transition={{ duration: 0.25, type: 'spring', stiffness: 400, damping: 25 }}
                className="flex flex-col items-center justify-center flex-1"
              >
                {result ? (
                  <motion.div 
                    className="flex flex-col items-center gap-1.5"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: [1.2, 1] }}
                    transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  >
                    <motion.div
                      animate={{ rotate: [0, -10, 10, -10, 0] }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                    >
                      <Trophy size={28} className="text-amber-500 drop-shadow-md" strokeWidth={2.5} />
                    </motion.div>
                    <span className="text-[16px] font-black text-amber-600 tracking-wide drop-shadow-sm">
                      {result.winner === 'black'
                        ? mode === 'pve' ? '你赢了!' : '黑棋胜!'
                        : mode === 'pve' ? 'AI 胜!' : '白棋胜!'}
                    </span>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[13px] font-bold text-gray-700 uppercase tracking-wider">
                      {isAITurn ? '思考中...' : '等待落子'}
                    </span>
                    <div className="flex h-1.5 w-16 overflow-hidden rounded-full bg-black/10 shadow-inner">
                      {isAITurn ? (
                        <motion.div
                          className="h-full bg-blue-500 rounded-full"
                          initial={{ width: '30%', marginLeft: '0%' }}
                          animate={{ marginLeft: ['0%', '70%', '0%'] }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      ) : (
                        <div className={`h-full w-full transition-all duration-500 ease-out ${currentPlayer === 'black' ? 'bg-gray-900' : 'bg-gray-400'}`} />
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* White score */}
            <div className="flex flex-col items-center gap-1.5 min-w-[60px]">
              <div
                className="h-8 w-8 rounded-full border border-black/10 shadow-[0_4px_10px_rgba(0,0,0,0.15)] relative"
                style={{
                  background: 'radial-gradient(circle at 30% 30%, #FFFFFF 0%, #F8F8F8 40%, #E0E0E0 80%, #C8C8C8 100%)',
                }}
              >
                 <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 50%)' }} />
              </div>
              <span className="text-[14px] font-bold text-gray-900 drop-shadow-sm">
                {mode === 'pve' ? 'AI' : '白棋'} · {scores.white}
              </span>
            </div>
          </div>
        </div>

        {/* Board */}
        <div className="flex flex-1 items-center justify-center px-4">
          <GomokuBoard />
        </div>

        {/* Controls - iOS Bottom Toolbar */}
        <div className="absolute bottom-0 left-0 right-0">
          <div
            className="flex items-center justify-between px-10 pb-safe pt-3"
            style={{ backgroundColor: '#fff', borderTop: '0.5px solid rgba(0,0,0,0.06)', boxShadow: '0 -2px 10px rgba(0,0,0,0.03)' }}
          >
            <button
              onClick={undo}
              disabled={moves.length === 0 || isAITurn}
              className="flex flex-col items-center gap-1.5 active:scale-95 disabled:opacity-30 transition-all"
            >
              <Undo2 size={24} className="text-blue-500" strokeWidth={2.2} />
              <span className="text-[10px] font-semibold tracking-wider text-blue-500">悔棋</span>
            </button>

            <button
              onClick={reset}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition-all"
            >
              <RotateCcw size={24} className="text-blue-500" strokeWidth={2.2} />
              <span className="text-[10px] font-semibold tracking-wider text-blue-500">新局</span>
            </button>
          </div>
        </div>
      </div>
    </AppScreen>
  );
}
