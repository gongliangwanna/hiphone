import { Sparkles, Bot, PenLine, HardDrive, ShieldCheck, Scale, ShieldAlert, Ban } from 'lucide-react';

/* ── Single disclaimer item card ── */

function DisclaimerItem({
  icon,
  iconColor,
  title,
  body,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  body: string;
}) {
  return (
    <div
      className="mx-4 mb-3 flex items-start gap-3 px-4 py-3"
      style={{
        backgroundColor: 'var(--color-tertiarySystemBackground)',
        borderRadius: 'var(--radius-group)',
      }}
    >
      <div
        className="flex flex-shrink-0 items-center justify-center rounded-lg"
        style={{
          width: 32,
          height: 32,
          backgroundColor: iconColor,
          color: 'white',
          marginTop: 2,
        }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          style={{
            fontSize: 'var(--font-size-body)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-label)',
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 'var(--font-size-footnote)',
            color: 'var(--color-secondaryLabel)',
            lineHeight: 1.5,
          }}
        >
          {body}
        </div>
      </div>
    </div>
  );
}

const ITEMS = [
  {
    icon: <Sparkles size={18} strokeWidth={2} />,
    iconColor: '#FF9500',
    title: '娱乐用途',
    body: 'mini机 仅供娱乐与情感陪伴使用，不构成医疗、法律、金融等任何专业领域的建议或参考。',
  },
  {
    icon: <Bot size={18} strokeWidth={2} />,
    iconColor: '#AF52DE',
    title: 'AI 生成内容',
    body: '本应用中的虚拟角色与对话内容均由 AI 模型生成，不代表任何真实人物、实体或组织的立场与观点。',
  },
  {
    icon: <PenLine size={18} strokeWidth={2} />,
    iconColor: '#32ADE6',
    title: '内容责任',
    body: '您创建、编辑和使用的角色设定、对话记录、头像图片等内容，由您本人自行承担相应责任。',
  },
  {
    icon: <HardDrive size={18} strokeWidth={2} />,
    iconColor: '#34C759',
    title: '本地存储',
    body: '您的聊天记录、角色配置和偏好设置均仅保存在本设备的浏览器中，不会上传至任何服务器。',
  },
  {
    icon: <ShieldCheck size={18} strokeWidth={2} />,
    iconColor: '#007AFF',
    title: '合规使用',
    body: '请勿将本应用用于任何非法、违反公序良俗或侵犯他人合法权益的用途。',
  },
  {
    icon: <Scale size={18} strokeWidth={2} />,
    iconColor: '#8E8E93',
    title: '免责范围',
    body: '开发者不对因使用本应用而产生的任何直接或间接后果承担责任，包括但不限于与第三方 AI 服务产生的调用费用。',
  },
  {
    icon: <Ban size={18} strokeWidth={2.25} />,
    iconColor: '#FF3B30',
    title: '禁止商用',
    body: '本应用仅供个人学习与非商业用途使用。严禁将其用于任何形式的商业用途（包括但不限于转售、广告植入、付费服务），违者将依法追究法律责任。',
  },
];

/* ── Main page ── */

export function DisclaimerPage() {
  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
      data-testid="disclaimer-page"
    >
      {/* Hero */}
      <div className="flex flex-col items-center px-6 pb-6 pt-8">
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: 64,
            height: 64,
            backgroundColor: 'rgba(0,122,255,0.12)',
            color: 'var(--color-systemBlue)',
          }}
        >
          <ShieldAlert size={32} strokeWidth={2} />
        </div>
        <div
          className="mt-3 text-center"
          style={{
            fontSize: 'var(--font-size-title3)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-label)',
          }}
        >
          使用须知与免责声明
        </div>
        <div
          className="mt-1 text-center"
          style={{
            fontSize: 'var(--font-size-footnote)',
            color: 'var(--color-secondaryLabel)',
            maxWidth: 280,
            lineHeight: 1.5,
          }}
        >
          在开始使用 mini机 之前，请花一分钟阅读以下内容
        </div>
      </div>

      {/* Disclaimer items */}
      {ITEMS.map((item) => (
        <DisclaimerItem key={item.title} {...item} />
      ))}

      {/* Acknowledgment footer */}
      <div
        className="mx-4 mb-6 mt-4 px-5 py-4"
        style={{
          backgroundColor: 'rgba(0,122,255,0.08)',
          borderRadius: 'var(--radius-group)',
          border: '0.5px solid rgba(0,122,255,0.2)',
        }}
      >
        <div
          className="text-center"
          style={{
            fontSize: 'var(--font-size-footnote)',
            color: 'var(--color-systemBlue)',
            fontWeight: 'var(--font-weight-medium)',
            lineHeight: 1.6,
          }}
        >
          继续使用本应用即表示您已阅读、理解并同意本免责声明。
        </div>
      </div>

      {/* Bottom spacer */}
      <div style={{ height: 40 }} />
    </div>
  );
}
