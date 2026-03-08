import { useState } from "react";
import { useAuthStore } from "../stores/authStore";

type AuthMode = "login" | "register";

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        const message = await register(email, username, password);
        setSuccess(message || "Registration successful. Please check your email.");
        setMode("login");
        setPassword("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-[#F5F6F8] min-h-screen px-6">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Gotion</h1>
          <p className="text-sm text-gray-400 mt-1">
            {mode === "login" ? "Sign in to continue" : "Create your account"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          {/* Mode toggle */}
          <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                mode === "login"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-400"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                mode === "register"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-400"
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full text-sm text-gray-800 bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#E74C3C]/30 transition-shadow"
                placeholder="you@example.com"
              />
            </div>

            {/* Username (register only) */}
            {mode === "register" && (
              <div>
                <label className="text-sm text-gray-500 mb-1 block">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full text-sm text-gray-800 bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#E74C3C]/30 transition-shadow"
                  placeholder="Choose a username"
                />
              </div>
            )}

            {/* Password */}
            <div>
              <label className="text-sm text-gray-500 mb-1 block">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                className="w-full text-sm text-gray-800 bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#E74C3C]/30 transition-shadow"
                placeholder="Enter password"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl">
                {error}
              </div>
            )}

            {/* Success message */}
            {success && (
              <div className="bg-green-50 text-green-600 text-sm px-4 py-2.5 rounded-xl">
                {success}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#E74C3C] text-white text-sm font-semibold py-3 rounded-xl hover:bg-[#D44332] transition-colors disabled:opacity-50"
            >
              {submitting
                ? mode === "login"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
