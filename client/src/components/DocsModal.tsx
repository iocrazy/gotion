import { X } from "lucide-react";
import { motion } from "motion/react";

interface DocsModalProps {
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function ShortcutRow({ keys, desc }: { keys: string; desc: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-gray-600">{desc}</span>
      <kbd className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{keys}</kbd>
    </div>
  );
}

export function DocsModal({ onClose }: DocsModalProps) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 z-[60]"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="absolute bottom-0 left-0 right-0 top-8 bg-white rounded-t-3xl z-[60] flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
          <button onClick={onClose} className="text-gray-400">
            <X size={24} />
          </button>
          <h2 className="text-lg font-semibold text-gray-800">Docs</h2>
          <div className="w-6" />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Section title="Notes Editor">
            <p className="text-sm text-gray-500 mb-3">
              Open Notes from task detail to use the rich text editor. Content syncs with Notion automatically.
            </p>
            <div className="bg-gray-50 rounded-xl p-3 space-y-0.5">
              <ShortcutRow keys="``` + Space" desc="Code block" />
              <ShortcutRow keys="# + Space" desc="Heading 1" />
              <ShortcutRow keys="## + Space" desc="Heading 2" />
              <ShortcutRow keys="### + Space" desc="Heading 3" />
              <ShortcutRow keys="- + Space" desc="Bullet list" />
              <ShortcutRow keys="1. + Space" desc="Numbered list" />
              <ShortcutRow keys="> + Space" desc="Blockquote" />
              <ShortcutRow keys="--- + Enter" desc="Divider" />
            </div>
          </Section>

          <Section title="Inline Formatting">
            <div className="bg-gray-50 rounded-xl p-3 space-y-0.5">
              <ShortcutRow keys="Cmd+B" desc="Bold" />
              <ShortcutRow keys="Cmd+I" desc="Italic" />
              <ShortcutRow keys="Cmd+E" desc="Inline code" />
              <ShortcutRow keys="Cmd+Shift+X" desc="Strikethrough" />
            </div>
          </Section>

          <Section title="Task Shortcuts">
            <div className="bg-gray-50 rounded-xl p-3 space-y-0.5">
              <ShortcutRow keys="Esc" desc="Close task detail" />
              <ShortcutRow keys="Drag" desc="Reorder tasks" />
              <ShortcutRow keys="Swipe left" desc="Delete task" />
            </div>
          </Section>

          <Section title="Notion Sync">
            <div className="text-sm text-gray-500 space-y-2">
              <p>Content syncs bidirectionally between Gotion notes and Notion page body.</p>
              <p><span className="font-medium text-gray-700">Supported:</span> Paragraphs, headings (H1-H3), bullet lists, numbered lists, code blocks, images.</p>
              <p><span className="font-medium text-gray-700">In-progress tasks:</span> Auto-synced every 30s via polling.</p>
              <p><span className="font-medium text-gray-700">Other tasks:</span> Synced on detail view open (lazy load).</p>
              <p><span className="font-medium text-gray-700">Conflict:</span> Last-write-wins based on timestamps.</p>
            </div>
          </Section>

          <Section title="Images">
            <div className="text-sm text-gray-500 space-y-2">
              <p>Drag & drop or paste images directly into the notes editor. Use the toolbar button to pick a file.</p>
              <p>Attachments can be added from the task detail view (below notes).</p>
            </div>
          </Section>
        </div>
      </motion.div>
    </>
  );
}
