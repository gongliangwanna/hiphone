import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import './notesRichText.css';

interface RichTextEditorProps {
  content: string;
  editable: boolean;
  noteId: string | null;
  onUpdate: (html: string) => void;
}

export function RichTextEditor({
  content,
  editable,
  noteId,
  onUpdate,
}: RichTextEditorProps) {
  const isSettingContent = useRef(false);
  const prevNoteIdRef = useRef(noteId);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: '正文' }),
    ],
    content,
    editable,
    onUpdate: ({ editor: ed }) => {
      if (isSettingContent.current) return;
      onUpdate(ed.getHTML());
    },
  });

  // Reset content when noteId changes (navigating between notes)
  useEffect(() => {
    if (!editor) return;
    if (prevNoteIdRef.current === noteId) return;
    prevNoteIdRef.current = noteId;

    isSettingContent.current = true;
    editor.commands.setContent(content);
    isSettingContent.current = false;
  }, [editor, noteId, content]);

  // Sync editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  return (
    <EditorContent
      editor={editor}
      className="w-full flex-1"
      data-testid="note-rich-editor"
    />
  );
}
