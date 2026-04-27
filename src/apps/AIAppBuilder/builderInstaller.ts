/**
 * Pack the current draft into a JSZip Blob and pipe through the
 * standard user-app `installer.install`. Forces manifest.id to the
 * locked draftId so the LLM cannot accidentally rename the app
 * mid-session.
 *
 * See docs/superpowers/specs/2026-04-27-ai-app-builder-v1-design.md
 */

import JSZip from 'jszip';
import { install, type InstallResult } from '@/platform/userApp/installer';

export async function packDraftZip(
  draftId: string,
  files: Record<string, string>,
): Promise<Blob> {
  const manifestSrc = files['manifest.json'];
  if (!manifestSrc) {
    throw new Error('packDraftZip: draftFiles missing manifest.json');
  }

  // Force manifest.id; rewrite manifest with the locked draftId.
  const manifest = JSON.parse(manifestSrc);
  manifest.id = draftId;
  const lockedManifest = JSON.stringify(manifest, null, 2);

  const zip = new JSZip();
  zip.file('manifest.json', lockedManifest);
  for (const [path, content] of Object.entries(files)) {
    if (path === 'manifest.json') continue;
    zip.file(path, content);
  }
  return zip.generateAsync({ type: 'blob' });
}

export async function installDraft(
  draftId: string,
  files: Record<string, string>,
): Promise<InstallResult> {
  const blob = await packDraftZip(draftId, files);
  return install(blob);
}

/**
 * Pack the draft and trigger a browser download of `<draftId>.zip` via
 * a transient anchor element. Used by the drafts sheet's "导出" action.
 */
export async function triggerDraftZipDownload(
  draftId: string,
  files: Record<string, string>,
): Promise<void> {
  const blob = await packDraftZip(draftId, files);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${draftId}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}
