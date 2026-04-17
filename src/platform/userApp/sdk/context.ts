/**
 * Synchronous runtime context for user app SDK calls.
 *
 * When a user app is being executed (inside `createUserAppRuntime`),
 * the runtime pushes the appId onto a stack. SDK functions like
 * `@hiphone/storage.set()` read `getCurrentAppId()` to know which
 * app they're serving.
 *
 * Two-level context system:
 *   1. `stack` — synchronous call-stack context pushed during render/init.
 *   2. `mountedApps` — mounted app registry: an app registers itself when
 *      its UserAppRoot mounts and unregisters on unmount. When the call
 *      stack is empty (e.g. inside useEffect / event handlers), and exactly
 *      one app is mounted, that app's id is used as fallback.
 *
 * Sync-only by design: user app code that Sucrase emits is synchronous
 * (CommonJS require calls). Async SDK methods (await storage.get) may
 * resolve after the runtime context has exited — so SDK methods
 * capture the appId at the time of the call (which is inside the
 * runtime's synchronous execution) before awaiting anything.
 */

const stack: string[] = [];

/**
 * Ref-count of currently mounted user app instances per appId.
 * Multiple instances of the same app increment the count.
 */
const mountedApps = new Map<string, number>();

export class NoUserAppContextError extends Error {
  constructor() {
    super(
      'No user app runtime context active. SDK calls like @hiphone/storage ' +
        'must be invoked from within a user app render/lifecycle path.',
    );
    this.name = 'NoUserAppContextError';
  }
}

export function getCurrentAppId(): string {
  // Primary: synchronous call-stack context (render / module init)
  const top = stack[stack.length - 1];
  if (top !== undefined) return top;

  // Fallback: if exactly one app is currently mounted (event handlers,
  // useEffect callbacks, async continuations), use that app's id.
  if (mountedApps.size === 1) {
    return mountedApps.keys().next().value as string;
  }

  throw new NoUserAppContextError();
}

export function withUserAppContext<T>(appId: string, fn: () => T): T {
  stack.push(appId);
  try {
    return fn();
  } finally {
    stack.pop();
  }
}

/**
 * Register an app instance as mounted. Called from UserAppRoot mount
 * effect. Returns an unregister function for use in cleanup.
 */
export function registerMountedApp(appId: string): () => void {
  const prev = mountedApps.get(appId) ?? 0;
  mountedApps.set(appId, prev + 1);
  return () => {
    const count = mountedApps.get(appId) ?? 0;
    if (count <= 1) {
      mountedApps.delete(appId);
    } else {
      mountedApps.set(appId, count - 1);
    }
  };
}

/** Test-only: inspect stack depth. */
export function _debugStackDepth(): number {
  return stack.length;
}

/** Test-only: inspect mounted app count. */
export function _debugMountedAppsSize(): number {
  return mountedApps.size;
}
