import React, { useEffect, useRef } from 'react';
import { open } from '@hiphone/nav';
import { show as toastShow } from '@hiphone/toast';
import { useOpenParams } from '@hiphone/hooks';

interface Item {
  id: string;
  name: string;
  emoji: string;
  price: number;
  description: string;
}

// Primary item (ITEMS[0]) is assumed by E2E tests: name=宝剑, price=100.
const ITEMS: Item[] = [
  { id: 'sword', name: '宝剑', emoji: '⚔️', price: 100, description: '传说中的利刃' },
  { id: 'shield', name: '盾牌', emoji: '🛡️', price: 80, description: '不破之盾' },
  { id: 'potion', name: '药水', emoji: '🧪', price: 30, description: '恢复满血' },
  { id: 'gem', name: '宝石', emoji: '💎', price: 200, description: '闪闪发光' },
];

export default function ShopApp() {
  const params = useOpenParams();
  const consumedRef = useRef<unknown>(null);

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
        <div className="grid grid-cols-2 gap-3">
          {ITEMS.map((item, i) => {
            const isPrimary = i === 0;
            return (
              <div
                key={item.id}
                data-testid={isPrimary ? 'shop-item' : undefined}
                className="bg-white rounded-2xl p-4 flex flex-col items-center shadow-sm border border-gray-100"
              >
                <div className="text-5xl mb-3">{item.emoji}</div>
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
                  className="mt-3 w-full bg-blue-500 text-white rounded-lg py-2 text-sm font-medium active:bg-blue-600 hover:bg-blue-600 transition-colors"
                >
                  立即购买
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
