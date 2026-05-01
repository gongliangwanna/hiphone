import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerHeartbeatAi,
  HEARTBEAT_APP_ID,
  _resetHeartbeatRegistrationForTests,
} from '../heartbeatRegister';
import { getTools, _resetToolRegistryForTests } from '../toolRegistry';
import {
  getAppSystemPrompt,
  _resetAppSystemPromptRegistryForTests,
} from '../appSystemPromptRegistry';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { getCharacterAlias } from '../heartbeatTools';
import { useXYData } from '@/apps/XingYu/xingYuDataStore';

describe('registerHeartbeatAi', () => {
  beforeEach(() => {
    _resetToolRegistryForTests();
    _resetAppSystemPromptRegistryForTests();
    _resetHeartbeatRegistrationForTests();

    // Reset XingYu data store so positive-path tests don't bleed into null-path tests.
    useXYData.setState({
      ...useXYData.getState(),
      messages: [],
      moments: [],
      characterLastReadMsgTs: {},
      characterSeenInteractionCount: {},
    });

    useCharacterStore.setState({
      characters: [
        { id: 'char-001', name: '小星', avatar: '', description: '', personality: '', scenario: '', firstMessage: '', messageExamples: '', alternateGreetings: [], systemPrompt: '', postHistoryInstructions: '', creatorNotes: '', tags: [], version: '' },
        { id: 'char-002', name: '小月', avatar: '', description: '', personality: '', scenario: '', firstMessage: '', messageExamples: '', alternateGreetings: [], systemPrompt: '', postHistoryInstructions: '', creatorNotes: '', tags: [], version: '' },
      ],
    });
    usePersonaStore.setState({
      personas: [{ id: 'p1', name: '小星星', description: '', avatar: '', isDefault: false }],
      activePersonaId: 'p1',
    } as never);
  });

  it('HEARTBEAT_APP_ID is the literal "heartbeat"', () => {
    expect(HEARTBEAT_APP_ID).toBe('heartbeat');
  });

  it('registers 16 tools (15 built-in + done)', () => {
    registerHeartbeatAi();
    const tools = getTools(HEARTBEAT_APP_ID);
    expect(tools.map((t) => t.type).sort()).toEqual([
      'chat_with_character',
      'comment_moment',
      'create_note',
      'done',
      'like_moment',
      'post_moment',
      'send_message',
      'update_signature',
      'view_characters',
      'view_moments',
      'view_notes',
      'view_own_signature_history',
      'view_unread_interactions',
      'view_unread_messages',
      'view_user_signature',
      'view_user_signature_history',
    ]);
  });

  it('send_message description uses generic "用户" (user name lives in appSystemPrompt)', () => {
    registerHeartbeatAi();
    const sendMsg = getTools(HEARTBEAT_APP_ID).find((t) => t.type === 'send_message')!;
    expect(sendMsg.description).toContain('用户');
    expect(sendMsg.description).not.toContain('小星星');
  });

  it('create_note description discourages duplicate or uncertain notes', () => {
    registerHeartbeatAi();
    const tool = getTools(HEARTBEAT_APP_ID).find((t) => t.type === 'create_note')!;
    expect(tool.description).toContain('不要写重复的备忘录');
    expect(tool.description).toContain('不知道写什么就不要写');
    expect(tool.description).toContain('不知道之前写过什么就先用 view_notes 看再写');
  });

  it('update_signature description requires checking own recent signatures first', () => {
    registerHeartbeatAi();
    const viewTool = getTools(HEARTBEAT_APP_ID).find((t) => t.type === 'view_own_signature_history')!;
    expect(viewTool.param).toBe('{n: number}');
    expect(viewTool.description).toContain('推荐 n=5');

    const updateTool = getTools(HEARTBEAT_APP_ID).find((t) => t.type === 'update_signature')!;
    expect(updateTool.description).toContain('必须先用 view_own_signature_history');
    expect(updateTool.description).toContain('避免写重复签名');
  });

  it('chat_with_character.dynamicContext lists other characters + registers aliases', () => {
    registerHeartbeatAi();
    const tool = getTools(HEARTBEAT_APP_ID).find((t) => t.type === 'chat_with_character')!;
    expect(tool.dynamicContext).toBeDefined();

    const body = tool.dynamicContext!({ appId: HEARTBEAT_APP_ID, characterId: 'char-001' });
    expect(body).toContain('小月');
    expect(body).toContain('c1');

    expect(getCharacterAlias('char-001').get('c1')).toBe('char-002');
  });

  it('chat_with_character.dynamicContext handles zero-other-characters gracefully', () => {
    useCharacterStore.setState({
      characters: [
        { id: 'char-solo', name: '独自一人', avatar: '', description: '', personality: '', scenario: '', firstMessage: '', messageExamples: '', alternateGreetings: [], systemPrompt: '', postHistoryInstructions: '', creatorNotes: '', tags: [], version: '' },
      ],
    });
    registerHeartbeatAi();
    const tool = getTools(HEARTBEAT_APP_ID).find((t) => t.type === 'chat_with_character')!;
    const body = tool.dynamicContext!({ appId: HEARTBEAT_APP_ID, characterId: 'char-solo' });
    expect(body).toContain('没有其他角色');
  });

  it('view_unread_messages has contextAtTail:true', () => {
    registerHeartbeatAi();
    const tool = getTools(HEARTBEAT_APP_ID).find((t) => t.type === 'view_unread_messages')!;
    expect(tool.contextAtTail).toBe(true);
    expect(tool.dynamicContext).toBeDefined();
  });

  it('view_unread_messages.dynamicContext returns null when no unread', () => {
    registerHeartbeatAi();
    const tool = getTools(HEARTBEAT_APP_ID).find((t) => t.type === 'view_unread_messages')!;
    const body = tool.dynamicContext!({ appId: HEARTBEAT_APP_ID, characterId: 'char-001' });
    expect(body).toBeNull();
  });

  it('view_unread_messages.dynamicContext returns non-null string with count when unread present', () => {
    registerHeartbeatAi();
    // Seed an unread user message into XingYu state.
    useXYData.setState({
      ...useXYData.getState(),
      messages: [
        {
          id: 'm1', convId: 'c-char-char-001', senderId: 'me',
          type: 'text', text: 'hello', timestamp: 1_700_000_000_000,
        } as never,
        {
          id: 'm2', convId: 'c-char-char-001', senderId: 'me',
          type: 'text', text: 'hi again', timestamp: 1_700_000_001_000,
        } as never,
      ],
      characterLastReadMsgTs: { 'char-001': 0 },
    });

    const tool = getTools(HEARTBEAT_APP_ID).find((t) => t.type === 'view_unread_messages')!;
    const body = tool.dynamicContext!({ appId: HEARTBEAT_APP_ID, characterId: 'char-001' });
    expect(body).toBeDefined();
    expect(body).not.toBeNull();
    expect(body).toContain('2');
    expect(body).toContain('未读');
  });

  it('view_unread_interactions.dynamicContext returns non-null string with count when interactions present', () => {
    registerHeartbeatAi();
    // Seed a moment owned by char-001 that another user has liked + commented.
    useXYData.setState({
      ...useXYData.getState(),
      moments: [
        {
          id: 'mom1',
          idolId: 'char-char-001',
          text: 'my moment',
          likedBy: ['char-char-002'],
          comments: [{ id: 'c1', userId: 'char-char-002', text: 'nice' } as never],
          timestamp: 1_700_000_000_000,
        } as never,
      ],
      characterSeenInteractionCount: { 'char-001': 0 },
    });

    const tool = getTools(HEARTBEAT_APP_ID).find((t) => t.type === 'view_unread_interactions')!;
    const body = tool.dynamicContext!({ appId: HEARTBEAT_APP_ID, characterId: 'char-001' });
    expect(body).toBeDefined();
    expect(body).not.toBeNull();
    expect(body).toContain('2');
    expect(body).toContain('互动');
  });

  it('view_unread_interactions.dynamicContext returns null when no new interactions', () => {
    registerHeartbeatAi();
    const tool = getTools(HEARTBEAT_APP_ID).find(
      (t) => t.type === 'view_unread_interactions',
    )!;
    expect(tool.contextAtTail).toBe(true);
    const body = tool.dynamicContext!({
      appId: HEARTBEAT_APP_ID,
      characterId: 'char-001',
    });
    expect(body).toBeNull();
  });

  it('appSystemPrompt("heartbeat") includes user name + behavior constraints', () => {
    registerHeartbeatAi();
    const fn = getAppSystemPrompt(HEARTBEAT_APP_ID)!;
    const text = fn();
    expect(text).toContain('自主行为');
    expect(text).toContain('小星星');
    expect(text).toContain('[行为约束]');
    expect(text).toContain('view_own_signature_history');
    expect(text).toContain('done');
  });

  it('registerHeartbeatAi is idempotent', () => {
    registerHeartbeatAi();
    registerHeartbeatAi();
    registerHeartbeatAi();
    expect(getTools(HEARTBEAT_APP_ID)).toHaveLength(16);
  });
});
