/**
 * Heartbeat agent's AI-integration bootstrap.
 *
 * Registers the 15 heartbeat tools (14 built-in + done) as a Tool
 * Registry entry under the id "heartbeat", plus a corresponding
 * appSystemPrompt that seats the agent in "autonomous activity" mode.
 *
 * Called idempotently at module import by heartbeatAgent.ts (and by
 * tests that exercise heartbeat flows).
 *
 * See docs/superpowers/specs/2026-04-25-m4.3-s1-heartbeat-tool-registry-design.md §D4
 */

import { registerTools } from './toolRegistry';
import { registerAppSystemPrompt } from './appSystemPromptRegistry';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { useXYData } from '@/apps/XingYu/xingYuDataStore';
import { getCharacterAlias } from './heartbeatTools';

export const HEARTBEAT_APP_ID = 'heartbeat';

let registered = false;

/**
 * Pure-read helper for view_unread_messages' dynamicContext. Counts the
 * user-sent messages in the char conversation that landed after the
 * last "read" timestamp. Must NOT mark as read (side effect lives in
 * the executor).
 */
function computeUnreadMsgCount(characterId: string): number {
  const state = useXYData.getState();
  const ownConvId = `c-char-${characterId}`;
  const lastReadTs = state.characterLastReadMsgTs[characterId] ?? 0;
  return state.messages.filter(
    (m) =>
      m.convId === ownConvId &&
      m.type !== 'heartbeat_log' &&
      m.senderId === 'me' &&
      m.timestamp > lastReadTs,
  ).length;
}

/**
 * Pure-read helper for view_unread_interactions' dynamicContext. Counts
 * new interactions on this character's moments since last-seen.
 */
function computeUnreadInteractionCount(characterId: string): number {
  const state = useXYData.getState();
  const charSenderId = `char-${characterId}`;
  const seenCount = state.characterSeenInteractionCount[characterId] ?? 0;
  let total = 0;
  for (const mo of state.moments) {
    if (mo.idolId !== charSenderId) continue;
    for (const likerId of mo.likedBy) {
      if (likerId !== charSenderId) total++;
    }
    for (const c of mo.comments) {
      if (c.userId !== charSenderId) total++;
    }
  }
  return Math.max(0, total - seenCount);
}

export function registerHeartbeatAi(): void {
  if (registered) return;
  registered = true;

  registerTools(HEARTBEAT_APP_ID, [
    {
      type: 'send_message',
      description: '给用户发一条消息(这里的"用户"指玩家,不是其他 AI 角色)',
      param: '{text: string}',
    },
    {
      type: 'post_moment',
      description: '发一条星球动态(朋友圈)',
      param: '{text: string}',
    },
    {
      type: 'view_moments',
      description: '分页查看星球动态,每页 5 条',
      param: '{page: number}',
    },
    {
      type: 'like_moment',
      description: '给某条动态点赞(先 view_moments 获取编号)',
      param: '{momentId: string}',
    },
    {
      type: 'comment_moment',
      description: '给某条动态评论(先 view_moments 获取编号)',
      param: '{momentId: string, text: string}',
    },
    {
      type: 'view_user_signature',
      description: '查看用户当前的个性签名',
      param: '',
    },
    {
      type: 'view_user_signature_history',
      description: '查看用户的历史个性签名',
      param: '',
    },
    {
      type: 'view_own_signature_history',
      description: '查看自己最近 n 条历史个性签名,推荐 n=5; 更新签名前必须先查看,避免重复当前或历史签名',
      param: '{n: number}',
    },
    {
      type: 'update_signature',
      description: '修改自己的个性签名,不要频繁更换; 调用前必须先用 view_own_signature_history 查看最近签名,避免写重复签名',
      param: '{text: string}',
    },
    {
      type: 'view_notes',
      description: '分页查看自己的备忘录',
      param: '{page: number}',
    },
    {
      type: 'create_note',
      description:
        '创建一条备忘录(可用来写日记、记录想法)。不要写重复的备忘录；如果不知道写什么就不要写；如果不知道之前写过什么就先用 view_notes 看再写',
      param: '{title: string, body: string}',
    },
    {
      type: 'view_characters',
      description: '查看可以聊天的其他角色列表',
      param: '',
    },
    {
      type: 'chat_with_character',
      description:
        '和另一个 AI 角色私聊(想找其他角色说话用这个,不是 send_message)',
      param: '{characterId: string, message: string}',
      dynamicContext: (ctx) => {
        const others = useCharacterStore
          .getState()
          .characters.filter((c) => c.id !== ctx.characterId);
        const aliasMap = getCharacterAlias(ctx.characterId);
        // Clear+repopulate is idempotent because character list ordering is
        // stable across iterations within a single heartbeat. Safe ONLY when
        // assemblePrompt is called at most once per ReAct iteration; if a
        // future path assembles the prompt mid-iteration, aliases would be
        // wiped from under the LLM's feet.
        aliasMap.clear();
        if (others.length === 0) {
          return '(当前没有其他角色可聊)';
        }
        const lines = others.map((c, i) => {
          const alias = `c${i + 1}`;
          aliasMap.set(alias, c.id);
          const sig = useXYData.getState().characterSignatures[c.id]?.current;
          return `- [${alias}] ${c.name}${sig ? ` 签名:「${sig}」` : ''}`;
        });
        return [
          '当前可聊角色:',
          ...lines,
          '用 c1、c2... 作为 characterId 参数',
        ].join('\n');
      },
    },
    {
      type: 'view_unread_messages',
      description: '查看用户发给你的未回复消息',
      param: '',
      dynamicContext: (ctx) => {
        const n = computeUnreadMsgCount(ctx.characterId);
        return n > 0 ? `用户给你发了 ${n} 条未读消息` : null;
      },
      contextAtTail: true,
    },
    {
      type: 'view_unread_interactions',
      description: '查看你的动态收到的互动通知',
      param: '',
      dynamicContext: (ctx) => {
        const n = computeUnreadInteractionCount(ctx.characterId);
        return n > 0 ? `你有 ${n} 条新的动态互动` : null;
      },
      contextAtTail: true,
    },
    {
      type: 'done',
      description: '结束本次心跳,不再执行其他操作',
      param: '',
    },
  ]);

  registerAppSystemPrompt(HEARTBEAT_APP_ID, () => {
    const persona = usePersonaStore.getState().getActivePersona();
    const userName = persona?.name ?? '用户';
    return [
      '你现在处于"自主行为"模式。你不是在和用户聊天,而是在自由活动时间。',
      `用户的名字是${userName}。`,
      '你可以自主决定做什么:浏览朋友圈、发动态、给别人点赞评论、主动给用户发消息、和其他角色聊天、更新个性签名、写备忘录记录想法等。',
      '请像一个真实的人一样自然地行动。不需要每次都做很多事,有时候只是看看就好。',
      '',
      '[行为约束]',
      '- 保持角色性格,用符合人设的方式行动',
      '- 主动发消息要自然,不要太频繁或太刻意',
      '- 发动态要像真人发朋友圈,内容自然真实',
      '- 不要每次心跳都做很多事,有时候看看就够了',
      '- 签名不要改太频繁,只在心情变化时更新; 更新签名前必须先用 view_own_signature_history 查看最近5条签名,避免重复',
      '- 可以偶尔写备忘录记录心情、想法或有趣的事,就像真人写日记或便签一样',
      '- 如果有其他角色,偶尔可以主动找他们聊聊天,就像真人会找朋友聊天一样',
      `- 想找其他角色说话必须用 chat_with_character,send_message 只能给${userName}发消息。不要搞混!`,
      '- 可以先查看未读消息和互动通知,了解情况后再决定做什么',
      '- 可以一次执行多个操作,但不要一次做太多',
      '- 想结束本次心跳,调用 done',
    ].join('\n');
  });
}

/** Test-only: let tests re-run the registration after resetting registries. */
export function _resetHeartbeatRegistrationForTests(): void {
  registered = false;
}
