import { useMemo } from 'react';
import { usePhoneOwnerStore } from '@/platform/stores/phoneOwnerStore';

export interface CurrentOwner {
  /** 'me' when player; 'char-{bareId}' when viewing another's phone. */
  ownerId: string;
  /** Human-readable label for UI (matches ownerId when no nicer name available). */
  ownerName: string;
  isViewingOther: boolean;
}

function snapshotFor(phoneOwnerId: string | null): CurrentOwner {
  if (phoneOwnerId === null) {
    return { ownerId: 'me', ownerName: '我', isViewingOther: false };
  }
  const prefixed = `char-${phoneOwnerId}`;
  return { ownerId: prefixed, ownerName: prefixed, isViewingOther: true };
}

/**
 * React hook — reactive version that re-renders when perspective changes.
 * Safe to call inside user app components.
 *
 * phoneOwnerId stores bare character IDs (e.g. '001', 'xingchen').
 * This hook prefixes them with 'char-' to produce ownerId.
 */
export function useCurrentOwner(): CurrentOwner {
  const phoneOwnerId = usePhoneOwnerStore((s) => s.phoneOwnerId);
  return useMemo(() => snapshotFor(phoneOwnerId), [phoneOwnerId]);
}

/**
 * One-shot non-reactive snapshot. Useful in event handlers, async
 * callbacks, or non-React contexts.
 */
export function getCurrentOwner(): CurrentOwner {
  return snapshotFor(usePhoneOwnerStore.getState().phoneOwnerId);
}
