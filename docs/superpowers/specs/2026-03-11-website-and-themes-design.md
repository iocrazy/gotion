# Gotion Web Official Site + Client Theme Switching

**Date:** 2026-03-11
**Status:** Approved

## Overview

Two features: (1) Deploy a web official site (Landing + Auth + Pricing + Admin Dashboard) on Cloudflare Pages; (2) Add multi-theme switching to the desktop client with an extensible theme system.

---

## Feature 1: Web Official Site (Cloudflare Pages)

### Decision

- Deploy as independent frontend on Cloudflare Pages (global CDN, zero-ops, high availability independent of NAS)
- Auth API calls to existing Gotion Server via `VITE_API_URL` (cross-origin with CORS)
- Merge existing `admin/` SPA into the website project — single frontend codebase

### Project Structure

```
website/                     # Migrated from reference/gotion
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx               # Router: Landing / Auth / Pricing / Admin
    ├── index.css             # Hand-drawn style global CSS
    ├── lib/
    │   └── api.ts            # API client, baseURL from VITE_API_URL
    ├── pages/
    │   ├── LandingPage.tsx
    │   ├── AuthPage.tsx      # Login / Register (email + password)
    │   ├── PricingPage.tsx   # Free vs Pro comparison
    │   └── admin/
    │       ├── AdminLayout.tsx
    │       ├── DashboardPage.tsx   # Stats: users, Pro users, revenue
    │       ├── UsersPage.tsx       # User list + resource usage
    │       ├── SubscriptionsPage.tsx
    │       └── PaymentsPage.tsx
    └── components/
        ├── Navbar.tsx
        └── Footer.tsx
```

### Routes

| Path | Page | Access |
|------|------|--------|
| `/` | Landing | Public |
| `/auth` | Login / Register | Public |
| `/pricing` | Pricing | Public |
| `/admin` | Dashboard | Admin only |
| `/admin/users` | User Management | Admin only |
| `/admin/subscriptions` | Subscription Management | Admin only |
| `/admin/payments` | Payment Records | Admin only |

### Auth Flow

- Login/Register calls `POST /api/auth/login` and `POST /api/auth/register` on the Gotion Server
- JWT token stored in localStorage
- Admin pages check `user.is_admin` — non-admin users see "Please download the desktop client"
- Admin auth mechanism unchanged: first registered user is auto-admin, existing admins can elevate others

### Migration from reference/gotion

The `reference/gotion` directory contains a working Vite + React project with:
- `App.tsx` — Landing, AuthPage (login/signup with email+password, OAuth buttons), PricingPage, Dashboard
- `index.css` — Hand-drawn style CSS (Patrick Hand font, sketchy borders, dot grid background)
- `server.ts` — Development server (not needed for production)

Migration steps:
1. Copy `reference/gotion` to `website/`
2. Remove `server.ts` (not needed — Cloudflare Pages handles serving)
3. Adapt `api.ts` to use `VITE_API_URL` for all API calls
4. Remove Dashboard view for regular users, keep for admin
5. Add admin pages from existing `admin/` SPA
6. Add react-router-dom for client-side routing (currently uses simple state-based view switching)

### Server Changes

1. **Restrict existing CORS** — Server already has `CorsLayer::permissive()` which is insecure. Replace with specific origin allowlist including the Cloudflare Pages domain
2. **Remove admin static hosting** — Delete `ServeDir`/`ServeFile` for `/admin` path in `main.rs`
3. **Remove admin build stage from Dockerfile** — No longer need `node:22-slim` admin-builder stage
4. **Delete `admin/` directory** — Functionality migrated to `website/src/pages/admin/`

### Cloudflare Pages Deployment

- Use Cloudflare Pages built-in Git integration (no separate GitHub Actions workflow needed)
- Build command: `cd website && npm run build`
- Output directory: `website/dist`
- Environment variable: `VITE_API_URL=https://your-gotion-server.com`
- SPA fallback: `/* → /index.html`

### Website Tech Stack

- React 19 + TypeScript + TailwindCSS 4 + Vite (consistent with client)
- react-router-dom for client-side routing
- Zustand for auth state management (consistent with admin SPA pattern)

---

## Feature 2: Client Theme Switching

### Decision

- CSS custom properties + theme registry (TypeScript object)
- Initial themes: Light (free) + Dark (free) + Neobrutalism/hand-drawn (Pro)
- Extensible: adding a new theme = one CSS variable set + registry entry
- UI: Sidebar menu entry → ThemeModal with preview cards

### Theme Data Structure

```typescript
// client/src/lib/themes.ts
interface ThemeDefinition {
  id: string;              // "light" | "dark" | "neobrutalism"
  name: string;            // Display name
  isPro: boolean;          // Requires Pro subscription
  preview: {               // Colors for preview card
    bg: string;
    surface: string;
    accent: string;
    text: string;
  };
  variables: Record<string, string>;  // CSS variable mappings
  special?: {              // Special styles (e.g., hand-drawn)
    fontFamily?: string;
    borderStyle?: string;
    backgroundPattern?: string;
  };
}
```

### Theme Definitions

Light and Dark values **preserve existing colors** from `client/src/index.css`:

| Variable | Light (existing) | Dark (existing) | Neobrutalism (new) |
|----------|-----------------|----------------|-------------------|
| `--bg-base` | `#F5F5F7` | `#0A0A0F` | `#fffdf8` |
| `--bg-surface` | `#FFFFFF` | `#12121A` | `#fff8ee` |
| `--bg-hover` | `#F0F0F2` | `#1A1A25` | `#fff0d4` |
| `--text-primary` | `#1F2937` | `rgba(255,255,255,0.90)` | `#18181b` |
| `--text-secondary` | `#6B7280` | `rgba(255,255,255,0.45)` | `#3f3f46` |
| `--text-muted` | `#9CA3AF` | `rgba(255,255,255,0.25)` | `#71717a` |
| `--border` | `#E5E7EB` | `rgba(255,255,255,0.06)` | `#18181b` |
| `--accent` | `#DC2626` | `#DC2626` | `#fcd34d` |
| `--accent-dim` | `rgba(220,38,38,0.08)` | `rgba(220,38,38,0.15)` | `#f59e0b` |
| `--done` | `#10B981` | `#34D399` | `#22c55e` |
| `--danger` | `#EF4444` | `#EF4444` | `#ef4444` |
| `--warn` | `#F59E0B` | `#FBBF24` | `#f59e0b` |
| `--font-family` | system | system | Patrick Hand, cursive |
| `--border-width` | `1px` | `1px` | `3px` |
| `--shadow` | none | none | `4px 4px 0px` |
| `--border-radius` | `8px` | `8px` | `255px 15px 225px 15px / 15px 225px 15px 255px` |
| background | solid | solid | dot grid |

### Theme Application Mechanism

**Migration from current approach:** The existing code uses `data-theme` attribute with CSS-defined variable blocks in `index.css`. The new system replaces this with JS-injected inline CSS variables, which is more flexible for an extensible theme registry.

1. User selects theme → `settingsStore.setTheme(themeId)`
2. CSS variables injected onto `document.documentElement.style` (replaces `data-theme` attribute approach)
3. Remove `:root` and `:root[data-theme="light"]` CSS blocks from `index.css` — all theme colors are now in `themes.ts`
4. Special themes add `data-theme-style` attribute (e.g., `"neobrutalism"`) for non-variable styles
5. Persisted to Tauri SQLite / localStorage

### Neobrutalism Special Styles

Applied via `[data-theme-style="neobrutalism"]` CSS selector:
- `font-family: "Patrick Hand", cursive`
- `border-width: 3px; border-color: #18181b`
- `box-shadow: 4px 4px 0px #18181b`
- `border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px` (sketchy)
- `background-image: radial-gradient(#e5e7eb 1px, transparent 1px); background-size: 24px 24px` (dot grid)
- Google Fonts import: Patrick Hand + Permanent Marker

### settingsStore Changes

```typescript
// Current: theme: "dark" | "light"
// New: themeId: string (default "light")

// New methods:
setTheme(themeId: string): void   // Switch theme + persist
getTheme(): ThemeDefinition       // Get current theme definition
```

**Migration for existing users:** On load, if the store finds the old `theme` field instead of `themeId`, map `"dark"` → `"dark"` and `"light"` → `"light"` as themeId, then persist the new format. This is a one-time transparent migration.

**Non-Tauri (browser dev mode):** Use localStorage for theme persistence (key: `gotion_theme_id`). Current code hardcodes "light" in browser mode — fix to read from localStorage with "light" as fallback.

### Font Loading Fallback

Neobrutalism theme imports Google Fonts (Patrick Hand, Permanent Marker). Fallback strategy:
- CSS `font-family` includes fallback chain: `"Patrick Hand", "Comic Sans MS", cursive, sans-serif`
- If fonts fail to load (offline, China GFW), the theme still works with system cursive fonts
- Future improvement: bundle fonts as static assets for offline support

### Theme Selector UI

**Entry point:** New "Theme" item in MoreOptionsMenu (Palette icon from lucide-react)

**ThemeModal:**
- Displays all themes as preview cards in a grid
- Each ThemeCard renders a mini UI preview using the theme's own colors
- Current theme shows ✓ checkmark
- Pro themes show ProBadge (crown icon) for non-Pro users

**Components:**
- `ThemeModal.tsx` — Modal container
- `ThemeCard.tsx` — Individual theme preview card

**Interaction flow:**
1. Click "Theme" in MoreOptionsMenu → open ThemeModal
2. Click free theme → apply immediately, close modal
3. Click Pro theme (non-Pro user) → open UpgradeModal
4. Click Pro theme (Pro user) → apply immediately, close modal

### Pro Gating

- Light and Dark: free for all users
- Neobrutalism: requires Pro subscription
- Future themes can be individually flagged as free or Pro via `isPro` field

---

## Files to Create/Modify

### New Files
- `website/` — entire directory (migrated from `reference/gotion` + merged `admin/`)
- `client/src/lib/themes.ts` — theme definitions and registry
- `client/src/components/ThemeModal.tsx` — theme selection modal
- `client/src/components/ThemeCard.tsx` — theme preview card

### Modified Files
- `server/src/main.rs` — restrict CORS from permissive to specific origin, remove admin static hosting
- `server/Cargo.toml` — ensure `tower-http` cors feature enabled
- `server/Dockerfile` — remove admin build stage
- `client/src/index.css` — remove `:root` and `[data-theme="light"]` CSS variable blocks (moved to themes.ts), add neobrutalism special styles via `[data-theme-style]`
- `client/src/stores/settingsStore.ts` — extend theme from binary to multi-theme with migration
- `client/src/components/MoreOptionsMenu.tsx` — add Theme menu item
- `CLAUDE.md` — add `website/` to project structure

### Deleted
- `admin/` — entire directory (merged into website)
