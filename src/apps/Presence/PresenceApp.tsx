import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Clock3, LoaderCircle, LogOut, Send } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { AppScreen, Material, NavBar } from '@/system';
import {
  wasAppKilled,
  clearAppKilled,
  useAppRuntimeStore,
} from '@/platform/stores/appRuntimeStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { CharacterPicker } from './components/CharacterPicker';
import { FragmentStream } from './components/FragmentStream';
import { LeaveSummarySheet } from './components/LeaveSummarySheet';
import { PresenceRecordDetail } from './components/PresenceRecordDetail';
import { PresenceRecordList } from './components/PresenceRecordList';
import { SceneHero } from './components/SceneHero';
import { ScenePicker } from './components/ScenePicker';
import {
  getPresenceBackdrop,
  getPresencePresetScene,
  pickBackdropForCustomScene,
} from './presenceScenes';
import { requestPresenceReply, summarizePresenceSession } from './presenceAi';
import { rememberPresenceSummary } from './presenceMemory';
import { usePresenceStore } from './presenceStore';
import type { PresenceRecord, PresenceSummary, PresenceView } from './presenceTypes';

const DEFAULT_SCENE = '雨夜的便利店门口，她撑着伞站在灯下等你。';

export function PresenceApp() {
  const characters = useCharacterStore((s) => s.characters);
  const activeSession = usePresenceStore((s) => s.activeSession);
  const records = usePresenceStore((s) => s.records);
  const startSession = usePresenceStore((s) => s.startSession);
  const appendTurn = usePresenceStore((s) => s.appendTurn);
  const setSessionStatus = usePresenceStore((s) => s.setSessionStatus);
  const setSessionError = usePresenceStore((s) => s.setSessionError);
  const setSessionSummary = usePresenceStore((s) => s.setSessionSummary);
  const completeSession = usePresenceStore((s) => s.completeSession);
  const discardSession = usePresenceStore((s) => s.discardSession);
  const setStatusBarStyle = useAppRuntimeStore((s) => s.setStatusBarStyle);

  const [view, setView] = useState<PresenceView>('home');
  const [selectedCharacterId, setSelectedCharacterId] = useState('');
  const [sceneText, setSceneText] = useState(DEFAULT_SCENE);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>('convenience-rain');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [sending, setSending] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryDraft, setSummaryDraft] = useState<PresenceSummary | null>(null);

  useEffect(() => {
    if (wasAppKilled('presence')) {
      clearAppKilled('presence');
      setView('home');
      setLeaveOpen(false);
    }
  }, []);

  useEffect(() => {
    setStatusBarStyle(view === 'scene' ? 'light' : 'dark');
    return () => setStatusBarStyle('dark');
  }, [setStatusBarStyle, view]);

  useEffect(() => {
    if (selectedCharacterId && characters.some((c) => c.id === selectedCharacterId)) {
      return;
    }
    setSelectedCharacterId(characters[0]?.id ?? '');
  }, [characters, selectedCharacterId]);

  const activeCharacter = useMemo(
    () => characters.find((item) => item.id === activeSession?.characterId),
    [activeSession?.characterId, characters],
  );

  const selectedCharacter = useMemo(
    () => characters.find((item) => item.id === selectedCharacterId),
    [characters, selectedCharacterId],
  );

  const selectedPreset = useMemo(
    () => (selectedPresetId ? getPresencePresetScene(selectedPresetId) : undefined),
    [selectedPresetId],
  );

  const previewBackdrop = useMemo(
    () =>
      selectedPreset
        ? getPresenceBackdrop(selectedPreset.backdropId)
        : pickBackdropForCustomScene(sceneText),
    [sceneText, selectedPreset],
  );

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedRecordId),
    [records, selectedRecordId],
  );

  const handleSelectPreset = useCallback((presetId: string) => {
    const preset = getPresencePresetScene(presetId);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setSceneText(preset.text);
  }, []);

  const handleSceneTextChange = useCallback((value: string) => {
    setSceneText(value);
    setSelectedPresetId(null);
  }, []);

  const handleStart = useCallback(() => {
    if (!selectedCharacterId || !sceneText.trim()) return;
    const preset = selectedPresetId
      ? getPresencePresetScene(selectedPresetId)
      : undefined;
    startSession({
      characterId: selectedCharacterId,
      sceneText,
      presetSceneId: preset?.id,
      backdropId: preset?.backdropId,
    });
    setDraftText('');
    setView('scene');
  }, [sceneText, selectedCharacterId, selectedPresetId, startSession]);

  const handleSend = useCallback(async () => {
    const session = usePresenceStore.getState().activeSession;
    const text = draftText.trim();
    if (!session || !text || sending) return;
    const userTurn = appendTurn(session.id, 'user', text);
    if (!userTurn) return;
    setDraftText('');
    setSending(true);
    try {
      const latest = usePresenceStore.getState().activeSession;
      if (!latest) return;
      const reply = await requestPresenceReply({ session: latest });
      appendTurn(latest.id, 'assistant', reply);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '生成失败，请稍后再试';
      setSessionError(session.id, message);
    } finally {
      setSending(false);
    }
  }, [appendTurn, draftText, sending, setSessionError]);

  const runSummary = useCallback(async () => {
    const session = usePresenceStore.getState().activeSession;
    if (!session) return;
    setSummaryLoading(true);
    setSummaryError(null);
    setSessionStatus(session.id, 'summarizing');
    try {
      const summary = await summarizePresenceSession({ session });
      setSummaryDraft(summary);
      setSessionSummary(session.id, summary);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '总结失败，可以重试或直接保存记录';
      setSummaryError(message);
      setSummaryDraft(session.summary ?? null);
    } finally {
      setSummaryLoading(false);
    }
  }, [setSessionStatus, setSessionSummary]);

  const handleOpenLeave = useCallback(() => {
    const session = usePresenceStore.getState().activeSession;
    if (!session) return;
    setLeaveOpen(true);
    setSummaryDraft(session.summary ?? null);
    void runSummary();
  }, [runSummary]);

  const handleSaveAndLeave = useCallback(() => {
    const session = usePresenceStore.getState().activeSession;
    if (!session) return;
    const endedAt = Date.now();
    const memoryEntry = rememberPresenceSummary({
      characterId: session.characterId,
      summary: summaryDraft,
      startedAt: session.startedAt,
      endedAt,
    });
    const record = completeSession(
      session.id,
      summaryDraft,
      memoryEntry?.id,
      endedAt,
    );
    setLeaveOpen(false);
    setSummaryDraft(null);
    setSummaryError(null);
    if (record) {
      setSelectedRecordId(record.id);
      setView('recordDetail');
    } else {
      setView('home');
    }
  }, [completeSession, summaryDraft]);

  const handleDiscard = useCallback(() => {
    const session = usePresenceStore.getState().activeSession;
    discardSession(session?.id);
    setLeaveOpen(false);
    setSummaryDraft(null);
    setSummaryError(null);
    setView('home');
  }, [discardSession]);

  const handleReenter = useCallback((record: PresenceRecord) => {
    startSession({
      characterId: record.characterId,
      sceneText: record.sceneText,
      backdropId: record.backdropId,
    });
    setSelectedRecordId(null);
    setDraftText('');
    setView('scene');
  }, [startSession]);

  const nav = (() => {
    if (view === 'scene') {
      return (
        <NavBar
          title={activeSession?.title ?? '在场'}
          showBack
          backLabel="返回"
          onBack={() => setView('home')}
          tone="darkGlass"
          rightButtons={[
            {
              icon: <LogOut size={20} strokeWidth={1.8} />,
              onClick: handleOpenLeave,
              testId: 'presence-leave-btn',
              ariaLabel: '离开场景',
            },
          ]}
        />
      );
    }
    if (view === 'records') {
      return (
        <NavBar
          title="在场记录"
          showBack
          backLabel="在场"
          onBack={() => setView('home')}
        />
      );
    }
    if (view === 'recordDetail') {
      return (
        <NavBar
          title="在场记录"
          showBack
          backLabel="记录"
          onBack={() => setView('records')}
        />
      );
    }
    return (
      <NavBar
        title="在场"
        rightButtons={[
          {
            icon: <BookOpen size={21} strokeWidth={1.8} />,
            onClick: () => setView('records'),
            testId: 'presence-records-btn',
            ariaLabel: '在场记录',
          },
        ]}
      />
    );
  })();

  return (
    <AppScreen backgroundColor={view === 'scene' ? '#07080a' : 'rgba(238,241,246,1)'}>
      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        data-testid="presence-app"
      >
        {nav}
        <div
          className="relative min-h-0 flex-1 overflow-hidden"
          data-testid="presence-view-stack"
        >
        <AnimatePresence initial={false}>
          {view === 'home' && (
            <motion.div
              key="presence-home"
              className="absolute inset-0 overflow-y-auto pb-6"
              data-testid="presence-home-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[300px] overflow-hidden">
                <img
                  src={previewBackdrop.imageUrl}
                  alt=""
                  className="h-full w-full scale-110 object-cover opacity-45"
                  style={{ filter: 'blur(10px)' }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-white/12 via-[rgba(238,241,246,0.72)] to-[rgba(238,241,246,1)]" />
              </div>

              {activeSession && (
                <motion.div
                  className="relative px-4 pt-3"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div
                    className="rounded-[22px] px-4 py-3"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.74)',
                      border: '0.5px solid rgba(0,122,255,0.18)',
                      boxShadow: '0 10px 28px rgba(0,122,255,0.08)',
                    }}
                    data-testid="presence-restore-card"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: 'rgba(0,122,255,0.13)' }}
                      >
                        <Clock3 size={18} strokeWidth={1.9} color="var(--color-systemBlue)" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className="text-[14px] font-semibold"
                          style={{ color: 'var(--color-label)' }}
                        >
                          有未结束的场景
                        </div>
                        <div
                          className="mt-0.5 truncate text-[12px]"
                          style={{ color: 'var(--color-secondaryLabel)' }}
                        >
                          {activeSession.title}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <motion.button
                        type="button"
                        className="h-9 flex-1 rounded-[14px] text-[14px] font-semibold text-white"
                        style={{
                          background:
                            'linear-gradient(180deg, rgba(0,122,255,1), rgba(0,98,220,1))',
                        }}
                        onClick={() => setView('scene')}
                        whileTap={{ scale: 0.98 }}
                      >
                        继续
                      </motion.button>
                      <motion.button
                        type="button"
                        className="h-9 flex-1 rounded-[14px] text-[14px] font-medium"
                        style={{
                          backgroundColor: 'transparent',
                          color: 'var(--color-secondaryLabel)',
                        }}
                        onClick={handleDiscard}
                        whileTap={{ scale: 0.98 }}
                      >
                        丢弃
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}

              <motion.section
                className="relative mx-4 mt-3 overflow-hidden rounded-[28px]"
                style={{
                  minHeight: 218,
                  border: '0.5px solid rgba(255,255,255,0.58)',
                  boxShadow: '0 24px 62px rgba(20,22,28,0.18)',
                }}
                initial={{ opacity: 0, y: 16, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              >
                <img
                  src={previewBackdrop.imageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/76 via-black/24 to-white/8" />
                <div className="relative flex min-h-[218px] flex-col justify-between p-4 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <h1 className="min-w-0 truncate text-[27px] font-semibold leading-tight">
                      {selectedPreset?.title ?? previewBackdrop.title}
                    </h1>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/18">
                      <img
                        src={selectedCharacter?.avatar || '/resource/avatars/preset-01.jpg'}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                        style={{ boxShadow: '0 0 0 1.5px rgba(255,255,255,0.68)' }}
                      />
                    </div>
                  </div>
                  <p className="line-clamp-3 text-[14px] font-medium leading-6 text-white/86">
                    {sceneText || previewBackdrop.title}
                  </p>
                </div>
              </motion.section>

              <div className="relative mt-5 space-y-5">
                <CharacterPicker
                  characters={characters}
                  selectedId={selectedCharacterId}
                  onSelect={setSelectedCharacterId}
                />
                <ScenePicker
                  sceneText={sceneText}
                  selectedPresetId={selectedPresetId}
                  onSceneTextChange={handleSceneTextChange}
                  onSelectPreset={handleSelectPreset}
                />
              </div>

              <div className="relative px-4 pt-5">
                <motion.button
                  type="button"
                  onClick={handleStart}
                  disabled={!selectedCharacterId || !sceneText.trim()}
                  className="h-12 w-full rounded-[18px] text-[16px] font-semibold text-white disabled:opacity-45"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(0,122,255,1), rgba(0,98,220,1))',
                    boxShadow: '0 16px 34px rgba(0,122,255,0.25)',
                  }}
                  data-testid="presence-enter-scene"
                  whileTap={{ scale: 0.985 }}
                >
                  进入场景
                </motion.button>
              </div>
            </motion.div>
          )}

          {view === 'scene' && activeSession && (
            <motion.div
              key="presence-scene"
              className="absolute inset-0 flex min-h-0 flex-col"
              data-testid="presence-scene-view"
              style={{
                backgroundColor: '#101318',
              }}
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.992 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div
                className="absolute inset-0 overflow-hidden"
                data-testid="presence-scene-backdrop"
              >
                <img
                  src={getPresenceBackdrop(activeSession.backdropId).imageUrl}
                  alt=""
                  className="h-full w-full scale-[1.03] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/22 via-black/20 to-black/66" />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(90deg, rgba(0,0,0,0.36), rgba(0,0,0,0.04) 56%, rgba(0,0,0,0.32))',
                  }}
                />
              </div>
              <div
                className="relative z-10 flex min-h-0 flex-1 flex-col"
                data-testid="presence-scene-content"
              >
                <SceneHero
                  character={activeCharacter}
                  sceneText={activeSession.sceneText}
                  backdropId={activeSession.backdropId}
                  immersive
                />
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <FragmentStream
                    turns={activeSession.turns}
                    characterName={activeCharacter?.name}
                  />
                  {activeSession.error && (
                    <div className="px-4 pb-3">
                      <div className="rounded-[18px] bg-red-500/10 px-3 py-2 text-[13px] text-red-600">
                        {activeSession.error}
                      </div>
                    </div>
                  )}
                </div>
                <Material
                  variant="chrome"
                  className="mb-4 shrink-0 bg-transparent px-4 py-0"
                  style={{
                    backgroundColor: 'transparent',
                  }}
                  disableBackdrop
                  data-testid="presence-input-tray"
                >
                  <div className="flex items-end gap-3">
                    <textarea
                      value={draftText}
                      onChange={(event) => setDraftText(event.target.value)}
                      placeholder="说点什么，或写下你的动作…"
                      className="max-h-28 min-h-12 flex-1 resize-none rounded-[24px] px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/48"
                      style={{
                        backgroundColor: 'rgba(24,22,22,0.68)',
                        border: '0.5px solid rgba(255,255,255,0.18)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 34px rgba(0,0,0,0.26)',
                      }}
                      data-testid="presence-input"
                      disabled={sending}
                    />
                    <motion.button
                      type="button"
                      onClick={handleSend}
                      disabled={!draftText.trim() || sending}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-45"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(111,132,255,0.96), rgba(52,78,194,0.92))',
                        border: '0.5px solid rgba(255,255,255,0.28)',
                        boxShadow: '0 14px 30px rgba(62,92,220,0.36)',
                      }}
                      data-testid="presence-send"
                      aria-label="发送"
                      whileTap={{ scale: 0.94 }}
                    >
                      {sending ? (
                        <LoaderCircle className="animate-spin" size={19} />
                      ) : (
                        <Send size={18} />
                      )}
                    </motion.button>
                  </div>
                </Material>
              </div>
              <LeaveSummarySheet
                open={leaveOpen}
                loading={summaryLoading}
                error={summaryError}
                summary={summaryDraft}
                onRetry={runSummary}
                onSave={handleSaveAndLeave}
                onDiscard={handleDiscard}
                onCancel={() => setLeaveOpen(false)}
              />
            </motion.div>
          )}

          {view === 'records' && (
            <motion.div
              key="presence-records"
              className="absolute inset-0 overflow-y-auto"
              data-testid="presence-records-view"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            >
              <PresenceRecordList
                records={records}
                characters={characters}
                onOpenRecord={(recordId) => {
                  setSelectedRecordId(recordId);
                  setView('recordDetail');
                }}
              />
            </motion.div>
          )}

          {view === 'recordDetail' && selectedRecord && (
            <motion.div
              key="presence-record-detail"
              className="absolute inset-0"
              data-testid="presence-record-detail-view"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            >
              <PresenceRecordDetail
                record={selectedRecord}
                character={characters.find((item) => item.id === selectedRecord.characterId)}
                onReenter={() => handleReenter(selectedRecord)}
              />
            </motion.div>
          )}

          {view === 'recordDetail' && !selectedRecord && (
            <motion.div
              key="presence-missing-record"
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button
                type="button"
                onClick={() => setView('records')}
                style={{ color: 'var(--color-systemBlue)' }}
              >
                返回记录
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </AppScreen>
  );
}
