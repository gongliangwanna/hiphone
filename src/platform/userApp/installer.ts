import JSZip from 'jszip';
import React, { type ComponentType } from 'react';
import { appRegistry } from '@/platform/appRegistry';
import {
  useInstalledUserAppsStore,
  type InstalledUserApp,
} from '@/platform/stores/installedUserAppsStore';
import {
  getDB,
  APP_META_STORE,
  APP_SRC_STORE,
  APP_KV_STORE,
  APP_KV_BY_APP_INDEX,
} from '@/platform/storage/idbStorage';
import { compileTsx } from './compiler';
import { createUserAppRuntime } from './moduleResolver';
import { resolveModule } from './sdk';
import { wrapUserComponent } from './sdk/wrap';
import { validateManifest, type UserAppManifest, ManifestError } from './manifest';
import { migrateS3ToS4Owner } from './migrations';
import { registerMountedApp } from './sdk/context';
import { ensureTwindInstalled } from './twindRuntime';

export type InstallErrorKind =
  | 'bad-zip'
  | 'bad-manifest'
  | 'id-conflict'
  | 'entry-missing'
  | 'compile'
  | 'uninstall-builtin'
  | 'io';

export class InstallError extends Error {
  constructor(
    public kind: InstallErrorKind,
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = 'InstallError';
  }
}

export interface InstallResult {
  id: string;
  installedAt: number;
  isUpgrade: boolean;
}

interface AppMeta {
  manifest: UserAppManifest;
  installedAt: number;
  iconDataUrl: string | null;
}

interface AppSrc {
  compiledMap: Record<string, string>;
  installedAt: number;
}

const USER_APP_PAGE = 1; // default: land user apps on page 1 (next to builtins)

export async function install(file: Blob): Promise<InstallResult> {
  // 1. Unzip
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch (err) {
    throw new InstallError('bad-zip', `failed to unzip: ${toMessage(err)}`, err);
  }

  // 2. Read + validate manifest
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new InstallError('bad-manifest', 'zip is missing manifest.json');
  }
  let manifest: UserAppManifest;
  try {
    const raw = await manifestFile.async('string');
    const parsed: unknown = JSON.parse(raw);
    manifest = validateManifest(parsed);
  } catch (err) {
    if (err instanceof InstallError) throw err;
    if (err instanceof ManifestError) {
      throw new InstallError('bad-manifest', err.message, err);
    }
    throw new InstallError('bad-manifest', `manifest.json: ${toMessage(err)}`, err);
  }

  // 3. id conflict check
  const existing = appRegistry.get(manifest.id);
  if (existing && existing.type === 'builtin') {
    throw new InstallError(
      'id-conflict',
      `manifest.id "${manifest.id}" conflicts with a builtin app`,
    );
  }
  const isUpgrade = !!existing && existing.type === 'user';

  // 4. Read entry file + compile all .tsx/.ts
  const filesToCompile = findCompilableFiles(zip);
  if (!filesToCompile.includes(manifest.entry)) {
    throw new InstallError(
      'entry-missing',
      `manifest.entry "${manifest.entry}" not found in zip`,
    );
  }
  const compiledMap: Record<string, string> = {};
  for (const path of filesToCompile) {
    const fileEntry = zip.file(path);
    if (!fileEntry) {
      throw new InstallError('entry-missing', `file ${path} referenced but missing`);
    }
    const source = await fileEntry.async('string');
    try {
      compiledMap[path] = await compileTsx(source, `${manifest.id}/${path}`);
    } catch (err) {
      throw new InstallError(
        'compile',
        `failed to compile ${path}: ${toMessage(err)}`,
        err,
      );
    }
  }

  // 5. Icon → data URL
  let iconDataUrl: string | null = null;
  if (manifest.icon) {
    const iconFile = zip.file(manifest.icon);
    if (iconFile) {
      const bytes = await iconFile.async('uint8array');
      iconDataUrl = bytesToDataUrl(bytes, mimeOf(manifest.icon));
    }
  }

  const installedAt = Date.now();

  // 6. IDB atomic write (app-meta + app-src in one tx)
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([APP_META_STORE, APP_SRC_STORE], 'readwrite');
    const meta: AppMeta = { manifest, installedAt, iconDataUrl };
    const src: AppSrc = { compiledMap, installedAt };
    tx.objectStore(APP_META_STORE).put(meta, manifest.id);
    tx.objectStore(APP_SRC_STORE).put(src, manifest.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new InstallError('io', 'failed to write IDB', tx.error));
  });

  // 7. Update installedUserAppsStore
  const record: InstalledUserApp = {
    id: manifest.id,
    name: manifest.name,
    iconDataUrl,
    page: USER_APP_PAGE,
    perspectiveAware: manifest.perspectiveAware,
  };
  useInstalledUserAppsStore.getState().add(record);

  // 8. Register in appRegistry
  const component = buildUserAppComponent(manifest, compiledMap);
  appRegistry.register({
    id: manifest.id,
    type: 'user',
    component,
    perspectiveAware: manifest.perspectiveAware,
    globalData: false,
  });

  return { id: manifest.id, installedAt, isUpgrade };
}

export async function uninstall(appId: string): Promise<void> {
  const entry = appRegistry.get(appId);
  if (entry && entry.type === 'builtin') {
    throw new InstallError('uninstall-builtin', `cannot uninstall builtin app "${appId}"`);
  }

  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      [APP_META_STORE, APP_SRC_STORE, APP_KV_STORE],
      'readwrite',
    );
    tx.objectStore(APP_META_STORE).delete(appId);
    tx.objectStore(APP_SRC_STORE).delete(appId);
    // Clear all app-kv rows whose value.appId === appId via the index
    const kvStore = tx.objectStore(APP_KV_STORE);
    const index = kvStore.index(APP_KV_BY_APP_INDEX);
    const cursorReq = index.openCursor(IDBKeyRange.only(appId));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new InstallError('io', 'uninstall IDB error', tx.error));
  });

  useInstalledUserAppsStore.getState().remove(appId);
  appRegistry.unregister(appId);
}

export async function loadInstalledApps(): Promise<void> {
  await migrateS3ToS4Owner();

  const db = await getDB();

  const metas = await new Promise<Array<{ id: string; meta: AppMeta }>>(
    (resolve, reject) => {
      const tx = db.transaction(APP_META_STORE, 'readonly');
      const store = tx.objectStore(APP_META_STORE);
      const results: Array<{ id: string; meta: AppMeta }> = [];
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          results.push({ id: String(cursor.key), meta: cursor.value as AppMeta });
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve(results);
      tx.onerror = () => reject(tx.error);
    },
  );

  const records: InstalledUserApp[] = metas.map(({ id, meta }) => ({
    id,
    name: meta.manifest.name,
    iconDataUrl: meta.iconDataUrl,
    page: USER_APP_PAGE,
    perspectiveAware: meta.manifest.perspectiveAware,
  }));
  useInstalledUserAppsStore.getState().replaceAll(records);

  for (const { id, meta } of metas) {
    const src = await new Promise<AppSrc | undefined>((resolve, reject) => {
      const tx = db.transaction(APP_SRC_STORE, 'readonly');
      const req = tx.objectStore(APP_SRC_STORE).get(id);
      req.onsuccess = () => resolve(req.result as AppSrc | undefined);
      req.onerror = () => reject(req.error);
    });
    if (!src) continue;
    const component = buildUserAppComponent(meta.manifest, src.compiledMap);
    appRegistry.register({
      id,
      type: 'user',
      component,
      perspectiveAware: meta.manifest.perspectiveAware,
      globalData: false,
    });
  }
}

// ─────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────

function findCompilableFiles(zip: JSZip): string[] {
  const out: string[] = [];
  zip.forEach((path, entry) => {
    if (entry.dir) return;
    if (path.endsWith('.tsx') || path.endsWith('.ts')) out.push(path);
  });
  return out;
}

function buildUserAppComponent(
  manifest: UserAppManifest,
  compiledMap: Record<string, string>,
): ComponentType {
  // Defer createUserAppRuntime execution until first render so that
  // missing-import errors surface at open-time (not install-time).
  // The UserAppErrorBoundary inside wrapUserComponent will catch and
  // display the error gracefully if the runtime throws on first render.
  let cache: ComponentType | null = null;
  const appId = manifest.id;
  const LazyRaw: ComponentType = function LazyUserApp() {
    if (!cache) {
      cache = createUserAppRuntime(compiledMap, manifest.entry, resolveModule, appId);
    }

    // Register this app instance via useLayoutEffect so it runs before any
    // passive useEffect callbacks inside user app code (e.g. `get('todos')`
    // in useEffect). React runs ALL layout effects before ANY passive effects,
    // regardless of component depth — so this registration is guaranteed to
    // be in place when user app useEffect callbacks fire.
    //
    // Also kick off runtime Tailwind bootstrap so user app className="flex"
    // etc. get their CSS generated. The first user app mount triggers the
    // import; subsequent mounts are no-ops.
    React.useLayoutEffect(() => {
      void ensureTwindInstalled();
      const unregister = registerMountedApp(appId);
      return unregister;
    }, []);

    return React.createElement(cache);
  };
  return wrapUserComponent(LazyRaw);
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function mimeOf(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64 =
    typeof btoa !== 'undefined'
      ? btoa(binary)
      : (
          globalThis as {
            Buffer?: {
              from: (
                s: string,
                enc: string,
              ) => { toString: (enc: string) => string };
            };
          }
        ).Buffer!.from(binary, 'binary').toString('base64');
  return `data:${mime};base64,${base64}`;
}
