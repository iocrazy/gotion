# Web Official Site + Client Theme Switching Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a web official site (Landing + Auth + Pricing + Admin Dashboard) on Cloudflare Pages, and add an extensible multi-theme system to the desktop client with a hand-drawn/neobrutalism style theme.

**Architecture:** Two independent features. Feature 1 migrates `reference/gotion` to `website/`, merges `admin/` SPA into it, adapts API calls to use `VITE_API_URL`, and adds react-router-dom for client-side routing. Feature 2 creates a CSS-variable-based theme registry in `client/src/lib/themes.ts`, replaces the binary dark/light toggle with an extensible theme system, and adds a ThemeModal with preview cards.

**Tech Stack:** React 19, TypeScript, TailwindCSS 4, Vite, react-router-dom 7, Zustand, motion (framer-motion), lucide-react, Axum (tower-http CORS), Cloudflare Pages

**Spec:** `docs/superpowers/specs/2026-03-11-website-and-themes-design.md`

**Testing Note:** This plan is primarily a migration/extraction task (copying existing code, adjusting imports/routes) with minimal new logic. TDD is deferred — unit tests for the theme registry (`getThemeById`, `applyTheme`) and integration tests for the auth flow should be added as a follow-up task after the migration is verified working. Each task includes build verification steps (`tsc --noEmit`, `cargo check`) as the primary correctness check.

---

## File Structure

### Feature 1: Website

**New files (created from migration):**
- `website/package.json` — Project config (merged deps from reference/gotion + admin)
- `website/vite.config.ts` — Vite config with API proxy for dev
- `website/tsconfig.json` — TypeScript config
- `website/index.html` — Entry HTML
- `website/src/main.tsx` — React entry with BrowserRouter
- `website/src/App.tsx` — Top-level router: Landing / Auth / Pricing / Admin
- `website/src/index.css` — Hand-drawn style CSS (from reference/gotion)
- `website/src/lib/api.ts` — Unified API client (merged from admin + reference)
- `website/src/lib/useAuth.ts` — Auth hook (from admin)
- `website/src/stores/authStore.ts` — Auth store (adapted from admin)
- `website/src/pages/LandingPage.tsx` — Landing page (extracted from App.tsx)
- `website/src/pages/AuthPage.tsx` — Login/Register (extracted from App.tsx)
- `website/src/pages/PricingPage.tsx` — Pricing (extracted from App.tsx)
- `website/src/pages/PostLoginPage.tsx` — Post-login page for non-admin users
- `website/src/pages/admin/AdminLayout.tsx` — Admin sidebar (from admin/)
- `website/src/pages/admin/DashboardPage.tsx` — Admin dashboard (from admin/)
- `website/src/pages/admin/UsersPage.tsx` — User management (from admin/)
- `website/src/pages/admin/SubscriptionsPage.tsx` — Subscriptions (from admin/)
- `website/src/pages/admin/PaymentsPage.tsx` — Payments (from admin/)
- `website/src/components/Navbar.tsx` — Top nav (extracted from App.tsx)
- `website/src/components/GotionLogo.tsx` — Logo SVG (extracted from App.tsx)
- `website/src/components/Footer.tsx` — Site footer

**Modified files:**
- `server/src/main.rs` — Replace `CorsLayer::permissive()` with specific origin allowlist, remove admin `ServeDir`
- `server/Dockerfile` — Remove admin-builder stage and admin dist copy

**Deleted:**
- `admin/` — Entire directory (merged into website)

### Feature 2: Client Theme Switching

**New files:**
- `client/src/lib/themes.ts` — Theme definitions and registry
- `client/src/components/ThemeModal.tsx` — Theme selection modal
- `client/src/components/ThemeCard.tsx` — Theme preview card component

**Modified files:**
- `client/src/index.css` — Remove `:root` and `[data-theme="light"]` variable blocks, add `[data-theme-style="neobrutalism"]` styles
- `client/src/stores/settingsStore.ts` — Extend from binary theme to multi-theme with migration
- `client/src/components/MoreOptionsMenu.tsx` — Add "Theme" menu item with Palette icon

---

## Chunk 1: Website Project Setup & Migration

### Task 1: Create website project scaffold

**Files:**
- Create: `website/package.json`
- Create: `website/vite.config.ts`
- Create: `website/tsconfig.json`
- Create: `website/index.html`
- Create: `website/src/main.tsx`
- Create: `website/src/index.css`

- [ ] **Step 1: Create `website/package.json`**

```json
{
  "name": "gotion-website",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "lucide-react": "^0.575.0",
    "motion": "^12.23.24",
    "clsx": "^2.1.1",
    "date-fns": "^4.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.4.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create `website/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5175,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
```

- [ ] **Step 3: Create `website/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `website/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Gotion - Sync your life with Notion</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Copy `reference/gotion/src/index.css` to `website/src/index.css`**

Copy the file as-is — it contains the hand-drawn font imports, theme variables, and utility classes (sketchy-border, sketchy-box, highlighter). No modifications needed.

- [ ] **Step 6: Create `website/src/main.tsx`**

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

- [ ] **Step 7: Install dependencies**

Run: `cd website && npm install`

- [ ] **Step 8: Commit**

```bash
git add website/package.json website/package-lock.json website/vite.config.ts website/tsconfig.json website/index.html website/src/main.tsx website/src/index.css
git commit -m "feat(website): scaffold project with Vite, React 19, TailwindCSS 4"
```

---

### Task 2: Extract and create shared components

**Files:**
- Create: `website/src/components/GotionLogo.tsx`
- Create: `website/src/components/Navbar.tsx`
- Create: `website/src/components/Footer.tsx`

- [ ] **Step 1: Create `website/src/components/GotionLogo.tsx`**

Extract the `GotionLogo` component from `reference/gotion/src/App.tsx` lines 30-54:

```typescript
export function GotionLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M 70 30 C 60 15, 30 10, 20 40 C 15 65, 35 85, 60 80 C 80 75, 80 50, 80 50"
        stroke="#a5f3fc"
        strokeWidth="12"
        transform="translate(4, 4)"
      />
      <path
        d="M 70 30 C 60 15, 30 10, 20 40 C 15 65, 35 85, 60 80 C 80 75, 80 50, 80 50"
        stroke="currentColor"
        strokeWidth="12"
      />
      <path
        d="M 50 55 L 65 70 L 90 35"
        stroke="#fcd34d"
        strokeWidth="12"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Create `website/src/components/Navbar.tsx`**

Extract the `Navbar` component from `reference/gotion/src/App.tsx` lines 56-146. Adapt to use react-router-dom's `Link` and `useNavigate`:

```typescript
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LogOut, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
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
```

- [ ] **Step 3: Create `website/src/components/Footer.tsx`**

```typescript
import { GotionLogo } from "./GotionLogo";

export function Footer() {
  return (
    <footer className="border-t-2 border-ink/10 py-12 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 opacity-60">
        <div className="flex items-center gap-2">
          <GotionLogo className="w-6 h-6" />
          <span className="font-marker text-xl">Gotion</span>
        </div>
        <div className="flex items-center gap-8 font-hand text-lg font-bold">
          <a href="#" className="hover:text-ink transition-colors">Privacy</a>
          <a href="#" className="hover:text-ink transition-colors">Terms</a>
          <a href="#" className="hover:text-ink transition-colors">Support</a>
          <a href="#" className="hover:text-ink transition-colors">Twitter</a>
        </div>
        <p className="font-hand text-lg">&copy; 2026 Gotion</p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add website/src/components/
git commit -m "feat(website): extract GotionLogo, Navbar, Footer components"
```

---

### Task 3: Extract page components from reference App.tsx

**Files:**
- Create: `website/src/pages/LandingPage.tsx`
- Create: `website/src/pages/PricingPage.tsx`
- Create: `website/src/pages/AuthPage.tsx`
- Create: `website/src/pages/PostLoginPage.tsx`

- [ ] **Step 1: Create `website/src/pages/LandingPage.tsx`**

Extract the `LandingPage` component from `reference/gotion/src/App.tsx` lines 149-244. Adapt `onGetStarted` to use `useNavigate`:

```typescript
import { motion } from "motion/react";
import { Database, ArrowRight, Github, Twitter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Footer } from "../components/Footer";

export function LandingPage() {
  const navigate = useNavigate();

  // Full JSX body: copy verbatim from reference/gotion/src/App.tsx lines 149-244
  // Replacements needed:
  //   1. Every `onGetStarted()` call → `navigate("/auth?mode=signup")`
  //   2. Remove the `onGetStarted` prop — no longer needed (use navigate directly)
  // Add <Footer /> after the closing </div> of min-h-screen
  return (
    <>
      {/* PASTE FULL JSX from reference/gotion/src/App.tsx lines 149-244 here */}
      {/* This includes: background SVG decorations, hero section with animated text, */}
      {/* CTA buttons, feature cards, integration icons (Notion, Google Calendar) */}
      <Footer />
    </>
  );
}
```

**Extraction instructions:** Open `reference/gotion/src/App.tsx`, copy the complete `LandingPage` function body (lines 149-244) verbatim. The only change needed is replacing all `onGetStarted()` calls with `navigate("/auth?mode=signup")` and removing the `onGetStarted` prop from the function signature.

- [ ] **Step 2: Create `website/src/pages/PricingPage.tsx`**

Extract from `reference/gotion/src/App.tsx` lines 247-415. Adapt similarly:

```typescript
import { useState } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Footer } from "../components/Footer";

export function PricingPage() {
  const navigate = useNavigate();
  const [billedYearly, setBilledYearly] = useState(true);

  // Full component body: copy verbatim from reference/gotion/src/App.tsx lines 247-415
  // Replacements needed:
  //   1. Every `onGetStarted()` call → `navigate("/auth?mode=signup")`
  //   2. Remove the `onGetStarted` prop — use navigate directly
  // This includes: tiers array, billing toggle, plan comparison cards, FAQ section
  // Add <Footer /> at the bottom

  return (
    <>
      {/* PASTE FULL JSX from reference/gotion/src/App.tsx lines 309-415 here */}
      <Footer />
    </>
  );
}
```

- [ ] **Step 3: Create `website/src/pages/AuthPage.tsx`**

Extract from `reference/gotion/src/App.tsx` lines 418-606. Adapt to use `VITE_API_URL` and react-router-dom:

```typescript
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Loader2, Github, Twitter } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
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

  // ... copy full JSX from reference lines 471-605 ...
  // Replace onConnect with placeholder (OAuth not yet implemented)
}
```

- [ ] **Step 4: Create `website/src/pages/PostLoginPage.tsx`**

Simple page shown to non-admin users after login:

```typescript
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
```

- [ ] **Step 5: Commit**

```bash
git add website/src/pages/
git commit -m "feat(website): extract Landing, Pricing, Auth, PostLogin pages"
```

---

### Task 4: Create website API client and auth store

**Files:**
- Create: `website/src/lib/api.ts`
- Create: `website/src/lib/useAuth.ts`
- Create: `website/src/stores/authStore.ts`

- [ ] **Step 1: Create `website/src/lib/api.ts`**

Merge the admin API client with website auth needs. Use `VITE_API_URL`:

```typescript
const TOKEN_KEY = "gotion_token";
const API_URL = import.meta.env.VITE_API_URL || "";

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  requireAuth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, requireAuth = true } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (requireAuth) {
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let message = `Request failed: ${response.status}`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.error) message = parsed.error;
    } catch {
      if (errorBody) message = errorBody;
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

// --- Types ---

export interface User {
  id: string;
  email: string;
  username: string;
  is_admin: boolean;
  disabled?: boolean;
  created_at?: string;
  subscription?: {
    plan: string;
    expires_at: string | null;
    is_pro: boolean;
  };
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Stats {
  total_users: number;
  total_tasks: number;
  total_categories: number;
  pro_users: number;
  monthly_revenue: number;
}

export interface Subscription {
  user_id: string;
  username?: string;
  email?: string;
  plan: string;
  period?: string;
  expires_at: string | null;
  created_at?: string;
}

export interface Payment {
  id?: string;
  order_no: string;
  user_id: string;
  username?: string;
  amount: number;
  channel: string;
  status: string;
  plan: string;
  period?: string;
  paid_at: string | null;
  created_at?: string;
}

// --- Auth API ---

export async function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
    requireAuth: false,
  });
}

export async function register(email: string, password: string, username: string): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: { email, password, username },
    requireAuth: false,
  });
}

export async function getMe(): Promise<User> {
  return request<User>("/api/auth/me");
}

// --- Admin API ---

export async function getStats(): Promise<Stats> {
  return request<Stats>("/api/admin/stats");
}

export async function getUsers(): Promise<User[]> {
  return request<User[]>("/api/admin/users");
}

export async function updateUser(
  id: string,
  data: { disabled?: boolean; is_admin?: boolean }
): Promise<User> {
  return request<User>(`/api/admin/users/${id}`, {
    method: "PUT",
    body: data,
  });
}

export async function deleteUser(id: string): Promise<void> {
  await request<unknown>(`/api/admin/users/${id}`, { method: "DELETE" });
}

export async function getSubscriptions(): Promise<Subscription[]> {
  return request<Subscription[]>("/api/admin/subscriptions");
}

export async function giftPro(
  userId: string,
  days: number,
  period?: string
): Promise<unknown> {
  return request<unknown>(`/api/admin/subscriptions/${userId}`, {
    method: "PUT",
    body: { days, period },
  });
}

export async function getPayments(): Promise<Payment[]> {
  return request<Payment[]>("/api/admin/payments");
}
```

- [ ] **Step 2: Create `website/src/stores/authStore.ts`**

Adapted from `admin/src/stores/authStore.ts` — supports both admin and regular users:

```typescript
import {
  login as apiLogin,
  register as apiRegister,
  getMe,
  setToken,
  getToken,
  type User,
} from "../lib/api";

let token: string | null = null;
let user: User | null = null;
let listeners: Array<() => void> = [];

function notify(): void {
  listeners.forEach((fn) => fn());
}

export function subscribe(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function getAuthState(): { token: string | null; user: User | null } {
  return { token, user };
}

export async function login(email: string, password: string): Promise<User> {
  const result = await apiLogin(email, password);
  token = result.token;
  user = result.user;
  setToken(result.token);
  notify();
  return result.user;
}

export async function register(email: string, password: string, username: string): Promise<User> {
  const result = await apiRegister(email, password, username);
  token = result.token;
  user = result.user;
  setToken(result.token);
  notify();
  return result.user;
}

export function logout(): void {
  token = null;
  user = null;
  setToken(null);
  notify();
}

export async function loadToken(): Promise<boolean> {
  const stored = getToken();
  if (!stored) return false;

  try {
    token = stored;
    const me = await getMe();
    user = me;
    notify();
    return true;
  } catch {
    logout();
    return false;
  }
}
```

- [ ] **Step 3: Create `website/src/lib/useAuth.ts`**

```typescript
import { useSyncExternalStore } from "react";
import { subscribe, getAuthState } from "../stores/authStore";

export function useAuth() {
  return useSyncExternalStore(subscribe, getAuthState);
}
```

- [ ] **Step 4: Commit**

```bash
git add website/src/lib/ website/src/stores/
git commit -m "feat(website): add API client and auth store"
```

---

### Task 5: Migrate admin pages into website

**Files:**
- Create: `website/src/pages/admin/AdminLayout.tsx`
- Create: `website/src/pages/admin/DashboardPage.tsx`
- Create: `website/src/pages/admin/UsersPage.tsx`
- Create: `website/src/pages/admin/SubscriptionsPage.tsx`
- Create: `website/src/pages/admin/PaymentsPage.tsx`

- [ ] **Step 1: Copy admin pages**

Copy the following files from `admin/src/` to `website/src/pages/admin/`, updating import paths:

1. `admin/src/components/AdminLayout.tsx` → `website/src/pages/admin/AdminLayout.tsx`
   - Change imports: `../lib/api` → `../../lib/api`, `../stores/authStore` → `../../stores/authStore`, `../lib/useAuth` → `../../lib/useAuth`
   - Update `NavLink` `to` paths: prefix with `/admin` (e.g., `to="/admin"`, `to="/admin/users"`)

2. `admin/src/pages/DashboardPage.tsx` → `website/src/pages/admin/DashboardPage.tsx`
   - Change import: `../lib/api` → `../../lib/api`

3. `admin/src/pages/UsersPage.tsx` → `website/src/pages/admin/UsersPage.tsx`
   - Change import: `../lib/api` → `../../lib/api`

4. `admin/src/pages/SubscriptionsPage.tsx` → `website/src/pages/admin/SubscriptionsPage.tsx`
   - Change import: `../lib/api` → `../../lib/api`

5. `admin/src/pages/PaymentsPage.tsx` → `website/src/pages/admin/PaymentsPage.tsx`
   - Change import: `../lib/api` → `../../lib/api`

- [ ] **Step 2: Update AdminLayout nav paths**

In `website/src/pages/admin/AdminLayout.tsx`, update `NAV_ITEMS`:

```typescript
const NAV_ITEMS = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/users", icon: Users, label: "Users" },
  { to: "/admin/subscriptions", icon: Crown, label: "Subscriptions" },
  { to: "/admin/payments", icon: CreditCard, label: "Payments" },
] as const;
```

And update the `NavLink` `end` prop: `end={to === "/admin"}`.

- [ ] **Step 3: Commit**

```bash
git add website/src/pages/admin/
git commit -m "feat(website): migrate admin pages from admin/ SPA"
```

---

### Task 6: Create website App.tsx with routing

**Files:**
- Create: `website/src/App.tsx`

- [ ] **Step 1: Create `website/src/App.tsx`**

```typescript
import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Navbar } from "./components/Navbar";
import { LandingPage } from "./pages/LandingPage";
import { AuthPage } from "./pages/AuthPage";
import { PricingPage } from "./pages/PricingPage";
import { PostLoginPage } from "./pages/PostLoginPage";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { DashboardPage } from "./pages/admin/DashboardPage";
import { UsersPage } from "./pages/admin/UsersPage";
import { SubscriptionsPage } from "./pages/admin/SubscriptionsPage";
import { PaymentsPage } from "./pages/admin/PaymentsPage";
import { useAuth } from "./lib/useAuth";
import { loadToken, logout } from "./stores/authStore";

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user?.is_admin) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function App() {
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadToken().finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 className="animate-spin text-ink" size={48} />
      </div>
    );
  }

  const handleLoginSuccess = (loginUser: any) => {
    // Auth store already updated by AuthPage calling authStore.login/register
    if (loginUser.is_admin) {
      navigate("/admin");
    } else {
      navigate("/welcome");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-bg selection:bg-accent selection:text-ink overflow-x-hidden">
      <Navbar
        authenticated={!!user}
        isAdmin={user?.is_admin ?? false}
        onLogout={handleLogout}
      />

      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route
          path="/auth"
          element={
            user ? (
              <Navigate to={user.is_admin ? "/admin" : "/welcome"} replace />
            ) : (
              <AuthPage onLoginSuccess={handleLoginSuccess} />
            )
          }
        />
        <Route path="/welcome" element={user ? <PostLoginPage /> : <Navigate to="/auth" replace />} />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <AdminGuard>
              <AdminLayout />
            </AdminGuard>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          <Route path="payments" element={<PaymentsPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd website && npx tsc --noEmit`
Expected: No type errors (or only minor ones to fix)

- [ ] **Step 3: Fix any type errors from Step 2**

- [ ] **Step 4: Commit**

```bash
git add website/src/App.tsx
git commit -m "feat(website): add App with react-router routing and admin guard"
```

---

### Task 7: Update server CORS and remove admin hosting

**Files:**
- Modify: `server/src/main.rs:151-163`
- Modify: `server/Dockerfile`

- [ ] **Step 1: Update CORS in `server/src/main.rs`**

Replace lines 151-163 with:

```rust
    let website_origin = std::env::var("WEBSITE_ORIGIN")
        .unwrap_or_else(|_| "http://localhost:5175".into());

    let cors = CorsLayer::new()
        .allow_origin(
            website_origin
                .split(',')
                .filter_map(|s| s.trim().parse().ok())
                .collect::<Vec<_>>(),
        )
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
        ]);

    let app = api::router(state).layer(cors);
```

- [ ] **Step 2: Remove ServeDir/ServeFile imports**

In `server/src/main.rs`, remove the import line:
```rust
// DELETE this line:
use tower_http::services::{ServeDir, ServeFile};
```

Also remove any code that uses `ServeDir` or `ServeFile` for the `/admin` path (lines 151-163 in current file).

- [ ] **Step 3: Update `server/Dockerfile`**

Remove the admin-builder stage (lines 1-7) and the admin dist copy (line 36). New Dockerfile:

```dockerfile
# Build stage
FROM rust:1.88-slim AS builder

RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY shared/ shared/
COPY server/ server/

# Create a dummy client member to satisfy workspace resolver
RUN mkdir -p client/src-tauri/src && \
    printf '[package]\nname = "gotion-client"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n' > client/src-tauri/Cargo.toml && \
    echo 'fn main() {}' > client/src-tauri/src/main.rs

# Build server in release mode
RUN cargo build --release -p gotion-server

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/gotion-server /usr/local/bin/gotion-server

ENV RUST_LOG=info

EXPOSE 3001

WORKDIR /app

CMD ["gotion-server"]
```

- [ ] **Step 4: Verify server builds**

Run: `cd server && cargo check`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add server/src/main.rs server/Dockerfile
git commit -m "feat(server): restrict CORS to website origin, remove admin static hosting"
```

---

### Task 8: Delete admin directory and update CLAUDE.md

**Files:**
- Delete: `admin/` (entire directory)
- Modify: `CLAUDE.md`

- [ ] **Step 1: Delete admin directory**

```bash
rm -rf admin/
```

- [ ] **Step 2: Update CLAUDE.md project structure**

Add `website/` to the project structure section and remove `admin/` references. Add `website/` description to the structure:

```
├── website/              # Web official site: Landing + Auth + Pricing + Admin Dashboard
│   └── src/              # React SPA deployed on Cloudflare Pages
```

Also add to Environment Variables section:
```
- `WEBSITE_ORIGIN=https://gotion.pages.dev` (Cloudflare Pages origin for CORS)
```

- [ ] **Step 3: Commit**

```bash
git rm -r admin/
git add CLAUDE.md
git commit -m "chore: delete admin/ SPA (merged into website/), update CLAUDE.md"
```

---

## Chunk 2: Client Theme System

> **Note:** Tasks 10-14 will introduce temporary type errors in `SettingsView.tsx` because it references the old `theme` field. This is expected and resolved in Task 15. Do not attempt to fix SettingsView until Task 15.

### Task 9: Create theme definitions registry

**Files:**
- Create: `client/src/lib/themes.ts`

- [ ] **Step 1: Create `client/src/lib/themes.ts`**

```typescript
export interface ThemeDefinition {
  readonly id: string;
  readonly name: string;
  readonly isPro: boolean;
  readonly preview: {
    readonly bg: string;
    readonly surface: string;
    readonly accent: string;
    readonly text: string;
  };
  readonly variables: Readonly<Record<string, string>>;
  readonly special?: {
    readonly fontFamily?: string;
    readonly themeStyle?: string;
  };
}

const LIGHT_THEME: ThemeDefinition = {
  id: "light",
  name: "Light",
  isPro: false,
  preview: {
    bg: "#F5F5F7",
    surface: "#FFFFFF",
    accent: "#DC2626",
    text: "#1F2937",
  },
  variables: {
    "--bg-base": "#F5F5F7",
    "--bg-surface": "#FFFFFF",
    "--bg-hover": "#F0F0F2",
    "--text-primary": "#1F2937",
    "--text-secondary": "#6B7280",
    "--text-muted": "#9CA3AF",
    "--border": "#E5E7EB",
    "--accent": "#DC2626",
    "--accent-dim": "rgba(220,38,38,0.08)",
    "--done": "#10B981",
    "--danger": "#EF4444",
    "--warn": "#F59E0B",
  },
};

const DARK_THEME: ThemeDefinition = {
  id: "dark",
  name: "Dark",
  isPro: false,
  preview: {
    bg: "#0A0A0F",
    surface: "#12121A",
    accent: "#DC2626",
    text: "#E4E4E7",
  },
  variables: {
    "--bg-base": "#0A0A0F",
    "--bg-surface": "#12121A",
    "--bg-hover": "#1A1A25",
    "--text-primary": "rgba(255,255,255,0.90)",
    "--text-secondary": "rgba(255,255,255,0.45)",
    "--text-muted": "rgba(255,255,255,0.25)",
    "--border": "rgba(255,255,255,0.06)",
    "--accent": "#DC2626",
    "--accent-dim": "rgba(220,38,38,0.15)",
    "--done": "#34D399",
    "--danger": "#EF4444",
    "--warn": "#FBBF24",
  },
};

const NEOBRUTALISM_THEME: ThemeDefinition = {
  id: "neobrutalism",
  name: "Hand-drawn",
  isPro: true,
  preview: {
    bg: "#fffdf8",
    surface: "#fff8ee",
    accent: "#fcd34d",
    text: "#18181b",
  },
  variables: {
    "--bg-base": "#fffdf8",
    "--bg-surface": "#fff8ee",
    "--bg-hover": "#fff0d4",
    "--text-primary": "#18181b",
    "--text-secondary": "#3f3f46",
    "--text-muted": "#71717a",
    "--border": "#18181b",
    "--accent": "#fcd34d",
    "--accent-dim": "#f59e0b",
    "--done": "#22c55e",
    "--danger": "#ef4444",
    "--warn": "#f59e0b",
  },
  special: {
    fontFamily: '"Patrick Hand", "Comic Sans MS", cursive, sans-serif',
    themeStyle: "neobrutalism",
  },
};

export const THEMES: readonly ThemeDefinition[] = [
  LIGHT_THEME,
  DARK_THEME,
  NEOBRUTALISM_THEME,
];

export function getThemeById(id: string): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? LIGHT_THEME;
}

export function applyTheme(theme: ThemeDefinition): void {
  const root = document.documentElement;

  // Apply CSS variables
  for (const [key, value] of Object.entries(theme.variables)) {
    root.style.setProperty(key, value);
  }

  // Apply special font
  if (theme.special?.fontFamily) {
    root.style.setProperty("--font-family", theme.special.fontFamily);
    root.style.fontFamily = theme.special.fontFamily;
  } else {
    root.style.removeProperty("--font-family");
    root.style.fontFamily = "";
  }

  // Apply theme style attribute for CSS selectors
  if (theme.special?.themeStyle) {
    root.dataset.themeStyle = theme.special.themeStyle;
  } else {
    delete root.dataset.themeStyle;
  }

  // Remove legacy data-theme attribute
  delete root.dataset.theme;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/lib/themes.ts
git commit -m "feat(client): add theme definitions registry with light, dark, neobrutalism"
```

---

### Task 10: Update settingsStore for multi-theme support

**Files:**
- Modify: `client/src/stores/settingsStore.ts`

- [ ] **Step 1: Rewrite `client/src/stores/settingsStore.ts`**

Replace the entire file contents:

```typescript
import { create } from "zustand";
import { isTauri, tauriInvoke } from "../lib/tauri";
import { getThemeById, applyTheme } from "../lib/themes";

interface SettingsState {
  serverUrl: string;
  bgOpacity: number;
  themeId: string;
  loaded: boolean;
  loadSettings: () => Promise<void>;
  setServerUrl: (url: string) => Promise<void>;
  setBgOpacity: (opacity: number) => Promise<void>;
  setTheme: (themeId: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  serverUrl: import.meta.env.VITE_SERVER_URL || "https://gotion.heygo.cn:88",
  bgOpacity: 1.0,
  themeId: "light",
  loaded: false,

  loadSettings: async () => {
    if (isTauri()) {
      try {
        const json = await tauriInvoke<string>("get_settings");
        const settings = JSON.parse(json);
        // Migration: support old "theme" field
        const themeId: string = settings.themeId ?? settings.theme ?? "light";
        const theme = getThemeById(themeId);
        applyTheme(theme);
        set({
          serverUrl: settings.server_url,
          bgOpacity: settings.bg_opacity ?? 1.0,
          themeId: theme.id,
          loaded: true,
        });
      } catch (e) {
        console.error("Failed to load settings:", e);
        applyTheme(getThemeById("light"));
        set({ loaded: true });
      }
    } else {
      const savedUrl = localStorage.getItem("gotion_serverUrl");
      const savedThemeId = localStorage.getItem("gotion_theme_id") ?? "light";
      const theme = getThemeById(savedThemeId);
      applyTheme(theme);
      set({
        themeId: theme.id,
        loaded: true,
        ...(savedUrl ? { serverUrl: savedUrl } : {}),
      });
    }
  },

  setServerUrl: async (url: string) => {
    const cleaned = url.replace(/\/+$/, "");
    set({ serverUrl: cleaned });
    if (!isTauri()) {
      localStorage.setItem("gotion_serverUrl", cleaned);
    }
    if (isTauri()) {
      try {
        await tauriInvoke("save_settings", {
          settingsJson: JSON.stringify({ server_url: cleaned }),
        });
      } catch (e) {
        console.error("Failed to save settings:", e);
      }
    }
  },

  setBgOpacity: async (opacity: number) => {
    set({ bgOpacity: opacity });
    if (isTauri()) {
      try {
        await tauriInvoke("save_settings", {
          settingsJson: JSON.stringify({ bg_opacity: opacity }),
        });
      } catch (e) {
        console.error("Failed to save settings:", e);
      }
    }
  },

  setTheme: async (themeId: string) => {
    const theme = getThemeById(themeId);
    applyTheme(theme);
    set({ themeId: theme.id });
    if (isTauri()) {
      try {
        await tauriInvoke("save_settings", {
          settingsJson: JSON.stringify({ themeId: theme.id }),
        });
      } catch (e) {
        console.error("Failed to save settings:", e);
      }
    } else {
      localStorage.setItem("gotion_theme_id", theme.id);
    }
  },
}));
```

- [ ] **Step 2: Verify no type errors**

Run: `cd client && npx tsc --noEmit`

Note: Other files that reference `theme` (like `SettingsView.tsx`) may have type errors. These will be fixed in later tasks.

- [ ] **Step 3: Commit**

```bash
git add client/src/stores/settingsStore.ts
git commit -m "feat(client): extend settingsStore for multi-theme with migration"
```

---

### Task 11: Update index.css for theme system

**Files:**
- Modify: `client/src/index.css`

- [ ] **Step 1: Remove CSS variable blocks and add neobrutalism styles**

In `client/src/index.css`:

1. **Remove** the `:root { ... }` block (lines 3-16) — theme variables now injected by JS
2. **Remove** the `:root[data-theme="light"] { ... }` block (lines 18-31) — same reason
3. **Add** neobrutalism special styles at the end of the file:

```css
/* Neobrutalism theme special styles */
@import url('https://fonts.googleapis.com/css2?family=Patrick+Hand&family=Permanent+Marker&display=swap');

:root[data-theme-style="neobrutalism"] {
  /* Dot grid background */
  background-image: radial-gradient(#e5e7eb 1px, transparent 1px) !important;
  background-size: 24px 24px;
}

:root[data-theme-style="neobrutalism"] * {
  border-color: var(--border);
}

:root[data-theme-style="neobrutalism"] button,
:root[data-theme-style="neobrutalism"] [class*="rounded"] {
  border-radius: 12px 4px 16px 4px / 4px 16px 4px 12px;
}

:root[data-theme-style="neobrutalism"] [class*="shadow"] {
  box-shadow: 3px 3px 0px var(--border);
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/index.css
git commit -m "refactor(client): move theme variables to JS, add neobrutalism CSS"
```

---

### Task 12: Create ThemeCard component

**Files:**
- Create: `client/src/components/ThemeCard.tsx`

- [ ] **Step 1: Create `client/src/components/ThemeCard.tsx`**

```typescript
import { Check, Crown } from "lucide-react";
import type { ThemeDefinition } from "../lib/themes";

interface ThemeCardProps {
  theme: ThemeDefinition;
  isSelected: boolean;
  isPro: boolean;
  onClick: () => void;
}

export function ThemeCard({ theme, isSelected, isPro, onClick }: ThemeCardProps) {
  const showProBadge = theme.isPro && !isPro;

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
        isSelected
          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20"
          : "border-[var(--border)] hover:border-[var(--text-muted)]"
      }`}
    >
      {/* Mini preview */}
      <div
        className="w-full aspect-[4/3] rounded-lg overflow-hidden border"
        style={{
          backgroundColor: theme.preview.bg,
          borderColor: theme.preview.text + "20",
        }}
      >
        <div
          className="h-3 w-full flex items-center px-2 gap-1"
          style={{ backgroundColor: theme.preview.surface }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.preview.accent }} />
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.preview.text + "30" }} />
        </div>
        <div className="p-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm border"
              style={{ borderColor: theme.preview.text + "40" }}
            />
            <div
              className="h-1.5 rounded-full flex-1"
              style={{ backgroundColor: theme.preview.text + "60" }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: theme.preview.accent }}
            />
            <div
              className="h-1.5 rounded-full w-3/4"
              style={{ backgroundColor: theme.preview.text + "30" }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm border"
              style={{ borderColor: theme.preview.text + "40" }}
            />
            <div
              className="h-1.5 rounded-full w-1/2"
              style={{ backgroundColor: theme.preview.text + "20" }}
            />
          </div>
        </div>
      </div>

      {/* Label */}
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] text-[var(--text-primary)] font-medium">
          {theme.name}
        </span>
        {showProBadge && (
          <Crown size={12} className="text-orange-400 fill-orange-400" />
        )}
      </div>

      {/* Selected checkmark */}
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center">
          <Check size={12} className="text-white" strokeWidth={3} />
        </div>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/ThemeCard.tsx
git commit -m "feat(client): add ThemeCard preview component"
```

---

### Task 13: Create ThemeModal component

**Files:**
- Create: `client/src/components/ThemeModal.tsx`

- [ ] **Step 1: Create `client/src/components/ThemeModal.tsx`**

```typescript
import { X } from "lucide-react";
import { THEMES } from "../lib/themes";
import { ThemeCard } from "./ThemeCard";
import { useSettingsStore } from "../stores/settingsStore";
import { useAuthStore } from "../stores/authStore";
import { useUpgrade } from "../lib/upgradeContext";

interface ThemeModalProps {
  onClose: () => void;
}

export function ThemeModal({ onClose }: ThemeModalProps) {
  const themeId = useSettingsStore((s) => s.themeId);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const isPro = useAuthStore((s) => s.isPro);
  const openUpgrade = useUpgrade();

  const handleSelect = (id: string) => {
    const theme = THEMES.find((t) => t.id === id);
    if (!theme) return;

    if (theme.isPro && !isPro()) {
      openUpgrade();
      return;
    }

    setTheme(id);
    onClose();
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/20"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-surface)] rounded-2xl shadow-xl w-[320px] p-5 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[var(--text-primary)] text-[16px] font-semibold">
            Choose Theme
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          >
            <X size={18} className="text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {THEMES.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isSelected={theme.id === themeId}
              isPro={isPro()}
              onClick={() => handleSelect(theme.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/ThemeModal.tsx
git commit -m "feat(client): add ThemeModal with preview cards and Pro gating"
```

---

### Task 14: Add Theme entry to MoreOptionsMenu

**Files:**
- Modify: `client/src/components/MoreOptionsMenu.tsx`

- [ ] **Step 1: Add Theme menu item and ThemeModal state**

In `client/src/components/MoreOptionsMenu.tsx`:

1. Add import at top:
```typescript
import { Palette } from "lucide-react";
import { ThemeModal } from "./ThemeModal";
```

2. Add state inside the component:
```typescript
const [showThemeModal, setShowThemeModal] = useState(false);
```

3. Add the Theme button after the "Select tasks" button (after line 184, before the Show Subtasks section):
```typescript
        <button
          className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
          onClick={() => setShowThemeModal(true)}
        >
          <Palette size={20} className="text-gray-600" />
          <span className="text-gray-800 text-[15px]">Theme</span>
        </button>
```

4. Add ThemeModal render at the end of the component (before the closing `</div>` of the outermost div):
```typescript
      {showThemeModal && (
        <ThemeModal onClose={() => setShowThemeModal(false)} />
      )}
```

- [ ] **Step 2: Verify no type errors**

Run: `cd client && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add client/src/components/MoreOptionsMenu.tsx
git commit -m "feat(client): add Theme entry to MoreOptionsMenu"
```

---

### Task 15: Update SettingsView for new theme system

**Files:**
- Modify: `client/src/components/SettingsView.tsx`

- [ ] **Step 1: Update SettingsView to use themeId**

In `client/src/components/SettingsView.tsx`:

1. Update import to use `getThemeById`:
```typescript
import { getThemeById } from "../lib/themes";
```

2. Replace theme-related store usage:
```typescript
// Old:
const theme = useSettingsStore((s) => s.theme);
const setTheme = useSettingsStore((s) => s.setTheme);

// New:
const themeId = useSettingsStore((s) => s.themeId);
const currentTheme = getThemeById(themeId);
```

3. Remove `handleThemeToggle` function entirely.

4. Update the Theme SettingItem to show current theme name (no toggle, just display — actual switching happens in ThemeModal):
```typescript
          <SettingItem
            icon={
              themeId === "dark" ? <Moon size={20} /> : <Sun size={20} />
            }
            label="Theme"
            right={
              <span className="flex items-center gap-1.5 text-sm text-gray-500 capitalize">
                {currentTheme.name}
              </span>
            }
          />
```

Remove the `onClick` handler and `ProBadge` from the Theme SettingItem — theme selection now happens via ThemeModal in MoreOptionsMenu.

- [ ] **Step 2: Commit**

```bash
git add client/src/components/SettingsView.tsx
git commit -m "refactor(client): update SettingsView for multi-theme system"
```

---

### Task 16: Final verification and build check

- [ ] **Step 1: Verify client TypeScript**

Run: `cd client && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Verify server builds**

Run: `cd server && cargo check`
Expected: No errors

- [ ] **Step 3: Verify website TypeScript**

Run: `cd website && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Update CLAUDE.md with website details**

Ensure `CLAUDE.md` reflects the new project structure including `website/` and the removal of `admin/`.

- [ ] **Step 5: Final commit**

```bash
git add CLAUDE.md
git status  # Review any remaining unstaged changes
git commit -m "chore: final verification and cleanup for website + theme features"
```

> **Note:** Do NOT use `git add -A`. Review `git status` output and only stage files that are part of this feature. Avoid accidentally staging `.env`, credentials, or unrelated files.
