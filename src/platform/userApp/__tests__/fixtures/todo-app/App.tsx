import React, { useState, useEffect } from 'react';
import { get, set } from '@hiphone/storage';
import { useCurrentOwner } from '@hiphone/perspective';
import { useOnLaunch, useAppMemory } from '@hiphone/hooks';
import { TodoItem } from './components/TodoItem';
import { formatTimestamp } from './utils';

interface Todo {
  id: number;
  text: string;
  createdAt: number;
}

export default function TodoApp() {
  const { ownerName, isViewingOther } = useCurrentOwner();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useAppMemory<string>('draft', '');

  useOnLaunch(() => {
    console.log('[todo] launched');
  });

  useEffect(() => {
    get('todos').then((raw) => {
      if (Array.isArray(raw)) setTodos(raw as Todo[]);
    });
  }, [ownerName]);

  const addTodo = () => {
    if (!draft.trim()) return;
    const next: Todo[] = [
      ...todos,
      { id: Date.now(), text: draft, createdAt: Date.now() },
    ];
    setTodos(next);
    set('todos', next);
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-2" style={{ padding: 20 }} data-testid="todo-app-root">
      <h1 data-testid="todo-title">
        {isViewingOther ? `${ownerName} 的待办` : '我的待办'}
      </h1>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          data-testid="todo-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{ flex: 1, padding: 8 }}
        />
        <button data-testid="todo-add" onClick={addTodo} style={{ padding: 8 }}>
          添加
        </button>
      </div>
      <ul data-testid="todo-list">
        {todos.map((t) => (
          <TodoItem key={t.id} text={t.text} when={formatTimestamp(t.createdAt)} />
        ))}
      </ul>
    </div>
  );
}
