import { useState } from "react";
import { motion } from "motion/react";
import { X, Check, Crown } from "lucide-react";
import { Toggle } from "./ui/Toggle";

interface ReminderAtModalProps {
  onClose: () => void;
  onConfirm?: (label: string) => void;
}

type ReminderOption =
  | "same"
  | "5min"
  | "15min"
  | "30min"
  | "1day"
  | "2days"
  | "customize";

const reminderOptions: { value: ReminderOption; label: string; premium?: boolean }[] = [
  { value: "same", label: "Same with due date" },
  { value: "5min", label: "5 min before" },
  { value: "15min", label: "15 min before" },
  { value: "30min", label: "30 min before" },
  { value: "1day", label: "1 day before" },
  { value: "2days", label: "2 days before" },
  { value: "customize", label: "Customize", premium: true },
];

export function ReminderAtModal({ onClose, onConfirm }: ReminderAtModalProps) {
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [selected, setSelected] = useState<ReminderOption>("same");
  const [enhancedReminder, setEnhancedReminder] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
        style={{ zIndex: 60 }}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="absolute bottom-0 left-0 right-0 bg-[#F5F6F8] rounded-t-3xl flex flex-col overflow-hidden"
        style={{ zIndex: 60 }}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between">
          <button onClick={onClose} className="text-gray-400">
            <X size={24} />
          </button>
          <h2 className="text-lg font-semibold text-gray-800">Reminder at</h2>
          <button
            onClick={() => {
              const label = reminderEnabled
                ? reminderOptions.find((o) => o.value === selected)?.label ?? "None"
                : "None";
              onConfirm?.(label);
              onClose();
            }}
            className="text-red-500"
          >
            <Check size={24} />
          </button>
        </div>

        <div className="px-4 pb-8 space-y-4 overflow-y-auto">
          {/* Reminder Toggle */}
          <div className="bg-white rounded-3xl px-5 py-4 shadow-sm flex items-center justify-between">
            <span className="text-gray-800 text-[15px]">Reminder</span>
            <Toggle
              active={reminderEnabled}
              onClick={() => setReminderEnabled(!reminderEnabled)}
            />
          </div>

          {/* Reminder Options */}
          <div className={`bg-white rounded-3xl shadow-sm overflow-hidden ${!reminderEnabled ? "opacity-50 pointer-events-none" : ""}`}>
            {reminderOptions.map((option, index) => (
              <button
                key={option.value}
                className={`w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors ${
                  index < reminderOptions.length - 1
                    ? "border-b border-gray-100"
                    : ""
                }`}
                onClick={() => setSelected(option.value)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-800 text-[15px]">
                    {option.label}
                  </span>
                  {option.premium && (
                    <Crown
                      size={14}
                      className="text-yellow-500 fill-yellow-500"
                    />
                  )}
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selected === option.value
                      ? "border-red-500"
                      : "border-gray-300"
                  }`}
                >
                  {selected === option.value && (
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Enhanced Reminder & Ringtone */}
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-gray-800 text-[15px]">
                  Enhanced Reminder
                </span>
                <Crown
                  size={14}
                  className="text-yellow-500 fill-yellow-500"
                />
              </div>
              <Toggle
                active={enhancedReminder}
                onClick={() => setEnhancedReminder(!enhancedReminder)}
              />
            </div>
            <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-gray-800 text-[15px]">Ringtone</span>
                <Crown
                  size={14}
                  className="text-yellow-500 fill-yellow-500"
                />
              </div>
              <span className="text-gray-400 text-sm">Default</span>
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
