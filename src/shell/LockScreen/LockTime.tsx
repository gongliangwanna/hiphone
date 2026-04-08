import { useClock } from '../StatusBar/useClock';

/** Lock screen large time — iOS style: thin weight, no leading zero */
export function LockTime() {
  const time = useClock();

  const [h, m] = time.split(':');
  const hour = h!.startsWith('0') ? h!.slice(1) : h;

  return (
    <div
      className="text-center text-white"
      style={{
        fontSize: 86,
        lineHeight: 1.05,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        fontFeatureSettings: '"tnum"',
      }}
      data-testid="lock-time"
    >
      {hour}:{m}
    </div>
  );
}
