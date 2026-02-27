import { useState, useEffect } from "react";
import { useTaskStore } from "../stores/taskStore";
import { Editor } from "./Editor";
import { X, Calendar, Flag, Trash2 } from "lucide-react";
import { format, startOfToday, startOfTomorrow, addDays, isSameYear } from "date-fns";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "../lib/utils";
import type { Task } from "../lib/api";

interface TaskDetailPanelProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
}

export function TaskDetailPanel({ task, isOpen, onClose }: TaskDetailPanelProps) {
  const { updateTask, deleteTask } = useTaskStore();
  const [title, setTitle] = useState(task.title);

  useEffect(() => {
    setTitle(task.title);
  }, [task]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    updateTask(task.id, { title: e.target.value });
  };

  const handleSetDate = (date: Date | undefined) => {
    updateTask(task.id, {
      due_date: date ? format(date, "yyyy-MM-dd") : null,
    });
  };

  const handleDelete = () => {
    deleteTask(task.id);
    onClose();
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const now = new Date();
    if (isSameYear(date, now)) {
      return format(date, "MMM d");
    }
    return format(date, "MMM d, yyyy");
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[500px] translate-x-[-50%] translate-y-[-50%] rounded-2xl bg-[#1C1C1E] border border-white/10 shadow-2xl z-50 flex flex-col focus:outline-none">
          {/* Header */}
          <div className="flex items-center justify-between p-5 pb-2 shrink-0">
            <Dialog.Title className="text-xs font-bold text-white/40 uppercase tracking-widest">
              Details
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-2 space-y-6">
            {/* Title */}
            <input
              value={title}
              onChange={handleTitleChange}
              className="w-full bg-transparent text-2xl font-bold text-white placeholder:text-white/20 focus:outline-none leading-tight"
              placeholder="Title"
            />

            {/* Notes */}
            <div className="min-h-[120px] bg-[#2C2C2E] rounded-xl border border-white/5 focus-within:border-white/20 transition-colors overflow-hidden">
              <Editor taskId={task.id} />
            </div>

            {/* Properties Group */}
            <div className="bg-[#2C2C2E] rounded-xl border border-white/5 overflow-hidden divide-y divide-white/5">
              {/* Date */}
              <div className="flex items-center justify-between p-3.5 hover:bg-white/5 transition-colors group">
                <div className="flex items-center text-sm font-medium text-white">
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center mr-3 text-red-400 group-hover:scale-110 transition-transform">
                    <Calendar className="w-4 h-4" />
                  </div>
                  Date
                </div>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      className={cn(
                        "text-sm px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors",
                        task.due_date ? "text-blue-400 bg-blue-400/10" : "text-white/30"
                      )}
                    >
                      {task.due_date ? formatDateDisplay(task.due_date) : "Add Date"}
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content className="bg-[#2C2C2E] border border-white/10 rounded-xl p-1.5 shadow-2xl z-[60] min-w-[200px] text-white">
                      <DropdownMenu.Item
                        onSelect={() => handleSetDate(startOfToday())}
                        className="flex justify-between items-center px-3 py-2 text-sm hover:bg-white/10 rounded-lg cursor-pointer outline-none"
                      >
                        <span>Today</span>
                        <span className="text-white/30 text-xs">{format(startOfToday(), "EEE")}</span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={() => handleSetDate(startOfTomorrow())}
                        className="flex justify-between items-center px-3 py-2 text-sm hover:bg-white/10 rounded-lg cursor-pointer outline-none"
                      >
                        <span>Tomorrow</span>
                        <span className="text-white/30 text-xs">{format(startOfTomorrow(), "EEE")}</span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={() => handleSetDate(addDays(new Date(), 7))}
                        className="flex justify-between items-center px-3 py-2 text-sm hover:bg-white/10 rounded-lg cursor-pointer outline-none"
                      >
                        <span>Next Week</span>
                        <span className="text-white/30 text-xs">{format(addDays(new Date(), 7), "MMM d")}</span>
                      </DropdownMenu.Item>
                      {task.due_date && (
                        <>
                          <DropdownMenu.Separator className="h-px bg-white/10 my-1" />
                          <DropdownMenu.Item
                            onSelect={() => handleSetDate(undefined)}
                            className="flex justify-between items-center px-3 py-2 text-sm hover:bg-red-500/20 text-red-400 rounded-lg cursor-pointer outline-none"
                          >
                            <span>Clear Date</span>
                          </DropdownMenu.Item>
                        </>
                      )}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>

              {/* Priority */}
              <div className="flex items-center justify-between p-3.5 hover:bg-white/5 transition-colors group">
                <div className="flex items-center text-sm font-medium text-white">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center mr-3 text-orange-400 group-hover:scale-110 transition-transform">
                    <Flag className="w-4 h-4" />
                  </div>
                  Priority
                </div>
                <span className="text-sm text-white/30 px-3 py-1.5">
                  {task.title.startsWith("!!! ") ? "High" : task.title.startsWith("!! ") ? "Medium" : task.title.startsWith("! ") ? "Low" : "None"}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/5 bg-[#1C1C1E] flex justify-between items-center shrink-0 rounded-b-2xl">
            <div className="text-[10px] text-white/20 font-mono">
              ID: {task.id.slice(0, 8)}
            </div>
            <button
              onClick={handleDelete}
              className="text-red-400 hover:text-red-300 text-xs font-medium flex items-center transition-colors hover:bg-red-500/10 px-3 py-1.5 rounded-lg"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
