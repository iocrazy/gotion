import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Loader2, Github, Twitter } from "lucide-react";
import { useSearchParams } from "react-router";
import * as authStore from "../stores/authStore";

export function AuthPage({ onLoginSuccess }: { onLoginSuccess: (user: any) => void }) {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [isLogin, setIsLogin] = useState(initialMode === "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsLogin(initialMode === "login");
    setError("");
    setEmail("");
    setPassword("");
  }, [initialMode]);

  const handleEmailAuth = async () => {
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (isLogin) {
        const user = await authStore.login(email, password);
        onLoginSuccess(user);
      } else {
        const username = email.split("@")[0];
        const user = await authStore.register(email, password, username);
        onLoginSuccess(user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 pt-20 relative overflow-hidden">
      {/* Background Doodles */}
      <div className="absolute top-20 left-10 opacity-20 pointer-events-none transform -rotate-12">
        <svg width="150" height="150" viewBox="0 0 100 100" fill="none" stroke="currentColor" className="text-secondary">
          <path d="M10,10 Q50,50 90,10" strokeWidth="3" />
          <path d="M10,90 Q50,50 90,90" strokeWidth="3" />
          <circle cx="50" cy="50" r="20" strokeWidth="3" />
        </svg>
      </div>
      <div className="absolute bottom-20 right-10 opacity-20 pointer-events-none transform rotate-12">
        <svg width="120" height="120" viewBox="0 0 100 100" fill="none" stroke="currentColor" className="text-tertiary">
          <rect x="20" y="20" width="60" height="60" rx="5" strokeWidth="3" />
          <path d="M30,40 L70,40" strokeWidth="3" />
          <path d="M30,60 L70,60" strokeWidth="3" />
        </svg>
      </div>

      <motion.div
        layout
        className="max-w-md w-full bg-white border-2 border-ink rounded-[2rem] p-8 shadow-[8px_8px_0px_0px_#fcd34d] relative z-10"
      >
        {/* Tape Effect */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-tertiary/60 rotate-2 border-l border-r border-white/50 shadow-sm z-20"></div>

        <div className="text-center space-y-2 mb-8 mt-4">
          <motion.h1
            key={isLogin ? "login-title" : "signup-title"}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-marker text-ink"
          >
            {isLogin ? "Welcome Back!" : "Join Gotion"}
          </motion.h1>
          <motion.p
            key={isLogin ? "login-desc" : "signup-desc"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-lg font-hand text-ink/60"
          >
            {isLogin ? "Ready to get things done?" : "Start your organized life today."}
          </motion.p>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block font-bold font-hand text-lg ml-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-bg border-2 border-ink rounded-xl font-hand text-lg focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all placeholder:text-ink/30"
              />
            </div>

            <div className="space-y-2">
              <label className="block font-bold font-hand text-lg ml-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-bg border-2 border-ink rounded-xl font-hand text-lg focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all placeholder:text-ink/30"
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="text-red-500 font-hand font-bold text-center"
              >
                {error}
              </motion.p>
            )}

            <button
              onClick={handleEmailAuth}
              disabled={loading}
              className="w-full py-4 bg-ink text-white font-bold text-xl rounded-xl border-2 border-ink shadow-[4px_4px_0px_0px_#fcd34d] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#fcd34d] transition-all flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin" /> : (isLogin ? "Log In" : "Sign Up")}
            </button>
          </div>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-ink/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-ink/40 font-hand font-bold text-lg">or continue with</span>
            </div>
          </div>

          <button
            className="w-full py-3 bg-white text-ink font-bold text-lg rounded-xl border-2 border-ink hover:bg-gray-50 transition-all flex items-center justify-center gap-3 opacity-50 cursor-not-allowed"
            disabled
          >
            <div className="w-6 h-6 flex items-center justify-center bg-black text-white rounded-md text-xs font-serif">N</div>
            Notion (coming soon)
          </button>

          <div className="grid grid-cols-2 gap-4">
            <button className="flex items-center justify-center gap-2 py-3 border-2 border-ink rounded-xl hover:bg-gray-50 transition-colors font-bold font-hand opacity-50 cursor-not-allowed" disabled>
              <Github size={20} />
              GitHub
            </button>
            <button className="flex items-center justify-center gap-2 py-3 border-2 border-ink rounded-xl hover:bg-gray-50 transition-colors font-bold font-hand opacity-50 cursor-not-allowed" disabled>
              <Twitter size={20} />
              Twitter
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="font-hand text-lg text-ink/60">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-ink font-bold hover:underline decoration-wavy decoration-2 underline-offset-4"
            >
              {isLogin ? "Sign up" : "Log in"}
            </button>
          </p>
        </div>
      </motion.div>

      <div className="mt-8 text-center max-w-sm">
        <p className="text-sm font-hand text-ink/40">
          By clicking "Sign Up" or "Continue", you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
