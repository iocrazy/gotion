import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import { Loader2, KeyRound } from "lucide-react";
import { resetPassword } from "../lib/api";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await resetPassword(token, password);
      navigate("/auth?reset=success");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 pt-20">
        <div className="max-w-md w-full bg-white border-2 border-ink rounded-[2rem] p-8 shadow-[8px_8px_0px_0px_#fcd34d] text-center">
          <h1 className="text-3xl font-marker text-ink mb-4">Invalid Link</h1>
          <p className="font-hand text-lg text-ink/60 mb-6">
            This reset link is invalid or has expired.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block py-3 px-6 bg-ink text-white font-bold rounded-xl border-2 border-ink shadow-[4px_4px_0px_0px_#fcd34d] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#fcd34d] transition-all"
          >
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 pt-20 relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white border-2 border-ink rounded-[2rem] p-8 shadow-[8px_8px_0px_0px_#fcd34d] relative z-10"
      >
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-tertiary/60 rotate-2 border-l border-r border-white/50 shadow-sm z-20" />

        <div className="text-center space-y-2 mb-8 mt-4">
          <KeyRound className="w-12 h-12 mx-auto text-ink/60 mb-2" />
          <h1 className="text-3xl font-marker text-ink">Set New Password</h1>
          <p className="text-lg font-hand text-ink/60">
            Choose a strong password for your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block font-bold font-hand text-lg ml-1">
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-4 py-3 bg-bg border-2 border-ink rounded-xl font-hand text-lg focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all placeholder:text-ink/30"
            />
          </div>

          <div className="space-y-2">
            <label className="block font-bold font-hand text-lg ml-1">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
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
            {loading ? <Loader2 className="animate-spin" /> : "Reset Password"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
