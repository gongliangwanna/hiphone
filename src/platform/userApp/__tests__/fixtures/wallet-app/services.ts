import { registerService } from '@hiphone/services';
import { get } from '@hiphone/storage';

const DEFAULT_BALANCE = 1000;

registerService({
  name: 'balance',
  description: '当前钱包余额 (CNY)',
  execute: async () => {
    const b = await get('balance');
    return typeof b === 'number' ? b : DEFAULT_BALANCE;
  },
});
