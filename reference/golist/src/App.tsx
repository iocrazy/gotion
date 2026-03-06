import React, { useState, useRef, useEffect } from 'react';
import { Menu, Search, MoreHorizontal, Plus, Calendar as CalendarIcon, User, CheckCircle2, Circle, Flag, Clock, Bell, Repeat, ListTree, Target, Settings, ChevronRight, ChevronLeft, Trash2, Grid2X2, Lightbulb, Folder, Briefcase, Coffee, Heart, Cake, X, LayoutGrid, Monitor, ClipboardList, Clapperboard, ShoppingCart, Book, Plane, Utensils, Check, ListChecks, CornerDownRight, ArrowDownUp, Crown, ChevronDown, ChevronUp, Star, Shirt, Layout, Cloud, HelpCircle, MessageSquare, Share, Facebook, Paperclip, FileText, Copy, Hourglass, ListFilter } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate, useMotionValueEvent } from 'motion/react';

type View = 'tasks' | 'calendar' | 'mine' | 'starred';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('tasks');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [tasks, setTasks] = useState([
    { id: 1, title: '任务一', date: '03/01', time: '13:37', repeat: true, section: 'Today', originalSection: 'Today', completed: false, starred: false, subtasks: [{ id: 1, text: '你好', done: false }, { id: 2, text: '你好', done: false }] },
    { id: 2, title: 'Drink water, keep healthy', date: '03/02', times: '0/4 Times', section: 'Future', originalSection: 'Future', completed: false, starred: false },
    { id: 3, title: "It's time to drink water", date: '03/02', times: '0/4 Times', section: 'Future', originalSection: 'Future', completed: false, starred: false },
    { id: 4, title: 'Drink water, keep healthy', times: '1/4 Times', section: 'Completed Today', originalSection: 'Today', completed: true, starred: false },
    { id: 5, title: '啦啦啦啦啦', section: 'Completed Today', originalSection: 'Today', completed: true, starred: false },
    { id: 6, title: '你好，能不能给我提示', section: 'Completed Today', originalSection: 'Today', completed: true, starred: false },
  ]);

  const handleComplete = (id: number, isCompleted: boolean) => {
    setTasks(prev => prev.map(task => {
      if (task.id === id) {
        return { 
          ...task, 
          completed: isCompleted, 
          section: isCompleted ? 'Completed Today' : (task.originalSection || 'Today') 
        };
      }
      return task;
    }));
  };

  const handleUpdateTask = (id: number, updates: any) => {
    setTasks(prev => prev.map(task => task.id === id ? { ...task, ...updates } : task));
  };

  const handleToggleStar = (id: number) => {
    setTasks(prev => prev.map(task => task.id === id ? { ...task, starred: !task.starred } : task));
  };

  const handleDeleteTask = (id: number) => {
    setTasks(prev => prev.filter(task => task.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      <div className="w-full max-w-md bg-[#F5F6F8] h-screen flex flex-col relative shadow-xl overflow-hidden">
        {currentView === 'tasks' && <TasksView tasks={tasks} onComplete={handleComplete} onToggleStar={handleToggleStar} onDeleteTask={handleDeleteTask} onAdd={() => setIsAddingTask(true)} onSearch={() => setIsSearching(true)} onTaskClick={setSelectedTask} onCreateCategory={() => setShowCreateCategory(true)} onMenuClick={() => setIsSidebarOpen(true)} />}
        {currentView === 'calendar' && <CalendarView onSearch={() => setIsSearching(true)} onTaskClick={setSelectedTask} onMenuClick={() => setIsSidebarOpen(true)} />}
        {currentView === 'mine' && <MineView onSettingsClick={() => setShowSettings(true)} />}
        {currentView === 'starred' && <StarredTasksView tasks={tasks} onComplete={handleComplete} onToggleStar={handleToggleStar} onDeleteTask={handleDeleteTask} onTaskClick={setSelectedTask} onBack={() => setCurrentView('tasks')} />}

        {/* Bottom Navigation */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-lg px-6 py-3 flex items-center gap-8 z-10">
          <button 
            onClick={() => setCurrentView('tasks')}
            className={`flex flex-col items-center gap-1 ${currentView === 'tasks' ? 'text-blue-500' : 'text-gray-400'}`}
          >
            <div className={`p-1 rounded-lg ${currentView === 'tasks' ? 'bg-blue-50' : ''}`}>
              <div className="w-5 h-5 border-2 border-current rounded-sm flex flex-col gap-0.5 p-0.5">
                <div className="h-1 bg-current rounded-sm w-full"></div>
                <div className="h-1 bg-current rounded-sm w-full"></div>
              </div>
            </div>
            <span className="text-[10px] font-medium">Tasks</span>
          </button>
          <button 
            onClick={() => setCurrentView('calendar')}
            className={`flex flex-col items-center gap-1 ${currentView === 'calendar' ? 'text-blue-500' : 'text-gray-400'}`}
          >
            <CalendarIcon size={24} strokeWidth={2} />
            <span className="text-[10px] font-medium">Calendar</span>
          </button>
          <button 
            onClick={() => setCurrentView('mine')}
            className={`flex flex-col items-center gap-1 ${currentView === 'mine' ? 'text-blue-500' : 'text-gray-400'}`}
          >
            <User size={24} strokeWidth={2} />
            <span className="text-[10px] font-medium">Mine</span>
          </button>
        </div>

        {/* Add Task Modal */}
        {isAddingTask && <AddTaskModal onClose={() => setIsAddingTask(false)} onCreateCategory={() => setShowCreateCategory(true)} />}
        
        {/* Search View */}
        {isSearching && <SearchView onClose={() => setIsSearching(false)} />}
        
        {/* Task Detail View */}
        {selectedTask && <TaskDetailView task={selectedTask} onClose={() => setSelectedTask(null)} onComplete={handleComplete} onUpdateTask={handleUpdateTask} />}
        
        {/* Settings View */}
        {showSettings && <SettingsView onClose={() => setShowSettings(false)} />}

        {/* Create Category Modal */}
        {showCreateCategory && <CreateCategoryModal onClose={() => setShowCreateCategory(false)} />}

        {/* Sidebar Menu */}
        <SidebarMenu isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} onSettingsClick={() => setShowSettings(true)} onStarredClick={() => { setIsSidebarOpen(false); setCurrentView('starred'); }} />
      </div>
    </div>
  );
}

function CreateCategoryModal({ onClose }: { onClose: () => void }) {
  const colors = [
    'bg-red-500', 'bg-purple-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-blue-500'
  ];
  const icons = [
    <Folder size={24} />, <Briefcase size={24} />, <Monitor size={24} />, <Cake size={24} />, <Coffee size={24} />, <ClipboardList size={24} />, <Heart size={24} />,
    <Clapperboard size={24} />, <ShoppingCart size={24} />, <Book size={24} />, <Flag size={24} />, <Plane size={24} />, <Utensils size={24} />, <CheckCircle2 size={24} />
  ];

  const [selectedColor, setSelectedColor] = useState(colors[0]);
  const [selectedIcon, setSelectedIcon] = useState(0);
  const [categoryName, setCategoryName] = useState('');

  return (
    <div className="absolute inset-0 bg-black/20 z-50 flex flex-col justify-end">
      <div className="bg-white rounded-t-3xl p-6 pb-12 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onClose} className="text-gray-400"><X size={24} /></button>
          <h2 className="text-lg font-semibold">Create New Category</h2>
          <button onClick={onClose} className="text-red-500"><Check size={24} /></button>
        </div>

        <div className="mb-6 relative">
          <input 
            type="text" 
            placeholder="Please input category" 
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value.slice(0, 50))}
            className="w-full bg-gray-50 rounded-xl px-4 py-4 outline-none text-gray-800 placeholder:text-gray-400"
            autoFocus
          />
          <span className="absolute right-4 bottom-4 text-xs text-gray-400">{categoryName.length}/50</span>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-1 mb-3">
            <span className="text-gray-500 text-sm">Color</span>
            <div className="w-3 h-3 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 text-[8px]">?</div>
          </div>
          <div className="flex items-center gap-4">
            {colors.map(color => (
              <button 
                key={color} 
                onClick={() => setSelectedColor(color)}
                className={`w-8 h-8 rounded-full ${color} relative flex items-center justify-center`}
              >
                {selectedColor === color && (
                  <div className="w-6 h-6 rounded-full border-2 border-white"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-gray-500 text-sm mb-3">Icon</div>
          <div className="grid grid-cols-7 gap-y-4 gap-x-2">
            {icons.map((icon, index) => (
              <button 
                key={index}
                onClick={() => setSelectedIcon(index)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  selectedIcon === index 
                    ? 'bg-red-100 text-red-500' 
                    : 'bg-gray-50 text-gray-300'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type SortOption = 'due_date' | 'creation_time' | 'alphabetical_az' | 'alphabetical_za' | 'manual' | 'flag_color';


function SearchView({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 bg-[#F5F6F8] z-50 flex flex-col animate-in fade-in duration-200">
      <div className="px-6 pt-12 pb-4 flex items-center gap-4 bg-white shadow-sm">
        <button onClick={onClose} className="text-gray-400"><ChevronLeft size={24} /></button>
        <div className="flex-1 bg-gray-100 rounded-full flex items-center px-4 py-2">
          <Search size={20} className="text-gray-400 mr-2" />
          <input type="text" placeholder="Search tasks..." className="bg-transparent outline-none w-full text-sm" autoFocus />
        </div>
      </div>
      <div className="flex-1 p-6 flex flex-col items-center justify-center text-gray-400">
        <Search size={48} className="mb-4 opacity-20" />
        <p>Type to search tasks</p>
      </div>
    </div>
  );
}

function TaskDetailView({ task, onClose, onComplete, onUpdateTask }: { task: any, onClose: () => void, onComplete: (id: number, isCompleted: boolean) => void, onUpdateTask: (id: number, updates: any) => void }) {
  const [activeModal, setActiveModal] = useState<'date' | 'reminder' | 'repeat' | 'category' | 'notes' | null>(null);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [subtasks, setSubtasks] = useState(task.subtasks || []);
  const [isDone, setIsDone] = useState(task.completed);

  // Sync subtasks to parent when they change
  useEffect(() => {
    onUpdateTask(task.id, { subtasks });
  }, [subtasks, task.id, onUpdateTask]);

  const handleToggleDone = (done: boolean) => {
    setIsDone(done);
    onComplete(task.id, done);
  };

  const handleAddSubtask = () => {
    setSubtasks([...subtasks, { id: Date.now(), text: '', done: false }]);
  };

  const updateSubtask = (id: number, text: string) => {
    setSubtasks(subtasks.map(st => st.id === id ? { ...st, text } : st));
  };

  const toggleSubtask = (id: number) => {
    setSubtasks(subtasks.map(st => st.id === id ? { ...st, done: !st.done } : st));
  };

  return (
    <div className={`absolute inset-0 z-50 flex flex-col animate-in slide-in-from-right duration-200 ${isDone ? 'bg-gray-200' : 'bg-[#F5F6F8]'}`}>
      <div className="px-6 pt-12 pb-4 flex items-center justify-between">
        <button onClick={onClose} className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${isDone ? 'bg-gray-100 text-gray-500' : 'bg-white text-gray-800'}`}>
          <ChevronLeft size={20} />
        </button>
        <button className={`flex items-center gap-1 font-medium ${isDone ? 'text-gray-500' : 'text-gray-400'}`} onClick={() => setActiveModal('category')}>
          No Category <ChevronDown size={16} />
        </button>
        <button className={`relative ${isDone ? 'text-gray-500' : 'text-gray-800'}`} onClick={() => setShowMoreOptions(true)}>
          <MoreHorizontal size={24} />
          {!isDone && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full"></span>}
        </button>
      </div>
      
      <div className={`flex-1 overflow-y-auto px-4 pb-6 space-y-4 ${isDone ? 'opacity-60 pointer-events-none' : ''}`}>
        <div className={`rounded-3xl p-6 shadow-sm min-h-[300px] flex flex-col ${isDone ? 'bg-gray-100' : 'bg-white'}`}>
          <input 
            type="text" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)}
            className={`text-2xl font-semibold mb-8 w-full bg-transparent outline-none ${isDone ? 'text-gray-500 line-through' : 'text-gray-800'}`}
          />
          
          <div className="space-y-4 mb-8 flex-1">
            {subtasks.map(st => (
              <div key={st.id} className="flex items-center gap-3">
                <button className={st.done ? "text-red-500" : "text-gray-300"} onClick={() => toggleSubtask(st.id)}>
                  {st.done ? <CheckCircle2 size={20} strokeWidth={1.5} /> : <Circle size={20} strokeWidth={1.5} />}
                </button>
                <input 
                  type="text" 
                  value={st.text} 
                  onChange={(e) => updateSubtask(st.id, e.target.value)}
                  className={`flex-1 bg-transparent outline-none ${st.done ? 'text-gray-400 line-through' : 'text-gray-800'}`}
                  placeholder="Sub-task"
                />
                <button className="text-gray-300">
                  <Menu size={20} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
          
          <button className="text-red-500 text-sm font-medium text-left w-max" onClick={handleAddSubtask}>
            + Add Sub-task
          </button>
        </div>
        
        <div className={`rounded-3xl overflow-hidden shadow-sm ${isDone ? 'bg-gray-100' : 'bg-white'}`}>
          <SettingItem icon={<CalendarIcon size={20} />} label="Due Date" right={<span className="text-gray-800 text-sm">03/01/2026</span>} hasBorder={false} onClick={() => setActiveModal('date')} />
        </div>

        <div className={`rounded-3xl overflow-hidden shadow-sm ${isDone ? 'bg-gray-100' : 'bg-white'}`}>
          <SettingItem icon={<FileText size={20} />} label="Notes" right={<span className="text-gray-400 text-sm">Add</span>} onClick={() => setActiveModal('notes')} />
          <SettingItem 
            icon={
              <div className="flex items-center gap-1">
                <Paperclip size={20} />
                <Crown size={12} className="text-yellow-500 fill-yellow-500" />
              </div>
            } 
            label="Attachment" 
            right={<span className="text-gray-400 text-sm">Add</span>} 
            hasBorder={false} 
          />
        </div>
      </div>

      {activeModal === 'date' && <DatePickerModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'reminder' && <ReminderAtModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'repeat' && <RepeatPickerModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'category' && <CategoryPickerModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'notes' && <NotesModal onClose={() => setActiveModal(null)} />}
      
      <AnimatePresence>
        {showMoreOptions && <TaskDetailMoreOptions isDone={isDone} setIsDone={handleToggleDone} onClose={() => setShowMoreOptions(false)} />}
      </AnimatePresence>
    </div>
  );
}

function NotesModal({ onClose }: { onClose: () => void }) {
  const [notes, setNotes] = useState('');

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 z-50"
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute bottom-0 left-0 right-0 top-12 bg-white rounded-t-3xl z-50 flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
          <button onClick={onClose} className="text-gray-400"><X size={24} /></button>
          <h2 className="text-lg font-semibold text-gray-800">Notes</h2>
          <button onClick={onClose} className="text-red-500"><Check size={24} /></button>
        </div>
        <div className="flex-1 p-6 flex flex-col">
          <textarea
            className="flex-1 bg-transparent resize-none outline-none text-gray-800 placeholder-gray-400"
            placeholder="Add Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={3000}
          />
          <div className="text-right text-xs text-gray-400 mt-2">
            {notes.length}/3000
          </div>
        </div>
      </motion.div>
    </>
  );
}

function TaskDetailMoreOptions({ isDone, setIsDone, onClose }: { isDone: boolean, setIsDone: (done: boolean) => void, onClose: () => void }) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 z-50"
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 overflow-hidden"
      >
        <div className="p-2">
          <div 
            className="flex items-center justify-between p-4 active:bg-gray-50 rounded-xl cursor-pointer border border-yellow-400 mb-2"
            onClick={() => setIsDone(!isDone)}
          >
            <div className="flex items-center gap-4">
              <CheckCircle2 size={24} className="text-gray-800" />
              <span className="text-gray-800 text-lg">Mark as done</span>
            </div>
            <div className={`w-12 h-7 rounded-full relative transition-colors ${isDone ? 'bg-red-500' : 'bg-gray-200'}`}>
              <div className={`w-6 h-6 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform ${isDone ? 'left-[22px]' : 'left-0.5'}`}></div>
            </div>
          </div>
          
          <button className="w-full flex items-center gap-4 p-4 active:bg-gray-50 rounded-xl text-left">
            <Copy size={24} className="text-gray-800" />
            <span className="text-gray-800 text-lg">Duplicate task</span>
          </button>
          
          <button className="w-full flex items-center gap-4 p-4 active:bg-gray-50 rounded-xl text-left">
            <div className="relative">
              <Hourglass size={24} className="text-gray-800" />
              <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
            </div>
            <span className="text-gray-800 text-lg">Focus</span>
          </button>
          
          <button className="w-full flex items-center gap-4 p-4 active:bg-gray-50 rounded-xl text-left">
            <Share size={24} className="text-gray-800" />
            <span className="text-gray-800 text-lg">Share</span>
          </button>
          
          <button className="w-full flex items-center gap-4 p-4 active:bg-gray-50 rounded-xl text-left">
            <Trash2 size={24} className="text-gray-800" />
            <span className="text-gray-800 text-lg">Delete</span>
          </button>
        </div>
        
        <div className="border-t border-gray-100 p-4">
          <button onClick={onClose} className="w-full py-3 text-center text-lg text-gray-800 font-medium">
            Cancel
          </button>
        </div>
      </motion.div>
    </>
  );
}

function DatePickerModal({ onClose }: { onClose: () => void }) {
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 z-50"
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute bottom-0 left-0 right-0 top-12 bg-[#F5F6F8] rounded-t-3xl z-50 flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 flex items-center justify-between bg-[#F5F6F8]">
          <button onClick={onClose} className="text-gray-400"><X size={24} /></button>
          <h2 className="text-lg font-semibold text-gray-800">Date & Time</h2>
          <button onClick={onClose} className="text-red-500"><Check size={24} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
          <div className="bg-white rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <button className="p-1"><ChevronLeft size={20} className="text-gray-800" /></button>
              <span className="font-medium text-lg text-gray-800">Mar, 2026</span>
              <button className="p-1"><ChevronRight size={20} className="text-gray-800" /></button>
            </div>
            
            <div className="grid grid-cols-7 gap-y-4 mb-6 text-center">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-xs text-gray-400 font-medium">{d}</div>
              ))}
              {Array.from({ length: 31 }).map((_, i) => (
                <div key={i} className={`text-sm py-2 flex items-center justify-center ${i + 1 === 1 ? 'bg-red-500 text-white rounded-full w-8 h-8 mx-auto' : 'text-gray-700'}`}>
                  {i + 1}
                </div>
              ))}
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`next-${i}`} className="text-sm py-2 text-gray-300">
                  {i + 1}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="px-4 py-2 bg-[#F5F6F8] rounded-full text-sm text-gray-400">No Date</button>
              <button className="px-4 py-2 bg-red-100 text-red-500 rounded-full text-sm font-medium">Today</button>
              <button className="px-4 py-2 bg-[#F5F6F8] rounded-full text-sm text-gray-400">Tomorrow</button>
              <button className="px-4 py-2 bg-[#F5F6F8] rounded-full text-sm text-gray-400">This Sunday</button>
              <button className="px-4 py-2 bg-[#F5F6F8] rounded-full text-sm text-gray-400">3 Days Later</button>
            </div>
          </div>

          <div className="bg-white rounded-3xl overflow-hidden shadow-sm">
            <SettingItem icon={<Clock size={20} />} label="Time" right={<span className="text-gray-800 text-sm">13:37</span>} onClick={() => setShowTimePicker(true)} />
            <SettingItem icon={<Bell size={20} />} label="Reminder at" right={<span className="text-gray-800 text-sm">No</span>} onClick={() => setShowReminderPicker(true)} />
            <SettingItem icon={<Repeat size={20} />} label="Repeat" right={<span className="text-gray-800 text-sm">No</span>} hasBorder={false} />
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showTimePicker && <SetTimeModal onClose={() => setShowTimePicker(false)} />}
        {showReminderPicker && <ReminderAtModal onClose={() => setShowReminderPicker(false)} />}
      </AnimatePresence>
    </>
  );
}

function TimePickerColumn({ items, value, onChange }: { items: string[], value: string, onChange: (val: string) => void }) {
  const itemHeight = 40;
  const y = useMotionValue(0);

  useEffect(() => {
    const index = items.indexOf(value);
    if (index !== -1) {
      const targetY = -index * itemHeight;
      if (Math.abs(y.get() - targetY) > itemHeight / 2) {
        animate(y, targetY, { type: 'spring', stiffness: 300, damping: 30 });
      }
    }
  }, [value, items, itemHeight, y]);

  useMotionValueEvent(y, "change", (latest) => {
    const index = Math.round(-latest / itemHeight);
    const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
    if (items[clampedIndex] !== value) {
      onChange(items[clampedIndex]);
    }
  });

  return (
    <div className="h-[200px] overflow-hidden w-20 relative touch-none">
      <motion.div
        drag="y"
        dragConstraints={{
          top: -(items.length - 1) * itemHeight,
          bottom: 0
        }}
        dragTransition={{
          power: 0.2,
          timeConstant: 300,
          modifyTarget: (target) => Math.round(target / itemHeight) * itemHeight
        }}
        style={{ y }}
        className="pt-[80px] pb-[80px] cursor-grab active:cursor-grabbing"
      >
        {items.map((item, i) => (
          <div 
            key={i} 
            className={`h-[40px] flex items-center justify-center transition-colors duration-200 ${item === value ? 'text-gray-800 font-medium text-xl' : 'text-gray-300 text-lg'}`}
            onClick={() => onChange(item)}
          >
            {item}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function SetTimeModal({ onClose }: { onClose: () => void }) {
  const [hour, setHour] = useState('13');
  const [minute, setMinute] = useState('37');

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  const quickTimes = [
    'No time', '07:00', '09:00', '10:00', '12:00',
    '14:00', '16:00', '18:00', '20:00', '22:00'
  ];

  const handleQuickTime = (time: string) => {
    if (time === 'No time') {
      onClose();
      return;
    }
    const [h, m] = time.split(':');
    setHour(h);
    setMinute(m);
  };

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
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[60] flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 flex items-center justify-between">
          <button onClick={onClose} className="text-gray-400"><X size={24} strokeWidth={1.5} /></button>
          <h2 className="text-lg font-semibold text-gray-800">Set Time</h2>
          <button onClick={onClose} className="text-red-500"><Check size={24} strokeWidth={1.5} /></button>
        </div>
        
        <div className="py-4 flex justify-center items-center relative h-56">
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-10 bg-gray-100 rounded-xl -z-10" />
          <div className="flex gap-12 text-center text-xl">
            <TimePickerColumn items={hours} value={hour} onChange={setHour} />
            <TimePickerColumn items={minutes} value={minute} onChange={setMinute} />
          </div>
        </div>

        <div className="px-6 pb-8">
          <div className="flex flex-wrap gap-2 justify-center">
            {quickTimes.map(time => (
              <button 
                key={time}
                onClick={() => handleQuickTime(time)}
                className="px-4 py-2 bg-[#F5F6F8] rounded-full text-sm text-gray-600 font-medium hover:bg-gray-200 transition-colors"
              >
                {time}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </>
  );
}

function ReminderAtModal({ onClose }: { onClose: () => void }) {
  const [isReminderOn, setIsReminderOn] = useState(false);
  const [isEnhancedOn, setIsEnhancedOn] = useState(false);
  const [selectedOption, setSelectedOption] = useState('Same with due date');

  const reminderOptions = [
    'Same with due date',
    '5 minutes before',
    '15 minutes before',
    '30 minutes before',
    '1 day before',
    '2 days before',
  ];

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
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[60] flex flex-col overflow-hidden max-h-[90vh]"
      >
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-50">
          <button onClick={onClose} className="text-gray-400"><X size={24} strokeWidth={1.5} /></button>
          <h2 className="text-lg font-semibold text-gray-800">Reminder at</h2>
          <button onClick={onClose} className="text-red-500"><Check size={24} strokeWidth={1.5} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto pb-8">
          <div className="px-6 py-4 flex items-center justify-between border-b border-gray-50">
            <span className="text-gray-800 text-[15px]">Reminder is off</span>
            <Toggle active={isReminderOn} onClick={() => setIsReminderOn(!isReminderOn)} />
          </div>

          <div className="px-6 py-2">
            {reminderOptions.map(opt => (
              <button 
                key={opt}
                onClick={() => setSelectedOption(opt)}
                className="w-full py-3.5 flex items-center gap-4 text-left"
              >
                <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedOption === opt ? 'border-red-500 bg-red-500' : 'border-gray-300'}`}>
                  {selectedOption === opt && <Check size={14} className="text-white" strokeWidth={3} />}
                </div>
                <span className="text-gray-500 text-[15px]">{opt}</span>
              </button>
            ))}
            
            <button className="w-full py-3.5 flex items-center gap-4 text-left">
              <div className="w-5 h-5 rounded border border-gray-300" />
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-[15px]">Customize</span>
                <Crown size={14} className="text-orange-400 fill-orange-400" />
              </div>
            </button>
          </div>

          <div className="px-6 py-4 border-t border-gray-50">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-[15px]">Enhanced Reminder</span>
                <Crown size={14} className="text-orange-400 fill-orange-400" />
              </div>
              <Toggle active={isEnhancedOn} onClick={() => setIsEnhancedOn(!isEnhancedOn)} />
            </div>
            <p className="text-xs text-gray-400 pr-12">If enabled, task will be strongly and constantly reminded</p>
          </div>

          <div className="px-6 py-4 border-t border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-[15px]">Ringtone</span>
              <Crown size={14} className="text-orange-400 fill-orange-400" />
            </div>
            <div className="flex items-center gap-1 text-gray-400">
              <span className="text-sm">Default</span>
              <ChevronRight size={16} />
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

function RepeatPickerModal({ onClose }: { onClose: () => void }) {
  const options = ['None', 'Daily', 'Weekly', 'Monthly', 'Yearly'];
  return (
    <div className="absolute inset-0 bg-black/20 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="bg-white rounded-t-3xl p-6 pb-12 animate-in slide-in-from-bottom-full duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Repeat</h2>
          <button onClick={onClose} className="text-gray-400"><X size={24} /></button>
        </div>
        <div className="space-y-2">
          {options.map(opt => (
            <button 
              key={opt}
              onClick={onClose}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 rounded-xl transition-colors text-gray-700 font-medium"
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryPickerModal({ onClose }: { onClose: () => void }) {
  const categories = [
    { name: 'Inbox', icon: <Folder size={20} />, color: 'text-gray-500' },
    { name: 'Work', icon: <Briefcase size={20} />, color: 'text-blue-500' },
    { name: 'Personal', icon: <Coffee size={20} />, color: 'text-green-500' },
    { name: 'Wishlist', icon: <Heart size={20} />, color: 'text-purple-500' },
    { name: 'Birthday', icon: <Cake size={20} />, color: 'text-red-500' },
  ];

  return (
    <div className="absolute inset-0 bg-black/20 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="bg-white rounded-t-3xl p-6 pb-12 animate-in slide-in-from-bottom-full duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Select Category</h2>
          <button onClick={onClose} className="text-gray-400"><X size={24} /></button>
        </div>
        <div className="space-y-2">
          {categories.map(cat => (
            <button 
              key={cat.name}
              onClick={onClose}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <span className={cat.color}>{cat.icon}</span>
              <span className="text-gray-700 font-medium">{cat.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AddTaskModal({ onClose, onCreateCategory }: { onClose: () => void, onCreateCategory: () => void }) {
  const [showCategory, setShowCategory] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSubtask, setShowSubtask] = useState(false);
  const [category, setCategory] = useState('No Category');
  const [subtasks, setSubtasks] = useState<{id: number, text: string}[]>([{ id: Date.now(), text: '' }]);

  const addSubtask = () => {
    setSubtasks([...subtasks, { id: Date.now(), text: '' }]);
  };

  const updateSubtask = (id: number, text: string) => {
    setSubtasks(subtasks.map(st => st.id === id ? { ...st, text } : st));
  };

  const removeSubtask = (id: number) => {
    setSubtasks(subtasks.filter(st => st.id !== id));
    if (subtasks.length === 1) {
      setShowSubtask(false);
      setSubtasks([{ id: Date.now(), text: '' }]);
    }
  };

  const categories = [
    { name: 'No Category', icon: <Folder size={20} />, color: 'text-gray-500' },
    { name: 'Work', icon: <Briefcase size={20} />, color: 'text-blue-500' },
    { name: 'Personal', icon: <Coffee size={20} />, color: 'text-green-500' },
    { name: 'Wishlist', icon: <Heart size={20} />, color: 'text-purple-500' },
    { name: 'Birthday', icon: <Cake size={20} />, color: 'text-red-500' },
  ];

  if (showDatePicker) {
    return <DatePickerModal onClose={() => setShowDatePicker(false)} />;
  }

  return (
    <div className="absolute inset-0 bg-black/20 z-50 flex flex-col justify-end">
      <div className="bg-white rounded-t-3xl p-6 pb-12 animate-in slide-in-from-bottom-full duration-200">
        <div className="flex items-center justify-between mb-6">
          <input 
            type="text" 
            placeholder={showSubtask ? "Input the sub-task" : "Input new task here"} 
            className="text-lg w-full outline-none placeholder:text-gray-300"
            autoFocus
          />
          <button className="text-yellow-500 p-2">
            <Lightbulb size={24} />
          </button>
        </div>

        {showSubtask && (
          <div className="mb-6 space-y-3">
            {subtasks.map((st, index) => (
              <div key={st.id} className="flex items-center gap-3 text-gray-400">
                <Circle size={20} strokeWidth={1.5} />
                <input 
                  type="text" 
                  value={st.text}
                  onChange={(e) => updateSubtask(st.id, e.target.value)}
                  placeholder="Input the sub-task"
                  className="flex-1 text-sm outline-none text-gray-800 placeholder:text-gray-400 bg-transparent"
                  autoFocus={index === subtasks.length - 1}
                />
                <button onClick={() => removeSubtask(st.id)}><X size={20} className="text-gray-300" /></button>
              </div>
            ))}
            <button onClick={addSubtask} className="flex items-center gap-3 text-red-500 text-sm font-medium mt-2">
              <Plus size={20} />
              Add Sub-task
            </button>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <div className="relative">
            {/* Category Dropdown */}
            {showCategory && (
              <div className="absolute bottom-full left-0 mb-3 bg-white rounded-2xl shadow-xl w-48 py-2 animate-in fade-in zoom-in-95 duration-200">
                {categories.map(cat => (
                  <button 
                    key={cat.name}
                    onClick={() => { setCategory(cat.name); setShowCategory(false); }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                  >
                    <span className={cat.color}>{cat.icon}</span>
                    <span className="text-gray-700 text-sm">{cat.name}</span>
                  </button>
                ))}
                <div className="h-px bg-gray-100 my-1 mx-4"></div>
                <button 
                  onClick={() => { setShowCategory(false); onCreateCategory(); }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-gray-400"><Plus size={20} /></span>
                  <span className="text-gray-400 text-sm">Create New</span>
                </button>
              </div>
            )}
            <button 
              onClick={() => setShowCategory(!showCategory)}
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
                showCategory 
                  ? 'border-2 border-red-500 text-gray-700 bg-white' 
                  : 'bg-gray-100 text-gray-600 border-2 border-transparent'
              }`}
            >
              {category}
            </button>
          </div>
          
          <div className="flex items-center gap-4 text-gray-400">
            <button onClick={() => setShowDatePicker(true)} className="text-red-500"><Clock size={20} /></button>
            <button><Bell size={20} /></button>
            <button><Repeat size={20} /></button>
            <button onClick={() => setShowSubtask(!showSubtask)} className={showSubtask ? 'text-red-500' : ''}><ListTree size={20} /></button>
            <button><Target size={20} /></button>
          </div>
          
          <button 
            onClick={onClose}
            className="bg-red-500 text-white p-3 rounded-full shadow-md shadow-red-200"
          >
            <CheckCircle2 size={24} className="fill-current text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MoreOptionsMenu({ onClose, currentSort, onSortChange }: { onClose: () => void, currentSort?: SortOption, onSortChange?: (sort: SortOption) => void }) {
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [showSortOptions, setShowSortOptions] = useState(true);
  const [internalSortBy, setInternalSortBy] = useState<SortOption>('creation_time');

  const activeSort = currentSort || internalSortBy;

  const sortOptions: { id: SortOption, label: string }[] = [
    { id: 'due_date', label: 'Due date & Time' },
    { id: 'creation_time', label: 'Task Creation Time' },
    { id: 'alphabetical_az', label: 'Alphabetical A-Z' },
    { id: 'alphabetical_za', label: 'Alphabetical Z-A' },
    { id: 'manual', label: 'Manual' },
    { id: 'flag_color', label: 'Flag color' }
  ];

  return (
    <div className="absolute inset-0 z-50 flex items-start justify-end pt-[72px] pr-6" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-xl w-[280px] py-2 animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <button className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
          <ListChecks size={20} className="text-gray-600" />
          <span className="text-gray-800 text-[15px]">Select tasks</span>
        </button>

        <div className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-4">
            <CornerDownRight size={20} className="text-gray-600" />
            <div className="flex items-center gap-1">
              <span className="text-gray-800 text-[15px]">Show Subtasks</span>
              <Crown size={14} className="text-orange-400 fill-orange-400" />
            </div>
          </div>
          <button 
            className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center ${showSubtasks ? 'bg-blue-500' : 'bg-gray-300'}`}
            onClick={() => setShowSubtasks(!showSubtasks)}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${showSubtasks ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className="w-full flex flex-col hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setShowSortOptions(!showSortOptions)}>
          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
                <path d="M4 20V4" />
                <path d="M4 20l-2-2" />
                <path d="M4 20l2-2" />
                <path d="M9 6h11" />
                <path d="M9 12h7" />
                <path d="M9 18h3" />
              </svg>
              <div className="flex flex-col items-start">
                <span className="text-gray-800 text-[15px]">Sort by</span>
                {!showSortOptions && <span className="text-[13px] text-gray-400">{sortOptions.find(o => o.id === activeSort)?.label}</span>}
              </div>
            </div>
            {showSortOptions ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
          </div>
          
          {showSortOptions && (
            <div className="flex flex-col pb-2">
              <div className="mx-5 mb-2 border-t border-gray-100"></div>
              {sortOptions.map(option => (
                <button 
                  key={option.id}
                  className={`text-left flex items-center justify-between px-5 py-3 pl-14 text-[15px] ${activeSort === option.id ? 'text-red-500' : 'text-gray-500'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSortChange) {
                      onSortChange(option.id);
                    } else {
                      setInternalSortBy(option.id);
                    }
                    setShowSortOptions(false);
                  }}
                >
                  {option.label}
                  {option.id === 'flag_color' && <Crown size={14} className="text-orange-400 fill-orange-400" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { TaskItem } from './components/TaskItem';

function StarredTasksView({ tasks, onComplete, onToggleStar, onDeleteTask, onTaskClick, onBack }: { tasks: any[], onComplete: (id: number, isCompleted: boolean) => void, onToggleStar: (id: number) => void, onDeleteTask: (id: number) => void, onTaskClick: (task: any) => void, onBack: () => void }) {
  const starredTasks = tasks.filter(t => t.starred);
  const uncompletedTasks = starredTasks.filter(t => !t.completed);
  const completedTasks = starredTasks.filter(t => t.completed);

  return (
    <div className="absolute inset-0 bg-[#F5F6F8] z-40 flex flex-col animate-in slide-in-from-right duration-200">
      <div className="px-6 pt-12 pb-4 flex items-center bg-white shadow-sm">
        <button onClick={onBack} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-700">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold text-gray-800 pr-10">Starred Tasks</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {uncompletedTasks.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 text-gray-500 mb-3">
              <span className="text-sm font-medium">Previous</span>
              <ChevronUp size={16} />
            </div>
            {uncompletedTasks.map(task => (
              <TaskItem 
                key={task.id} 
                task={task} 
                onComplete={(isCompleted) => onComplete(task.id, isCompleted)} 
                onToggleStar={() => onToggleStar(task.id)}
                onDelete={() => onDeleteTask(task.id)}
                onClick={() => onTaskClick(task)} 
              />
            ))}
          </div>
        )}

        {completedTasks.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 text-gray-500 mb-3">
              <span className="text-sm font-medium">Completed</span>
              <ChevronUp size={16} />
            </div>
            {completedTasks.map(task => (
              <TaskItem 
                key={task.id} 
                task={task} 
                onComplete={(isCompleted) => onComplete(task.id, isCompleted)} 
                onToggleStar={() => onToggleStar(task.id)}
                onDelete={() => onDeleteTask(task.id)}
                onClick={() => onTaskClick(task)} 
              />
            ))}
          </div>
        )}

        {starredTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Star size={48} className="mb-4 opacity-20" />
            <p>No starred tasks</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TasksView({ tasks, onComplete, onToggleStar, onDeleteTask, onAdd, onSearch, onTaskClick, onCreateCategory, onMenuClick }: { tasks: any[], onComplete: (id: number, isCompleted: boolean) => void, onToggleStar: (id: number) => void, onDeleteTask: (id: number) => void, onAdd: () => void, onSearch: () => void, onTaskClick: (task: any) => void, onCreateCategory: () => void, onMenuClick: () => void }) {
  const categories = ['All', 'Work', 'Personal', 'Wishlist', 'Birthday'];
  const [activeCategory, setActiveCategory] = useState('All');
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [currentSort, setCurrentSort] = useState<SortOption>('creation_time');

  const sortTasks = (tasksToSort: any[]) => {
    return [...tasksToSort].sort((a, b) => {
      switch (currentSort) {
        case 'alphabetical_az':
          return a.title.localeCompare(b.title);
        case 'alphabetical_za':
          return b.title.localeCompare(a.title);
        case 'due_date':
          if (!a.date) return 1;
          if (!b.date) return -1;
          return a.date.localeCompare(b.date);
        case 'flag_color':
          return (a.starred === b.starred) ? 0 : a.starred ? -1 : 1;
        case 'creation_time':
        case 'manual':
        default:
          return a.id - b.id;
      }
    });
  };

  const todayTasks = sortTasks(tasks.filter(t => t.section === 'Today' && !t.completed));
  const futureTasks = sortTasks(tasks.filter(t => t.section === 'Future' && !t.completed));
  const completedTasks = sortTasks(tasks.filter(t => t.completed));

  return (
    <div className="flex-1 flex flex-col relative">
      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between">
        <button className="relative" onClick={onMenuClick}>
          <Menu size={24} className="text-gray-700" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-[#F5F6F8]"></span>
        </button>
        <div className="flex items-center gap-4 text-gray-700">
          <button onClick={onSearch}><Search size={24} /></button>
          <button onClick={() => setShowMoreOptions(true)}><MoreHorizontal size={24} /></button>
        </div>
      </div>

      {/* Categories */}
      <div className="relative">
        <div className="px-6 py-2 flex items-center gap-3 overflow-x-auto no-scrollbar pr-16">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'bg-gray-200/50 text-gray-500'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="absolute right-0 top-0 h-[48px] w-24 bg-gradient-to-l from-[#F5F6F8] from-50% to-transparent flex items-center justify-end pr-6 pointer-events-none">
          <button onClick={onCreateCategory} className="text-gray-500 pointer-events-auto hover:text-gray-700 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="6" height="6" rx="1" />
              <rect x="14" y="4" width="6" height="6" rx="1" />
              <rect x="4" y="14" width="6" height="6" rx="1" />
              <path d="M14 17h6" />
              <path d="M17 14v6" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Active Category Indicator Line */}
      <div className="px-6 mt-1">
        <div className="h-1 bg-gray-300 rounded-full w-full max-w-[80%]"></div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {todayTasks.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 text-gray-500 mb-3">
              <span className="text-sm font-medium">Today</span>
              <ChevronLeft size={16} className="rotate-90" />
            </div>
            {todayTasks.map(task => (
              <TaskItem 
                key={task.id} 
                task={task} 
                onComplete={(isCompleted) => onComplete(task.id, isCompleted)} 
                onToggleStar={() => onToggleStar(task.id)}
                onDelete={() => onDeleteTask(task.id)}
                onClick={() => onTaskClick(task)} 
              />
            ))}
          </div>
        )}

        {futureTasks.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 text-gray-500 mb-3">
              <span className="text-sm font-medium">Future</span>
              <ChevronLeft size={16} className="rotate-90" />
            </div>
            {futureTasks.map(task => (
              <TaskItem 
                key={task.id} 
                task={task} 
                onComplete={(isCompleted) => onComplete(task.id, isCompleted)} 
                onToggleStar={() => onToggleStar(task.id)}
                onDelete={() => onDeleteTask(task.id)}
                onClick={() => onTaskClick(task)} 
              />
            ))}
          </div>
        )}

        {completedTasks.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 text-gray-500 mb-3">
              <span className="text-sm font-medium">Completed Today</span>
              <ChevronLeft size={16} className="rotate-90" />
            </div>
            {completedTasks.map(task => (
              <TaskItem 
                key={task.id} 
                task={task} 
                onComplete={(isCompleted) => onComplete(task.id, isCompleted)} 
                onToggleStar={() => onToggleStar(task.id)}
                onDelete={() => onDeleteTask(task.id)}
                onClick={() => onTaskClick(task)} 
              />
            ))}
            <div className="flex justify-center mt-4">
              <button className="text-xs text-gray-400 underline decoration-gray-300 underline-offset-2">
                Check all completed tasks
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FAB */}
      <button 
        onClick={onAdd}
        className="absolute bottom-24 right-6 w-14 h-14 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-red-200 z-10"
      >
        <Plus size={32} strokeWidth={1.5} />
      </button>

      {/* More Options Menu */}
      {showMoreOptions && <MoreOptionsMenu onClose={() => setShowMoreOptions(false)} currentSort={currentSort} onSortChange={setCurrentSort} />}
    </div>
  );
}

function MineView({ onSettingsClick }: { onSettingsClick: () => void }) {
  return (
    <div className="flex-1 flex flex-col bg-[#F5F6F8] overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#0B1E3B]">Mine</h1>
        <button onClick={onSettingsClick} className="text-gray-700">
          <Settings size={24} />
        </button>
      </div>

      <div className="px-6 pb-24">
        {/* Premium Banner */}
        <div className="bg-gradient-to-r from-[#F06A6A] to-[#E55555] rounded-2xl p-5 text-white flex items-center justify-between shadow-sm mb-4 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-xl font-bold mb-1">You are Premium</h2>
            <p className="text-sm opacity-90">Annual plan</p>
          </div>
          <button className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-[#E55555] relative z-10">
            <ChevronRight size={20} />
          </button>
          {/* Decorative circles */}
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-xl"></div>
          <div className="absolute right-12 bottom-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 blur-lg"></div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white rounded-2xl p-5 flex flex-col items-center justify-center shadow-sm">
            <span className="text-3xl font-semibold text-[#0B1E3B] mb-2">0</span>
            <span className="text-sm text-gray-400">Completed Tasks</span>
          </div>
          <div className="bg-white rounded-2xl p-5 flex flex-col items-center justify-center shadow-sm relative">
            <button className="absolute top-3 right-3 text-gray-300">
              <Circle size={16} />
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px]">?</span>
            </button>
            <span className="text-3xl font-semibold text-[#0B1E3B] mb-2">0</span>
            <span className="text-sm text-gray-400">Perfect Day</span>
          </div>
        </div>

        {/* Annual Heatmap */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              <h3 className="text-base font-medium text-[#0B1E3B]">Annual Heatmap</h3>
              <button className="text-gray-300">
                <Circle size={14} />
                <span className="absolute -translate-x-[11px] translate-y-[1px] text-[9px]">?</span>
              </button>
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <span>2026</span>
              <ChevronRight size={14} className="rotate-90" />
            </div>
          </div>
          
          <div className="relative">
            <div className="flex gap-1 text-[10px] text-gray-400 mb-1">
              <div className="w-4"></div>
              <div className="flex-1 flex justify-between px-2">
                <span>Jan</span>
                <span>Feb</span>
                <span>Mar</span>
                <span>Apr</span>
              </div>
            </div>
            <div className="flex gap-1">
              <div className="flex flex-col gap-1 text-[10px] text-gray-400 justify-between py-1">
                <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
              </div>
              <div className="flex-1 grid grid-cols-12 gap-1">
                {Array.from({ length: 12 * 7 }).map((_, i) => (
                  <div key={i} className="bg-[#FFF0F0] rounded-sm aspect-square"></div>
                ))}
              </div>
            </div>
            
            {/* Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-[#FFF0F0]/90 text-[#E55555] px-6 py-2 rounded-full text-sm font-medium backdrop-blur-sm">
                No Task Data
              </div>
            </div>
          </div>
        </div>

        {/* Completed Tasks Chart */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-1">
              <h3 className="text-base font-medium text-[#0B1E3B]">Completed Tasks</h3>
              <ChevronRight size={16} className="rotate-90 text-gray-400" />
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <span>All</span>
              <ChevronRight size={14} className="rotate-90" />
            </div>
          </div>
          
          <div className="flex items-center gap-8 pb-4">
            <div className="relative w-24 h-24">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="#FFF0F0" strokeWidth="16" fill="none" />
              </svg>
            </div>
            <div className="text-gray-400 text-sm">
              No Completed Tasks
            </div>
          </div>
        </div>

        {/* Daily Completed Chart */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-medium text-[#0B1E3B]">Daily Completed</h3>
            <div className="flex items-center gap-2 text-sm text-gray-800">
              <ChevronLeft size={16} />
              <span>02/22 - 02/28</span>
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-6">A quiet schedule this week.</p>
          
          <div className="relative h-40 mb-6">
            <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-gray-400">
              <span>10</span>
              <span>5</span>
              <span>0</span>
            </div>
            <div className="ml-6 h-full flex items-end justify-between px-2 relative">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="flex flex-col items-center gap-2 h-full justify-end w-full">
                  <div className="w-2 bg-[#FFF0F0] rounded-full h-[85%]"></div>
                  <span className="text-[10px] text-gray-400">{day}</span>
                </div>
              ))}
              
              {/* Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pb-6">
                <div className="bg-[#FFF0F0]/90 text-[#E55555] px-6 py-2 rounded-full text-sm font-medium backdrop-blur-sm">
                  No Task Data
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-800">Tasks Completion Rate</span>
              <span className="text-[#E55555]">--</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-800">Most productive day</span>
              <span className="text-[#E55555]">--</span>
            </div>
          </div>
        </div>

        {/* Habits Tracker */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-1">
              <h3 className="text-base font-medium text-[#0B1E3B]">Habits Tracker</h3>
              <button className="text-gray-300">
                <Circle size={14} />
                <span className="absolute -translate-x-[11px] translate-y-[1px] text-[9px]">?</span>
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-800">
              <ChevronLeft size={16} />
              <span>02/22 - 02/28</span>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-blue-400"><Coffee size={20} /></div>
                <span className="text-gray-800">Drink water</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <span>0/7</span>
                <ChevronRight size={16} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-blue-400"><Coffee size={20} /></div>
                <span className="text-gray-800">Drink water</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <span>0/7</span>
                <ChevronRight size={16} />
              </div>
            </div>
          </div>
        </div>

        {/* Focus */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-[#0B1E3B]">Focus</h3>
            <div className="text-sm text-gray-800">02/22 - 02/28</div>
          </div>
          <div className="text-sm text-gray-800 mb-6">
            Total Focus Time This Week <span className="text-[#E55555]">0Min</span>
          </div>
          
          <div className="relative h-32">
            <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-gray-400">
              <div className="flex items-center gap-2 w-full"><span className="w-4">12</span><div className="flex-1 border-t border-gray-100"></div></div>
              <div className="flex items-center gap-2 w-full"><span className="w-4">9</span><div className="flex-1 border-t border-gray-100"></div></div>
              <div className="flex items-center gap-2 w-full"><span className="w-4">6</span><div className="flex-1 border-t border-gray-100"></div></div>
            </div>
            
            {/* Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-[#FFF0F0]/90 text-[#E55555] px-6 py-2 rounded-full text-sm font-medium backdrop-blur-sm">
                No Focus Data
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 bg-[#F5F6F8] z-50 flex flex-col animate-in slide-in-from-right duration-200">
      <div className="px-6 pt-12 pb-4 flex items-center gap-4 bg-white shadow-sm">
        <button onClick={onClose} className="p-2 -ml-2 text-gray-700">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-semibold text-gray-800 flex-1">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="text-sm text-gray-500 mb-2">Customize</div>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <SettingItem icon={<Repeat size={20} />} label="Sync" />
          <SettingItem icon={<div className="w-5 h-5 border-2 border-current rounded-md" />} label="Theme" />
          <SettingItem icon={<Grid2X2 size={20} />} label="Widget" />
          <SettingItem icon={<ListTree size={20} />} label="Category" />
          <SettingItem icon={<Bell size={20} />} label="Notification & Reminder" />
          <SettingItem icon={<CheckCircle2 size={20} />} label="Task Completion Tone" right={<Toggle active />} />
          <SettingItem icon={<div className="w-5 h-5 border-2 border-current rounded-full flex items-center justify-center"><div className="w-3 h-0.5 bg-current" /><div className="w-0.5 h-3 bg-current absolute" /></div>} label="Language" right={<span className="text-gray-400 text-sm">English</span>} />
          <SettingItem icon={<CalendarIcon size={20} />} label="Subscribe Local Calendar" />
          <SettingItem icon={<User size={20} />} label="Smart Input" />
          <SettingItem icon={<div className="w-5 h-5 border-2 border-current rounded-sm flex flex-col gap-0.5 p-0.5"><div className="h-1 bg-current rounded-sm w-full"></div><div className="h-1 bg-current rounded-sm w-full"></div></div>} label="Default View" right={<span className="text-gray-400 text-sm">Task List</span>} hasBorder={false} />
        </div>

        <div className="text-sm text-gray-500 mt-6 mb-2">Date & Time</div>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <SettingItem icon={<div className="w-5 h-5 border-2 border-current rounded-full flex items-center justify-center text-[10px] font-bold">7</div>} label="First Day of Week" right={<span className="text-gray-400 text-sm">Auto</span>} />
          <SettingItem icon={<Clock size={20} />} label="Time Format" right={<span className="text-gray-400 text-sm">Default</span>} />
          <SettingItem icon={<CalendarIcon size={20} />} label="Date Format" right={<span className="text-gray-400 text-sm">02/28/2026</span>} />
          <SettingItem icon={<CalendarIcon size={20} />} label="Due Date" right={<span className="text-gray-400 text-sm">Today</span>} hasBorder={false} />
        </div>
        
        <div className="text-sm text-gray-500 mt-6 mb-2">About</div>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm mb-24">
          <SettingItem icon={<MoreHorizontal size={20} />} label="Feedback" hasBorder={false} />
        </div>
      </div>
    </div>
  );
}

function SettingItem({ icon, label, right, hasBorder = true, onClick }: { icon: React.ReactNode, label: string, right?: React.ReactNode, hasBorder?: boolean, onClick?: () => void }) {
  return (
    <div 
      className={`flex items-center px-4 py-3.5 bg-white active:bg-gray-50 transition-colors ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="text-gray-600 mr-3">{icon}</div>
      <div className={`flex-1 flex items-center justify-between ${hasBorder ? 'border-b border-gray-100' : ''} pb-3.5 -mb-3.5 pt-3.5 -mt-3.5`}>
        <span className="text-gray-800">{label}</span>
        <div className="flex items-center gap-2">
          {right}
          {!right && <ChevronRight size={16} className="text-gray-300" />}
          {right && typeof right !== 'boolean' && right.type !== Toggle && <ChevronRight size={16} className="text-gray-300" />}
        </div>
      </div>
    </div>
  );
}

function Toggle({ active, onClick }: { active: boolean, onClick?: () => void }) {
  return (
    <div 
      className={`w-10 h-6 rounded-full p-1 transition-colors cursor-pointer ${active ? 'bg-red-500' : 'bg-gray-200'}`}
      onClick={onClick}
    >
      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${active ? 'translate-x-4' : 'translate-x-0'}`} />
    </div>
  );
}

function CalendarView({ onSearch, onTaskClick, onMenuClick }: { onSearch: () => void, onTaskClick: (task: any) => void, onMenuClick: () => void }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const prevMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F5F6F8] overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between">
        <button className="relative" onClick={onMenuClick}>
          <Menu size={24} className="text-gray-700" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-[#F5F6F8]"></span>
        </button>
        <div className="flex items-center gap-4 text-gray-700">
          <button onClick={onSearch}><Search size={24} /></button>
          <button onClick={() => setShowMoreOptions(true)}><MoreHorizontal size={24} /></button>
        </div>
      </div>

      <div className="px-6 py-2">
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={prevMonth} className="p-2 text-gray-400 hover:text-gray-700"><ChevronLeft size={20} /></button>
            <span className="font-semibold text-lg text-gray-800">
              {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
            </span>
            <button onClick={nextMonth} className="p-2 text-gray-400 hover:text-gray-700"><ChevronRight size={20} /></button>
          </div>

          {/* Days of week */}
          <div className="grid grid-cols-7 gap-y-4 mb-4 text-center">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="text-xs text-gray-400 font-medium">{d}</div>
            ))}
            
            {/* Empty days */}
            {emptyDays.map(d => (
              <div key={`empty-${d}`} className="text-sm py-2"></div>
            ))}
            
            {/* Days */}
            {days.map(d => {
              const isToday = d === new Date().getDate() && selectedDate.getMonth() === new Date().getMonth() && selectedDate.getFullYear() === new Date().getFullYear();
              const isSelected = d === selectedDate.getDate();
              
              return (
                <button 
                  key={d} 
                  onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), d))}
                  className={`text-sm py-2 w-8 h-8 mx-auto flex items-center justify-center rounded-full transition-colors ${
                    isSelected ? 'bg-blue-500 text-white shadow-md shadow-blue-200' : 
                    isToday ? 'text-blue-500 font-bold' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tasks for selected day */}
        <div className="mt-8 mb-24">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Tasks for {monthNames[selectedDate.getMonth()]} {selectedDate.getDate()}</h3>
          
          <div 
            className="bg-white rounded-2xl p-4 flex items-start gap-3 shadow-sm mb-3 cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => onTaskClick({ title: "Review project proposal", date: "10:00 AM" })}
          >
            <button className="mt-0.5 text-gray-300" onClick={(e) => e.stopPropagation()}>
              <Circle size={24} strokeWidth={1.5} />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-gray-800 font-medium">Review project proposal</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>10:00 AM</span>
                <Bell size={12} />
              </div>
            </div>
            <button className="text-gray-300">
              <Flag size={20} strokeWidth={1.5} />
            </button>
          </div>
          
          <div 
            className="bg-white rounded-2xl p-4 flex items-start gap-3 shadow-sm opacity-60 cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => onTaskClick({ title: "Morning workout", date: "07:00 AM" })}
          >
            <button className="mt-0.5 text-blue-500" onClick={(e) => e.stopPropagation()}>
              <CheckCircle2 size={24} strokeWidth={1.5} className="fill-blue-500 text-white" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-gray-500 font-medium line-through">Morning workout</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>07:00 AM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* More Options Menu */}
      {showMoreOptions && <MoreOptionsMenu onClose={() => setShowMoreOptions(false)} />}
    </div>
  );
}

function SidebarMenu({ isOpen, onClose, onSettingsClick, onStarredClick }: { isOpen: boolean, onClose: () => void, onSettingsClick: () => void, onStarredClick: () => void }) {
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(true);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/20 z-50"
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-[#F5F6F8] z-50 overflow-y-auto rounded-r-3xl shadow-2xl no-scrollbar"
          >
            <div className="p-6 pt-12">
              {/* Logo */}
              <div className="flex items-center gap-2 mb-8">
                <h1 className="text-3xl font-bold text-red-500 flex items-center">
                  g<span className="relative inline-flex items-center justify-center w-6 h-6 bg-red-500 rounded-full text-white mx-0.5"><Check size={16} strokeWidth={3} /></span>list
                </h1>
              </div>

              {/* Premium Block */}
              <div className="bg-white rounded-2xl p-4 mb-4 flex items-center gap-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer">
                <Crown className="text-orange-400" size={24} />
                <span className="text-gray-800 font-medium">Premium Member</span>
              </div>

              {/* Main Menu Block */}
              <div className="bg-white rounded-2xl p-2 mb-4 shadow-sm">
                <MenuItem icon={<Star className="text-red-400" size={22} />} label="Starred Tasks" onClick={onStarredClick} />
                <MenuItem icon={<Target className="text-red-500" size={22} />} label="Habits" />
                
                <div>
                  <div 
                    className="flex items-center justify-between px-4 py-3 active:bg-gray-50 rounded-xl transition-colors cursor-pointer"
                    onClick={() => setIsCategoryExpanded(!isCategoryExpanded)}
                  >
                    <div className="flex items-center gap-4">
                      <LayoutGrid className="text-red-500" size={22} />
                      <span className="text-gray-800 font-medium">Category</span>
                    </div>
                    <ChevronUp className={`text-gray-400 transition-transform ${isCategoryExpanded ? '' : 'rotate-180'}`} size={20} />
                  </div>
                  
                  <AnimatePresence>
                    {isCategoryExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pl-4 pr-2 pb-2">
                          <CategoryItem icon={<Folder className="text-gray-400" size={20} />} label="All" count={6} />
                          <CategoryItem icon={<Briefcase className="text-blue-400" size={20} />} label="Work" count={0} />
                          <CategoryItem icon={<Coffee className="text-green-400" size={20} />} label="Personal" count={0} />
                          <CategoryItem icon={<Heart className="text-purple-400" size={20} />} label="Wishlist" count={0} />
                          <CategoryItem icon={<Cake className="text-red-400" size={20} />} label="Birthday" count={0} />
                          <div className="flex items-center gap-4 px-4 py-3 mt-1 active:bg-gray-50 rounded-xl transition-colors cursor-pointer">
                            <Plus className="text-gray-400" size={20} />
                            <span className="text-gray-400 font-medium">Create New</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Settings Block */}
              <div className="bg-white rounded-2xl p-2 mb-8 shadow-sm">
                <MenuItem icon={<Shirt className="text-purple-400" size={22} />} label="Theme" />
                <MenuItem icon={<Layout className="text-purple-500" size={22} />} label="Widget" />
                <MenuItem icon={<Cloud className="text-blue-400" size={22} />} label="Sync" />
                <MenuItem icon={<HelpCircle className="text-purple-500" size={22} />} label="FAQ" />
                <MenuItem icon={<MessageSquare className="text-green-500" size={22} />} label="Feedback" />
                <MenuItem icon={<Share className="text-orange-400" size={22} />} label="Share App" />
                <MenuItem icon={<Facebook className="text-blue-500" size={22} />} label="Follow Us" />
                <MenuItem icon={<Settings className="text-blue-400" size={22} />} label="Settings" onClick={() => { onClose(); onSettingsClick(); }} />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <div 
      className="flex items-center gap-4 px-4 py-3 active:bg-gray-50 rounded-xl transition-colors cursor-pointer"
      onClick={onClick}
    >
      {icon}
      <span className="text-gray-800 font-medium">{label}</span>
    </div>
  );
}

function CategoryItem({ icon, label, count }: { icon: React.ReactNode, label: string, count: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 active:bg-gray-50 rounded-xl transition-colors cursor-pointer">
      <div className="flex items-center gap-4">
        {icon}
        <span className="text-gray-800">{label}</span>
      </div>
      <span className="text-gray-400 text-sm">{count}</span>
    </div>
  );
}

