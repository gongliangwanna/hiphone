import { describe, it, expect, beforeEach } from 'vitest';
import { useXYData } from '@/apps/XingYu/xingYuDataStore';
import { executeHeartbeatTool } from '../heartbeatTools';

const CHAR_ID = 'signature-char';

describe('heartbeat signature tools', () => {
  beforeEach(() => {
    useXYData.setState({
      ...useXYData.getState(),
      characterSignatures: {},
    });
  });

  it('view_own_signature_history defaults to the recent 5 signatures', async () => {
    useXYData.setState({
      ...useXYData.getState(),
      characterSignatures: {
        [CHAR_ID]: {
          current: '今天想晒太阳',
          history: Array.from({ length: 7 }, (_, i) => ({
            text: `旧签名-${i + 1}`,
            timestamp: 1_700_000_000_000 - i * 60_000,
          })),
        },
      },
    });

    const result = await executeHeartbeatTool('view_own_signature_history', {}, CHAR_ID);

    expect(result.done).toBe(false);
    expect(result.observation).toContain('当前签名：「今天想晒太阳」');
    expect(result.observation).toContain('最近5条历史签名（共7条');
    expect(result.observation).toContain('旧签名-1');
    expect(result.observation).toContain('旧签名-5');
    expect(result.observation).not.toContain('旧签名-6');
  });

  it('view_own_signature_history clamps n to the available history count', async () => {
    useXYData.setState({
      ...useXYData.getState(),
      characterSignatures: {
        [CHAR_ID]: {
          current: '当前签名',
          history: [
            { text: '旧签名-A', timestamp: 1_700_000_000_000 },
            { text: '旧签名-B', timestamp: 1_699_999_000_000 },
          ],
        },
      },
    });

    const result = await executeHeartbeatTool('view_own_signature_history', { n: 99 }, CHAR_ID);

    expect(result.observation).toContain('最近2条历史签名（共2条');
    expect(result.observation).toContain('旧签名-A');
    expect(result.observation).toContain('旧签名-B');
  });

  it('view_own_signature_history handles missing history', async () => {
    useXYData.setState({
      ...useXYData.getState(),
      characterSignatures: {
        [CHAR_ID]: {
          current: '还在这里',
          history: [],
        },
      },
    });

    const result = await executeHeartbeatTool('view_own_signature_history', { n: 5 }, CHAR_ID);

    expect(result.observation).toContain('当前签名：「还在这里」');
    expect(result.observation).toContain('还没有历史签名记录');
  });
});
