import { useState } from "react";
import { motion } from "motion/react";
import { X, Check } from "lucide-react";
import { TimePickerColumn } from "./TimePickerColumn";

interface SetTimeModalProps {
  onClose: () => void;
  currentHour?: string;
  currentMinute?: string;
  onTimeSelect: (hour: string, minute: string) => void;
}

const hours = Array.from({ length: 24 }, (_, i) =>
  i.toString().padStart(2, "0"),
);
const minutes = Array.from({ length: 60 }, (_, i) =>
  i.toString().padStart(2, "0"),
);

const quickTimes = [
  "No time",
  "07:00",
  "09:00",
  "10:00",
  "12:00",
  "14:00",
  "16:00",
  "18:00",
  "20:00",
  "22:00",
];

export function SetTimeModal({
  onClose,
  currentHour = "09",
  currentMinute = "00",
  onTimeSelect,
}: SetTimeModalProps) {
  const [hour, setHour] = useState(currentHour);
  const [minute, setMinute] = useState(currentMinute);

  const handleConfirm = () => {
    onTimeSelect(hour, minute);
    onClose();
  };

  const handleQuickTime = (time: string) => {
    if (time === "No time") {
      onTimeSelect("", "");
      onClose();
      return;
    }
    const [h, m] = time.split(":");
    setHour(h.padStart(2, "0"));
    setMinute(m.padStart(2, "0"));
  };

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
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl flex flex-col overflow-hidden"
        style={{ zIndex: 60 }}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between">
          <button onClick={onClose} className="text-gray-400">
            <X size={24} />
          </button>
          <h2 className="text-lg font-semibold text-gray-800">Set Time</h2>
          <button onClick={handleConfirm} className="text-red-500">
            <Check size={24} />
          </button>
        </div>

        {/* Time Picker Wheels */}
        <div className="py-4 flex justify-center items-center relative h-56">
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-10 bg-gray-100 rounded-xl -z-10" />
          <div className="flex gap-12 text-center text-xl">
            <TimePickerColumn items={hours} value={hour} onChange={setHour} />
            <TimePickerColumn
              items={minutes}
              value={minute}
              onChange={setMinute}
            />
          </div>
        </div>

        {/* Quick Time Buttons */}
        <div className="px-6 pb-8">
          <div className="flex flex-wrap gap-2 justify-center">
            {quickTimes.map((time) => (
              <button
                key={time}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  time === `${hour}:${minute}`
                    ? "bg-red-100 text-red-500"
                    : "bg-[#F5F6F8] text-gray-600 hover:bg-gray-200"
                }`}
                onClick={() => handleQuickTime(time)}
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
