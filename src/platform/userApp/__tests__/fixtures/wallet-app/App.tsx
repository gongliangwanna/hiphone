import React from 'react';
import { open } from '@hiphone/nav';
import { useOpenParams } from '@hiphone/hooks';

interface PayParams {
  action: 'pay';
  amount: number;
  item: string;
  callback: string;
}

function isPayParams(value: unknown): value is PayParams {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.action === 'pay' &&
    typeof v.amount === 'number' &&
    typeof v.item === 'string' &&
    typeof v.callback === 'string'
  );
}

export default function WalletApp() {
  const params = useOpenParams();

  if (!isPayParams(params)) {
    return (
      <div data-testid="wallet-idle" style={{ padding: 20 }}>
        <h1 data-testid="wallet-title">测试钱包</h1>
        <div data-testid="wallet-empty">余额：未设置</div>
      </div>
    );
  }

  const confirm = () => {
    open(params.callback, { result: 'success', amount: params.amount });
  };

  return (
    <div data-testid="wallet-pay" style={{ padding: 20 }}>
      <h1 data-testid="wallet-title">支付确认</h1>
      <div data-testid="wallet-item">{params.item}</div>
      <div data-testid="wallet-amount">￥ {params.amount}</div>
      <button
        type="button"
        data-testid="wallet-confirm"
        onClick={confirm}
        style={{ marginTop: 12, padding: 8 }}
      >
        确认支付
      </button>
    </div>
  );
}
