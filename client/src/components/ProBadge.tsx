import { Crown } from "lucide-react";
import { useAuthStore } from "../stores/authStore";

interface ProBadgeProps {
  onClick?: () => void;
  className?: string;
}

export function ProBadge({ onClick, className }: ProBadgeProps) {
  const isPro = useAuthStore((s) => s.isPro);
  if (isPro()) return null;
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center ${className ?? ""}`}
    >
      <Crown size={14} className="text-orange-400 fill-orange-400" />
    </button>
  );
}
