import { motion, AnimatePresence } from 'motion/react';
import { usePhoneOwnerStore } from '@/platform/stores/phoneOwnerStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';

const CHAR_FALLBACK_AVATAR = '/resource/avatars/preset-01.jpg';

/**
 * Persistent indicator shown when viewing another entity's phone.
 * Rendered as a Dynamic Island pill at the top-center of the screen,
 * replacing the static notch area. Tap to return to your own phone.
 */
export function PhoneOwnerBanner() {
  const phoneOwnerId = usePhoneOwnerStore((s) => s.phoneOwnerId);
  const returnToMyPhone = usePhoneOwnerStore((s) => s.returnToMyPhone);
  const characters = useCharacterStore((s) => s.characters);
  const goHome = useAppRuntimeStore((s) => s.goHome);

  const character = phoneOwnerId
    ? characters.find((c) => c.id === phoneOwnerId)
    : null;

  const handleReturn = () => {
    returnToMyPhone();
    goHome();
  };

  return (
    <AnimatePresence>
      {phoneOwnerId && character && (
        /* Centering wrapper — pointer-events-none so it doesn't block status bar taps */
        <div
          key="phone-owner-island-wrapper"
          className="pointer-events-none absolute inset-x-0 z-[56] flex justify-center"
          style={{ top: 'calc(var(--status-top-padding) - 2px)' }}
        >
          <motion.button
            onClick={handleReturn}
            initial={{ width: 37, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 37, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            className="pointer-events-auto flex items-center gap-1.5 overflow-hidden"
            style={{
              height: 37,
              paddingLeft: 6,
              paddingRight: 10,
              borderRadius: 20,
              backgroundColor: '#000',
              cursor: 'pointer',
            }}
          >
            {/* Character avatar */}
            <div
              className="flex-shrink-0 overflow-hidden rounded-full"
              style={{ width: 26, height: 26 }}
            >
              <img
                src={character.avatar?.trim() || CHAR_FALLBACK_AVATAR}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>

            {/* Compact label */}
            <span
              className="flex-shrink-0 whitespace-nowrap"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#fff',
              }}
            >
              {character.name}
            </span>

            {/* Separator dot */}
            <div
              style={{
                width: 3,
                height: 3,
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.35)',
                flexShrink: 0,
              }}
            />

            {/* Exit hint */}
            <span
              className="flex-shrink-0 whitespace-nowrap"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'rgb(255, 149, 0)',
              }}
            >
              退出
            </span>
          </motion.button>
        </div>
      )}
    </AnimatePresence>
  );
}
