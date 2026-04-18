import React, { useEffect, useRef } from 'react';
import { open } from '@hiphone/nav';
import { show as toastShow } from '@hiphone/toast';
import { useOpenParams } from '@hiphone/hooks';

const ITEM = {
  name: '宝剑',
  price: 100,
};

export default function ShopApp() {
  const params = useOpenParams();
  const consumedRef = useRef<unknown>(null);

  useEffect(() => {
    if (!params) return;
    // Idempotency: only react once per distinct params object.
    if (consumedRef.current === params) return;
    consumedRef.current = params;
    if (params.result === 'success' && typeof params.amount === 'number') {
      toastShow(`支付 ${params.amount} 成功`);
    }
  }, [params]);

  const buy = () => {
    open('test-wallet', {
      action: 'pay',
      amount: ITEM.price,
      item: ITEM.name,
      callback: 'test-shop',
    });
  };

  return (
    <div data-testid="shop-root" style={{ padding: 20 }}>
      <h1 data-testid="shop-title">测试商场</h1>
      <div data-testid="shop-item" style={{ marginTop: 12 }}>
        <div>{ITEM.name}</div>
        <div data-testid="shop-price">￥ {ITEM.price}</div>
      </div>
      <button
        type="button"
        data-testid="shop-buy"
        onClick={buy}
        style={{ marginTop: 12, padding: 8 }}
      >
        立即购买
      </button>
    </div>
  );
}
