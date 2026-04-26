/**
 * Heartbeat agent format override for the prompt assembly pipeline.
 *
 * Instead of building a standalone prompt, this module provides a `formatOverride`
 * string that replaces the default [回复格式] section in `assemblePrompt()`.
 * This way the heartbeat agent gets the same full context as regular chat
 * (character card, persona, world book, chat history, device context, etc.)
 * but with ReAct agent instructions instead of JSON structured output.
 */


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

  // Tool descriptions (inlined — buildHeartbeatTools was deleted in S6;
  // heartbeatPrompt.ts itself will be removed in S8 once runHeartbeat
  // switches to the Tool Registry path).
  const toolLines: string[] = [
    `- send_message: 在你和${userName}的私聊中发一条消息(注意:这是给${userName}发消息,不是给其他角色)\n  参数格式: {"text": "消息内容"}`,
    `- post_moment: 发一条星球动态(朋友圈)\n  参数格式: {"text": "动态内容"}`,
    `- view_moments: 分页查看星球动态,每页5条\n  参数格式: {"page": 1}`,
    `- like_moment: 给某条动态点赞(先 view_moments 获取编号)\n  参数格式: {"momentId": "m1"}`,
    `- comment_moment: 给某条动态评论(先 view_moments 获取编号)\n  参数格式: {"momentId": "m1", "text": "评论内容"}`,
    `- view_user_signature: 查看${userName}当前的个性签名\n  参数格式: {}`,
    `- view_user_signature_history: 查看${userName}的历史个性签名\n  参数格式: {}`,
    `- update_signature: 修改自己的个性签名\n  参数格式: {"text": "新签名"}`,
    `- view_notes: 分页查看自己的备忘录,每页5条\n  参数格式: {"page": 1}`,
    `- create_note: 创建一条备忘录(可以用来写日记、记录想法等)\n  参数格式: {"title": "标题", "body": "内容"}`,
    `- view_unread_messages: 查看${userName}发给你的未回复消息\n  参数格式: {}`,
    `- view_unread_interactions: 查看你的动态收到的互动通知(谁赞了/评论了你的动态)\n  参数格式: {}`,
    `- view_characters: 查看可以聊天的其他角色列表\n  参数格式: {}`,
    `- chat_with_character: 和另一个AI角色私聊(想找别的角色说话就用这个,不是send_message)\n  参数格式: {"characterId": "c1", "message": "你想对TA说的话"}`,
    `- done: 结束本次心跳,不再执行其他操作\n  参数格式: {}`,
  ];
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
