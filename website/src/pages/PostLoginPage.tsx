import { motion } from "motion/react";
import { Download, Monitor } from "lucide-react";

export function PostLoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 pt-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white border-2 border-ink rounded-[2rem] p-8 shadow-[8px_8px_0px_0px_#a5f3fc] text-center space-y-6"
      >
        <div className="w-16 h-16 mx-auto bg-accent/20 border-2 border-ink rounded-2xl flex items-center justify-center">
          <Monitor size={32} />
        </div>
        <h1 className="text-3xl font-marker">Welcome!</h1>
        <p className="font-hand text-lg text-ink/70">
          Your account is ready. Please download and open the Gotion desktop client to start managing your tasks.
        </p>
        <button className="w-full py-3 bg-ink text-white font-bold text-lg rounded-xl border-2 border-ink shadow-[4px_4px_0px_0px_#fcd34d] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#fcd34d] transition-all flex items-center justify-center gap-3">
          <Download size={20} />
          Download Gotion
        </button>
      </motion.div>
    </div>
  );
}
