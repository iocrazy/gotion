import { useState, useEffect, useRef } from 'react';
import { useGotionStore, Task, TaskPriority, TaskStatus } from '@/app/store/gotionStore';
import { Editor } from './Editor';
import { X, Calendar, Flag, Trash2, Circle, PlayCircle, Clock, PauseCircle, Check, XCircle, ChevronRight } from 'lucide-react';
import { format, startOfToday, startOfTomorrow, addDays, isSameYear } from 'date-fns';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/app/lib/utils';

interface TaskDetailPanelProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
}

export function TaskDetailPanel({ task, isOpen, onClose }: TaskDetailPanelProps) {
  const { updateTask, updateBlocks, blocks, deleteTask } = useGotionStore();
  const [title, setTitle] = useState(task.title);
  const [content, setContent] = useState('');
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  const taskBlocks = blocks[task.id] || [];
  
  useEffect(() => {
    setTitle(task.title);
    if (taskBlocks.length > 0) {
        setContent(taskBlocks[0].content);
    } else {
        setContent('');
    }
  }, [task, taskBlocks]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    updateTask(task.id, { title: e.target.value });
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    updateBlocks(task.id, [{
        id: 'block-' + task.id,
        task_id: task.id,
        type: 'doc',
        content: newContent,
        sort_order: 0,
        updated_at: Date.now(),
        is_dirty: true
    }]);
  };

  const handleSetDate = (date: Date | undefined) => {
      updateTask(task.id, { due_date: date ? date.toISOString() : undefined });
  };

  const handleSetPriority = (priority: TaskPriority) => {
      updateTask(task.id, { priority });
  };

  const handleSetStatus = (status: TaskStatus) => {
      updateTask(task.id, { status });
  };

  const handleDelete = () => {
      deleteTask(task.id);
      onClose();
  };

  const getStatusIcon = (status: TaskStatus) => {
      switch (status) {
          case 'not-started': return <Circle className="w-5 h-5 text-white/40" />;
          case 'in-progress': return <PlayCircle className="w-5 h-5 text-blue-400" />;
          case 'waiting': return <Clock className="w-5 h-5 text-yellow-400" />;
          case 'on-hold': return <PauseCircle className="w-5 h-5 text-purple-400" />;
          case 'done': return <Check className="w-5 h-5 text-emerald-400" />;
          case 'canceled': return <XCircle className="w-5 h-5 text-red-400" />;
          default: return <Circle className="w-5 h-5 text-white/40" />;
      }
  };

  const getStatusLabel = (status: TaskStatus) => {
      switch (status) {
          case 'not-started': return 'Not Started';
          case 'in-progress': return 'In Progress';
          case 'waiting': return 'Waiting';
          case 'on-hold': return 'On Hold';
          case 'done': return 'Done';
          case 'canceled': return 'Canceled';
          default: return 'Not Started';
      }
  };

  const formatDateDisplay = (dateStr: string) => {
      const date = new Date(dateStr);
      const now = new Date();
      if (isSameYear(date, now)) {
          return format(date, 'MMM d, HH:mm');
      }
      return format(date, 'MMM d, yyyy HH:mm');
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[500px] translate-x-[-50%] translate-y-[-50%] rounded-2xl bg-[#1C1C1E] border border-white/10 shadow-2xl z-50 flex flex-col focus:outline-none animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between p-5 pb-2 shrink-0">
            <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest">Details</h2>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-2 space-y-6 custom-scrollbar">
            
            {/* Title & Status */}
            <div className="flex items-start gap-4">
                 <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                        <button className="mt-1 hover:bg-white/10 rounded-full p-0.5 transition-colors shrink-0">
                            {getStatusIcon(task.status)}
                        </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                        <DropdownMenu.Content className="bg-[#2C2C2E] border border-white/10 rounded-xl p-1.5 shadow-2xl z-[60] min-w-[180px] text-white animate-in fade-in zoom-in-95 duration-100">
                            <div className="px-2 py-1.5 text-[10px] uppercase text-white/40 font-bold tracking-wider">Status</div>
                            <DropdownMenu.Item onSelect={() => handleSetStatus('not-started')} className="flex items-center px-2 py-2 text-sm hover:bg-blue-500/20 hover:text-blue-200 rounded-lg cursor-pointer outline-none transition-colors">
                                <Circle className="w-4 h-4 mr-3 text-white/40" /> Not started
                            </DropdownMenu.Item>
                            <DropdownMenu.Item onSelect={() => handleSetStatus('in-progress')} className="flex items-center px-2 py-2 text-sm hover:bg-blue-500/20 hover:text-blue-200 rounded-lg cursor-pointer outline-none transition-colors">
                                <PlayCircle className="w-4 h-4 mr-3 text-blue-400" /> In progress
                            </DropdownMenu.Item>
                            <DropdownMenu.Item onSelect={() => handleSetStatus('waiting')} className="flex items-center px-2 py-2 text-sm hover:bg-blue-500/20 hover:text-blue-200 rounded-lg cursor-pointer outline-none transition-colors">
                                <Clock className="w-4 h-4 mr-3 text-yellow-400" /> Waiting for
                            </DropdownMenu.Item>
                            <DropdownMenu.Item onSelect={() => handleSetStatus('on-hold')} className="flex items-center px-2 py-2 text-sm hover:bg-blue-500/20 hover:text-blue-200 rounded-lg cursor-pointer outline-none transition-colors">
                                <PauseCircle className="w-4 h-4 mr-3 text-purple-400" /> On hold
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator className="h-px bg-white/10 my-1" />
                            <DropdownMenu.Item onSelect={() => handleSetStatus('done')} className="flex items-center px-2 py-2 text-sm hover:bg-blue-500/20 hover:text-blue-200 rounded-lg cursor-pointer outline-none transition-colors">
                                <Check className="w-4 h-4 mr-3 text-emerald-400" /> Done
                            </DropdownMenu.Item>
                            <DropdownMenu.Item onSelect={() => handleSetStatus('canceled')} className="flex items-center px-2 py-2 text-sm hover:bg-blue-500/20 hover:text-blue-200 rounded-lg cursor-pointer outline-none transition-colors">
                                <XCircle className="w-4 h-4 mr-3 text-red-400" /> Canceled
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>

                <input
                    value={title}
                    onChange={handleTitleChange}
                    className="w-full bg-transparent text-2xl font-bold text-white placeholder:text-white/20 focus:outline-none leading-tight mt-0.5"
                    placeholder="Title"
                />
            </div>

            {/* Notes */}
            <div className="min-h-[120px] bg-[#2C2C2E] rounded-xl border border-white/5 focus-within:border-white/20 transition-colors overflow-hidden">
                <Editor content={content} onChange={handleContentChange} />
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
                            <button className={cn(
                                "text-sm px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors",
                                task.due_date ? "text-blue-400 bg-blue-400/10" : "text-white/30"
                            )}>
                                {task.due_date ? formatDateDisplay(task.due_date) : 'Add Date'}
                            </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                            <DropdownMenu.Content className="bg-[#2C2C2E] border border-white/10 rounded-xl p-1.5 shadow-2xl z-[60] min-w-[200px] text-white animate-in fade-in zoom-in-95 duration-100">
                                <DropdownMenu.Item onSelect={() => handleSetDate(startOfToday())} className="flex justify-between items-center px-3 py-2 text-sm hover:bg-white/10 rounded-lg cursor-pointer outline-none">
                                    <span>Today</span>
                                    <span className="text-white/30 text-xs">{format(startOfToday(), 'EEE')}</span>
                                </DropdownMenu.Item>
                                <DropdownMenu.Item onSelect={() => handleSetDate(startOfTomorrow())} className="flex justify-between items-center px-3 py-2 text-sm hover:bg-white/10 rounded-lg cursor-pointer outline-none">
                                    <span>Tomorrow</span>
                                    <span className="text-white/30 text-xs">{format(startOfTomorrow(), 'EEE')}</span>
                                </DropdownMenu.Item>
                                <DropdownMenu.Item onSelect={() => handleSetDate(addDays(new Date(), 7))} className="flex justify-between items-center px-3 py-2 text-sm hover:bg-white/10 rounded-lg cursor-pointer outline-none">
                                    <span>Next Week</span>
                                    <span className="text-white/30 text-xs">{format(addDays(new Date(), 7), 'MMM d')}</span>
                                </DropdownMenu.Item>
                                <DropdownMenu.Separator className="h-px bg-white/10 my-1" />
                                <DropdownMenu.Item 
                                    onSelect={(e) => {
                                        e.preventDefault();
                                        dateInputRef.current?.showPicker();
                                    }} 
                                    className="flex justify-between items-center px-3 py-2 text-sm hover:bg-white/10 rounded-lg cursor-pointer outline-none"
                                >
                                    <span>Custom...</span>
                                </DropdownMenu.Item>
                                {task.due_date && (
                                    <>
                                        <DropdownMenu.Separator className="h-px bg-white/10 my-1" />
                                        <DropdownMenu.Item onSelect={() => handleSetDate(undefined)} className="flex justify-between items-center px-3 py-2 text-sm hover:bg-red-500/20 text-red-400 rounded-lg cursor-pointer outline-none">
                                            <span>Clear Date</span>
                                        </DropdownMenu.Item>
                                    </>
                                )}
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                    <input 
                        type="datetime-local" 
                        ref={dateInputRef} 
                        className="hidden" 
                        onChange={(e) => {
                            if (e.target.value) {
                                handleSetDate(new Date(e.target.value));
                            }
                        }}
                    />
                </div>

                {/* Priority */}
                <div className="flex items-center justify-between p-3.5 hover:bg-white/5 transition-colors group">
                    <div className="flex items-center text-sm font-medium text-white">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center mr-3 text-orange-400 group-hover:scale-110 transition-transform">
                            <Flag className="w-4 h-4" />
                        </div>
                        Priority
                    </div>
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                            <button className={cn(
                                "text-sm px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors capitalize",
                                task.priority !== 'none' ? "text-orange-400 bg-orange-400/10" : "text-white/30"
                            )}>
                                {task.priority}
                            </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                            <DropdownMenu.Content className="bg-[#2C2C2E] border border-white/10 rounded-xl p-1.5 shadow-2xl z-[60] min-w-[150px] text-white animate-in fade-in zoom-in-95 duration-100">
                                <DropdownMenu.Item onSelect={() => handleSetPriority('none')} className="px-3 py-2 text-sm hover:bg-white/10 rounded-lg cursor-pointer outline-none">None</DropdownMenu.Item>
                                <DropdownMenu.Item onSelect={() => handleSetPriority('low')} className="px-3 py-2 text-sm hover:bg-white/10 rounded-lg cursor-pointer outline-none text-blue-400">Low (!)</DropdownMenu.Item>
                                <DropdownMenu.Item onSelect={() => handleSetPriority('medium')} className="px-3 py-2 text-sm hover:bg-white/10 rounded-lg cursor-pointer outline-none text-orange-400">Medium (!!)</DropdownMenu.Item>
                                <DropdownMenu.Item onSelect={() => handleSetPriority('high')} className="px-3 py-2 text-sm hover:bg-white/10 rounded-lg cursor-pointer outline-none text-red-400">High (!!!)</DropdownMenu.Item>
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                </div>

                {/* Status Row */}
                <div className="flex items-center justify-between p-3.5 hover:bg-white/5 transition-colors group">
                    <div className="flex items-center text-sm font-medium text-white">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center mr-3 text-blue-400 group-hover:scale-110 transition-transform">
                            <Circle className="w-4 h-4" />
                        </div>
                        Status
                    </div>
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                            <button className="text-sm px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors text-white/60 hover:text-white flex items-center gap-2">
                                {getStatusLabel(task.status)}
                                <ChevronRight className="w-3 h-3 opacity-50" />
                            </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                            <DropdownMenu.Content className="bg-[#2C2C2E] border border-white/10 rounded-xl p-1.5 shadow-2xl z-[60] min-w-[180px] text-white animate-in fade-in zoom-in-95 duration-100">
                                <div className="px-2 py-1.5 text-[10px] uppercase text-white/40 font-bold tracking-wider">Status</div>
                                <DropdownMenu.Item onSelect={() => handleSetStatus('not-started')} className="flex items-center px-2 py-2 text-sm hover:bg-white/10 rounded-lg cursor-pointer outline-none">
                                    <Circle className="w-4 h-4 mr-3 text-white/40" /> Not started
                                </DropdownMenu.Item>
                                <DropdownMenu.Item onSelect={() => handleSetStatus('in-progress')} className="flex items-center px-2 py-2 text-sm hover:bg-white/10 rounded-lg cursor-pointer outline-none">
                                    <PlayCircle className="w-4 h-4 mr-3 text-blue-400" /> In progress
                                </DropdownMenu.Item>
                                <DropdownMenu.Item onSelect={() => handleSetStatus('waiting')} className="flex items-center px-2 py-2 text-sm hover:bg-white/10 rounded-lg cursor-pointer outline-none">
                                    <Clock className="w-4 h-4 mr-3 text-yellow-400" /> Waiting for
                                </DropdownMenu.Item>
                                <DropdownMenu.Item onSelect={() => handleSetStatus('on-hold')} className="flex items-center px-2 py-2 text-sm hover:bg-white/10 rounded-lg cursor-pointer outline-none">
                                    <PauseCircle className="w-4 h-4 mr-3 text-purple-400" /> On hold
                                </DropdownMenu.Item>
                                <DropdownMenu.Separator className="h-px bg-white/10 my-1" />
                                <DropdownMenu.Item onSelect={() => handleSetStatus('done')} className="flex items-center px-2 py-2 text-sm hover:bg-white/10 rounded-lg cursor-pointer outline-none">
                                    <Check className="w-4 h-4 mr-3 text-emerald-400" /> Done
                                </DropdownMenu.Item>
                                <DropdownMenu.Item onSelect={() => handleSetStatus('canceled')} className="flex items-center px-2 py-2 text-sm hover:bg-white/10 rounded-lg cursor-pointer outline-none">
                                    <XCircle className="w-4 h-4 mr-3 text-red-400" /> Canceled
                                </DropdownMenu.Item>
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
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
