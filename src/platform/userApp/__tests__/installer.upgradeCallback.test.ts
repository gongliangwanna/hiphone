import { describe, it, expect } from 'vitest';
import type { InstallOptions, InstallErrorKind } from '../installer';
import { InstallError } from '../installer';

describe('installer types (P1 surface)', () => {
  it('InstallOptions has onUpgradeDetected callback shape', () => {
    const options: InstallOptions = {
      onUpgradeDetected: async ({ existing, incoming }) => {
        expect(typeof existing.id).toBe('string');
        expect(typeof existing.name).toBe('string');
        expect(typeof existing.version).toBe('string');
        expect(typeof incoming.id).toBe('string');
        expect(typeof incoming.name).toBe('string');
        expect(typeof incoming.version).toBe('string');
        return true;
      },
    };
    expect(options.onUpgradeDetected).toBeTypeOf('function');
  });

  it('user-cancelled is a valid InstallErrorKind', () => {
    const kind: InstallErrorKind = 'user-cancelled';
    const err = new InstallError(kind, 'user cancelled upgrade');
    expect(err.kind).toBe('user-cancelled');
    expect(err).toBeInstanceOf(InstallError);
  });
});
