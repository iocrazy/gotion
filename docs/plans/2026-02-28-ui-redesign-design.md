# Gotion UI Redesign — Linear Style

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Gotion floating TodoList UI from the current dark/glass morphism style to a Linear-inspired minimal dark theme with right-side slide-out detail panel.

**Architecture:** Pure CSS/component refactor — no backend changes. Replace the current dual-theme system (dark + glass) with a single cohesive dark theme. Add animated window resize for detail panel.

**Tech Stack:** React 19 + TailwindCSS 4 + Radix UI + Lucide icons (unchanged)

---

## Color System

| Token | Value | Usage |
|-------|-------|-------|
| `bg-base` | `#0A0A0F` | Main background |
| `bg-surface` | `#12121A` | Cards, panels |
| `bg-hover` | `#1A1A25` | Hover state |
| `border` | `rgba(255,255,255,0.06)` | Dividers, borders |
| `text-primary` | `rgba(255,255,255,0.90)` | Primary text |
| `text-secondary` | `rgba(255,255,255,0.45)` | Secondary text |
| `text-muted` | `rgba(255,255,255,0.25)` | Placeholder, disabled |
| `accent` | `#8B5CF6` | Purple accent (selection, active icons) |
| `accent-dim` | `rgba(139,92,246,0.15)` | Selected row background |
| `done` | `#34D399` | Completed status green |
| `danger` | `#F87171` | Overdue, high priority |
| `warn` | `#FBBF24` | Medium priority |

## Window Layout

### Default State (380×520)

```
┌──────────────────────────────────────┐
│ ● ● ●          Gotion         📌  ⚙ │  ← 28px title bar
├──────────────────────────────────────┤
│                                      │
│  ○ Design homepage        Mar 1  →   │  ← 40px task rows
│  ────────────────────────────────    │
│  ○ Fix auth bug           Today  →   │
│  ────────────────────────────────    │
│  ◉ Write tests              ✓    →   │
│  ────────────────────────────────    │
│  ○ Deploy v2.0            Mar 5  →   │
│                                      │
├──────────────────────────────────────┤
│  ＋ New Task...              📅  🚩  │  ← 48px input bar
│               ● Synced               │  ← 20px status bar
└──────────────────────────────────────┘
```

### Expanded State (700×520) — detail panel open

```
┌──────────────────┬───────────────────┐
│ ● ● ●  Gotion 📌│  Task Detail    ✕  │
├──────────────────┼───────────────────┤
│                  │                   │
│  ○ Design...  →  │  Design homepage  │
│  ──────────────  │                   │
│ [○ Fix bug]   →  │  ○ Todo  · Mar 1  │
│  ──────────────  │  ────────────     │
│  ◉ Write...   →  │                   │
│  ──────────────  │  Notes:           │
│  ○ Deploy...  →  │  [TipTap Editor]  │
│                  │                   │
├──────────────────┴───────────────────┤
│  ＋ New Task...              📅  🚩  │
│               ● Synced               │
└──────────────────────────────────────┘
```

## Component Specs

### TitleBar (28px height)
- Left: Custom traffic lights (close, minimize, pin-green-dot)
- Center: "Gotion" — `text-xs font-medium tracking-[0.2em] text-white/40`
- Right: Pin icon + Settings icon, `text-white/30` default, `text-accent` when active
- Remove standalone Group By and Sync buttons (move to Settings dropdown)

### TaskItem (40px height)
- Left: Circle checkbox (16px), unchecked `border-white/20`, done `bg-done` filled
- Center: Title `text-sm font-light tracking-wide`
- Right: Date label `text-[10px] text-secondary`, chevron `text-white/15`
- Selected: `bg-accent-dim` + 2px purple left border
- Done: title `line-through text-white/30`
- Separator: `border-b border-white/[0.04]`
- High priority: small red dot indicator

### AddTask (48px height)
- `bg-surface` background with top border
- Input: no background, placeholder `text-muted`
- Icons: `text-white/20`, hover brightens

### TaskDetailPanel (right side, ~320px width)
- Background: `bg-surface`, left border `border-white/[0.06]`
- Title: editable `text-lg font-light`
- Properties: Status pill + Due date in one row
- Notes: TipTap editor fills remaining space
- Window resize: `transition-all duration-200 ease-out`
- Close: Esc key or click outside or ✕ button

### StatusBar (20px height)
- Center: dot + label ("Synced" / "Syncing..." / "Offline")
- `text-[10px] text-muted`

## Removed Features
- Glass morphism theme (delete entirely)
- Theme toggle (dark only)
- Opacity slider
- GlassPanel component (replace with simple div)
- Standalone Group By button (move into Settings)

## Kept Features
- Pin/Always-on-top toggle
- Server URL configuration in Settings
- Priority picker (date/flag icons in AddTask)
- WebSocket sync status indicator
- Offline queue + SQLite cache
