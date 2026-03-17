import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { useEffect, useCallback, useRef } from "react";
import { ImagePlus } from "lucide-react";
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
          "prose prose-sm focus:outline-none max-w-none min-h-[100px] px-4 py-2 text-sm",
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (files?.length) {
          event.preventDefault();
          for (const file of Array.from(files)) {
            if (file.type.startsWith("image/")) {
              handleImageUpload(file);
            }
          }
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const files = event.clipboardData?.files;
        if (files?.length) {
          for (const file of Array.from(files)) {
            if (file.type.startsWith("image/")) {
              event.preventDefault();
              handleImageUpload(file);
              return true;
            }
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveContent(editor.getJSON());
      }, 1000);
    },
  });

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return;
    try {
      const { url } = await api.uploadImage(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (e) {
      console.error("Failed to upload image:", e);
    }
  }, [editor]);

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

  return (
    <div>
      {editor && (
        <div className="flex items-center px-4 pt-2 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.onchange = () => {
                const file = input.files?.[0];
                if (file) handleImageUpload(file);
              };
              input.click();
            }}
            className="p-1.5 rounded-md transition-colors text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            title="Insert image"
          >
            <ImagePlus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
