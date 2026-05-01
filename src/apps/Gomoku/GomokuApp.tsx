import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Circle, Plus, Sparkles, Trophy } from 'lucide-react';
import { AppScreen, NavBar } from '@/system';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { wasAppKilled, clearAppKilled } from '@/platform/stores/appRuntimeStore';
import { useXYData } from '@/apps/XingYu/xingYuDataStore';
import { GomokuBoard } from './GomokuBoard';
import { GomokuChatPanel } from './GomokuChatPanel';
import { NewGameSheet } from './NewGameSheet';
import { getAIMove } from './gomokuAI';
import {
  useGomokuStore,
  type GameResult,
  type GomokuAiStatus,
  type PlayerStone,
} from './gomokuStore';
import {
  formatGomokuCoordinate,
  stoneLabel,
} from './gomokuPrompt';
import { requestGomokuCharacterReply } from './gomokuAiSession';
import {
  rememberAiChat,
  rememberAiMove,
  rememberFallbackMove,
  rememberGameResult,
  rememberUserChat,
  rememberUserMove,
} from './gomokuMemory';
import { registerGomokuAi } from './gomokuRegister';

registerGomokuAi();

const FALLBACK_USER_AVATAR = '/resource/avatars/cute.png';
const FALLBACK_AI_AVATAR = '/resource/avatars/preset-01.jpg';

export function GomokuApp() {
  const characters = useCharacterStore((s) => s.characters);
  const userSettings = useXYData((s) => s.userSettings);
  const board = useGomokuStore((s) => s.board);
  const currentPlayer = useGomokuStore((s) => s.currentPlayer);
  const result = useGomokuStore((s) => s.result);
  const moves = useGomokuStore((s) => s.moves);
  const scores = useGomokuStore((s) => s.scores);
  const characterId = useGomokuStore((s) => s.characterId);
  const userStone = useGomokuStore((s) => s.userStone);
  const aiStone = useGomokuStore((s) => s.aiStone);
  const messages = useGomokuStore((s) => s.messages);
  const aiStatus = useGomokuStore((s) => s.aiStatus);
  const ignoredChatCount = useGomokuStore((s) => s.ignoredChatCount);
  const aiSilenced = useGomokuStore((s) => s.aiSilenced);
  const placeStone = useGomokuStore((s) => s.placeStone);
  const addMessage = useGomokuStore((s) => s.addMessage);
  const startNewGame = useGomokuStore((s) => s.startNewGame);
  const setAiStatus = useGomokuStore((s) => s.setAiStatus);
  const noteAiChatResult = useGomokuStore((s) => s.noteAiChatResult);
  const [newGameOpen, setNewGameOpen] = useState(false);
  const [draftCharacterId, setDraftCharacterId] = useState('');
  const [draftUserStone, setDraftUserStone] = useState<PlayerStone>('black');
  const aiInFlight = useRef(false);

  const activeCharacter = useMemo(
    () =>
      characters.find((character) => character.id === characterId) ??
      characters[0],
    [characterId, characters],
  );

  const aiName = activeCharacter?.name || 'AI';
  const aiAvatar = activeCharacter?.avatar?.trim() || FALLBACK_AI_AVATAR;
  const userAvatar = userSettings.avatarUrl || FALLBACK_USER_AVATAR;
  const isAiBusy = aiStatus === 'thinking' || aiStatus === 'retrying';
  const isUserTurn = currentPlayer === userStone;
  const boardLocked =
    !activeCharacter || Boolean(result) || !isUserTurn || aiStatus !== 'idle';

  useEffect(() => {
    if (wasAppKilled('gomoku')) {
      clearAppKilled('gomoku');
    }
  }, []);

  useEffect(() => {
    if (characters.length === 0) return;
    const selectedStillExists = characters.some((c) => c.id === characterId);
    if (!characterId || !selectedStillExists) {
      startNewGame({ characterId: characters[0]!.id, userStone });
    }
  }, [characterId, characters, startNewGame, userStone]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const debugWindow = window as unknown as {
      render_game_to_text?: () => string;
      advanceTime?: (ms: number) => void;
    };
    debugWindow.render_game_to_text = () =>
      JSON.stringify({
        app: 'gomoku',
        coordinateSystem: 'row/col are 0-based from top-left',
        currentPlayer,
        userStone,
        aiStone,
        aiStatus,
        ignoredChatCount,
        aiSilenced,
        result,
        moves: moves.length,
        latestMove: moves[moves.length - 1] ?? null,
        occupied: board.flat().filter(Boolean).length,
        messages: messages.map((message) => ({
          role: message.role,
          text: message.text,
        })),
      });
    debugWindow.advanceTime = () => {};
    return () => {
      delete debugWindow.render_game_to_text;
      delete debugWindow.advanceTime;
    };
  }, [
    aiStatus,
    aiSilenced,
    aiStone,
    board,
    currentPlayer,
    ignoredChatCount,
    messages,
    moves,
    result,
    userStone,
  ]);

  const rememberResultIfNeeded = useCallback(() => {
    const state = useGomokuStore.getState();
    if (!state.result || !activeCharacter) return;
    rememberGameResult({
      characterId: activeCharacter.id,
      winner: state.result.winner,
      userStone: state.userStone,
      aiName: activeCharacter.name || 'AI',
    });
  }, [activeCharacter]);

  const applyFallbackMove = useCallback(
    (reason: string) => {
      if (!activeCharacter) return;
      const state = useGomokuStore.getState();
      const fallbackMove = getAIMove(state.board, state.aiStone);
      if (!fallbackMove) {
        setAiStatus('failed', '没有可用落点');
        addMessage({ role: 'system', text: '棋盘已满,无法继续落子。' });
        return;
      }

      setAiStatus('fallback');
      const [row, col] = fallbackMove;
      const placed = useGomokuStore.getState().placeStone(row, col);
      if (!placed) {
        setAiStatus('failed', '系统代走失败');
        addMessage({ role: 'system', text: '系统代走失败,请新开一局。' });
        return;
      }

      const coord = formatGomokuCoordinate(row, col);
      addMessage({
        role: 'system',
        text: `${reason},系统代走 ${coord}。`,
      });
      rememberFallbackMove({
        characterId: activeCharacter.id,
        characterName: activeCharacter.name || 'AI',
        row,
        col,
      });
      rememberResultIfNeeded();
      setAiStatus('idle');
    },
    [activeCharacter, addMessage, rememberResultIfNeeded, setAiStatus],
  );

  const runAiGameTurn = useCallback(async () => {
    if (!activeCharacter || aiInFlight.current) return;
    const state = useGomokuStore.getState();
    if (state.result || state.currentPlayer !== state.aiStone) return;

    aiInFlight.current = true;
    setAiStatus('thinking');
    try {
      const reply = await requestGomokuCharacterReply({
        characterId: activeCharacter.id,
        turnKind: 'game',
        onSemanticRetry: () => setAiStatus('retrying'),
      });

      if (!reply.ok || !reply.move) {
        applyFallbackMove('角色未能给出合法落点');
        return;
      }

      const text = reply.texts.join('\n').trim();
      for (const line of reply.texts) {
        addMessage({ role: 'ai', text: line });
      }

      const placed = useGomokuStore
        .getState()
        .placeStone(reply.move.row, reply.move.col);
      if (!placed) {
        applyFallbackMove('角色落点已失效');
        return;
      }

      addMessage({
        role: 'system',
        text: `${aiName}落在 ${formatGomokuCoordinate(
          reply.move.row,
          reply.move.col,
        )}。`,
      });
      rememberAiMove({
        characterId: activeCharacter.id,
        characterName: aiName,
        row: reply.move.row,
        col: reply.move.col,
        stone: state.aiStone,
        text,
      });
      rememberResultIfNeeded();
      setAiStatus('idle');
    } catch {
      applyFallbackMove('角色暂时没有回应');
    } finally {
      aiInFlight.current = false;
    }
  }, [
    activeCharacter,
    addMessage,
    aiName,
    applyFallbackMove,
    rememberResultIfNeeded,
    setAiStatus,
  ]);

  useEffect(() => {
    if (!activeCharacter) return;
    if (result) return;
    if (aiStatus !== 'idle') return;
    if (currentPlayer !== aiStone) return;
    void runAiGameTurn();
  }, [activeCharacter, aiStatus, aiStone, currentPlayer, result, runAiGameTurn]);

  const handleUserPlace = useCallback(
    (row: number, col: number) => {
      if (!activeCharacter || boardLocked) return;
      const state = useGomokuStore.getState();
      if (state.currentPlayer !== state.userStone) return;

      const placed = placeStone(row, col);
      if (!placed) return;

      const coord = formatGomokuCoordinate(row, col);
      addMessage({ role: 'system', text: `你落在 ${coord}。` });
      rememberUserMove(activeCharacter.id, row, col, state.userStone);
      rememberResultIfNeeded();
    },
    [
      activeCharacter,
      addMessage,
      boardLocked,
      placeStone,
      rememberResultIfNeeded,
    ],
  );

  const handleSendChat = useCallback(
    async (text: string) => {
      if (!activeCharacter || isAiBusy) return;
      if (useGomokuStore.getState().aiSilenced) {
        addMessage({
          role: 'system',
          text: '本局已进入只下棋模式。',
        });
        return;
      }
      addMessage({ role: 'user', text });
      rememberUserChat(activeCharacter.id, text);
      setAiStatus('thinking');

      try {
        const reply = await requestGomokuCharacterReply({
          characterId: activeCharacter.id,
          turnKind: 'chat',
          userMessage: text,
          onSemanticRetry: () => setAiStatus('retrying'),
        });

        if (!reply.ok) {
          const wasSilenced = useGomokuStore.getState().aiSilenced;
          noteAiChatResult(false);
          const nowSilenced = useGomokuStore.getState().aiSilenced;
          setAiStatus('idle');
          addMessage({
            role: 'system',
            text:
              nowSilenced && !wasSilenced
                ? `${aiName}一直没有回应,本局后续只下棋不聊天。`
                : `${aiName}没有给出可用聊天回复。`,
          });
          return;
        }

        noteAiChatResult(true);
        for (const line of reply.texts) {
          addMessage({ role: 'ai', text: line });
          rememberAiChat(activeCharacter.id, aiName, line);
        }
        setAiStatus('idle');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const wasSilenced = useGomokuStore.getState().aiSilenced;
        noteAiChatResult(false);
        const nowSilenced = useGomokuStore.getState().aiSilenced;
        setAiStatus('idle', message);
        addMessage({
          role: 'system',
          text:
            nowSilenced && !wasSilenced
              ? `${aiName}一直没有回应,本局后续只下棋不聊天。`
              : `${aiName}暂时没有回应。`,
        });
      }
    },
    [
      activeCharacter,
      addMessage,
      aiName,
      isAiBusy,
      noteAiChatResult,
      setAiStatus,
    ],
  );

  const openNewGame = () => {
    setDraftCharacterId(activeCharacter?.id ?? characters[0]?.id ?? '');
    setDraftUserStone(userStone);
    setNewGameOpen(true);
  };

  const confirmNewGame = () => {
    if (!draftCharacterId) return;
    startNewGame({ characterId: draftCharacterId, userStone: draftUserStone });
    setNewGameOpen(false);
  };

  if (characters.length === 0) {
    return (
      <AppScreen backgroundColor="#F2F2F7">
        <NavBar title="五子棋" />
        <div
          className="flex flex-1 flex-col items-center justify-center px-8 text-center"
          data-testid="gomoku-empty-state"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[18px] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <Sparkles size={30} strokeWidth={1.8} className="text-[#007AFF]" />
          </div>
          <div className="text-[20px] font-bold text-[#1C1C1E]">
            还没有 AI 角色
          </div>
          <div className="mt-2 max-w-[240px] text-[14px] leading-5 text-[#8E8E93]">
            去设置里创建角色后,就可以在这里和角色边下棋边聊天。
          </div>
        </div>
      </AppScreen>
    );
  }

  return (
    <AppScreen backgroundColor="#F2F2F7">
      <NavBar
        title="五子棋"
        rightButtons={[
          {
            icon: <Plus size={23} strokeWidth={2.1} />,
            onClick: openNewGame,
            testId: 'gomoku-new-game-btn',
            ariaLabel: '新局',
          },
        ]}
      />

      <div className="relative flex min-h-0 flex-1 flex-col pb-safe">
        <div className="shrink-0 px-4 pt-3">
          <div className="rounded-[20px] bg-white px-3 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <PlayerBadge
                align="left"
                avatar={userAvatar}
                name="你"
                stone={userStone}
                score={scores.user ?? 0}
                active={currentPlayer === userStone && !result}
              />
              <TurnBadge
                result={result}
                currentPlayer={currentPlayer}
                userStone={userStone}
                aiName={aiName}
                aiStatus={aiStatus}
              />
              <PlayerBadge
                align="right"
                avatar={aiAvatar}
                name={aiName}
                stone={aiStone}
                score={scores.ai ?? 0}
                active={currentPlayer === aiStone && !result}
              />
            </div>
          </div>
        </div>

        <div className="flex min-h-[290px] shrink-0 items-center justify-center px-3 py-2">
          <GomokuBoard
            disabled={boardLocked}
            onPlaceStone={handleUserPlace}
            previewStone={userStone}
          />
        </div>

        <GomokuChatPanel
          messages={messages}
          userAvatar={userAvatar}
          aiAvatar={aiAvatar}
          aiName={aiName}
          aiStatus={aiStatus}
          disabled={!activeCharacter || isAiBusy || aiSilenced}
          silenced={aiSilenced}
          onSend={handleSendChat}
        />

        <NewGameSheet
          open={newGameOpen}
          characters={characters}
          selectedCharacterId={draftCharacterId}
          selectedUserStone={draftUserStone}
          onSelectCharacter={setDraftCharacterId}
          onSelectUserStone={setDraftUserStone}
          onStart={confirmNewGame}
          onClose={() => setNewGameOpen(false)}
        />
      </div>
    </AppScreen>
  );
}

function PlayerBadge({
  avatar,
  name,
  stone,
  score,
  active,
  align,
}: {
  avatar: string;
  name: string;
  stone: PlayerStone;
  score: number;
  active: boolean;
  align: 'left' | 'right';
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${align === 'right' ? 'justify-end text-right' : ''}`}
      data-testid={align === 'left' ? 'gomoku-user-badge' : 'gomoku-ai-badge'}
    >
      {align === 'left' && <BadgeAvatar avatar={avatar} active={active} />}
      <div className="min-w-0">
        <div className="truncate text-[14px] font-bold text-[#1C1C1E]">
          {name}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#8E8E93]">
          <Circle
            size={10}
            fill={stone === 'black' ? '#111' : '#fff'}
            color={stone === 'black' ? '#111' : '#D1D1D6'}
          />
          <span>{stoneLabel(stone)} · {score}</span>
        </div>
      </div>
      {align === 'right' && <BadgeAvatar avatar={avatar} active={active} />}
    </div>
  );
}

function BadgeAvatar({ avatar, active }: { avatar: string; active: boolean }) {
  return (
    <div
      className={`h-11 w-11 shrink-0 rounded-full p-[2px] ${active ? 'bg-[#007AFF]' : 'bg-black/8'}`}
    >
      <img
        src={avatar}
        alt=""
        className="h-full w-full rounded-full border-2 border-white object-cover"
      />
    </div>
  );
}

function TurnBadge({
  result,
  currentPlayer,
  userStone,
  aiName,
  aiStatus,
}: {
  result: GameResult;
  currentPlayer: PlayerStone;
  userStone: PlayerStone;
  aiName: string;
  aiStatus: GomokuAiStatus;
}) {
  if (result) {
    const userWon = result.winner === userStone;
    return (
      <div className="flex min-w-[78px] flex-col items-center">
        <Trophy size={22} strokeWidth={2.2} className="text-[#FF9500]" />
        <div className="mt-0.5 text-[12px] font-bold text-[#C76A00]">
          {userWon ? '你赢了' : `${aiName}胜`}
        </div>
      </div>
    );
  }

  const isAiTurn = currentPlayer !== userStone;
  const label =
    aiStatus === 'retrying'
      ? '重试中'
      : aiStatus === 'fallback'
        ? '代走'
        : isAiTurn
          ? '角色思考'
          : '等你落子';

  return (
    <div className="flex min-w-[78px] flex-col items-center">
      <Bot size={22} strokeWidth={2} className="text-[#007AFF]" />
      <div className="mt-0.5 whitespace-nowrap text-[12px] font-bold text-[#3A3A3C]">
        {label}
      </div>
    </div>
  );
}
