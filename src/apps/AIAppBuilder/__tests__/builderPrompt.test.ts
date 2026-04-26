import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../builderPrompt';

describe('buildSystemPrompt', () => {
  it('includes draftId in the manifest constraint', () => {
    const prompt = buildSystemPrompt('ai-app-tomato-abcd');
    expect(prompt).toContain('ai-app-tomato-abcd');
  });

  it('mentions the JSON {files:[{path,content}]} output format', () => {
    const prompt = buildSystemPrompt('ai-app-x-1234');
    expect(prompt).toContain('files');
    expect(prompt).toContain('path');
    expect(prompt).toContain('content');
    expect(prompt).toContain('JSON');
  });

  it('lists the available SDK modules', () => {
    const prompt = buildSystemPrompt('ai-app-x-1234');
    expect(prompt).toContain('@hiphone/storage');
    expect(prompt).toContain('@hiphone/ai');
    expect(prompt).toContain('@hiphone/perspective');
    expect(prompt).toContain('@hiphone/hooks');
    expect(prompt).toContain('react');
    expect(prompt).toContain('lucide-react');
  });

  it('includes the todo-app fixture as few-shot example 1', () => {
    const prompt = buildSystemPrompt('ai-app-x-1234');
    // todo-app's App.tsx imports useAppMemory — this string is unique to it
    expect(prompt).toContain('useAppMemory');
  });

  it('includes the ai-translator-app fixture as few-shot example 2', () => {
    const prompt = buildSystemPrompt('ai-app-x-1234');
    // ai-translator-app uses streamComplete
    expect(prompt).toContain('streamComplete');
  });

  it('explicitly forbids markdown code fences in the response', () => {
    const prompt = buildSystemPrompt('ai-app-x-1234');
    expect(prompt).toMatch(/不要.*markdown|markdown.*不要|代码块|code fence/i);
  });

  it('warns about sandbox limitations (window / document / fetch unavailable)', () => {
    const prompt = buildSystemPrompt('ai-app-x-1234');
    expect(prompt).toContain('沙箱限制');
    expect(prompt).toContain('window');
    expect(prompt).toContain('document');
    expect(prompt).toContain('fetch');
    expect(prompt).toContain('localStorage');
    // Suggests alternatives for keyboard input (no physical keyboard on phone)
    expect(prompt).toMatch(/键盘|手势|方向按钮/);
  });
});
