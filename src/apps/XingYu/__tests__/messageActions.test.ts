import { describe, it, expect, beforeEach } from 'vitest';
import { useXYData } from '../xingYuDataStore';
import type { TextMessage, ImageMessage, LocationMessage, Conversation } from '../data';

beforeEach(() => {
  useXYData.setState({
    messages: [],
    conversations: [],
    favorites: [],
  });
});

describe('deleteMessages', () => {
  it('removes specified messages by id', () => {
    const msg1: TextMessage = { id: 'm1', convId: 'c1', senderId: 'me', type: 'text', text: 'hello', timestamp: 1 };
    const msg2: TextMessage = { id: 'm2', convId: 'c1', senderId: 'me', type: 'text', text: 'world', timestamp: 2 };
    const msg3: TextMessage = { id: 'm3', convId: 'c1', senderId: 'other', type: 'text', text: 'hi', timestamp: 3 };
    useXYData.setState({ messages: [msg1, msg2, msg3] });

    useXYData.getState().deleteMessages(['m1', 'm3']);

    expect(useXYData.getState().messages).toHaveLength(1);
    expect(useXYData.getState().messages[0]!.id).toBe('m2');
  });

  it('is a no-op when ids do not match', () => {
    const msg1: TextMessage = { id: 'm1', convId: 'c1', senderId: 'me', type: 'text', text: 'hi', timestamp: 1 };
    useXYData.setState({ messages: [msg1] });
    useXYData.getState().deleteMessages(['nonexistent']);
    expect(useXYData.getState().messages).toHaveLength(1);
  });
});

describe('addFavorite', () => {
  it('adds a text message to favorites with extracted content', () => {
    const msg: TextMessage = { id: 'm1', convId: 'c1', senderId: 'idol1', type: 'text', text: 'hello', timestamp: 1000 };
    useXYData.getState().addFavorite(msg, 'Test User');

    const favs = useXYData.getState().favorites;
    expect(favs).toHaveLength(1);
    expect(favs[0]!.messageId).toBe('m1');
    expect(favs[0]!.content.text).toBe('hello');
    expect(favs[0]!.senderName).toBe('Test User');
    expect(favs[0]!.type).toBe('text');
  });

  it('does not add duplicate favorites for the same messageId', () => {
    const msg: TextMessage = { id: 'm1', convId: 'c1', senderId: 'idol1', type: 'text', text: 'hello', timestamp: 1000 };
    useXYData.getState().addFavorite(msg, 'User');
    useXYData.getState().addFavorite(msg, 'User');

    expect(useXYData.getState().favorites).toHaveLength(1);
  });

  it('extracts imageUrl for image messages', () => {
    const msg: ImageMessage = { id: 'm-img', convId: 'c1', senderId: 'a', type: 'image', imageUrl: 'data:abc', timestamp: 1 };
    useXYData.getState().addFavorite(msg, 'A');

    const fav = useXYData.getState().favorites[0]!;
    expect(fav.content.imageUrl).toBe('data:abc');
    expect(fav.content.text).toBeUndefined();
  });

  it('extracts location payload for location messages', () => {
    const msg: LocationMessage = {
      id: 'm-loc',
      convId: 'c1',
      senderId: 'a',
      type: 'location',
      location: { label: '我的位置', latitude: 31.2304, longitude: 121.4737 },
      timestamp: 1,
    };
    useXYData.getState().addFavorite(msg, 'A');

    const fav = useXYData.getState().favorites[0]!;
    expect(fav.content.location).toEqual({ label: '我的位置', latitude: 31.2304, longitude: 121.4737 });
    expect(fav.content.text).toBeUndefined();
  });
});

describe('addFavorites', () => {
  it('batch adds multiple messages to favorites', () => {
    const msg1: TextMessage = { id: 'm1', convId: 'c1', senderId: 'a', type: 'text', text: 'one', timestamp: 1 };
    const msg2: ImageMessage = { id: 'm2', convId: 'c1', senderId: 'b', type: 'image', imageUrl: 'url', timestamp: 2 };
    useXYData.getState().addFavorites([msg1, msg2], (id) => (id === 'a' ? 'Alice' : 'Bob'));

    const favs = useXYData.getState().favorites;
    expect(favs).toHaveLength(2);
    expect(favs.find((f) => f.messageId === 'm1')!.senderName).toBe('Alice');
    expect(favs.find((f) => f.messageId === 'm2')!.senderName).toBe('Bob');
  });

  it('skips messages that are already favorited', () => {
    const msg1: TextMessage = { id: 'm1', convId: 'c1', senderId: 'a', type: 'text', text: 'one', timestamp: 1 };
    const msg2: TextMessage = { id: 'm2', convId: 'c1', senderId: 'a', type: 'text', text: 'two', timestamp: 2 };
    useXYData.getState().addFavorite(msg1, 'A');
    useXYData.getState().addFavorites([msg1, msg2], () => 'A');

    expect(useXYData.getState().favorites).toHaveLength(2);
  });
});

describe('removeFavorite', () => {
  it('removes a favorite by its favorite id', () => {
    const msg: TextMessage = { id: 'm1', convId: 'c1', senderId: 'a', type: 'text', text: 'hi', timestamp: 1 };
    useXYData.getState().addFavorite(msg, 'A');
    const favId = useXYData.getState().favorites[0]!.id;
    useXYData.getState().removeFavorite(favId);

    expect(useXYData.getState().favorites).toHaveLength(0);
  });
});

describe('forwardMessage', () => {
  it('copies a text message to target conversation as me', () => {
    const conv: Conversation = { id: 'c2', idolId: 'idol2', lastMsg: '', lastTime: 0, unread: 0 };
    useXYData.setState({ conversations: [conv] });

    const msg: TextMessage = { id: 'm1', convId: 'c1', senderId: 'idol1', type: 'text', text: 'forwarded', timestamp: 1 };
    useXYData.getState().forwardMessage(msg, 'c2');

    const msgs = useXYData.getState().messages.filter((m) => m.convId === 'c2');
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.type).toBe('text');
    expect((msgs[0] as TextMessage).text).toBe('forwarded');
    expect(msgs[0]!.senderId).toBe('me');
  });

  it('updates target conversation lastMsg preview', () => {
    const conv: Conversation = { id: 'c2', idolId: 'idol2', lastMsg: '', lastTime: 0, unread: 0 };
    useXYData.setState({ conversations: [conv] });
    const msg: ImageMessage = { id: 'm1', convId: 'c1', senderId: 'a', type: 'image', imageUrl: 'u', timestamp: 1 };
    useXYData.getState().forwardMessage(msg, 'c2');

    const updated = useXYData.getState().conversations.find((c) => c.id === 'c2')!;
    expect(updated.lastMsg).toBe('[图片]');
  });

  it('copies a location message and updates target preview', () => {
    const conv: Conversation = { id: 'c2', idolId: 'idol2', lastMsg: '', lastTime: 0, unread: 0 };
    useXYData.setState({ conversations: [conv] });
    const msg: LocationMessage = {
      id: 'm-loc',
      convId: 'c1',
      senderId: 'a',
      type: 'location',
      location: { label: '我的位置', latitude: 31.2304, longitude: 121.4737 },
      timestamp: 1,
    };

    useXYData.getState().forwardMessage(msg, 'c2');

    const created = useXYData.getState().messages.find((m) => m.convId === 'c2')!;
    expect(created.type).toBe('location');
    if (created.type !== 'location') throw new Error('expected location');
    expect(created.location).toEqual(msg.location);
    const updated = useXYData.getState().conversations.find((c) => c.id === 'c2')!;
    expect(updated.lastMsg).toBe('[位置] 我的位置');
  });
});

describe('forwardMessages', () => {
  it('copies all messages to target conversation', () => {
    const conv: Conversation = { id: 'c2', idolId: 'idol2', lastMsg: '', lastTime: 0, unread: 0 };
    useXYData.setState({ conversations: [conv] });

    const msgs: TextMessage[] = [
      { id: 'm1', convId: 'c1', senderId: 'a', type: 'text', text: 'one', timestamp: 1 },
      { id: 'm2', convId: 'c1', senderId: 'me', type: 'text', text: 'two', timestamp: 2 },
    ];
    useXYData.getState().forwardMessages(msgs, 'c2');

    const created = useXYData.getState().messages.filter((m) => m.convId === 'c2');
    expect(created).toHaveLength(2);
    expect(created.every((m) => m.senderId === 'me')).toBe(true);
  });
});

describe('forwardAsCard', () => {
  it('creates a forward_card message in target conversation', () => {
    const conv: Conversation = { id: 'c2', idolId: 'idol2', lastMsg: '', lastTime: 0, unread: 0 };
    useXYData.setState({ conversations: [conv] });

    const msgs: TextMessage[] = [
      { id: 'm1', convId: 'c1', senderId: 'a', type: 'text', text: 'hello', timestamp: 1 },
      { id: 'm2', convId: 'c1', senderId: 'me', type: 'text', text: 'world', timestamp: 2 },
    ];
    useXYData.getState().forwardAsCard(msgs, 'c2', '我和 A 的聊天记录', (id) => (id === 'a' ? 'A' : '我'));

    const created = useXYData.getState().messages.filter((m) => m.convId === 'c2');
    expect(created).toHaveLength(1);
    expect(created[0]!.type).toBe('forward_card');
  });

  it('preview includes sender names and content snippets', () => {
    const conv: Conversation = { id: 'c2', idolId: 'idol2', lastMsg: '', lastTime: 0, unread: 0 };
    useXYData.setState({ conversations: [conv] });

    const msgs: TextMessage[] = [
      { id: 'm1', convId: 'c1', senderId: 'a', type: 'text', text: 'hello', timestamp: 1 },
    ];
    useXYData.getState().forwardAsCard(msgs, 'c2', 'title', () => 'Alice');

    const created = useXYData.getState().messages.find((m) => m.convId === 'c2')!;
    if (created.type !== 'forward_card') throw new Error('expected forward_card');
    expect(created.forwardCard.preview[0]).toContain('Alice');
    expect(created.forwardCard.preview[0]).toContain('hello');
  });

  it('merge-forward preview includes location labels', () => {
    const conv: Conversation = { id: 'c2', idolId: 'idol2', lastMsg: '', lastTime: 0, unread: 0 };
    useXYData.setState({ conversations: [conv] });

    const msgs: LocationMessage[] = [
      {
        id: 'm-loc',
        convId: 'c1',
        senderId: 'a',
        type: 'location',
        location: { label: '我的位置', latitude: 31.2304, longitude: 121.4737 },
        timestamp: 1,
      },
    ];
    useXYData.getState().forwardAsCard(msgs, 'c2', '位置记录', () => 'Alice');

    const created = useXYData.getState().messages.find((m) => m.convId === 'c2')!;
    if (created.type !== 'forward_card') throw new Error('expected forward_card');
    expect(created.forwardCard.messages[0]!.type).toBe('location');
    expect(created.forwardCard.messages[0]!.location).toEqual(msgs[0]!.location);
    expect(created.forwardCard.preview[0]).toContain('Alice');
    expect(created.forwardCard.preview[0]).toContain('[位置] 我的位置');
  });
});
