import {
  Folder,
  Briefcase,
  Monitor,
  Cake,
  Coffee,
  ClipboardList,
  Heart,
  Clapperboard,
  ShoppingCart,
  Book,
  Flag,
  Plane,
  Utensils,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  folder: Folder,
  briefcase: Briefcase,
  monitor: Monitor,
  cake: Cake,
  coffee: Coffee,
  "clipboard-list": ClipboardList,
  heart: Heart,
  clapperboard: Clapperboard,
  "shopping-cart": ShoppingCart,
  book: Book,
  flag: Flag,
  plane: Plane,
  utensils: Utensils,
  "check-circle-2": CheckCircle2,
};

/**
 * Renders a category icon. If the icon string is a known Lucide icon name,
 * renders the Lucide component. Otherwise renders it as text (emoji).
 */
export function CategoryIcon({
  icon,
  size = 20,
  className,
}: {
  icon: string | null | undefined;
  size?: number;
  className?: string;
}) {
  if (!icon) return null;

  const LucideComp = ICON_MAP[icon];
  if (LucideComp) {
    return <LucideComp size={size} className={className} />;
  }

  // Assume it's an emoji
  return <span className={className} style={{ fontSize: size }}>{icon}</span>;
}
