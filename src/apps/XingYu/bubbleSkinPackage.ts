import JSZip from 'jszip';
import { DEFAULT_BUBBLE_SKIN_ID, type BubbleSkin } from './bubbleSkins';

interface BubbleSkinManifest {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  entryHtml?: unknown;
  entryCss?: unknown;
  entryJs?: unknown;
  accentColor?: unknown;
  minHeight?: unknown;
  assets?: unknown;
}

const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_CHARS = 80_000;
const MAX_ASSET_BYTES = 700 * 1024;
const MAX_TOTAL_ASSET_BYTES = 1024 * 1024;

export async function parseBubbleSkinPackage(file: File): Promise<BubbleSkin> {
  if (!file.name.toLowerCase().endsWith('.zip')) {
    throw new Error('请上传 .zip 装扮包');
  }
  if (file.size > MAX_PACKAGE_BYTES) {
    throw new Error('装扮包不能超过 2MB');
  }

  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const manifest = await readManifest(zip);
  const entryHtml = stringValue(manifest.entryHtml, 'bubble.html');
  const entryCss = stringValue(manifest.entryCss, 'bubble.css');
  const entryJs = stringValue(manifest.entryJs, 'bubble.js');
  const html = await readOptionalText(zip, entryHtml, '<div id="bubble"></div>');
  const rawCss = await readOptionalText(zip, entryCss, '');
  const js = await readOptionalText(zip, entryJs, DEFAULT_RENDER_JS);
  const assets = await readAssets(zip, manifest.assets);
  const css = replaceAssetTokens(rawCss, assets);
  const name = stringValue(manifest.name, file.name.replace(/\.zip$/i, '')).trim() || '未命名装扮';

  return {
    id: normalizeId(stringValue(manifest.id, `custom-${Date.now()}-${name}`)),
    name,
    description: stringValue(manifest.description, '上传的 CSS/JS 气泡装扮'),
    source: 'sandbox-code',
    renderMode: 'sandbox',
    accentColor: normalizeColor(stringValue(manifest.accentColor, '#8a6a44')),
    timestamp: {
      background: 'rgba(0,0,0,0.18)',
      color: '#fff',
      backdropFilter: 'blur(12px)',
    },
    mine: fallbackSurface(true),
    other: fallbackSurface(false),
    sandbox: {
      html,
      css,
      js,
      assets,
      minHeight: numberValue(manifest.minHeight, 46),
    },
  };
}

async function readManifest(zip: JSZip): Promise<BubbleSkinManifest> {
  const file = zip.file('manifest.json');
  if (!file) throw new Error('装扮包缺少 manifest.json');
  const text = await file.async('text');
  if (text.length > MAX_TEXT_CHARS) throw new Error('manifest.json 太大');
  try {
    const parsed = JSON.parse(text) as BubbleSkinManifest;
    if (!parsed || typeof parsed !== 'object') throw new Error();
    return parsed;
  } catch {
    throw new Error('manifest.json 格式错误');
  }
}

async function readOptionalText(zip: JSZip, path: string, fallback: string): Promise<string> {
  const file = zip.file(path);
  if (!file) return fallback;
  const text = await file.async('text');
  if (text.length > MAX_TEXT_CHARS) {
    throw new Error(`${path} 不能超过 ${MAX_TEXT_CHARS} 字符`);
  }
  return text;
}

async function readAssets(zip: JSZip, assetsManifest: unknown): Promise<Record<string, string>> {
  if (!assetsManifest || typeof assetsManifest !== 'object' || Array.isArray(assetsManifest)) return {};
  const assets: Record<string, string> = {};
  let totalBytes = 0;
  for (const [name, pathValue] of Object.entries(assetsManifest as Record<string, unknown>)) {
    if (!isSafeAssetName(name)) continue;
    if (typeof pathValue !== 'string') continue;
    const file = zip.file(pathValue);
    if (!file) throw new Error(`资源不存在：${pathValue}`);
    const data = await file.async('uint8array');
    if (data.byteLength > MAX_ASSET_BYTES) throw new Error(`单个资源不能超过 700KB：${name}`);
    totalBytes += data.byteLength;
    if (totalBytes > MAX_TOTAL_ASSET_BYTES) throw new Error('装扮资源总大小不能超过 1MB');
    const base64 = uint8ToBase64(data);
    assets[name] = `data:${mimeForPath(pathValue)};base64,${base64}`;
  }
  return assets;
}

function replaceAssetTokens(css: string, assets: Record<string, string>): string {
  return css.replace(/asset\(\s*["']?([a-zA-Z0-9_.-]+)["']?\s*\)/g, (_match, name: string) => {
    const dataUrl = assets[name];
    return dataUrl ? `url("${dataUrl}")` : 'none';
  });
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(24, Math.min(240, value))
    : fallback;
}

function normalizeColor(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim() : '#8a6a44';
}

function normalizeId(value: string): string {
  const id = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!id || id === DEFAULT_BUBBLE_SKIN_ID) return `custom-${Date.now()}`;
  return id.startsWith('custom-') ? id : `custom-${id}`;
}

function isSafeAssetName(name: string): boolean {
  return /^[a-zA-Z0-9_.-]{1,40}$/.test(name);
}

function mimeForPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function uint8ToBase64(data: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < data.length; i += chunkSize) {
    binary += String.fromCharCode(...data.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function fallbackSurface(isMine: boolean): BubbleSkin['mine'] {
  return {
    background: isMine ? 'rgba(255, 248, 232, 0.96)' : 'rgba(255,255,255,0.96)',
    color: isMine ? '#4b3525' : '#33302c',
    border: '1px solid rgba(60, 60, 67, 0.1)',
    borderRadius: 18,
    tailRadius: 7,
    boxShadow: '0 2px 8px rgba(70, 60, 45, 0.08)',
  };
}

const DEFAULT_RENDER_JS = `
window.renderBubble = function renderBubble(ctx) {
  const root = document.getElementById('bubble') || document.body;
  root.textContent = ctx.text || '';
};
`;
