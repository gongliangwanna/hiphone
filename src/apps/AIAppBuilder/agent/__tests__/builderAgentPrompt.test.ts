import { describe, expect, it } from 'vitest';
import { buildAgentSystemPrompt } from '../builderAgentPrompt';

describe('buildAgentSystemPrompt', () => {
  it('documents async storage and the hydrate-before-save rule', () => {
    const prompt = buildAgentSystemPrompt('ai-app-test-1234');

    expect(prompt).toContain('@hiphone/storage: async');
    expect(prompt).toContain('全部返回 Promise');
    expect(prompt).toContain('await get');
    expect(prompt).toContain('不要在 useState 初始化函数里同步读取');
    expect(prompt).toContain('返回桌面时 React 组件会 unmount');
    expect(prompt).toContain('不要在组件首次渲染后用默认空数组/空对象立刻 set');
    expect(prompt).toContain('通常不要手动 JSON.stringify');
    expect(prompt).toContain('sdk.storage');
    expect(prompt).toContain('sdk.ai');
    expect(prompt).toContain('sdk.hooks');
    expect(prompt).not.toContain('上限 25 轮工具调用');
  });
});
