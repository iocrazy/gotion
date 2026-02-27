import { useState } from 'react';
import { useGotionStore, TaskStatus } from '@/app/store/gotionStore';
import { Check, Info, Calendar, Flag, Circle, XCircle, Clock, PauseCircle, PlayCircle } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { format, isSameYear } from 'date-fns';
import { TaskDetailPanel } from './TaskDetailPanel';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface TaskItemProps {
  task: any;
}

export function TaskItem({ task }: TaskItemProps) {
  const { toggleTaskStatus, updateTask, blocks } = useGotionStore();
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const handleToggle = () => {
    toggleTaskStatus(task.id);
  };

  const handleStatusChange = (status: TaskStatus) => {
      updateTask(task.id, { status });
  };

  const taskBlocks = blocks[task.id] || [];
  
  const getPreviewText = () => {
      if (!taskBlocks.length) return '';
      try {
          const json = JSON.parse(taskBlocks[0].content);
          if (json.content && json.content.length > 0) {
              const firstNode = json.content[0];
              if (firstNode.content && firstNode.content.length > 0) {
                  return firstNode.content[0].text || '';
              }
          }
      } catch (e) {
          return '';
      }
      return '';
  };
  
  const previewText = getPreviewText();

  const formatDateDisplay = (dateStr: string) => {
      const date = new Date(dateStr);
      const now = new Date();
      if (isSameYear(date, now)) {
          return format(date, 'MMM d');
      }
      return format(date, 'MMM d, yyyy');
  };

  const priorityColor = {
      low: 'text-blue-400',
      medium: 'text-orange-400',
      high: 'text-red-400',
      none: 'text-transparent'
  };

  const isComplete = task.status === 'done' || task.status === 'canceled';

  const StatusIcon = () => {
      switch (task.status) {
          case 'done': return <Check className="w-3 h-3 text-white" />;
          case 'canceled': return <XCircle className="w-3 h-3 text-white" />;
          case 'in-progress': return <PlayCircle className="w-3 h-3 text-blue-400" />;
          case 'waiting': return <Clock className="w-3 h-3 text-yellow-400" />;
          case 'on-hold': return <PauseCircle className="w-3 h-3 text-purple-400" />;
          default: return null;
      }
  };

  const getStatusBorderColor = () => {
      switch (task.status) {
          case 'done': return "bg-emerald-500 border-emerald-500";
          case 'canceled': return "bg-red-500 border-red-500";
          case 'in-progress': return "border-blue-400";
          case 'waiting': return "border-yellow-400";
          case 'on-hold': return "border-purple-400";
          default: return "border-white/30 hover:border-white/60";
      }
  };

  return (
    <>
    <div className="group border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
      <div className="flex items-start py-1.5 px-3 cursor-default">
        {/* Status Dropdown Trigger */}
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <button
                onClick={(e) => { e.stopPropagation(); }}
                className={cn(
                    "mt-0.5 w-4 h-4 rounded-full border mr-3 flex items-center justify-center transition-all shrink-0",
                    getStatusBorderColor()
                )}
                >
                <StatusIcon />
                </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content className="bg-zinc-800 border border-white/10 rounded-lg p-1 shadow-xl z-50 min-w-[160px] text-white">
                    <div className="px-2 py-1 text-[10px] uppercase text-white/40 font-bold">To-do</div>
                    <DropdownMenu.Item onSelect={() => handleStatusChange('not-started')} className="flex items-center px-2 py-1.5 text-xs hover:bg-white/10 rounded cursor-pointer">
                        <Circle className="w-3 h-3 mr-2 text-white/40" /> Not started
                    </DropdownMenu.Item>
                    
                    <div className="px-2 py-1 text-[10px] uppercase text-white/40 font-bold mt-1">In Progress</div>
                    <DropdownMenu.Item onSelect={() => handleStatusChange('in-progress')} className="flex items-center px-2 py-1.5 text-xs hover:bg-white/10 rounded cursor-pointer">
                        <PlayCircle className="w-3 h-3 mr-2 text-blue-400" /> In progress
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onSelect={() => handleStatusChange('waiting')} className="flex items-center px-2 py-1.5 text-xs hover:bg-white/10 rounded cursor-pointer">
                        <Clock className="w-3 h-3 mr-2 text-yellow-400" /> Waiting for
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onSelect={() => handleStatusChange('on-hold')} className="flex items-center px-2 py-1.5 text-xs hover:bg-white/10 rounded cursor-pointer">
                        <PauseCircle className="w-3 h-3 mr-2 text-purple-400" /> On hold
                    </DropdownMenu.Item>

                    <div className="px-2 py-1 text-[10px] uppercase text-white/40 font-bold mt-1">Complete</div>
                    <DropdownMenu.Item onSelect={() => handleStatusChange('done')} className="flex items-center px-2 py-1.5 text-xs hover:bg-white/10 rounded cursor-pointer">
                        <Check className="w-3 h-3 mr-2 text-emerald-400" /> Done
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onSelect={() => handleStatusChange('canceled')} className="flex items-center px-2 py-1.5 text-xs hover:bg-white/10 rounded cursor-pointer">
                        <XCircle className="w-3 h-3 mr-2 text-red-400" /> Canceled
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
        
        {/* Content */}
        <div className="flex-1 min-w-0 mr-2" onClick={() => setIsDetailOpen(true)}>
          <div className={cn(
            "text-sm text-white/90 truncate leading-tight",
            isComplete && "line-through text-white/50"
          )}>
            {task.priority !== 'none' && (
                <span className={cn("mr-1 font-bold", priorityColor[task.priority as keyof typeof priorityColor])}>
                    {task.priority === 'high' ? '!!!' : task.priority === 'medium' ? '!!' : '!'}
                </span>
            )}
            {task.title}
          </div>
          
          {previewText && (
              <div className="text-[10px] text-white/40 truncate mt-0.5 leading-tight">
                  {previewText}
              </div>
          )}

          {/* Metadata Row */}
          {(task.due_date) && (
            <div className="flex items-center gap-2 mt-0.5">
                <div className={cn("flex items-center text-[10px]", isComplete ? "text-white/30" : "text-red-400")}>
                    {formatDateDisplay(task.due_date)}
                </div>
            </div>
          )}
        </div>

        {/* Info Button */}
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
                onClick={(e) => { e.stopPropagation(); setIsDetailOpen(true); }}
                className="p-0.5 hover:bg-white/10 rounded-full text-blue-400 transition-colors"
            >
                <Info className="w-4 h-4" />
            </button>
        </div>
      </div>
    </div>

    <TaskDetailPanel 
        task={task} 
        isOpen={isDetailOpen} 
        onClose={() => setIsDetailOpen(false)} 
    />
    </>
  );
}
