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
    <div
      className="px-3 py-2"
      style={{
        backgroundColor: "var(--bg-surface)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="+ New Task..."
            className="w-full bg-transparent py-2 pl-1 pr-20 text-sm font-light tracking-wide focus:outline-none"
            style={{
              color: "var(--text-primary)",
            }}
          />

          {/* Inline Actions */}
          <div className="absolute right-0 flex items-center gap-0.5">
            {/* Date Picker */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    dueDate
                      ? "text-[var(--accent)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  <Calendar className="w-3.5 h-3.5" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="rounded-lg p-1 shadow-2xl z-50 min-w-[150px]"
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <DropdownMenu.Item
                    onSelect={() => setDueDate(startOfToday())}
                    className="p-2 rounded cursor-pointer text-xs outline-none hover:bg-[var(--bg-hover)]"
                  >
                    Today
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => setDueDate(startOfTomorrow())}
                    className="p-2 rounded cursor-pointer text-xs outline-none hover:bg-[var(--bg-hover)]"
                  >
                    Tomorrow
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => setDueDate(addDays(new Date(), 7))}
                    className="p-2 rounded cursor-pointer text-xs outline-none hover:bg-[var(--bg-hover)]"
                  >
                    Next Week
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="h-px my-1" style={{ backgroundColor: "var(--border)" }} />
                  <DropdownMenu.Item
                    onSelect={() => setDueDate(undefined)}
                    className="p-2 rounded cursor-pointer text-xs outline-none hover:bg-[var(--bg-hover)]"
                    style={{ color: "var(--danger)" }}
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
                    "p-1.5 rounded-md transition-colors",
                    priority !== "none"
                      ? "text-[var(--warn)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  <Flag className="w-3.5 h-3.5" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="rounded-lg p-1 shadow-2xl z-50 min-w-[150px]"
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  {(["none", "low", "medium", "high"] as const).map((p) => (
                    <DropdownMenu.Item
                      key={p}
                      onSelect={() => setPriority(p)}
                      className="p-2 rounded cursor-pointer text-xs outline-none hover:bg-[var(--bg-hover)]"
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </DropdownMenu.Item>
                  ))}
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
