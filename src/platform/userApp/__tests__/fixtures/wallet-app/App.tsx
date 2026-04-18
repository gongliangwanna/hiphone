import React, { useEffect, useState } from 'react';
import { open } from '@hiphone/nav';
import { useOpenParams } from '@hiphone/hooks';
import { get, set } from '@hiphone/storage';

interface Transaction {
  id: number;
  item: string;
  amount: number;
  timestamp: number;
}

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

const DEFAULT_BALANCE = 1000;

export default function WalletApp() {
  const params = useOpenParams();
  const [balance, setBalance] = useState(DEFAULT_BALANCE);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    (async () => {
      const b = await get('balance');
      const t = await get('transactions');
      if (typeof b === 'number') setBalance(b);
      if (Array.isArray(t)) setTransactions(t as Transaction[]);
    })();
  }, []);

  if (isPayParams(params)) {
    const insufficient = params.amount > balance;

    const confirm = () => {
      if (insufficient) return;
      const next = balance - params.amount;
      const tx: Transaction = {
        id: Date.now(),
        item: params.item,
        amount: params.amount,
        timestamp: Date.now(),
      };
      const nextTxs = [tx, ...transactions];
      setBalance(next);
      setTransactions(nextTxs);
      void set('balance', next);
      void set('transactions', nextTxs);
      open(params.callback, { result: 'success', amount: params.amount });
    };

    const cancel = () => {
      open(params.callback, { result: 'cancelled' });
    };

    return (
      <div data-testid="wallet-pay" className="flex flex-col h-full bg-gray-50">
        <header className="bg-white px-5 pt-5 pb-4 border-b border-gray-200">
          <h1
            data-testid="wallet-title"
            className="text-2xl font-bold text-gray-900 tracking-tight"
          >
            支付确认
          </h1>
        </header>

        <div className="flex-1 flex flex-col justify-center p-5">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">
              购买商品
            </div>
            <div
              data-testid="wallet-item"
              className="text-lg font-semibold text-gray-900 mb-6"
            >
              {params.item}
            </div>

            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">
              应付金额
            </div>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-2xl font-semibold text-gray-700">￥</span>
              <span
                data-testid="wallet-amount"
                className="text-5xl font-bold text-gray-900 tabular-nums"
              >
                {params.amount}
              </span>
            </div>

            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">当前余额</span>
                <span
                  className={
                    'font-medium tabular-nums ' +
                    (insufficient ? 'text-red-600' : 'text-gray-900')
                  }
                >
                  ￥{balance}
                </span>
              </div>
              {insufficient && (
                <div className="text-xs text-red-600 mt-1.5">
                  余额不足,无法完成支付
                </div>
              )}
            </div>

            <button
              type="button"
              data-testid="wallet-confirm"
              onClick={confirm}
              disabled={insufficient}
              className={
                'w-full rounded-xl py-3 text-base font-semibold transition-colors ' +
                (insufficient
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 text-white active:bg-blue-600 hover:bg-blue-600')
              }
            >
              确认支付
            </button>
            <button
              type="button"
              onClick={cancel}
              className="w-full mt-2 py-3 text-base text-gray-600 hover:text-gray-900"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="wallet-idle" className="flex flex-col h-full bg-gray-50">
      <header className="bg-white px-5 pt-5 pb-4 border-b border-gray-200">
        <h1
          data-testid="wallet-title"
          className="text-2xl font-bold text-gray-900 tracking-tight"
        >
          测试钱包
        </h1>
      </header>

      <div className="p-4">
        <div className="rounded-2xl p-6 text-white shadow-lg bg-gradient-to-br from-blue-500 to-blue-700">
          <div className="text-sm opacity-80 mb-1">当前余额</div>
          <div className="text-4xl font-bold tabular-nums">￥{balance}</div>
          <div className="mt-6 flex justify-between items-center text-xs opacity-90">
            <span>交易 {transactions.length} 笔</span>
            <span className="font-mono">test-wallet</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
          最近交易
        </div>
        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-sm border border-gray-100">
            暂无交易记录
            <div className="text-xs mt-1 text-gray-300">去商场买点东西吧</div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
            {transactions.map((tx, i) => (
              <div
                key={tx.id}
                className={
                  'px-4 py-3 flex justify-between items-center ' +
                  (i < transactions.length - 1 ? 'border-b border-gray-100' : '')
                }
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {tx.item}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 tabular-nums">
                    {new Date(tx.timestamp).toLocaleString('zh-CN', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <div className="text-red-600 font-medium tabular-nums">
                  -￥{tx.amount}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
