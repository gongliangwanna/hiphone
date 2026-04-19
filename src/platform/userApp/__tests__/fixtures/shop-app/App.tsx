import React, { useEffect, useRef, useState, type ComponentType } from 'react';
import { Sword, Shield, Beaker, Gem } from 'lucide-react';
import { open } from '@hiphone/nav';
import { show as toastShow } from '@hiphone/toast';
import { useOpenParams } from '@hiphone/hooks';
import { invoke } from '@hiphone/services';

interface Item {
  id: string;
  name: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  tint: string;
  price: number;
  description: string;
}

// Primary item (ITEMS[0]) is assumed by E2E tests: name=宝剑, price=100.
const ITEMS: Item[] = [
  { id: 'sword', name: '宝剑', icon: Sword, tint: '#007AFF', price: 100, description: '传说中的利刃' },
  { id: 'shield', name: '盾牌', icon: Shield, tint: '#5856D6', price: 80, description: '不破之盾' },
  { id: 'potion', name: '药水', icon: Beaker, tint: '#34C759', price: 30, description: '恢复满血' },
  { id: 'gem', name: '宝石', icon: Gem, tint: '#FF2D55', price: 200, description: '闪闪发光' },
];

export default function ShopApp() {
  const params = useOpenParams();
  const consumedRef = useRef<unknown>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    invoke('test-wallet', 'balance')
      .then((b) => {
        if (typeof b === 'number') setBalance(b);
      })
      .catch(() => {
        // test-wallet not installed — leave balance null (UI shows "未连接钱包")
        setBalance(null);
      });
  }, [params]); // refetch when we return from wallet with a payment result

  useEffect(() => {
    if (!params || consumedRef.current === params) return;
    consumedRef.current = params;
    if (params.result === 'success' && typeof params.amount === 'number') {
      toastShow(`支付 ${params.amount} 成功`);
    } else if (params.result === 'cancelled') {
      toastShow('已取消支付');
    }
  }, [params]);

  const buy = (item: Item) => {
    open('test-wallet', {
      action: 'pay',
      amount: item.price,
      item: item.name,
      callback: 'test-shop',
    });
  };

  return (
    <div data-testid="shop-root" className="flex flex-col h-full bg-gray-50">
      <header className="bg-white px-5 pt-5 pb-4 border-b border-gray-200">
        <h1
          data-testid="shop-title"
          className="text-2xl font-bold text-gray-900 tracking-tight"
        >
          测试商场
        </h1>
        <p className="text-sm text-gray-500 mt-1">装备一触即达</p>
      </header>

      <div className="flex-1 overflow-auto p-4">
        <div
          className="mb-3 flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs"
          style={{ border: '1px solid rgba(0,0,0,0.06)' }}
        >
          <span style={{ color: 'var(--color-secondaryLabel)' }}>钱包余额</span>
          <span
            data-testid="shop-balance"
            style={{ color: 'var(--color-label)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
          >
            {balance === null ? '— 未连接' : `￥ ${balance}`}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {ITEMS.map((item, i) => {
            const isPrimary = i === 0;
            const Icon = item.icon;
            const insufficient = balance !== null && balance < item.price;
            return (
              <div
                key={item.id}
                data-testid={isPrimary ? 'shop-item' : undefined}
                className="bg-white rounded-2xl p-4 flex flex-col items-center shadow-sm border border-gray-100"
              >
                <div
                  className="flex items-center justify-center rounded-2xl mb-3"
                  style={{
                    width: 56,
                    height: 56,
                    backgroundColor: item.tint + '18', // ~10% alpha tint background
                  }}
                >
                  <Icon size={32} strokeWidth={1.8} color={item.tint} />
                </div>
                <div className="font-semibold text-gray-900 text-base">
                  {item.name}
                </div>
                <div className="text-xs text-gray-500 mt-1 text-center">
                  {item.description}
                </div>
                <div
                  data-testid={isPrimary ? 'shop-price' : undefined}
                  className="mt-3 text-xl font-bold text-blue-600"
                >
                  ￥{item.price}
                </div>
                <button
                  type="button"
                  data-testid={isPrimary ? 'shop-buy' : undefined}
                  onClick={() => buy(item)}
                  disabled={insufficient}
                  className={
                    insufficient
                      ? 'mt-3 w-full bg-gray-200 text-gray-400 rounded-lg py-2 text-sm font-medium cursor-not-allowed'
                      : 'mt-3 w-full bg-blue-500 text-white rounded-lg py-2 text-sm font-medium active:bg-blue-600 hover:bg-blue-600 transition-colors'
                  }
                >
                  {insufficient ? '余额不足' : '立即购买'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-5 text-center text-xs text-gray-400">
          支付将跳转到钱包 · Deep Link 演示
        </div>
      </div>
    </div>
  );
}
