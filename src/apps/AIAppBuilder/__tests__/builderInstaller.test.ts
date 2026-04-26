import { describe, it, expect, beforeEach, vi } from 'vitest';
import JSZip from 'jszip';
import { packDraftZip, installDraft } from '../builderInstaller';
import * as installerMod from '@/platform/userApp/installer';

describe('packDraftZip', () => {
  it('produces a Blob containing all draftFiles', async () => {
    const blob = await packDraftZip('ai-app-tomato-abcd', {
      'manifest.json': '{"id":"old","name":"X","version":"1.0.0","entry":"App.tsx","perspectiveAware":false}',
      'App.tsx': 'export default () => null;',
    });
    const zip = await JSZip.loadAsync(blob);
    expect(zip.file('App.tsx')).not.toBeNull();
    expect(zip.file('manifest.json')).not.toBeNull();
  });

  it('forces manifest.id to the locked draftId', async () => {
    const blob = await packDraftZip('ai-app-tomato-abcd', {
      'manifest.json': '{"id":"some-other-id","name":"X","version":"1.0.0","entry":"App.tsx","perspectiveAware":false}',
      'App.tsx': 'export default () => null;',
    });
    const zip = await JSZip.loadAsync(blob);
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifest.id).toBe('ai-app-tomato-abcd');
  });

  it('throws when draftFiles has no manifest.json', async () => {
    await expect(
      packDraftZip('ai-app-tomato-abcd', { 'App.tsx': 'x' }),
    ).rejects.toThrow(/manifest.json/);
  });

  it('throws when manifest.json is invalid JSON', async () => {
    await expect(
      packDraftZip('ai-app-tomato-abcd', {
        'manifest.json': 'not json',
        'App.tsx': 'x',
      }),
    ).rejects.toThrow();
  });
});

describe('installDraft', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('packs and pipes through installer.install', async () => {
    const installSpy = vi.spyOn(installerMod, 'install').mockResolvedValue({
      id: 'ai-app-tomato-abcd',
      installedAt: 0,
      isUpgrade: false,
    });
    await installDraft('ai-app-tomato-abcd', {
      'manifest.json': '{"id":"x","name":"X","version":"1.0.0","entry":"App.tsx","perspectiveAware":false}',
      'App.tsx': 'export default () => null;',
    });
    expect(installSpy).toHaveBeenCalled();
    const arg = installSpy.mock.calls[0]![0];
    // Blob arrives at installer.install
    expect(arg).toBeInstanceOf(Blob);
  });
});
