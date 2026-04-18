import React, { useState, type ComponentType, type ReactNode } from 'react';
import { MessageSquare, FileText, Zap, Bell, Layers } from 'lucide-react';
import { show as toastShow } from '@hiphone/toast';
import { show as bannerShow } from '@hiphone/banner';

interface Action {
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  tint: string;
  onClick: () => void;
}

export default function NotifierApp() {
  const [lastAction, setLastAction] = useState<string>('点击任意按钮查看反馈');

  const track = (desc: string) => setLastAction(desc);

  const toastActions: Action[] = [
    {
      label: '简短提示',
      icon: MessageSquare,
      tint: '#34C759',
      onClick: () => {
        toastShow('已保存');
        track('toast.show("已保存")');
      },
    },
    {
      label: '长消息',
      icon: FileText,
      tint: '#007AFF',
      onClick: () => {
        toastShow('这是一条较长的消息内容,用来检查换行与位置');
        track('toast.show(长消息)');
      },
    },
    {
      label: '连发 3 条',
      icon: Zap,
      tint: '#AF52DE',
      onClick: () => {
        toastShow('第一条');
        setTimeout(() => toastShow('第二条'), 700);
        setTimeout(() => toastShow('第三条'), 1400);
        track('连发 3 条 toast(后者替换前者)');
      },
    },
  ];

  const bannerActions: Action[] = [
    {
      label: '简单 banner',
      icon: Bell,
      tint: '#FF9500',
      onClick: () => {
        bannerShow({ title: '你有一条新通知' });
        track('banner.show · 点通知会回到本 App');
      },
    },
    {
      label: '连排队 3 条',
      icon: Layers,
      tint: '#5856D6',
      onClick: () => {
        bannerShow({ title: '第一条 · 排队中' });
        bannerShow({ title: '第二条 · 依次显示' });
        bannerShow({ title: '第三条 · 队列末尾' });
        track('连排队 3 条 banner');
      },
    },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="bg-white px-5 pt-5 pb-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          通知测试台
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Toast vs Banner · iOS 通知组件对比
        </p>
      </header>

      <div className="flex-1 overflow-auto p-4 space-y-5">
        <Section label="Toast  ·  轻量胶囊(2s)">
          <Grid actions={toastActions} />
        </Section>

        <Section label="Banner ·  系统通知(4s)">
          <Grid actions={bannerActions} />
        </Section>

        <div
          className="rounded-xl p-3 text-xs"
          style={{
            backgroundColor: '#fff',
            border: '1px solid rgba(0,0,0,0.06)',
            color: 'var(--color-secondaryLabel)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          <div className="font-semibold mb-1" style={{ color: 'var(--color-label)' }}>
            最近一次操作
          </div>
          <div>{lastAction}</div>
        </div>

        <div className="text-center text-[11px] text-gray-400 pb-2">
          点 banner 返回 App · 向上滑可提前关闭
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div
        className="text-[11px] font-semibold uppercase tracking-wider px-1 mb-2"
        style={{ color: 'var(--color-secondaryLabel)' }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Grid({ actions }: { actions: Action[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.label}
            type="button"
            onClick={a.onClick}
            className="bg-white rounded-xl px-3 py-3 flex items-center gap-3 active:scale-[0.98] transition-transform"
            style={{
              border: '1px solid rgba(0,0,0,0.06)',
              textAlign: 'left',
            }}
          >
            <div
              className="flex items-center justify-center rounded-lg flex-shrink-0"
              style={{
                width: 36,
                height: 36,
                backgroundColor: a.tint + '18',
              }}
            >
              <Icon size={20} strokeWidth={1.8} color={a.tint} />
            </div>
            <span
              className="text-sm font-medium truncate"
              style={{ color: 'var(--color-label)' }}
            >
              {a.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
