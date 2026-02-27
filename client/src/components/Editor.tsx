import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { useEffect, useCallback, useRef } from "react";
import { useTaskStore } from "../stores/taskStore";
import { api } from "../lib/api";
import type { Block } from "../lib/api";

export function Editor() {
  const { selectedTaskId } = useTaskStore();
  const blocksRef = useRef<Block[]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, Image],
    content: "",
    editorProps: {
      attributes: {
        class:
          "outline-none min-h-[200px] text-sm text-white/90 prose prose-invert prose-sm max-w-none",
      },
    },
    onUpdate: ({ editor }) => {
      // Debounced save
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveContent(editor.getJSON());
      }, 1000);
    },
  });

  const saveContent = useCallback(
    async (json: unknown) => {
      if (!selectedTaskId) return;
      const blocks: Block[] = [
        {
          id: blocksRef.current[0]?.id || crypto.randomUUID(),
          task_id: selectedTaskId,
          notion_block_id: null,
          type: "tiptap_doc",
          content: json,
          sort_order: 0,
          updated_at: new Date().toISOString(),
        },
      ];
      try {
        const saved = await api.updateBlocks(selectedTaskId, blocks);
        blocksRef.current = saved;
      } catch (e) {
        console.error("Failed to save content:", e);
      }
    },
    [selectedTaskId],
  );

  // Load content when task is selected
  useEffect(() => {
    if (!selectedTaskId || !editor) return;

    const loadContent = async () => {
      try {
        const blocks = await api.getBlocks(selectedTaskId);
        blocksRef.current = blocks;
        if (blocks.length > 0 && blocks[0].content) {
          editor.commands.setContent(blocks[0].content as Parameters<typeof editor.commands.setContent>[0]);
        } else {
          editor.commands.setContent("");
        }
      } catch (e) {
        console.error("Failed to load content:", e);
        editor.commands.setContent("");
      }
    };

    loadContent();
  }, [selectedTaskId, editor]);

  if (!selectedTaskId) {
    return null;
  }

  return (
    <div className="px-3 py-2 border-t border-white/10 flex-1 overflow-y-auto">
      <EditorContent editor={editor} />
    </div>
  );
}
