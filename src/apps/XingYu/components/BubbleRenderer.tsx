import {
  Children,
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  resolveBubbleSkinWithCustom,
  surfaceToCss,
  type BubbleSandboxRuntime,
} from '../bubbleSkins';
import { useBubbleSkinStore } from '../bubbleSkinStore';

interface Props {
  isMine: boolean;
  skinId: string;
  children: ReactNode;
}

export const BubbleRenderer = memo(function BubbleRenderer({ isMine, skinId, children }: Props) {
  const customSkins = useBubbleSkinStore((s) => s.customSkins);
  const skin = resolveBubbleSkinWithCustom(skinId, customSkins);
  const surface = isMine ? skin.mine : skin.other;
  const childParts = Children.toArray(children);
  const hasRichChildren = childParts.some(
    (child) => typeof child !== 'string' && typeof child !== 'number',
  );
  const plainText = childParts
    .filter((child): child is string | number => typeof child === 'string' || typeof child === 'number')
    .join('');

  if (skin.renderMode === 'sandbox' && skin.sandbox && !hasRichChildren) {
    return (
      <SandboxBubble
        isMine={isMine}
        skinId={skin.id}
        sandbox={skin.sandbox}
        text={plainText}
      />
    );
  }

  return (
    <div
      data-testid="xy-text-bubble"
      data-bubble-skin={skin.id}
      data-bubble-renderer="native"
      style={surfaceToCss(surface, isMine)}
    >
      {children}
    </div>
  );
});

function SandboxBubble({
  isMine,
  skinId,
  sandbox,
  text,
}: {
  isMine: boolean;
  skinId: string;
  sandbox: BubbleSandboxRuntime;
  text: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const reactId = useId();
  const bubbleId = useMemo(
    () => `xy-bubble-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    [reactId],
  );
  const [height, setHeight] = useState(sandbox.minHeight ?? 44);
  const srcDoc = useMemo(() => buildSandboxSrcDoc(sandbox, bubbleId), [sandbox, bubbleId]);

  useEffect(() => {
    setHeight(sandbox.minHeight ?? 44);
  }, [sandbox.minHeight, srcDoc]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; bubbleId?: string; height?: number };
      if (data?.type !== 'xy-bubble-size' || data.bubbleId !== bubbleId) return;
      const nextHeight = Number(data.height);
      if (!Number.isFinite(nextHeight)) return;
      setHeight(Math.max(sandbox.minHeight ?? 44, Math.ceil(nextHeight)));
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [bubbleId, sandbox.minHeight]);

  const postRender = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'xy-render-bubble',
        bubbleId,
        ctx: {
          text,
          isMine,
          senderName: isMine ? 'me' : 'other',
          timestamp: Date.now(),
          assets: sandbox.assets ?? {},
        },
      },
      '*',
    );
  }, [bubbleId, isMine, sandbox.assets, text]);

  useEffect(() => {
    postRender();
    const retry = window.setTimeout(postRender, 40);
    return () => window.clearTimeout(retry);
  }, [postRender]);

  return (
    <div
      data-testid="xy-text-bubble"
      data-bubble-skin={skinId}
      data-bubble-renderer="sandbox"
      style={{
        width: '100%',
        height,
        overflow: 'hidden',
      }}
    >
      <iframe
        ref={iframeRef}
        title={`气泡装扮 ${skinId}`}
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        onLoad={postRender}
        style={{
          display: 'block',
          width: '100%',
          height,
          border: 0,
          background: 'transparent',
          overflow: 'hidden',
        }}
      />
    </div>
  );
}

function buildSandboxSrcDoc(sandbox: BubbleSandboxRuntime, bubbleId: string): string {
  const css = escapeHtmlEndTag(sandbox.css, 'style');
  const js = escapeHtmlEndTag(sandbox.js, 'script');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline';"
  />
  <style>${css}</style>
</head>
<body>
  ${sandbox.html}
  <script>
${js}
  </script>
  <script>
(function () {
  var bubbleId = ${JSON.stringify(bubbleId)};
  function px(value) {
    var parsed = parseFloat(value || '0');
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function measureContentHeight() {
    if (typeof window.measureBubble === 'function') {
      var customHeight = Number(window.measureBubble());
      if (Number.isFinite(customHeight) && customHeight > 0) {
        return customHeight;
      }
    }
    var body = document.body;
    if (!body) return 0;
    var bodyStyle = window.getComputedStyle(body);
    var paddingBottom = px(bodyStyle.paddingBottom);
    var targets = [];
    var preferred = document.getElementById('bubble');
    if (preferred) targets.push(preferred);
    for (var i = 0; i < body.children.length; i += 1) {
      var child = body.children[i];
      if (child === preferred || child.tagName === 'SCRIPT' || child.tagName === 'STYLE') continue;
      targets.push(child);
    }
    var bottom = 0;
    for (var j = 0; j < targets.length; j += 1) {
      var rect = targets[j].getBoundingClientRect();
      bottom = Math.max(bottom, rect.bottom);
    }
    if (bottom > 0) return bottom + paddingBottom;
    return body.scrollHeight;
  }
  function emitSize() {
    var height = measureContentHeight();
    parent.postMessage({ type: 'xy-bubble-size', bubbleId: bubbleId, height: height }, '*');
  }
  function render(ctx) {
    try {
      if (typeof window.renderBubble === 'function') {
        window.renderBubble(ctx);
      } else {
        document.body.textContent = ctx.text || '';
      }
    } catch (err) {
      document.body.textContent = ctx.text || '';
    }
    requestAnimationFrame(emitSize);
    setTimeout(emitSize, 60);
  }
  window.addEventListener('message', function (event) {
    var data = event.data || {};
    if (data.type !== 'xy-render-bubble' || data.bubbleId !== bubbleId) return;
    render(data.ctx || {});
  });
  window.addEventListener('load', emitSize);
})();
  </script>
</body>
</html>`;
}

function escapeHtmlEndTag(value: string, tagName: string): string {
  return value.replace(new RegExp(`</${tagName}`, 'gi'), `<\\/${tagName}`);
}
