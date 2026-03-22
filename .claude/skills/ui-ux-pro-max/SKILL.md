---
name: ui-ux-pro-max
description: "UI/UX design intelligence for mobile. Enforces minimalist, clean design with proper spacing, touch targets, accessibility, and Material Design / Apple HIG conventions for React Native apps."
---

# UI/UX Pro Max - Design Intelligence (Mobile Focus)

## When to Apply

Use when the task involves UI structure, visual design, interaction patterns, or user experience.

## Core Principles for This Project

This is a **personal minimalist workout tracker**. Design must be:
- **Clean & minimal** — no visual clutter, generous whitespace
- **Touch-first** — all targets ≥44pt, comfortable spacing
- **Dark mode native** — designed for dark theme first
- **Consistent** — same spacing rhythm, icon style, typography scale everywhere

## Priority Rules

### 1. Accessibility (CRITICAL)
- Contrast 4.5:1 for text, 3:1 for UI elements
- Visible focus states on interactive elements
- Screen reader labels on icon-only buttons
- Support Dynamic Type / system text scaling
- Respect prefers-reduced-motion

### 2. Touch & Interaction (CRITICAL)
- Min 44×44pt touch targets (extend hit area with hitSlop if visual is smaller)
- Min 8px gap between touch targets
- Visual feedback on press within 100ms (opacity/scale, not layout shift)
- Don't rely on hover — tap/press only
- Use haptic feedback for confirmations sparingly
- Use movement threshold before starting drag to avoid accidental drags

### 3. Layout & Spacing (HIGH)
- Use 4/8dp spacing system consistently
- Respect safe areas (notch, gesture bar, status bar)
- Mobile-first — content fits viewport, no horizontal scroll
- Fixed bars (header/footer) must not obscure scrollable content
- Consistent content padding across all screens
- Visual hierarchy via size, spacing, contrast — not color alone

### 4. Typography (MEDIUM)
- Base 16px body, line-height 1.5
- Consistent type scale (12/14/16/18/24/32)
- Font weight hierarchy: Bold headings (600-700), Regular body (400), Medium labels (500)
- Use tabular/monospace figures for numbers in data columns
- Prefer wrapping over truncation; use ellipsis only when necessary

### 5. Animation (MEDIUM)
- 150-300ms for micro-interactions, ≤400ms for transitions
- Use transform/opacity only — never animate width/height/top/left
- ease-out for entering, ease-in for exiting
- Exit animations shorter than enter (~60-70%)
- Animations must be interruptible — user tap cancels immediately
- Subtle scale (0.95-1.05) on press for tappable elements

### 6. Forms & Feedback (MEDIUM)
- Visible labels (not placeholder-only)
- Error messages near the field with recovery guidance
- Confirm before destructive actions
- Loading states for >300ms operations
- Disabled elements: reduced opacity (0.38-0.5) + no interaction
- Auto-dismiss toasts in 3-5s

### 7. Navigation (HIGH)
- Predictable back behavior — preserve scroll/state
- Bottom nav max 5 items with labels + icons
- Modals must have clear dismiss affordance
- Don't use modals for primary navigation flows
- Current location visually highlighted in nav

## Common Anti-Patterns to Avoid

| Don't | Do Instead |
|-------|-----------|
| Emoji as icons | SVG icons (Lucide, @expo/vector-icons) |
| Hardcoded hex colors | Semantic color tokens from theme |
| Random spacing values | 4/8dp rhythm system |
| Placeholder-only labels | Visible persistent labels |
| Layout-shifting press states | transform/opacity press feedback |
| Icon-only buttons without labels | Add accessibilityLabel |
| Nested conflicting gestures | One primary gesture per region |
| Color-only meaning | Add icon/text alongside color |
| Cramped touch targets | ≥44pt with ≥8px gaps |
| Mixing icon styles | One consistent icon family |

## Pre-Delivery Checklist

- [ ] All touch targets ≥44pt with ≥8px gaps
- [ ] Press feedback on all interactive elements
- [ ] Safe areas respected (header, footer, gesture bar)
- [ ] 4/8dp spacing rhythm maintained
- [ ] Dark mode contrast verified (text ≥4.5:1)
- [ ] No emoji icons — all SVG/vector
- [ ] Scroll content not hidden behind fixed bars
- [ ] Destructive actions require confirmation
- [ ] Animations ≤300ms, interruptible
- [ ] Consistent typography scale used
