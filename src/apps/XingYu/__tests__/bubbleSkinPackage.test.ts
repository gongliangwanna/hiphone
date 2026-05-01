import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { parseBubbleSkinPackage } from '../bubbleSkinPackage';

describe('parseBubbleSkinPackage', () => {
  it('imports a zip package with manifest, CSS, JS, and assets', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({
      id: 'paper-demo',
      name: '纸条 Demo',
      description: '测试上传',
      entryHtml: 'bubble.html',
      entryCss: 'bubble.css',
      entryJs: 'bubble.js',
      accentColor: '#a46a34',
      minHeight: 52,
      assets: {
        paper: 'assets/paper.png',
      },
    }));
    zip.file('bubble.html', '<div id="bubble"></div>');
    zip.file('bubble.css', '#bubble { background-image: asset("paper"); }');
    zip.file('bubble.js', 'window.renderBubble = function(ctx) { document.body.textContent = ctx.text; };');
    zip.file('assets/paper.png', new Uint8Array([137, 80, 78, 71]));

    const blob = await zip.generateAsync({ type: 'blob' });
    const skin = await parseBubbleSkinPackage(new File([blob], 'paper-demo.zip'));

    expect(skin.id).toBe('custom-paper-demo');
    expect(skin.name).toBe('纸条 Demo');
    expect(skin.source).toBe('sandbox-code');
    expect(skin.renderMode).toBe('sandbox');
    expect(skin.sandbox?.minHeight).toBe(52);
    expect(skin.sandbox?.assets?.paper).toMatch(/^data:image\/png;base64,/);
    expect(skin.sandbox?.css).toContain('url("data:image/png;base64,');
  });

  it('rejects non-zip files', async () => {
    await expect(parseBubbleSkinPackage(new File(['x'], 'skin.css'))).rejects.toThrow('.zip');
  });
});
