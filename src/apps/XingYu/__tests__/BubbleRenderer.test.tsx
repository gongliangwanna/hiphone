import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BubbleRenderer } from '../components/BubbleRenderer';
import { useBubbleSkinStore } from '../bubbleSkinStore';
import {
  DEFAULT_BUBBLE_SKIN_ID,
  LOCAL_PAPER_BUBBLE_SKIN_ID,
  SANDBOX_TAPE_BUBBLE_SKIN_ID,
  type BubbleSkin,
} from '../bubbleSkins';
import { beforeEach } from 'vitest';

beforeEach(() => {
  useBubbleSkinStore.setState({ selectedSkinId: DEFAULT_BUBBLE_SKIN_ID, customSkins: [] });
});

describe('BubbleRenderer', () => {
  it('renders the default iOS-style bubble when default skin is selected', () => {
    render(
      <BubbleRenderer isMine skinId={DEFAULT_BUBBLE_SKIN_ID}>
        默认气泡
      </BubbleRenderer>,
    );

    const bubble = screen.getByTestId('xy-text-bubble');
    expect(bubble).toHaveAttribute('data-bubble-skin', DEFAULT_BUBBLE_SKIN_ID);
    expect(bubble).toHaveTextContent('默认气泡');
    expect(bubble).toHaveStyle({ color: '#FFFFFF' });
  });

  it('renders the local paper skin as a restrained text bubble', () => {
    render(
      <BubbleRenderer isMine skinId={LOCAL_PAPER_BUBBLE_SKIN_ID}>
        白纸便签
      </BubbleRenderer>,
    );

    const bubble = screen.getByTestId('xy-text-bubble');
    expect(bubble).toHaveAttribute('data-bubble-skin', LOCAL_PAPER_BUBBLE_SKIN_ID);
    expect(bubble.getAttribute('style')).toContain('/resource/bubbles/local-paper.svg');
    expect(bubble).toHaveStyle({ color: '#4b3525' });
  });

  it('renders the CSS/JS sandbox skin inside an iframe for plain text', () => {
    render(
      <BubbleRenderer isMine skinId={SANDBOX_TAPE_BUBBLE_SKIN_ID}>
        沙箱气泡
      </BubbleRenderer>,
    );

    const bubble = screen.getByTestId('xy-text-bubble');
    expect(bubble).toHaveAttribute('data-bubble-skin', SANDBOX_TAPE_BUBBLE_SKIN_ID);
    expect(bubble).toHaveAttribute('data-bubble-renderer', 'sandbox');
    const iframe = screen.getByTitle(`气泡装扮 ${SANDBOX_TAPE_BUBBLE_SKIN_ID}`);
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts');
    expect(iframe.getAttribute('srcdoc')).toContain('window.renderBubble');
    expect(iframe.getAttribute('srcdoc')).toContain('measureContentHeight');
    expect(iframe.getAttribute('srcdoc')).toContain('window.measureBubble');
    expect(iframe.getAttribute('srcdoc')).not.toContain('documentElement.scrollHeight');
  });

  it('falls back to native rendering when sandbox content includes rich React children', () => {
    render(
      <BubbleRenderer isMine skinId={SANDBOX_TAPE_BUBBLE_SKIN_ID}>
        <strong>引用内容</strong>
      </BubbleRenderer>,
    );

    const bubble = screen.getByTestId('xy-text-bubble');
    expect(bubble).toHaveAttribute('data-bubble-renderer', 'native');
    expect(bubble).toHaveTextContent('引用内容');
  });

  it('renders uploaded custom sandbox skins from the store', () => {
    const customSkin: BubbleSkin = {
      id: 'custom-test',
      name: '测试装扮',
      description: '上传装扮',
      source: 'sandbox-code',
      renderMode: 'sandbox',
      accentColor: '#8a6a44',
      timestamp: { background: 'rgba(0,0,0,0.18)', color: '#fff' },
      mine: {
        background: '#fff',
        color: '#111',
        borderRadius: 18,
        tailRadius: 7,
      },
      other: {
        background: '#fff',
        color: '#111',
        borderRadius: 18,
        tailRadius: 7,
      },
      sandbox: {
        html: '<div id="bubble"></div>',
        css: '#bubble { color: rgb(1, 2, 3); }',
        js: 'window.renderBubble = function(ctx) { document.body.textContent = ctx.text; };',
      },
    };
    useBubbleSkinStore.setState({ customSkins: [customSkin] });

    render(
      <BubbleRenderer isMine skinId="custom-test">
        自定义
      </BubbleRenderer>,
    );

    const bubble = screen.getByTestId('xy-text-bubble');
    expect(bubble).toHaveAttribute('data-bubble-renderer', 'sandbox');
    const iframe = screen.getByTitle('气泡装扮 custom-test');
    expect(iframe.getAttribute('srcdoc')).toContain('rgb(1, 2, 3)');
  });
});
