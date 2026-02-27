import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { useEffect } from 'react';

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  editable?: boolean;
}

export function Editor({ content, onChange, editable = true }: EditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Image],
    content: content ? JSON.parse(content) : '',
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()));
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm prose-invert focus:outline-none max-w-none min-h-[100px] p-4',
      },
    },
  });

  useEffect(() => {
    if (editor && content) {
      const currentContent = JSON.stringify(editor.getJSON());
      if (currentContent !== content) {
        try {
            editor.commands.setContent(JSON.parse(content));
        } catch (e) {
            console.error("Failed to parse content", e);
        }
      }
    }
  }, [content, editor]);

  return <EditorContent editor={editor} />;
}
