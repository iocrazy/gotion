import { useRef, useEffect } from "react";
import { motion, useMotionValue, useMotionValueEvent, animate } from "motion/react";

interface TimePickerColumnProps {
  items: string[];
  value: string;
  onChange: (val: string) => void;
}

const ITEM_HEIGHT = 40;

export function TimePickerColumn({ items, value, onChange }: TimePickerColumnProps) {
  const y = useMotionValue(0);
  const isAnimating = useRef(false);

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; });

  // Sync position when value changes externally
  useEffect(() => {
    const index = items.indexOf(value);
    if (index >= 0) {
      animate(y, -index * ITEM_HEIGHT, { type: "spring", damping: 20, stiffness: 200 });
    }
  }, [value, items, y]);

  useMotionValueEvent(y, "animationComplete", () => {
    isAnimating.current = false;
    const currentY = y.get();
    const index = Math.round(-currentY / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(itemsRef.current.length - 1, index));
    if (itemsRef.current[clamped] !== value) {
      onChangeRef.current(itemsRef.current[clamped]);
    }
  });

  const handleDragEnd = () => {
    const currentY = y.get();
    const index = Math.round(-currentY / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    isAnimating.current = true;
    animate(y, -clamped * ITEM_HEIGHT, { type: "spring", damping: 20, stiffness: 200 });
  };

  const handleItemClick = (item: string) => {
    onChange(item);
  };

  return (
    <div className="h-[200px] overflow-hidden w-20 relative touch-none">
      <motion.div
        drag="y"
        dragConstraints={{
          top: -(items.length - 1) * ITEM_HEIGHT,
          bottom: 0,
        }}
        dragTransition={{
          power: 0.2,
          timeConstant: 300,
          modifyTarget: (t) => Math.round(t / ITEM_HEIGHT) * ITEM_HEIGHT,
        }}
        onDragEnd={handleDragEnd}
        style={{ y }}
        className="pt-[80px] pb-[80px] cursor-grab active:cursor-grabbing"
      >
        {items.map((item, i) => (
          <div
            key={i}
            className={`h-[40px] flex items-center justify-center transition-colors duration-200 ${
              item === value
                ? "text-gray-800 font-medium text-xl"
                : "text-gray-300 text-lg"
            }`}
            onClick={() => handleItemClick(item)}
          >
            {item}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
