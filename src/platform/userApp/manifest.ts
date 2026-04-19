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

export type StatusBarStyle = 'light' | 'dark';

export interface UserAppManifest {
  id: string;
  name: string;
  version: string;
  entry: string;
  icon?: string;
  perspectiveAware: boolean;
  /**
   * Opt into edge-to-edge rendering. When true, the system's AppScreen
   * does NOT reserve the status-bar safe area — app content extends to
   * the very top of the screen and sits behind the status-bar text.
   * Required for fullscreen visuals (maps, camera, media players).
   */
  edgeToEdge?: boolean;
  /**
   * Override the global status-bar glyph colour while this app is in
   * the foreground. `light` renders white text (for dark-content apps);
   * `dark` (default) is the system default. Restored to `dark` on
   * unmount.
   */
  statusBarStyle?: StatusBarStyle;
  /**
   * Optional path (relative to zip root) to a services module. If set,
   * Installer compiles it into compiledMap; serviceRegistry lazy-runs
   * its top-level registerService() calls on first invoke of this app.
   */
  services?: string;
  // M3+ fields — allowed but ignored in M2
  author?: string;
  description?: string;
  /** Free-text release notes for the current version. Rendered as-is in
   *  the detail sheet; newlines are preserved. */
  changelog?: string;
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
      `manifest.id "${id}" does not match pattern /^[a-z][a-z0-9-]{2,31}$/`,
    );
  }

  const name = requireString(obj, 'name');
  const version = requireString(obj, 'version');
  const entry = requireString(obj, 'entry');

  const statusBarStyle =
    obj.statusBarStyle === 'light' || obj.statusBarStyle === 'dark'
      ? obj.statusBarStyle
      : undefined;
  if (obj.statusBarStyle !== undefined && statusBarStyle === undefined) {
    throw new ManifestError(
      `manifest.statusBarStyle must be "light" or "dark" (got ${JSON.stringify(obj.statusBarStyle)})`,
    );
  }

  let services: string | undefined;
  if (obj.services !== undefined) {
    if (typeof obj.services !== 'string' || obj.services.length === 0) {
      throw new ManifestError(
        `manifest.services must be a non-empty string when provided (got ${JSON.stringify(obj.services)})`,
      );
    }
    services = obj.services;
  }

  return {
    id,
    name,
    version,
    entry,
    icon: typeof obj.icon === 'string' ? obj.icon : undefined,
    perspectiveAware: obj.perspectiveAware === true,
    edgeToEdge: obj.edgeToEdge === true ? true : undefined,
    statusBarStyle,
    services,
    author: typeof obj.author === 'string' ? obj.author : undefined,
    description: typeof obj.description === 'string' ? obj.description : undefined,
    changelog: typeof obj.changelog === 'string' ? obj.changelog : undefined,
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
