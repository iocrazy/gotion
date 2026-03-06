import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimation, PanInfo, useMotionValue, useTransform } from 'motion/react';
import { Circle, CheckCircle2, Trash2, Bell, Repeat, Flag, Star, BellOff, Calendar, Hourglass, RefreshCw } from 'lucide-react';

const SubtaskIcon = ({ size = 14, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="7" cy="5" r="2" fill="currentColor" />
    <path d="M7 7v12h10" />
    <path d="M7 13h10" />
  </svg>
);

export function TaskItem({ task, onComplete, onToggleStar, onDelete, onClick }: { key?: React.Key, task: any, onComplete: (isCompleted: boolean) => void, onToggleStar?: () => void, onDelete?: () => void, onClick: () => void }) {
  const [isCompleted, setIsCompleted] = useState(task.completed || false);
  const controls = useAnimation();
  const dragRef = useRef(false);
  const x = useMotionValue(0);

  const scaleTrash = useTransform(x, [0, -56], [0, 1]);
  const scaleHourglass = useTransform(x, [-46, -104], [0, 1]);
  const scaleCalendar = useTransform(x, [-94, -152], [0, 1]);
  const scaleBellOff = useTransform(x, [-142, -200], [0, 1]);
  const scaleStar = useTransform(x, [-190, -248], [0, 1]);

  useEffect(() => {
    setIsCompleted(task.completed);
  }, [task.completed]);

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newCompletedState = !isCompleted;
    setIsCompleted(newCompletedState);
    setTimeout(() => {
      onComplete(newCompletedState);
    }, 600);
  };

  const handleDragStart = () => {
    dragRef.current = true;
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setTimeout(() => {
      dragRef.current = false;
    }, 100);
    
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset < -100 || velocity < -500) {
      controls.start({ x: -280 });
    } else {
      controls.start({ x: 0 });
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!dragRef.current) {
      onClick();
    }
  };

  const handleToggleStar = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleStar) onToggleStar();
    controls.start({ x: 0 }); // Close the swipe menu
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete();
    controls.start({ x: 0 }); // Close the swipe menu
  };

  return (
    <div className="relative mb-3">
      {/* Background Actions */}
      <div className="absolute inset-0 flex items-center justify-end pr-2 gap-2 bg-[#F5F6F8] rounded-2xl overflow-hidden">
        <motion.button 
          style={{ scale: scaleStar }}
          onClick={handleToggleStar}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors ${task.starred ? 'bg-yellow-400' : 'bg-red-200'}`}
        >
          <Star size={18} className={task.starred ? "fill-white" : ""} />
        </motion.button>
        <motion.button 
          style={{ scale: scaleBellOff }}
          className="w-10 h-10 bg-red-300 rounded-full flex items-center justify-center text-white">
          <BellOff size={18} />
        </motion.button>
        <motion.button 
          style={{ scale: scaleCalendar }}
          className="w-10 h-10 bg-red-400 rounded-full flex items-center justify-center text-white">
          <Calendar size={18} />
        </motion.button>
        <motion.button 
          style={{ scale: scaleHourglass }}
          className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white">
          <Hourglass size={18} />
        </motion.button>
        <motion.button 
          style={{ scale: scaleTrash }}
          onClick={handleDelete}
          className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white"
        >
          <Trash2 size={18} />
        </motion.button>
      </div>

      {/* Foreground Task */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -280, right: 0 }}
        dragElastic={0.1}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        animate={controls}
        className="relative bg-white rounded-2xl p-4 flex items-start gap-3 shadow-sm cursor-pointer"
        onClick={handleClick}
      >
        <button className="mt-0.5 text-gray-300 relative" onClick={handleComplete}>
          {isCompleted ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <CheckCircle2 size={24} className="text-gray-400 fill-gray-200" />
            </motion.div>
          ) : (
            <Circle size={24} strokeWidth={1.5} />
          )}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {!isCompleted && (
              <button onClick={handleDelete} className="text-blue-500 hover:text-blue-600 transition-colors">
                <Trash2 size={16} />
              </button>
            )}
            <span className={`font-medium ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
              {task.title}
            </span>
            {task.starred && <Star size={14} className="fill-yellow-400 text-yellow-400" />}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {(task.date || task.time || task.times) && (
              <span className="text-[#D31F26] font-medium text-[13px]">
                {task.date ? `${task.date} ` : ''}{task.time || ''}{task.times ? ` ${task.times}` : ''}
              </span>
            )}
            {task.repeat && <RefreshCw size={14} className="text-gray-300" />}
            {task.subtasks && task.subtasks.length > 0 && (
              <div className="flex items-center gap-1 text-gray-400">
                <SubtaskIcon size={14} className="text-gray-400" />
                <span className="text-[13px]">{task.subtasks.filter((st: any) => st.done).length}/{task.subtasks.length}</span>
              </div>
            )}
          </div>
        </div>
        <button className="text-gray-300">
          <Flag size={20} strokeWidth={1.5} />
        </button>
      </motion.div>
    </div>
  );
}
