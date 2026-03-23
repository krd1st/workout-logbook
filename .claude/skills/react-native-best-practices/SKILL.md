---
name: react-native-best-practices
description: React Native performance optimization guidelines for FPS, TTI, bundle size, memory leaks, re-renders, and animations. Based on Callstack's Ultimate Guide.
---

# React Native Best Practices

## When to Apply
- Debugging slow/janky UI or animations
- Investigating memory leaks
- Optimizing app startup time
- Reducing bundle or app size
- Profiling performance
- Reviewing code for performance issues

## Critical Rules

### Lists
- NEVER use ScrollView for dynamic lists — use FlatList or FlashList
- Always provide `keyExtractor` and `getItemLayout` when possible
- Use `removeClippedSubviews` for long lists
- Use `windowSize`, `maxToRenderPerBatch`, `initialNumToRender` to control rendering

### Re-renders
- Use `React.memo` for list item components
- Use `useCallback` for event handlers passed as props
- Use `useMemo` for expensive computations
- Prefer refs over state for values that don't affect rendering
- Use atomic state (individual useState calls) over single large state objects

### Animations
- Always use `useNativeDriver: true` for Animated API
- Prefer Reanimated worklets over Animated API for complex animations
- Never animate `width`, `height`, `top`, `left` — use `transform` and `opacity`
- Keep animations on the UI thread — avoid JS thread involvement

### TextInput
- Controlled TextInputs cause re-renders on every keystroke
- For forms with many inputs, consider uncontrolled patterns or debounced updates
- On Android, `selectionColor="transparent"` removes the selection handle

### Bottom Sheets (@gorhom/bottom-sheet)
- `BottomSheetModal` registers its own BackHandler — be aware of LIFO conflicts
- Use `enableDynamicSizing={false}` with explicit `snapPoints` for predictable sizing
- Use `enableContentPanningGesture={false}` to prevent gesture conflicts with ScrollViews inside
- For keyboard handling: change snapPoints dynamically based on keyboard visibility

### Bundle Size
- Avoid barrel imports — import directly from source files
- Use `expo export` to verify bundle compiles cleanly
- Enable R8 for Android production builds

### Startup (TTI)
- Pre-load data during splash screen
- Initialize database before showing main UI
- Pass preloaded data as props instead of loading in each screen

## Problem → Fix Mapping

| Problem | Fix |
|---------|-----|
| List jank | FlatList/FlashList + React.memo items |
| Too many re-renders | React.memo + useCallback + atomic state |
| Animation drops frames | useNativeDriver + transform/opacity only |
| Slow startup | Pre-load in App.js during splash |
| TextInput lag | Uncontrolled or debounced updates |
| Large bundle | Direct imports, tree shaking, R8 |
| Back button conflicts | Track sheet state with refs, re-register BackHandler on sheet close |
