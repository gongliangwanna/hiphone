import { useEffect, useState } from 'react';
import { resolveViewportProfile, type ViewportEnvironment, type ViewportProfile } from './viewportProfile';

const COARSE_POINTER_QUERY = '(hover: none) and (pointer: coarse)';

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

export function readViewportProfile(): ViewportProfile {
  return resolveViewportProfile(getViewportEnvironment());
}

export function useViewportProfile(): ViewportProfile {
  const [profile, setProfile] = useState<ViewportProfile>(() => readViewportProfile());

  useEffect(() => {
    const mediaQuery = window.matchMedia?.(COARSE_POINTER_QUERY);
    const updateProfile = () => {
      setProfile(readViewportProfile());
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
