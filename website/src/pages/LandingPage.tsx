import { motion } from "motion/react";
import { Database, ArrowRight, Github, Twitter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Footer } from "../components/Footer";

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-center px-6 pt-20 relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-20 left-10 opacity-20 pointer-events-none transform -rotate-12">
          <svg width="200" height="200" viewBox="0 0 100 100" fill="none" stroke="currentColor" className="text-secondary">
            <circle cx="50" cy="50" r="40" strokeWidth="2" strokeDasharray="8 8" />
            <path d="M50 10 L50 90 M10 50 L90 50" strokeWidth="2" />
          </svg>
        </div>
        <div className="absolute bottom-20 right-10 opacity-20 pointer-events-none transform rotate-12">
          <svg width="180" height="180" viewBox="0 0 100 100" fill="none" stroke="currentColor" className="text-tertiary">
            <rect x="20" y="20" width="60" height="60" rx="10" strokeWidth="2" />
            <circle cx="70" cy="30" r="5" fill="currentColor" />
          </svg>
        </div>
        <div className="absolute top-1/3 right-1/4 opacity-10 pointer-events-none">
          <svg width="100" height="100" viewBox="0 0 100 100" fill="currentColor" className="text-accent">
            <path d="M50 0 L61 35 L98 35 L68 57 L79 91 L50 70 L21 91 L32 57 L2 35 L39 35 Z" />
          </svg>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
          className="max-w-2xl w-full text-center space-y-10 relative z-10"
        >
          {/* Decorative doodle */}
          <div className="absolute -top-16 -right-16 hidden md:block transform rotate-12">
            <svg width="120" height="120" viewBox="0 0 100 100" fill="none" stroke="currentColor" className="text-ink opacity-20">
              <path d="M10,50 Q30,10 50,50 T90,50" strokeWidth="3" strokeDasharray="5,5" />
              <path d="M85,45 L90,50 L85,55" strokeWidth="3" />
            </svg>
          </div>

          <div className="space-y-6">
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="inline-block px-4 py-1 bg-white border-2 border-ink rounded-full text-sm font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transform -rotate-2"
            >
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500">Now in Public Beta</span>
            </motion.div>

            <h1 className="text-6xl md:text-8xl font-marker text-ink leading-[0.9] transform -rotate-1">
              Sync your life <br />
              with <span className="relative inline-block text-ink">
                Notion.
                <span className="absolute bottom-2 left-0 w-full h-4 bg-secondary/60 -z-10 transform -skew-x-6 rounded-sm"></span>
              </span>
            </h1>

            <p className="text-2xl font-hand text-ink/80 max-w-lg mx-auto leading-relaxed">
              The minimalist task manager that turns your Notion databases into a powerful, distraction-free workflow.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8">
            <button
              onClick={() => navigate("/auth?mode=signup")}
              className="w-full sm:w-auto px-8 py-4 bg-ink text-white font-bold text-xl rounded-xl border-2 border-ink shadow-[6px_6px_0px_0px_#a5f3fc] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_#a5f3fc] transition-all flex items-center justify-center gap-3"
            >
              <Database size={24} />
              Connect Notion
              <ArrowRight size={24} />
            </button>

            <button className="w-full sm:w-auto px-8 py-4 bg-white text-ink font-bold text-xl rounded-xl border-2 border-ink shadow-[6px_6px_0px_0px_rgba(0,0,0,0.1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] transition-all">
              View Demo
            </button>
          </div>

          <div className="pt-16 flex justify-center gap-12 opacity-60">
            <div className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 border-2 border-ink rounded-lg flex items-center justify-center bg-white transform rotate-3 group-hover:rotate-6 transition-transform shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <span className="font-marker text-xl">N</span>
              </div>
              <span className="font-hand font-bold">Notion</span>
            </div>
            <div className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 border-2 border-ink rounded-lg flex items-center justify-center bg-white transform -rotate-2 group-hover:-rotate-6 transition-transform shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <Github size={24} />
              </div>
              <span className="font-hand font-bold">GitHub</span>
            </div>
            <div className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 border-2 border-ink rounded-lg flex items-center justify-center bg-white transform rotate-1 group-hover:rotate-3 transition-transform shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <Twitter size={24} />
              </div>
              <span className="font-hand font-bold">Twitter</span>
            </div>
          </div>
        </motion.div>
      </div>
      <Footer />
    </>
  );
}
