'use client';

import { useState } from 'react';
import { GlassPanel } from './components/GlassPanel';
import { TaskList } from './components/TaskList';
import { Settings } from './components/Settings';
import { useGotionStore, TaskPriority, GroupByOption } from './store/gotionStore';
import { useSync } from './hooks/useSync';
import { Plus, RefreshCw, Loader2, Calendar, Flag, ListFilter } from 'lucide-react';
import { cn } from './lib/utils';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { format, startOfToday, startOfTomorrow, addDays } from 'date-fns';

export default function Home() {
  const { addTask, setGroupBy, groupBy } = useGotionStore();
  const { sync, isSyncing, error } = useSync();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newDate, setNewDate] = useState<Date | undefined>(undefined);
  const [newPriority, setNewPriority] = useState<TaskPriority>('none');

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskTitle.trim()) {
      addTask(newTaskTitle.trim(), {
          due_date: newDate ? newDate.toISOString() : undefined,
          priority: newPriority
      });
      setNewTaskTitle('');
      setNewDate(undefined);
      setNewPriority('none');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <GlassPanel className="w-full max-w-md h-[80vh] flex flex-col relative">
        {/* Title Bar */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5" data-tauri-drag-region>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500/50" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
            <div className="w-3 h-3 rounded-full bg-green-500/50" />
          </div>
          <h1 className="text-sm font-semibold tracking-widest uppercase text-white/50">Gotion</h1>
          <div className="flex items-center space-x-1">
            <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                    <button className={cn(
                        "p-2 rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white",
                        groupBy !== 'date' && "text-blue-400"
                    )}>
                        <ListFilter className="w-4 h-4" />
                    </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                    <DropdownMenu.Content className="bg-zinc-800 border border-white/10 rounded-lg p-1 shadow-xl z-50 min-w-[150px] text-white">
                        <div className="px-2 py-1 text-[10px] uppercase text-white/40 font-bold">Group By</div>
                        <DropdownMenu.Item onSelect={() => setGroupBy('date')} className="flex items-center px-2 py-1.5 text-xs hover:bg-white/10 rounded cursor-pointer">
                            {groupBy === 'date' && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-2" />}
                            <span className={groupBy !== 'date' ? "ml-3.5" : ""}>Date</span>
                        </DropdownMenu.Item>
                        <DropdownMenu.Item onSelect={() => setGroupBy('status')} className="flex items-center px-2 py-1.5 text-xs hover:bg-white/10 rounded cursor-pointer">
                            {groupBy === 'status' && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-2" />}
                            <span className={groupBy !== 'status' ? "ml-3.5" : ""}>Status</span>
                        </DropdownMenu.Item>
                        <DropdownMenu.Item onSelect={() => setGroupBy('priority')} className="flex items-center px-2 py-1.5 text-xs hover:bg-white/10 rounded cursor-pointer">
                            {groupBy === 'priority' && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-2" />}
                            <span className={groupBy !== 'priority' ? "ml-3.5" : ""}>Priority</span>
                        </DropdownMenu.Item>
                    </DropdownMenu.Content>
                </DropdownMenu.Portal>
            </DropdownMenu.Root>

            <button 
                onClick={sync} 
                disabled={isSyncing}
                className={cn(
                    "p-2 rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white",
                    isSyncing && "animate-spin"
                )}
            >
                {isSyncing ? <Loader2 className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
            </button>
            <Settings />
          </div>
        </div>

        {/* Error Message */}
        {error && (
            <div className="bg-red-500/20 text-red-200 text-xs p-2 text-center border-b border-red-500/20">
                {error}
            </div>
        )}

        {/* Task List (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          <TaskList />
        </div>

        {/* Add Task Input */}
        <div className="p-4 border-t border-white/10 bg-white/5">
          <form onSubmit={handleAddTask} className="relative">
            <div className="relative flex items-center bg-black/20 border border-white/10 rounded-xl focus-within:bg-black/40 focus-within:border-white/30 transition-all">
                <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
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
                                    newDate ? "text-blue-400" : "text-white/40 hover:text-white"
                                )}
                            >
                                <Calendar className="w-4 h-4" />
                            </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                            <DropdownMenu.Content className="bg-zinc-800 border border-white/10 rounded-lg p-1 shadow-xl z-50 min-w-[150px] text-white">
                                <DropdownMenu.Item onSelect={() => setNewDate(startOfToday())} className="p-2 hover:bg-white/10 rounded cursor-pointer text-xs">Today</DropdownMenu.Item>
                                <DropdownMenu.Item onSelect={() => setNewDate(startOfTomorrow())} className="p-2 hover:bg-white/10 rounded cursor-pointer text-xs">Tomorrow</DropdownMenu.Item>
                                <DropdownMenu.Item onSelect={() => setNewDate(addDays(new Date(), 7))} className="p-2 hover:bg-white/10 rounded cursor-pointer text-xs">Next Week</DropdownMenu.Item>
                                <DropdownMenu.Separator className="h-px bg-white/10 my-1" />
                                <DropdownMenu.Item onSelect={() => setNewDate(undefined)} className="p-2 hover:bg-white/10 rounded cursor-pointer text-xs text-red-400">Clear</DropdownMenu.Item>
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
                                    newPriority !== 'none' ? "text-orange-400" : "text-white/40 hover:text-white"
                                )}
                            >
                                <Flag className="w-4 h-4" />
                            </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                            <DropdownMenu.Content className="bg-zinc-800 border border-white/10 rounded-lg p-1 shadow-xl z-50 min-w-[150px] text-white">
                                <DropdownMenu.Item onSelect={() => setNewPriority('none')} className="p-2 hover:bg-white/10 rounded cursor-pointer text-xs">None</DropdownMenu.Item>
                                <DropdownMenu.Item onSelect={() => setNewPriority('low')} className="p-2 hover:bg-white/10 rounded cursor-pointer text-xs">Low</DropdownMenu.Item>
                                <DropdownMenu.Item onSelect={() => setNewPriority('medium')} className="p-2 hover:bg-white/10 rounded cursor-pointer text-xs">Medium</DropdownMenu.Item>
                                <DropdownMenu.Item onSelect={() => setNewPriority('high')} className="p-2 hover:bg-white/10 rounded cursor-pointer text-xs">High</DropdownMenu.Item>
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                </div>
            </div>
            
            {/* Submit Button (Hidden but accessible via Enter) */}
            <button type="submit" className="hidden" />
          </form>
        </div>
      </GlassPanel>
      
      <div className="mt-4 text-xs text-white/20">
        Gotion Web MVP • Offline Ready
      </div>
    </main>
  );
}
