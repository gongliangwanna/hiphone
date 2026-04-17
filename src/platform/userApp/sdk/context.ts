/**
 * Synchronous runtime context for user app SDK calls.
 *
 * When a user app is being executed (inside `createUserAppRuntime`),
 * the runtime pushes the appId onto a stack. SDK functions like
 * `@hiphone/storage.set()` read `getCurrentAppId()` to know which
 * app they're serving.
 *
 * Sync-only by design: user app code that Sucrase emits is synchronous
 * (CommonJS require calls). Async SDK methods (await storage.get) may
 * resolve after the runtime context has exited — so SDK methods
 * capture the appId at the time of the call (which is inside the
 * runtime's synchronous execution) before awaiting anything.
 */

const stack: string[] = [];

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
  const top = stack[stack.length - 1];
  if (top === undefined) throw new NoUserAppContextError();
  return top;
}

export function withUserAppContext<T>(appId: string, fn: () => T): T {
  stack.push(appId);
  try {
    return fn();
  } finally {
    stack.pop();
  }
}

/** Test-only: inspect stack depth. */
export function _debugStackDepth(): number {
  return stack.length;
}
