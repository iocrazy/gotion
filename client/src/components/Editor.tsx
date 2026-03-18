import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useCallback, useRef } from "react";
import {
  ImagePlus,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Minus,
  FileCode,
} from "lucide-react";
import { api } from "../lib/api";
import type { Block } from "../lib/api";

interface EditorProps {
  taskId: string;
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? "text-[var(--accent)] bg-[var(--bg-hover)]"
          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
      }`}
      title={title}
    >
      {children}
    </button>
  );
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
    extensions: [
      StarterKit,
      Image,
      Placeholder.configure({
        placeholder: "Write notes... (use ``` for code, # for heading)",
      }),
    ],
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

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor) return;
      try {
        const { url } = await api.uploadImage(file);
        editor.chain().focus().setImage({ src: url }).run();
      } catch (e) {
        console.error("Failed to upload image:", e);
      }
    },
    [editor],
  );

  // Load content when task changes
  useEffect(() => {
    if (!taskId || !editor) return;

    const loadContent = async () => {
      try {
        const blocks = await api.getBlocks(taskId);
        blocksRef.current = blocks;
        if (blocks.length > 0 && blocks[0].content) {
          editor.commands.setContent(
            blocks[0].content as Parameters<
              typeof editor.commands.setContent
            >[0],
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

  const iconSize = "w-3.5 h-3.5";

  return (
    <div>
      {editor && (
        <div
          className="flex items-center gap-0.5 px-3 pt-2 pb-2 flex-wrap"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Bold (Cmd+B)"
          >
            <Bold className={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Italic (Cmd+I)"
          >
            <Italic className={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
            title="Strikethrough (Cmd+Shift+X)"
          >
            <Strikethrough className={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive("code")}
            title="Inline code (Cmd+E)"
          >
            <Code className={iconSize} />
          </ToolbarButton>

          <div className="w-px h-4 bg-[var(--border)] mx-1" />

          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            active={editor.isActive("heading", { level: 1 })}
            title="Heading 1"
          >
            <Heading1 className={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            active={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
          >
            <Heading2 className={iconSize} />
          </ToolbarButton>

          <div className="w-px h-4 bg-[var(--border)] mx-1" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Bullet list"
          >
            <List className={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="Numbered list"
          >
            <ListOrdered className={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            title="Blockquote"
          >
            <Quote className={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive("codeBlock")}
            title="Code block"
          >
            <FileCode className={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Divider"
          >
            <Minus className={iconSize} />
          </ToolbarButton>

          <div className="w-px h-4 bg-[var(--border)] mx-1" />

          <ToolbarButton
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
            title="Insert image"
          >
            <ImagePlus className={iconSize} />
          </ToolbarButton>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
