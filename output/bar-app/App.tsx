import React, { useEffect, useMemo, useState } from 'react';
import { get, set } from '@hiphone/storage';
import { getCharacters } from '@hiphone/ai';
import { Character, normalizeCharacter } from './constants/character';
import { BuddyPicker } from './components/BuddyPicker';
import { BarRoom } from './components/BarRoom';

const LAST_CHAR_KEY = 'bar:lastCharacterId';

export default function App() {
  const characters = useMemo<Character[]>(() => {
    let raw: unknown[] = [];
    try {
      raw = (getCharacters() as unknown[]) ?? [];
    } catch {
      raw = [];
    }
    const out: Character[] = [];
    for (const item of raw) {
      const c = normalizeCharacter(item);
      if (c) out.push(c);
    }
    return out;
  }, []);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    get(LAST_CHAR_KEY).then((raw) => {
      if (!alive) return;
      if (typeof raw === 'string' && characters.some((c) => c.id === raw)) {
        setActiveId(raw);
      }
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, [characters]);

  const active = characters.find((c) => c.id === activeId) ?? null;

  const pick = (c: Character) => {
    setActiveId(c.id);
    void set(LAST_CHAR_KEY, c.id);
  };

  const back = () => {
    setActiveId(null);
    void set(LAST_CHAR_KEY, '');
  };

  return (
    <div className="h-full min-h-screen bg-[var(--color-systemBackground)] text-[var(--color-label)]">
      {!hydrated ? (
        <div className="flex min-h-screen items-center justify-center text-sm text-[var(--color-secondaryLabel)]">
          正在擦杯子…
        </div>
      ) : active ? (
        <BarRoom character={active} onBack={back} />
      ) : (
        <BuddyPicker characters={characters} onPick={pick} />
      )}
    </div>
  );
}
