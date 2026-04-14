import { useCallback } from 'react';
import { usePhoneOwnerStore } from '../stores/phoneOwnerStore';

/**
 * Perspective-aware identity hook.
 *
 * Replaces all hardcoded `senderId === 'me'` checks with a
 * phone-owner-aware alternative. When the player is on their own
 * phone, `selfSenderId` is `'me'`. When viewing character X's phone,
 * `selfSenderId` is `'char-X'`.
 */
export function usePerspective() {
  const phoneOwnerId = usePhoneOwnerStore((s) => s.phoneOwnerId);

  const selfSenderId = phoneOwnerId === null ? 'me' : `char-${phoneOwnerId}`;
  const isViewingOther = phoneOwnerId !== null;

  const isSelf = useCallback(
    (senderId: string) => senderId === selfSenderId,
    [selfSenderId],
  );

  return { phoneOwnerId, selfSenderId, isSelf, isViewingOther } as const;
}
