/**
 * Live preview pane: compiles the current draftFiles via Sucrase,
 * mounts the entry component inside an ErrorBoundary. Re-mounts whenever
 * draftFiles changes.
 *
 * The preview is ephemeral — never registered with appRegistry, never
 * written to IDB. The compiledMap is rebuilt from scratch each time.
 *
 * See docs/superpowers/specs/2026-04-27-ai-app-builder-v1-design.md
 */

import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { compileTsx } from '@/platform/userApp/compiler';
import { createUserAppRuntime } from '@/platform/userApp/moduleResolver';
import { resolveModule } from '@/platform/userApp/sdk';
import { wrapUserComponent } from '@/platform/userApp/sdk/wrap';
import { validateManifest, ManifestError } from '@/platform/userApp/manifest';
import { useAIAppBuilderStore } from './aiAppBuilderStore';

export function BuilderPreview() {
  const draftId = useAIAppBuilderStore((s) => s.draftId);
  const draftFiles = useAIAppBuilderStore((s) => s.draftFiles);

  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Need a stable JSON-stringified key to know when files actually changed
  const filesKey = useMemo(() => JSON.stringify(draftFiles), [draftFiles]);

  useEffect(() => {
    let cancelled = false;
    if (!draftId || Object.keys(draftFiles).length === 0) {
      setComponent(null);
      setError(null);
      return;
    }

    (async () => {
      try {
        // Validate manifest first
        const manifestSrc = draftFiles['manifest.json'];
        if (!manifestSrc) {
          throw new Error('草稿缺少 manifest.json');
        }
        const manifest = validateManifest(JSON.parse(manifestSrc));

        // Compile every .tsx / .ts file
        const compiledMap: Record<string, string> = {};
        for (const [path, content] of Object.entries(draftFiles)) {
          if (path === 'manifest.json') continue;
          if (path.endsWith('.tsx') || path.endsWith('.ts')) {
            compiledMap[path] = await compileTsx(content, `${draftId}/${path}`);
          }
        }

        // Run sandbox — createUserAppRuntime already extracts exports.default
        // and returns the ComponentType directly (throws if not a function).
        const Raw = createUserAppRuntime(compiledMap, manifest.entry, resolveModule, draftId);

        if (cancelled) return;
        setComponent(() => wrapUserComponent(Raw));
        setError(null);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ManifestError) {
          setError(`manifest.json 无效: ${e.message}`);
        } else {
          setError(e instanceof Error ? e.message : String(e));
        }
        setComponent(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [draftId, filesKey, draftFiles]);

  if (error) {
    return (
      <div
        style={{
          padding: 16,
          color: 'var(--color-systemRed)',
          backgroundColor: 'var(--color-secondarySystemBackground)',
          height: '100%',
          overflow: 'auto',
          fontSize: 13,
          lineHeight: 1.5,
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 8 }}>预览编译失败</div>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
          {error}
        </pre>
      </div>
    );
  }

  if (!Component) {
    return (
      <div
        style={{
          padding: 16,
          color: 'var(--color-secondaryLabel)',
          textAlign: 'center',
          fontSize: 13,
        }}
      >
        尚未生成 — 在下方对话区描述你想要的 app
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <Component />
    </div>
  );
}
