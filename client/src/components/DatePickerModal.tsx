import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Bell,
  Repeat,
} from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  getDay,
  getDaysInMonth,
  addMonths,
  subMonths,
  format,
  isToday,
  isSameDay,
  addDays,
  nextSunday,
} from "date-fns";
import { SettingItem } from "./ui/SettingItem";
import { SetTimeModal } from "./SetTimeModal";
import { ReminderAtModal } from "./ReminderAtModal";

interface DatePickerModalProps {
  open: boolean;
  onClose: () => void;
  currentDate: string | null;
  onDateSelect: (date: string | null) => void;
}

const quickDates = [
  { key: "nodate", label: "No Date" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "sunday", label: "This Sunday" },
  { key: "3days", label: "3 Days Later" },
];

const repeatOptions = ["Never", "Daily", "Weekly", "Monthly", "Yearly"];

function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  return new Date(dateStr + "T00:00:00");
}

function formatDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function DatePickerModal({
  open,
  onClose,
  currentDate,
  onDateSelect,
}: DatePickerModalProps) {
  const today = useMemo(() => new Date(), []);
  const initialDate = currentDate ? parseDate(currentDate) : today;
  const [viewMonth, setViewMonth] = useState(
    startOfMonth(initialDate || today),
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    parseDate(currentDate),
  );

  useEffect(() => {
    if (open) {
      const parsed = currentDate ? new Date(currentDate + "T00:00:00") : null;
      setSelectedDate(parsed);
      setViewMonth(startOfMonth(parsed ?? new Date()));
    }
  }, [open, currentDate]);
  const [selectedTime, setSelectedTime] = useState<{
    hour: string;
    minute: string;
  } | null>(null);
  const [repeatValue, setRepeatValue] = useState("Never");
  const [reminderLabel, setReminderLabel] = useState("None");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const startDayOfWeek = getDay(monthStart);
    const daysInMonth = getDaysInMonth(viewMonth);
    const prevMonth = subMonths(viewMonth, 1);
    const nextMonth = addMonths(viewMonth, 1);
    const prevMonthEnd = endOfMonth(prevMonth);
    const prevMonthDays = prevMonthEnd.getDate();

    const days: { date: Date; inMonth: boolean }[] = [];

    // Previous month trailing days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const date = new Date(
        prevMonth.getFullYear(),
        prevMonth.getMonth(),
        day,
      );
      days.push({ date, inMonth: false });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(
        viewMonth.getFullYear(),
        viewMonth.getMonth(),
        day,
      );
      days.push({ date, inMonth: true });
    }

    // Next month leading days
    const remaining = 42 - days.length;
    for (let day = 1; day <= remaining; day++) {
      const date = new Date(
        nextMonth.getFullYear(),
        nextMonth.getMonth(),
        day,
      );
      days.push({ date, inMonth: false });
    }

    return days;
  }, [viewMonth]);

  const handleConfirm = () => {
    onDateSelect(selectedDate ? formatDateString(selectedDate) : null);
    onClose();
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleQuickDate = (type: string) => {
    switch (type) {
      case "nodate":
        setSelectedDate(null);
        break;
      case "today":
        setSelectedDate(today);
        setViewMonth(startOfMonth(today));
        break;
      case "tomorrow":
        setSelectedDate(addDays(today, 1));
        setViewMonth(startOfMonth(addDays(today, 1)));
        break;
      case "sunday":
        setSelectedDate(nextSunday(today));
        setViewMonth(startOfMonth(nextSunday(today)));
        break;
      case "3days":
        setSelectedDate(addDays(today, 3));
        setViewMonth(startOfMonth(addDays(today, 3)));
        break;
    }
  };

  const isQuickDateActive = (type: string): boolean => {
    if (!selectedDate) return type === "nodate";
    switch (type) {
      case "today":
        return isSameDay(selectedDate, today);
      case "tomorrow":
        return isSameDay(selectedDate, addDays(today, 1));
      case "sunday":
        return isSameDay(selectedDate, nextSunday(today));
      case "3days":
        return isSameDay(selectedDate, addDays(today, 3));
      default:
        return false;
    }
  };

  const handleTimeSelect = (hour: string, minute: string) => {
    if (hour === "" && minute === "") {
      setSelectedTime(null);
    } else {
      setSelectedTime({ hour, minute });
    }
  };

  const handleRepeatCycle = () => {
    const currentIndex = repeatOptions.indexOf(repeatValue);
    const nextIndex = (currentIndex + 1) % repeatOptions.length;
    setRepeatValue(repeatOptions[nextIndex]);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40"
            style={{ zIndex: 50 }}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute bottom-0 left-0 right-0 top-12 bg-[#F5F6F8] rounded-t-3xl flex flex-col overflow-hidden"
            style={{ zIndex: 50 }}
          >
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between bg-[#F5F6F8]">
              <button onClick={onClose} className="text-gray-400">
                <X size={24} />
              </button>
              <h2 className="text-lg font-semibold text-gray-800">
                Date & Time
              </h2>
              <button onClick={handleConfirm} className="text-red-500">
                <Check size={24} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4">
              {/* Calendar Card */}
              <div className="bg-white rounded-3xl p-6 shadow-sm">
                {/* Month Navigation */}
                <div className="flex items-center gap-2 mb-6">
                  <button
                    className="p-1"
                    onClick={() => setViewMonth(subMonths(viewMonth, 1))}
                  >
                    <ChevronLeft size={20} className="text-gray-800" />
                  </button>
                  <span className="font-medium text-lg text-gray-800">
                    {format(viewMonth, "MMM, yyyy")}
                  </span>
                  <button
                    className="p-1"
                    onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                  >
                    <ChevronRight size={20} className="text-gray-800" />
                  </button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-y-4 mb-6 text-center">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (d) => (
                      <div
                        key={d}
                        className="text-xs text-gray-400 font-medium"
                      >
                        {d}
                      </div>
                    ),
                  )}

                  {/* Day Cells */}
                  {calendarDays.map(({ date, inMonth }, i) => {
                    const isSelected =
                      selectedDate && isSameDay(date, selectedDate);
                    const isTodayDate = isToday(date);

                    return (
                      <div
                        key={i}
                        className="flex items-center justify-center"
                      >
                        <button
                          className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors ${
                            isSelected
                              ? "bg-red-500 text-white"
                              : isTodayDate && inMonth
                                ? "text-red-500 font-medium"
                                : inMonth
                                  ? "text-gray-800 hover:bg-gray-100"
                                  : "text-gray-300"
                          }`}
                          onClick={() => handleDayClick(date)}
                        >
                          {date.getDate()}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Quick Date Buttons */}
                <div className="flex flex-wrap gap-2">
                  {quickDates.map(({ key, label }) => (
                    <button
                      key={key}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        isQuickDateActive(key)
                          ? "bg-red-100 text-red-500"
                          : "bg-[#F5F6F8] text-gray-400"
                      }`}
                      onClick={() => handleQuickDate(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Settings Card */}
              <div className="bg-white rounded-3xl overflow-hidden shadow-sm">
                <SettingItem
                  icon={<Clock size={20} />}
                  label="Time"
                  right={
                    <span className="text-gray-400 text-sm">
                      {selectedTime
                        ? `${selectedTime.hour}:${selectedTime.minute}`
                        : "None"}
                    </span>
                  }
                  onClick={() => setShowTimePicker(true)}
                />
                <SettingItem
                  icon={<Bell size={20} />}
                  label="Reminder at"
                  right={
                    <span className="text-gray-400 text-sm">{reminderLabel}</span>
                  }
                  onClick={() => setShowReminderPicker(true)}
                />
                <SettingItem
                  icon={<Repeat size={20} />}
                  label="Repeat"
                  right={
                    <span className="text-gray-400 text-sm">
                      {repeatValue}
                    </span>
                  }
                  hasBorder={false}
                  onClick={handleRepeatCycle}
                />
              </div>
            </div>

            {/* Nested Modals */}
            <AnimatePresence>
              {showTimePicker && (
                <SetTimeModal
                  onClose={() => setShowTimePicker(false)}
                  currentHour={selectedTime?.hour}
                  currentMinute={selectedTime?.minute}
                  onTimeSelect={handleTimeSelect}
                />
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showReminderPicker && (
                <ReminderAtModal
                  onClose={() => setShowReminderPicker(false)}
                  onConfirm={(label) => setReminderLabel(label)}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
