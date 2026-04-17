import React from 'react';

interface Props {
  text: string;
  when: string;
}

export function TodoItem({ text, when }: Props) {
  return (
    <li data-testid="todo-item" style={{ padding: 8, borderBottom: '1px solid #eee' }}>
      <span>{text}</span>
      <span style={{ marginLeft: 8, color: '#999' }}>{when}</span>
    </li>
  );
}
