import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LogOut, Menu, X } from "lucide-react";
import { Link } from "react-router";
import { GotionLogo } from "./GotionLogo";

interface NavbarProps {
  authenticated: boolean;
  isAdmin: boolean;
  onLogout: () => void;
}

export function Navbar({ authenticated, isAdmin, onLogout }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-bg/90 backdrop-blur-sm border-b-2 border-ink">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="absolute inset-0 bg-secondary rounded-lg transform rotate-6 translate-x-1 translate-y-1 border-2 border-ink"></div>
            <div className="relative w-10 h-10 bg-ink text-white rounded-lg flex items-center justify-center border-2 border-ink transform -rotate-3 group-hover:rotate-0 transition-transform duration-300">
              <GotionLogo className="w-6 h-6 text-white" />
            </div>
          </div>
          <span className="font-marker text-2xl tracking-wide group-hover:text-ink/80 transition-colors">Gotion</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 font-hand text-lg font-bold">
          <a href="#features" className="hover:text-accent-hover hover:underline decoration-wavy decoration-2 underline-offset-4 transition-all">Features</a>
          <Link to="/pricing" className="hover:text-accent-hover hover:underline decoration-wavy decoration-2 underline-offset-4 transition-all">Pricing</Link>
          <a href="#" className="hover:text-accent-hover hover:underline decoration-wavy decoration-2 underline-offset-4 transition-all">Changelog</a>
          {authenticated ? (
            <div className="flex items-center gap-4">
              {isAdmin && (
                <Link
                  to="/admin"
                  className="px-4 py-2 bg-white border-2 border-ink rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                  Dashboard
                </Link>
              )}
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-ink rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link to="/auth?mode=login" className="hover:text-accent-hover hover:underline decoration-wavy decoration-2 underline-offset-4 transition-all">
                Login
              </Link>
              <Link
                to="/auth?mode=signup"
                className="px-6 py-2 bg-accent border-2 border-ink rounded-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-bold"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>

        <button className="md:hidden text-ink" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t-2 border-ink bg-bg overflow-hidden"
          >
            <div className="p-6 flex flex-col gap-6 font-hand text-xl font-bold">
              <a href="#features" className="block py-2">Features</a>
              <Link to="/pricing" onClick={() => setIsOpen(false)} className="block py-2">Pricing</Link>
              {authenticated ? (
                <>
                  {isAdmin && (
                    <Link to="/admin" onClick={() => setIsOpen(false)} className="block py-2">Dashboard</Link>
                  )}
                  <button onClick={onLogout} className="flex items-center gap-2 text-red-600">
                    <LogOut size={24} /> Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/auth?mode=login" onClick={() => setIsOpen(false)} className="block py-2">Login</Link>
                  <Link to="/auth?mode=signup" onClick={() => setIsOpen(false)} className="w-full py-3 bg-accent border-2 border-ink rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold text-center block">
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
