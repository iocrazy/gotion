import { ChevronRight } from "lucide-react";

interface SettingItemProps {
  icon: React.ReactNode;
  label: string;
  right?: React.ReactNode;
  hasBorder?: boolean;
  onClick?: () => void;
}

export function SettingItem({
  icon,
  label,
  right,
  hasBorder = true,
  onClick,
}: SettingItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors ${
        hasBorder ? "border-b border-gray-100" : ""
      }`}
    >
      <div className="flex items-center gap-4">
        <span className="text-gray-600">{icon}</span>
        <span className="text-gray-800 text-[15px]">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {right || <ChevronRight size={16} className="text-gray-400" />}
      </div>
    </button>
  );
}
