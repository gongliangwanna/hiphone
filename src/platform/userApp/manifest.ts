/**
 * User app manifest schema — M2 subset.
 *
 * The M2 installer only consumes fields listed in `UserAppManifest`.
 * Fields the parent app-store spec defines for M3+ (author, description,
 * permissions, aiTools) pass through validation unchanged so they can be
 * present in manifests aimed at forward compatibility.
 */

const ID_PATTERN = /^[a-z][a-z0-9-]{2,31}$/;
const RESERVED_ID_PREFIX = '__';

export class ManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManifestError';
  }
}

export interface UserAppManifest {
  id: string;
  name: string;
  version: string;
  entry: string;
  icon?: string;
  perspectiveAware: boolean;
  // M3+ fields — allowed but ignored in M2
  author?: string;
  description?: string;
  permissions?: string[];
  aiTools?: string;
}

export function validateManifest(raw: unknown): UserAppManifest {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ManifestError('manifest must be a JSON object');
  }
  const obj = raw as Record<string, unknown>;

  const id = requireString(obj, 'id');
  if (id.startsWith(RESERVED_ID_PREFIX)) {
    throw new ManifestError(`manifest.id "${id}" uses reserved "__" prefix`);
  }
  if (id.length < 3 || id.length > 32) {
    throw new ManifestError(`manifest.id must be 3-32 chars (got length ${id.length})`);
  }
  if (!ID_PATTERN.test(id)) {
    throw new ManifestError(
      `manifest.id "${id}" does not match pattern /^[a-z0-9][a-z0-9-]+$/`,
    );
  }

  const name = requireString(obj, 'name');
  const version = requireString(obj, 'version');
  const entry = requireString(obj, 'entry');

  return {
    id,
    name,
    version,
    entry,
    icon: typeof obj.icon === 'string' ? obj.icon : undefined,
    perspectiveAware: obj.perspectiveAware === true,
    author: typeof obj.author === 'string' ? obj.author : undefined,
    description: typeof obj.description === 'string' ? obj.description : undefined,
    permissions: Array.isArray(obj.permissions)
      ? obj.permissions.filter((p): p is string => typeof p === 'string')
      : undefined,
    aiTools: typeof obj.aiTools === 'string' ? obj.aiTools : undefined,
  };
}

function requireString(obj: Record<string, unknown>, field: string): string {
  const val = obj[field];
  if (typeof val !== 'string' || val.length === 0) {
    throw new ManifestError(`manifest.${field} is required and must be a non-empty string`);
  }
  return val;
}
