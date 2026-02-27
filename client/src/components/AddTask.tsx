import { useState } from "react";
import { Calendar, Flag } from "lucide-react";
import { format, startOfToday, startOfTomorrow, addDays } from "date-fns";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "../lib/utils";
import { useTaskStore } from "../stores/taskStore";

type Priority = "none" | "low" | "medium" | "high";

const priorityPrefix: Record<Priority, string> = {
  none: "",
  low: "! ",
  medium: "!! ",
  high: "!!! ",
};

export function AddTask() {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [priority, setPriority] = useState<Priority>("none");
  const { createTask } = useTaskStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const fullTitle = priorityPrefix[priority] + trimmed;
    await createTask(fullTitle, {
      due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : undefined,
    });
    setTitle("");
    setDueDate(undefined);
    setPriority("none");
  };

  return (
    <div className="p-4 border-t border-white/10 bg-white/5">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center bg-black/20 border border-white/10 rounded-xl focus-within:bg-black/40 focus-within:border-white/30 transition-all">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New Task..."
            className="w-full bg-transparent py-3 pl-4 pr-24 text-sm text-white placeholder:text-white/30 focus:outline-none"
          />

          {/* Inline Actions */}
          <div className="absolute right-2 flex items-center space-x-1">
            {/* Date Picker */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className={cn(
                    "p-1.5 rounded-lg hover:bg-white/10 transition-colors",
                    dueDate ? "text-blue-400" : "text-white/40 hover:text-white"
                  )}
                >
                  <Calendar className="w-4 h-4" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="bg-zinc-800 border border-white/10 rounded-lg p-1 shadow-xl z-50 min-w-[150px] text-white">
                  <DropdownMenu.Item
                    onSelect={() => setDueDate(startOfToday())}
                    className="p-2 hover:bg-white/10 rounded cursor-pointer text-xs outline-none"
                  >
                    Today
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => setDueDate(startOfTomorrow())}
                    className="p-2 hover:bg-white/10 rounded cursor-pointer text-xs outline-none"
                  >
                    Tomorrow
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => setDueDate(addDays(new Date(), 7))}
                    className="p-2 hover:bg-white/10 rounded cursor-pointer text-xs outline-none"
                  >
                    Next Week
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="h-px bg-white/10 my-1" />
                  <DropdownMenu.Item
                    onSelect={() => setDueDate(undefined)}
                    className="p-2 hover:bg-white/10 rounded cursor-pointer text-xs text-red-400 outline-none"
                  >
                    Clear
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Priority Picker */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className={cn(
                    "p-1.5 rounded-lg hover:bg-white/10 transition-colors",
                    priority !== "none"
                      ? "text-orange-400"
                      : "text-white/40 hover:text-white"
                  )}
                >
                  <Flag className="w-4 h-4" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="bg-zinc-800 border border-white/10 rounded-lg p-1 shadow-xl z-50 min-w-[150px] text-white">
                  <DropdownMenu.Item
                    onSelect={() => setPriority("none")}
                    className="p-2 hover:bg-white/10 rounded cursor-pointer text-xs outline-none"
                  >
                    None
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => setPriority("low")}
                    className="p-2 hover:bg-white/10 rounded cursor-pointer text-xs outline-none"
                  >
                    Low
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => setPriority("medium")}
                    className="p-2 hover:bg-white/10 rounded cursor-pointer text-xs outline-none"
                  >
                    Medium
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => setPriority("high")}
                    className="p-2 hover:bg-white/10 rounded cursor-pointer text-xs outline-none"
                  >
                    High
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>

        <button type="submit" className="hidden" />
      </form>
    </div>
  );
}
