import { useEffect, useRef, useState } from 'react';
import { resolveViewportProfile, type ViewportEnvironment, type ViewportProfile } from './viewportProfile';

const COARSE_POINTER_QUERY = '(hover: none) and (pointer: coarse)';

/**
 * On touch devices (real phones), the keyboard shrinks `visualViewport.height`
 * while `window.innerHeight` stays the same. We track a "stable height" that
 * ignores keyboard-induced shrinks so the device shell doesn't resize.
 *
 * Rules:
 *  - Width changes → orientation change → update stable height
 *  - Height increases → keyboard dismissed → update stable height
 *  - Height decreases, width unchanged → keyboard appeared → keep stable height
 */
let stableWidth = 0;
let stableHeight = 0;

function getViewportEnvironment(): ViewportEnvironment {
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const coarsePointer = window.matchMedia?.(COARSE_POINTER_QUERY).matches ?? false;

  return {
    viewportWidth,
    viewportHeight,
    coarsePointer,
  };
}

function getStableViewportEnvironment(): ViewportEnvironment {
  const env = getViewportEnvironment();

  if (!env.coarsePointer) {
    return env;
  }

  const widthChanged = env.viewportWidth !== stableWidth;
  const heightIncreased = env.viewportHeight > stableHeight;

  if (stableWidth === 0 || widthChanged || heightIncreased) {
    stableWidth = env.viewportWidth;
    stableHeight = env.viewportHeight;
  }

  return {
    viewportWidth: stableWidth,
    viewportHeight: stableHeight,
    coarsePointer: env.coarsePointer,
  };
}

export function readViewportProfile(): ViewportProfile {
  return resolveViewportProfile(getStableViewportEnvironment());
}

export function useViewportProfile(): ViewportProfile {
  const [profile, setProfile] = useState<ViewportProfile>(() => readViewportProfile());
  const prevProfileRef = useRef(profile);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.(COARSE_POINTER_QUERY);
    const updateProfile = () => {
      const next = readViewportProfile();
      const prev = prevProfileRef.current;
      if (
        next.width !== prev.width ||
        next.height !== prev.height ||
        next.shellMode !== prev.shellMode ||
        next.sizeTier !== prev.sizeTier ||
        next.isPortrait !== prev.isPortrait
      ) {
        prevProfileRef.current = next;
        setProfile(next);
      }
    };

    updateProfile();
    window.addEventListener('resize', updateProfile);
    window.visualViewport?.addEventListener('resize', updateProfile);
    mediaQuery?.addEventListener?.('change', updateProfile);

    return () => {
      window.removeEventListener('resize', updateProfile);
      window.visualViewport?.removeEventListener('resize', updateProfile);
      mediaQuery?.removeEventListener?.('change', updateProfile);
    };
  }, []);

  return profile;
}
