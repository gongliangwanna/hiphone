import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface State {
  error: Error | null;
}

interface Props {
  children: ReactNode;
}

/**
 * Catches render-time errors inside user app components. Without this,
 * a user-code exception would bubble to the hiPhone root and white-screen
 * the entire device.
 *
 * Error Boundaries must be class components (no hook alternative in React 19).
 * Scope: render errors only — does NOT catch async errors, event handlers,
 * or setState errors (those bubble as promise rejections / onError).
 */
export class UserAppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Log to console so devtools picks it up (source map will map back to TSX).
    console.error('[UserApp] render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <UserAppErrorScreen error={this.state.error} />;
    }
    return this.props.children;
  }
}

function UserAppErrorScreen({ error }: { error: Error }) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-4 px-8"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
    >
      <div
        className="flex items-center justify-center rounded-2xl"
        style={{
          width: 64,
          height: 64,
          backgroundColor: 'rgba(255, 59, 48, 0.1)',
        }}
      >
        <AlertTriangle size={32} strokeWidth={1.5} color="rgb(255, 59, 48)" />
      </div>
      <div className="text-center">
        <div
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--color-label)',
            marginBottom: 6,
          }}
        >
          App crashed
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--color-secondaryLabel)',
            lineHeight: 1.5,
            fontFamily: 'var(--font-mono, monospace)',
            wordBreak: 'break-word',
          }}
        >
          {error.message}
        </div>
      </div>
    </div>
  );
}
