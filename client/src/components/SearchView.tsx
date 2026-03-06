import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "motion/react";
import { ChevronLeft, Search } from "lucide-react";
import { api } from "../lib/api";
import type { Task } from "../lib/api";
import { TaskItem } from "./TaskItem";
import { useTaskStore } from "../stores/taskStore";

interface SearchViewProps {
  onClose: () => void;
}

export function SearchView({ onClose }: SearchViewProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectTask = useTaskStore((s) => s.selectTask);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    setSearchError(null);
    try {
      const tasks = await api.listTasks(undefined, searchQuery);
      setResults(tasks);
    } catch (err) {
      console.error("Search failed:", err);
      setSearchError("Search failed");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 bg-[#F5F6F8] z-50 flex flex-col"
    >
      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center gap-4 bg-white shadow-sm">
        <button onClick={onClose} className="text-gray-400">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 bg-gray-100 rounded-full flex items-center px-4 py-2">
          <Search size={20} className="text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Search tasks..."
            className="bg-transparent outline-none w-full text-sm"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading && (
          <div className="text-center text-gray-400 text-sm py-8">
            Searching...
          </div>
        )}

        {searchError && (
          <div className="text-center text-red-500 text-sm py-4">
            {searchError}
          </div>
        )}

        {!isLoading && !searchError && results.length > 0 && (
          <div>
            {results.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onClick={() => selectTask(task.id)}
              />
            ))}
          </div>
        )}

        {!isLoading && !searchError && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Search size={48} className="opacity-20 mb-4" />
            <span className="text-sm">
              {query.trim() ? "No tasks found" : "Type to search tasks"}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
