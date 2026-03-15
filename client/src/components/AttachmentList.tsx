import { useState, useEffect, useRef, useCallback } from "react";
import { Paperclip, Trash2, FileIcon, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import type { Attachment } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { useUpgrade } from "../lib/upgradeContext";
import { ProBadge } from "./ProBadge";

const MAX_ATTACHMENTS = 10;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentListProps {
  taskId: string;
}

export function AttachmentList({ taskId }: AttachmentListProps) {
  const isPro = useAuthStore((s) => s.isPro);
  const openUpgrade = useUpgrade();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAttachments = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.listAttachments(taskId);
      setAttachments(result);
    } catch (err) {
      console.error("Failed to fetch attachments:", err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (isPro()) {
      fetchAttachments();
    } else {
      setLoading(false);
    }
  }, [isPro, fetchAttachments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const newAttachment = await api.uploadAttachment(taskId, file);
      setAttachments((prev) => [...prev, newAttachment]);
    } catch (err) {
      console.error("Failed to upload attachment:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await api.deleteAttachment(id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Failed to delete attachment:", err);
    } finally {
      setDeletingId(null);
    }
  };

  // Locked state for non-Pro users
  if (!isPro()) {
    return (
      <div className="rounded-3xl overflow-hidden shadow-sm bg-white">
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Paperclip size={20} className="text-gray-500" />
            <span className="text-[15px] font-medium text-gray-800">
              Attachments
            </span>
            <ProBadge onClick={openUpgrade} />
          </div>
        </div>
        <div className="px-5 pb-4">
          <button
            onClick={openUpgrade}
            className="w-full py-3 rounded-xl bg-orange-50 text-orange-500 text-sm font-medium flex items-center justify-center gap-2"
          >
            Upgrade to Pro for Attachments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl overflow-hidden shadow-sm bg-white">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip size={20} className="text-gray-500" />
          <span className="text-[15px] font-medium text-gray-800">
            Attachments
          </span>
          <span className="text-xs text-gray-400">
            {attachments.length}/{MAX_ATTACHMENTS}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={20} className="animate-spin text-gray-400" />
          </div>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-2">
            No attachments yet
          </p>
        ) : (
          attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-gray-50 group"
            >
              <FileIcon size={18} className="text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">
                  {attachment.filename}
                </p>
                <p className="text-xs text-gray-400">
                  {formatFileSize(attachment.file_size)}
                </p>
              </div>
              <button
                onClick={() => handleDelete(attachment.id)}
                disabled={deletingId === attachment.id}
                className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
              >
                {deletingId === attachment.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
              </button>
            </div>
          ))
        )}

        {/* Upload button */}
        {attachments.length < MAX_ATTACHMENTS && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-red-500 text-sm font-medium text-left w-max flex items-center gap-1"
            >
              {uploading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                "+ Add attachment"
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
