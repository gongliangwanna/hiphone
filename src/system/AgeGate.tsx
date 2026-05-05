import { useState, type ReactNode } from 'react';

export const AGE_CONFIRMATION_STORAGE_KEY = 'hiphone-age-confirmation';

export type AgeConfirmation = 'adult' | 'minor';

export function readAgeConfirmation(): AgeConfirmation | null {
  if (typeof window === 'undefined') return null;

  try {
    const value = window.localStorage.getItem(AGE_CONFIRMATION_STORAGE_KEY);
    return value === 'adult' || value === 'minor' ? value : null;
  } catch {
    return null;
  }
}

export function writeAgeConfirmation(value: AgeConfirmation): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(AGE_CONFIRMATION_STORAGE_KEY, value);
  } catch {
    // If storage is unavailable, keep the in-memory decision for this render.
  }
}

function BlockedScreen() {
  return (
    <div
      className="fixed inset-0 z-[9999] bg-black"
      data-testid="age-gate-blocked"
      aria-hidden="true"
    />
  );
}

export function AgeGate({ children }: { children: ReactNode }) {
  const [confirmation, setConfirmation] = useState<AgeConfirmation | null>(() => readAgeConfirmation());

  const confirm = (value: AgeConfirmation) => {
    writeAgeConfirmation(value);
    setConfirmation(value);
  };

  if (confirmation === 'adult') return <>{children}</>;
  if (confirmation === 'minor') return <BlockedScreen />;

  return (
    <main
      className="fixed inset-0 z-[9999] flex min-h-[100dvh] items-center justify-center bg-black px-6 text-white"
      data-testid="age-gate"
    >
      <section className="w-full max-w-[340px] rounded-[28px] border border-white/15 bg-white/10 p-5 text-center shadow-2xl shadow-black/40 backdrop-blur-2xl">
        <p className="text-[13px] font-medium text-white/55">hiPhone</p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-normal text-white">年龄确认</h1>
        <p className="mt-3 text-[15px] leading-6 text-white/72">
          请确认你是否已满 18 岁。未满 18 岁将无法继续使用。
        </p>
        <div className="mt-6 grid gap-3">
          <button
            type="button"
            className="h-12 rounded-full bg-white text-[16px] font-semibold text-black transition active:scale-[0.98]"
            onClick={() => confirm('adult')}
          >
            已满 18 岁
          </button>
          <button
            type="button"
            className="h-12 rounded-full bg-white/10 text-[16px] font-semibold text-white ring-1 ring-white/15 transition active:scale-[0.98]"
            onClick={() => confirm('minor')}
          >
            未满 18 岁
          </button>
        </div>
      </section>
    </main>
  );
}
