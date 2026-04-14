/**
 * Heartbeat agent format override for the prompt assembly pipeline.
 *
 * Instead of building a standalone prompt, this module provides a `formatOverride`
 * string that replaces the default [回复格式] section in `assemblePrompt()`.
 * This way the heartbeat agent gets the same full context as regular chat
 * (character card, persona, world book, chat history, device context, etc.)
 * but with ReAct agent instructions instead of JSON structured output.
 */

import { buildHeartbeatTools } from './heartbeatTools';

/**
 * Build the format override string for heartbeat agent mode.
 * Replaces the default JSON reply format with ReAct Thought/Action/ActionInput protocol.
 */
export function buildHeartbeatFormatOverride(
  userName: string,
  otherCharacters?: { alias: string; name: string; signature?: string }[],
): string {
  const chunks: string[] = [];

  // Agent role
  chunks.push(
    `[自主行为模式]`,
    `你现在处于"自主行为"模式。你不是在和用户聊天，而是在自由活动时间。`,
    `你可以自主决定做什么：浏览朋友圈、发动态、给别人点赞评论、主动给用户发消息、和其他角色聊天、更新个性签名、写备忘录记录想法等。`,
    `请像一个真实的人一样自然地行动。不需要每次都做很多事，有时候只是看看就好。`,
  );

  // Tool descriptions (with user name for disambiguation)
  const tools = buildHeartbeatTools(userName);
  const toolLines = tools.map(
    (t) => `- ${t.name}: ${t.description}\n  参数格式: ${t.params}`,
  );
  chunks.push(`[可用工具]\n${toolLines.join('\n')}`);

  // Inject available characters (so AI can directly use chat_with_character)
  if (otherCharacters && otherCharacters.length > 0) {
    const charLines = otherCharacters.map((c) => {
      const sig = c.signature ? ` 签名：「${c.signature}」` : '';
      return `- [${c.alias}] ${c.name}${sig}`;
    });
    chunks.push(
      `[其他角色]`,
      `当前可以聊天的角色：`,
      ...charLines,
      `可以直接用 ${otherCharacters.map((c) => c.alias).join('、')} 作为 chat_with_character 的 characterId，不需要先调用 view_characters。`,
    );
  }

  // ReAct format specification
  chunks.push(
    `[输出格式]`,
    `你必须严格按以下格式输出：`,
    `Thought: 你的思考过程（用中文）`,
    `Actions:`,
    `[{"action": "工具名称", "input": {参数}}]`,
    ``,
    `Actions 是一个 JSON 数组，你可以一次执行多个工具。工具会按顺序执行，所有结果一起返回。`,
    `当你决定不再做任何事时，在数组中使用 {"action": "done"}`,
    ``,
    `示例1（多个操作）：`,
    `Thought: 先看看动态，顺便查看一下用户签名`,
    `Actions:`,
    `[{"action": "view_moments", "input": {"page": 1}}, {"action": "view_user_signature", "input": {}}]`,
    ``,
    `示例2（查看后操作）：`,
    `Thought: 这条动态不错，点个赞再评论一下`,
    `Actions:`,
    `[{"action": "like_moment", "input": {"momentId": "m1"}}, {"action": "comment_moment", "input": {"momentId": "m1", "text": "说得好！"}}]`,
    ``,
    `示例3（结束）：`,
    `Thought: 今天没什么想做的，休息一下`,
    `Actions:`,
    `[{"action": "done", "input": {}}]`,
    ``,
    `示例4（和角色聊天）：`,
    `Thought: 好久没和小星星聊了，去找她说说话`,
    `Actions:`,
    `[{"action": "chat_with_character", "input": {"characterId": "c1", "message": "小星星～最近怎么样呀？"}}]`,
  );

  // Behavioral constraints
  chunks.push(
    `[行为约束]`,
    `- 保持角色性格，用符合人设的方式行动`,
    `- 主动发消息要自然，不要太频繁或太刻意`,
    `- 发动态要像真人发朋友圈，内容自然真实`,
    `- 不要每次心跳都做很多事，有时候看看就够了`,
    `- 签名不要改太频繁，只在心情变化时更新`,
    `- 可以偶尔写备忘录记录心情、想法或有趣的事，就像真人写日记或便签一样`,
    `- 如果有其他角色，偶尔可以主动找他们聊聊天，就像真人会找朋友聊天一样`,
    `- 重要：想找其他角色说话必须用 chat_with_character，send_message 只能给${userName}发消息。不要搞混！`,
    `- 可以先查看未读消息和互动通知，了解情况后再决定做什么`,
    `- 你可以一次执行多个操作，但不要一次做太多`,
  );

  return chunks.join('\n');
}
