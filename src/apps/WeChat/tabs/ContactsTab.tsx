import { useMemo } from 'react';
import { contactList, contactActions, getAvatarColor, getAvatarInitial } from '../data';

export function ContactsTab() {
  const sections = useMemo(() => {
    const grouped: Record<string, typeof contactList> = {};
    for (const c of contactList) {
      (grouped[c.initial] ??= []).push(c);
    }
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, []);

  return (
    <div className="h-full overflow-auto" style={{ backgroundColor: 'var(--color-systemBackground)' }}>
      {/* Search bar */}
      <div style={{ padding: '8px 16px' }}>
        <div
          className="flex items-center justify-center"
          style={{
            height: 36,
            borderRadius: 10,
            backgroundColor: 'var(--color-tertiarySystemBackground)',
            color: 'var(--color-tertiaryLabel)',
            fontSize: 'var(--font-size-callout)',
          }}
        >
          <SearchIcon />
          <span style={{ marginLeft: 6 }}>搜索</span>
        </div>
      </div>

      {/* Action items */}
      {contactActions.map((action, i) => (
        <div
          key={action.id}
          className="flex items-center"
          style={{
            padding: '10px 16px',
            borderBottom:
              i < contactActions.length - 1
                ? '0.5px solid var(--color-separator)'
                : 'none',
          }}
        >
          <div
            className="flex shrink-0 items-center justify-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              backgroundColor: action.color,
            }}
          >
            <ActionIcon type={action.icon} />
          </div>
          <span
            style={{
              marginLeft: 12,
              fontSize: 'var(--font-size-body)',
              color: 'var(--color-label)',
            }}
          >
            {action.name}
          </span>
        </div>
      ))}

      {/* Separator */}
      <div
        style={{
          height: 8,
          backgroundColor: 'var(--color-secondarySystemBackground)',
        }}
      />

      {/* Alphabetical sections */}
      {sections.map(([initial, contacts]) => (
        <div key={initial}>
          <div
            style={{
              padding: '4px 16px',
              fontSize: 'var(--font-size-footnote)',
              color: 'var(--color-secondaryLabel)',
              backgroundColor: 'var(--color-secondarySystemBackground)',
              fontWeight: 500,
            }}
          >
            {initial}
          </div>
          {contacts.map((contact, ci) => (
            <div
              key={contact.id}
              className="flex items-center"
              style={{
                padding: '8px 16px',
                borderBottom:
                  ci < contacts.length - 1
                    ? '0.5px solid var(--color-separator)'
                    : 'none',
              }}
            >
              <div
                className="flex shrink-0 items-center justify-center"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 4,
                  backgroundColor: getAvatarColor(contact.name),
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {getAvatarInitial(contact.name)}
              </div>
              <span
                style={{
                  marginLeft: 12,
                  fontSize: 'var(--font-size-body)',
                  color: 'var(--color-label)',
                }}
              >
                {contact.name}
              </span>
            </div>
          ))}
        </div>
      ))}

      {/* Footer */}
      <div
        className="text-center"
        style={{
          padding: '16px 0 24px',
          fontSize: 'var(--font-size-footnote)',
          color: 'var(--color-secondaryLabel)',
        }}
      >
        {contactList.length}位联系人
      </div>
    </div>
  );
}

function ActionIcon({ type }: { type: string }) {
  const color = '#fff';
  if (type === 'friend') {
    return (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="7" r="3.5" stroke={color} strokeWidth="1.5" />
        <path d="M3.5 18c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'group') {
    return (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <circle cx="7" cy="7" r="3" stroke={color} strokeWidth="1.5" />
        <circle cx="14" cy="7" r="2.5" stroke={color} strokeWidth="1.5" />
        <path d="M1 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14 11c2.8 0 5 2.2 5 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'tag') {
    return (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M3 3h6.5l7 7-6.5 6.5-7-7V3z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="7" cy="7" r="1.2" fill={color} />
      </svg>
    );
  }
  // official
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="5" width="14" height="10" rx="2" stroke={color} strokeWidth="1.5" />
      <path d="M3 8l7 4 7-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
