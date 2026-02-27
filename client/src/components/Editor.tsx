import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api";
import type { Block } from "../lib/api";

interface EditorProps {
  taskId: string;
}

export function Editor({ taskId }: EditorProps) {
  const blocksRef = useRef<Block[]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveContent = useCallback(
    async (json: unknown) => {
      if (!taskId) return;
      const blocks: Block[] = [
        {
          id: blocksRef.current[0]?.id || crypto.randomUUID(),
          task_id: taskId,
          notion_block_id: null,
          type: "tiptap_doc",
          content: json,
          sort_order: 0,
          updated_at: new Date().toISOString(),
        },
      ];
      try {
        const saved = await api.updateBlocks(taskId, blocks);
        blocksRef.current = saved;
      } catch (e) {
        console.error("Failed to save content:", e);
      }
    },
    [taskId],
  );

  const editor = useEditor({
    extensions: [StarterKit, Image],
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm prose-invert focus:outline-none max-w-none min-h-[100px] p-4",
      },
    },
    onUpdate: ({ editor }) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveContent(editor.getJSON());
      }, 1000);
    },
  });

  // Load content when task changes
  useEffect(() => {
    if (!taskId || !editor) return;

    const loadContent = async () => {
      try {
        const blocks = await api.getBlocks(taskId);
        blocksRef.current = blocks;
        if (blocks.length > 0 && blocks[0].content) {
          editor.commands.setContent(
            blocks[0].content as Parameters<typeof editor.commands.setContent>[0]
          );
        } else {
          editor.commands.setContent("");
        }
      } catch (e) {
        console.error("Failed to load content:", e);
        editor.commands.setContent("");
      }
    };

    loadContent();
  }, [taskId, editor]);

  return <EditorContent editor={editor} />;
}
