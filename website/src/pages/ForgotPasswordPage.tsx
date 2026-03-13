import { useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import { forgotPassword } from "../lib/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 pt-20 relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white border-2 border-ink rounded-[2rem] p-8 shadow-[8px_8px_0px_0px_#fcd34d] relative z-10"
      >
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-tertiary/60 rotate-2 border-l border-r border-white/50 shadow-sm z-20" />

        <div className="text-center space-y-2 mb-8 mt-4">
          <Mail className="w-12 h-12 mx-auto text-ink/60 mb-2" />
          <h1 className="text-3xl font-marker text-ink">
            {sent ? "Check Your Email" : "Forgot Password?"}
          </h1>
          <p className="text-lg font-hand text-ink/60">
            {sent
              ? "We've sent a reset link to your email."
              : "Enter your email and we'll send a reset link."}
          </p>
        </div>

        {sent ? (
          <div className="space-y-6">
            <div className="bg-green-50 border-2 border-green-200 text-green-700 text-center font-hand text-lg px-4 py-3 rounded-xl">
              Check your inbox for the reset link. It expires in 15 minutes.
            </div>
            <Link
              to="/auth"
              className="block w-full py-4 bg-ink text-white font-bold text-xl rounded-xl border-2 border-ink shadow-[4px_4px_0px_0px_#fcd34d] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#fcd34d] transition-all text-center"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block font-bold font-hand text-lg ml-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
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
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-ink text-white font-bold text-xl rounded-xl border-2 border-ink shadow-[4px_4px_0px_0px_#fcd34d] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#fcd34d] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin" /> : "Send Reset Link"}
            </button>

            <div className="text-center">
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 font-hand text-lg text-ink/60 hover:text-ink transition-colors"
              >
                <ArrowLeft size={18} />
                Back to Login
              </Link>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
