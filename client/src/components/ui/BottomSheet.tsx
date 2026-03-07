import { motion, AnimatePresence } from "motion/react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  zLevel?: 50 | 60;
  fullHeight?: boolean;
}

export function BottomSheet({
  open,
  onClose,
  children,
  className = "",
  zLevel = 50,
  fullHeight = false,
}: BottomSheetProps) {
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
            style={{ zIndex: zLevel }}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={`absolute bottom-0 left-0 right-0 ${
              fullHeight ? "top-12" : ""
            } bg-white rounded-t-3xl flex flex-col ${className}`}
            style={{ zIndex: zLevel }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
