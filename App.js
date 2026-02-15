import * as React from "react";
import {
  Animated,
  BackHandler,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  Vibration,
  View,
  PanResponder,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Button,
  Divider,
  IconButton,
  List,
  MD3DarkTheme,
  MD3LightTheme,
  PaperProvider,
  Snackbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useFonts } from "expo-font";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

// All data is local (expo-sqlite). No network. Works fully offline once built.
import {
  addLog,
  deleteExerciseEntry,
  getExerciseEntries,
  getLastExerciseEntry,
  initDatabase,
  startWorkout,
} from "./db/database";

// Layout constants
const TOP_PADDING = 8;
const GRID_PADDING = 12;
const PRESS_MOVE_THRESHOLD = 12;

// --- App colors: set hex codes here (use null to keep theme default) ---
const APP_COLORS = {
  // Milestone bar (reps slider)
  milestoneTrack: "#374151",
  milestoneDot: "#4b5563",
  milestoneDotSelected: "#4338ca",
  // Header shadow
  shadow: "#000",
  // Surfaces (null = use theme)
  background: null,
  surface: null,
  outline: null,
  outlineVariant: null,
  error: null,
  readyHighlight: "#333333",
};

/** Resolves colors: APP_COLORS override wins, else theme. */
function getAppColors(theme) {
  return {
    background: APP_COLORS.background ?? theme.colors.background,
    surface: APP_COLORS.surface ?? theme.colors.surface,
    outline: APP_COLORS.outline ?? theme.colors.outline,
    outlineVariant:
      APP_COLORS.outlineVariant ??
      theme.colors.outlineVariant ??
      theme.colors.outline,
    error: APP_COLORS.error ?? theme.colors.error,
    readyHighlight:
      APP_COLORS.readyHighlight ??
      theme.colors.tertiaryContainer ??
      theme.colors.primaryContainer,
  };
}

// Split definition (6 days) – from your earlier version
const SPLIT = [
  {
    name: "DAY 1. CHEST / TRICEPS / CORE",
    exercises: [
      "Barbell Bench Press (Flat)",
      "Machine Dip (Chest Focused)",
      "Cable Chest Fly (High To Low)",
      "Cable Overhead Extension",
      "Cable Pushdown",
      "Elbow Plank",
      "Hyperextension",
    ],
  },
  {
    name: "DAY 2. BACK / BICEPS / FOREARMS",
    exercises: [
      "Lat Pulldown (Wide Overhand Grip)",
      "Cable Row (Narrow Neutral Grip)",
      "Machine Row (Wide Overhand Grip)",
      "EZ-Bar Curl (Strict)",
      "Cable Curl (Face-Away)",
      "Cable Hammer Curl",
      "Cable Wrist Curl (Face-Away)",
    ],
  },
  {
    name: "DAY 3. LEGS / SHOULDERS / ABS",
    exercises: [
      "Leg Extension",
      "Leg Curl (Seated)",
      "Machine Shoulder Press",
      "Cable Lateral Raise (Unilateral)",
      "Peck-Deck Rear Delt Fly",
      "Machine Ab Crunch",
      "Cable Side Ab Crunch",
    ],
  },
  {
    name: "DAY 4. CHEST / TRICEPS / CORE",
    exercises: [
      "Dumbbell Bench Press (Incline)",
      "Machine Dip (Chest Focused)",
      "Cable Chest Fly (Low To High)",
      "Cable Overhead Extension",
      "Cable Pushdown",
      "Elbow Plank",
      "Hyperextension",
    ],
  },
  {
    name: "DAY 5. BACK / BICEPS / FOREARMS",
    exercises: [
      "Lat Pulldown (Medium Neutral Grip)",
      "Machine Row (Unilateral Neutral Grip)",
      "Cable Row (Wide Overhand Grip)",
      "EZ-Bar Curl (Strict)",
      "Machine Preacher Curl",
      "Cable Hammer Curl",
      "Cable Wrist Curl (Face-Away)",
    ],
  },
  {
    name: "DAY 6. LEGS / SHOULDERS / ABS",
    exercises: [
      "Leg Extension",
      "Leg Curl (Seated)",
      "Machine Shoulder Press",
      "Cable Lateral Raise (Unilateral)",
      "Peck-Deck Rear Delt Fly",
      "Machine Ab Crunch",
      "Cable Side Ab Crunch",
    ],
  },
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toISO(d = new Date()) {
  return d.toISOString();
}

function formatShortDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "2-digit",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(iso);
  }
}

/** European style: 15.01.26 (day.month.year) */
function formatDateEuropean(iso) {
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear()).slice(-2);
    return `${day}.${month}.${year}`;
  } catch {
    return String(iso);
  }
}

/** Log line: "30kg × 10 / 11" (weight with kg, no "reps" suffix) */
function formatLogLine(entry) {
  const w = entry.weight;
  const a = entry.top_reps ?? "—";
  const b = entry.back_reps ?? "—";
  return `${w}kg × ${a} / ${b}`;
}

function bumpNumber(
  raw,
  delta,
  { min = -Infinity, max = Infinity, decimals = 0 } = {},
) {
  const current = Number(String(raw ?? "").replace(",", "."));
  const base = Number.isFinite(current) ? current : 0;
  const next = clamp(base + delta, min, max);
  const fixed = next.toFixed(decimals);
  if (decimals <= 0) return fixed;
  // Trim trailing zeros (2.50 -> 2.5, 5.00 -> 5) while keeping needed precision (1.25).
  return fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function getSchemeForExercise(exerciseName) {
  const name = String(exerciseName || "")
    .trim()
    .toLowerCase();
  if (name === "barbell bench press (flat)")
    return { min: 3, max: 6, step: 1, unitShort: "reps" };
  if (name === "elbow plank")
    return { min: 30, max: 120, step: 15, unitShort: "sec" };
  return { min: 8, max: 12, step: 1, unitShort: "reps" };
}

function DayButton({ dayIndex, title, subtitle, onPress }) {
  const movedRef = React.useRef(false);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          movedRef.current = false;
        },
        onPanResponderMove: (_, { dx, dy }) => {
          if (
            Math.abs(dx) > PRESS_MOVE_THRESHOLD ||
            Math.abs(dy) > PRESS_MOVE_THRESHOLD
          ) {
            movedRef.current = true;
          }
        },
        onPanResponderRelease: () => {
          if (!movedRef.current && onPress) onPress();
        },
      }),
    [onPress],
  );

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <Surface
        elevation={1}
        style={{
          flex: 1,
          borderRadius: 16,
          justifyContent: "center",
          alignItems: "center",
          padding: 8,
        }}
      >
        <Text
          variant="titleMedium"
          style={{ textAlign: "center" }}
        >{`DAY ${dayIndex + 1}`}</Text>
        <Text
          variant="labelSmall"
          style={{ opacity: 0.75, marginTop: 6, textAlign: "center" }}
          numberOfLines={2}
        >
          {subtitle || title}
        </Text>
      </Surface>
    </View>
  );
}

// Milestone bar: progress-bar style with tappable circles at each step (no slider/drag)
const TRACK_HEIGHT = 5;
const DOT_SIZE = 10;
const SELECTED_DOT_SIZE = 20;
const BAR_HEIGHT = 44;

function MilestoneBar({
  min,
  max,
  step,
  value,
  onValueChange,
  style,
  barHeight = BAR_HEIGHT,
  trackHeight = TRACK_HEIGHT,
  dotSize = DOT_SIZE,
  selectedDotSize = SELECTED_DOT_SIZE,
  dotHitPadding = 8,
}) {
  const [barWidth, setBarWidth] = React.useState(0);

  const stepValues = React.useMemo(() => {
    const arr = [];
    for (let v = min; v <= max; v += step) arr.push(v);
    return arr;
  }, [min, max, step]);

  const handlePress = React.useCallback(
    (v) => {
      onValueChange(v);
      Vibration.vibrate(10);
    },
    [onValueChange],
  );

  const n = stepValues.length;

  return (
    <View
      style={[{ height: barHeight, justifyContent: "center" }, style]}
      onLayout={(e) => {
        const w = e?.nativeEvent?.layout?.width;
        if (typeof w === "number" && w > 0) setBarWidth(w);
      }}
    >
      {/* Track line: full width edge to edge */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: (barHeight - trackHeight) / 2,
          height: trackHeight,
          borderRadius: trackHeight / 2,
          backgroundColor: APP_COLORS.milestoneTrack,
        }}
      />
      {/* Dots: first left edge at 0, last right edge at barWidth, rest evenly between */}
      {stepValues.map((v, i) => {
        const selected = value === v;
        const size = selected ? selectedDotSize : dotSize;
        const dotLeft =
          barWidth > 0 && n > 1 ? (barWidth - size) * (i / (n - 1)) : 0;
        const pressableLeft = dotLeft - dotHitPadding / 2;
        return (
          <Pressable
            key={v}
            onPress={() => handlePress(v)}
            style={{
              position: "absolute",
              left: pressableLeft,
              top: 0,
              width: size + dotHitPadding,
              height: barHeight,
              alignItems: "center",
              justifyContent: "center",
            }}
            hitSlop={4}
          >
            <View
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: selected
                  ? APP_COLORS.milestoneDotSelected
                  : APP_COLORS.milestoneDot,
              }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function ExerciseCard({
  workoutId,
  exerciseName,
  refreshToken,
  onDidMutate,
  expanded,
  expandedMode,
  onOpenAdd,
  onOpenHistory,
  fillContainer,
  expandedWindowHeight,
  renderExpanded,
  onCollapseDone,
}) {
  const theme = useTheme();
  const colors = React.useMemo(() => getAppColors(theme), [theme]);
  const [loading, setLoading] = React.useState(true);
  const [lastEntry, setLastEntry] = React.useState(null);
  const [entries, setEntries] = React.useState([]);
  const expandAnim = React.useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const wasExpandedRef = React.useRef(expanded);

  const scheme = React.useMemo(
    () => getSchemeForExercise(exerciseName),
    [exerciseName],
  );

  const [weight, setWeight] = React.useState("0");
  const [set1, setSet1] = React.useState(scheme.min);
  const [set2, setSet2] = React.useState(scheme.min);
  const [snack, setSnack] = React.useState({ visible: false, text: "" });
  const didInitAddFormRef = React.useRef(false);
  const { width: viewportWidth } = useWindowDimensions();

  const relativeUi = React.useMemo(() => {
    // Keep current look as baseline around ~390pt width and scale proportionally.
    const scale = clamp(viewportWidth / 390, 0.85, 1.25);
    return {
      sidePadding: Math.round(16 * scale),
      weightRowGap: Math.max(4, Math.round(8 * scale)),
      setRowTightGap: Math.max(2, Math.round(8 * scale)),
      controlHeight: Math.round(44 * scale),
      controlRadius: Math.round(24 * scale),
      controlBorderWidth: Math.max(1, Math.round(1 * scale)),
      milestoneBarHeight: Math.round(44 * scale),
      milestoneTrackHeight: Math.max(2, Math.round(5 * scale)),
      milestoneDotSize: Math.max(6, Math.round(10 * scale)),
      milestoneSelectedDotSize: Math.max(12, Math.round(20 * scale)),
      milestoneDotHitPadding: Math.max(4, Math.round(8 * scale)),
    };
  }, [viewportWidth]);

  const weightSelection = React.useMemo(() => {
    // Keep the cursor/selection at the end so backspace/delete always works as expected.
    const len = String(weight ?? "").length;
    return { start: len, end: len };
  }, [weight]);

  const sortedEntries = React.useMemo(() => {
    const copy = [...entries];
    copy.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return copy;
  }, [entries]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [le, hist] = await Promise.all([
        getLastExerciseEntry({ exerciseName }),
        // Allow long histories; the history UI is scrollable.
        getExerciseEntries({ exerciseName, limit: 2000 }),
      ]);
      setLastEntry(le);
      setEntries(hist);
    } finally {
      setLoading(false);
    }
  }, [exerciseName]);

  React.useEffect(() => {
    let cancelled = false;
    if (workoutId != null) {
      (async () => {
        try {
          await refresh();
        } catch (err) {
          if (!cancelled) {
            console.error("refresh error:", err);
          }
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [workoutId, refresh, refreshToken]);

  React.useEffect(() => {
    setSet1(scheme.min);
    setSet2(scheme.min);
  }, [scheme.min]);

  React.useEffect(() => {
    // Auto-fill Add form from last entry, otherwise default to scheme min / 0.
    if (!expanded || expandedMode !== "add") {
      didInitAddFormRef.current = false;
      return;
    }
    if (didInitAddFormRef.current) return;

    const nextWeight =
      lastEntry?.weight != null ? String(lastEntry.weight) : "0";
    const nextSet1 =
      lastEntry?.top_reps != null
        ? clamp(Number(lastEntry.top_reps), scheme.min, scheme.max)
        : scheme.min;
    const nextSet2 =
      lastEntry?.back_reps != null
        ? clamp(Number(lastEntry.back_reps), scheme.min, scheme.max)
        : scheme.min;

    setWeight(nextWeight);
    setSet1(nextSet1);
    setSet2(nextSet2);
    didInitAddFormRef.current = true;
  }, [
    expanded,
    expandedMode,
    lastEntry?.weight,
    lastEntry?.top_reps,
    lastEntry?.back_reps,
    scheme.min,
    scheme.max,
  ]);

  async function onDelete(dateISO) {
    await deleteExerciseEntry({ exerciseName, dateISO });
    await refresh();
    if (onDidMutate) onDidMutate();
  }

  async function onSave() {
    const w = Number(String(weight).replace(",", "."));
    const s1 = Math.trunc(set1);
    const s2 = Math.trunc(set2);

    // Allow 0 as a valid default (treat it like "no weight", but don't block saving).
    if (!Number.isFinite(w) || w < 0) {
      setSnack({ visible: true, text: "Enter weight." });
      return;
    }
    if (!Number.isFinite(s1) || !Number.isFinite(s2)) {
      setSnack({ visible: true, text: "Enter both sets." });
      return;
    }

    const dateISO = toISO();
    await addLog({
      workoutId,
      exerciseName,
      dateISO,
      weight: w,
      unit: "kg",
      reps: clamp(s1, scheme.min, scheme.max),
      setType: "TOP_SET",
    });
    await addLog({
      workoutId,
      exerciseName,
      dateISO,
      weight: w,
      unit: "kg",
      reps: clamp(s2, scheme.min, scheme.max),
      setType: "BACK_OFF",
    });

    await refresh();
    if (onDidMutate) onDidMutate();
    const nextWeight = String(w);
    setWeight(nextWeight);
    setSet1(clamp(s1, scheme.min, scheme.max));
    setSet2(clamp(s2, scheme.min, scheme.max));
  }

  const lastLine =
    lastEntry && (lastEntry.top_reps != null || lastEntry.back_reps != null)
      ? `${formatLogLine(lastEntry)}`
      : "No record";

  const readyToUpgrade = React.useMemo(() => {
    return (
      Number(lastEntry?.top_reps) === scheme.max &&
      Number(lastEntry?.back_reps) === scheme.max
    );
  }, [lastEntry?.top_reps, lastEntry?.back_reps, scheme.max]);

  const contentContainerStyle = [
    {
      paddingTop: 0,
      paddingRight: relativeUi.sidePadding,
      paddingBottom: 0,
      paddingLeft: relativeUi.sidePadding,
    },
    fillContainer && {
      flex: 1,
      minHeight: 0,
      justifyContent: "space-between",
    },
    !fillContainer && { gap: 0 },
  ];

  React.useEffect(() => {
    // Manual animation (New Architecture safe). We animate the expanded content
    // as a single unit (height + opacity), and the parent keeps the card mounted during close.
    if (expanded && !wasExpandedRef.current) {
      expandAnim.setValue(0);
    }

    const anim = Animated.timing(expandAnim, {
      toValue: expanded ? 1 : 0,
      duration: expanded ? 260 : 220,
      easing: expanded ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      // We animate height, so we must stay on the JS driver.
      useNativeDriver: false,
    });

    anim.start(({ finished }) => {
      if (finished && !expanded) {
        if (onCollapseDone) onCollapseDone();
      }
    });

    wasExpandedRef.current = expanded;

    return () => {
      anim.stop();
    };
  }, [expanded, expandAnim, onCollapseDone]);

  return (
    <Surface
      elevation={1}
      style={[
        { borderRadius: 16, overflow: "hidden" },
        readyToUpgrade && { backgroundColor: colors.readyHighlight },
        fillContainer && { flex: 1, minHeight: 0 },
      ]}
    >
      {/* Header row: icon, title, description (unclickable), Add button, History button */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 12,
          paddingHorizontal: 16,
          minHeight: 56,
        }}
      >
        <List.Icon icon="dumbbell" style={{ marginRight: 16 }} />
        <View
          style={{
            flex: 1,
            minWidth: 0,
            justifyContent: "center",
            paddingRight: 8,
          }}
          pointerEvents="none"
        >
          <Text style={{ fontSize: 14 }} numberOfLines={1}>
            {exerciseName}
          </Text>
          <Text variant="bodySmall" style={{ opacity: 0.7 }} numberOfLines={1}>
            {lastLine}
          </Text>
        </View>
        <IconButton
          icon="plus"
          size={24}
          onPress={onOpenAdd}
          mode={expanded && expandedMode === "add" ? "contained" : "outlined"}
        />
        <IconButton
          icon="history"
          size={24}
          onPress={onOpenHistory}
          mode={
            expanded && expandedMode === "history" ? "contained" : "outlined"
          }
        />
      </View>

      {renderExpanded && (
        <Animated.View
          style={[
            {
              overflow: "hidden",
              height: expandedWindowHeight,
              opacity: expandAnim,
            },
            {
              transform: [
                {
                  translateY: expandAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-4, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[contentContainerStyle, { flex: 1, minHeight: 0 }]}>
            {workoutId == null ? (
              <View style={{ paddingVertical: 0, alignItems: "center" }}>
                <Text variant="bodySmall" style={{ opacity: 0.7 }}>
                  Starting workout…
                </Text>
              </View>
            ) : expandedMode === "add" ? (
              loading ? (
                <ActivityIndicator />
              ) : (
                <View>
                  <View style={{ marginBottom: relativeUi.setRowTightGap }}>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: relativeUi.weightRowGap,
                        alignItems: "flex-end",
                      }}
                    >
                      <View
                        style={{
                          flex: 26,
                          minWidth: 0,
                          justifyContent: "center",
                        }}
                      >
                        <TextInput
                          mode="outlined"
                          outlineStyle={{
                            borderRadius: relativeUi.controlRadius,
                            borderWidth: relativeUi.controlBorderWidth,
                          }}
                          style={{
                            width: "100%",
                            height: relativeUi.controlHeight,
                            backgroundColor: "transparent",
                            textAlign: "center",
                          }}
                          contentStyle={{
                            height: relativeUi.controlHeight,
                            textAlign: "center",
                          }}
                          value={weight}
                          onChangeText={(text) => {
                            setWeight(text);
                          }}
                          onFocus={() => {
                            const raw = String(weight ?? "").trim();
                            // Treat "0" like a placeholder: selecting the field clears it so typing replaces.
                            if (raw === "0") {
                              setWeight("");
                              return;
                            }
                          }}
                          selection={weightSelection}
                          onBlur={() => {
                            // Keep 0 as the default visible value.
                            if (String(weight ?? "").trim() === "") {
                              setWeight("0");
                            }
                          }}
                          keyboardType="decimal-pad"
                          caretHidden
                        />
                      </View>
                      {[
                        [1.25, "+1.25"],
                        [2.5, "+2.5"],
                        [5, "+5"],
                      ].map(([delta, label]) => (
                        <View
                          key={String(delta)}
                          style={{ flex: 13.5, minWidth: 0 }}
                        >
                          <Pressable
                            onPress={() =>
                              setWeight((v) =>
                                bumpNumber(v, delta, { min: 0, decimals: 2 }),
                              )
                            }
                            style={{
                              width: "100%",
                              height: relativeUi.controlHeight,
                              borderRadius: relativeUi.controlRadius,
                              justifyContent: "center",
                              alignItems: "center",
                              borderWidth: relativeUi.controlBorderWidth,
                              borderColor: colors.outline,
                            }}
                          >
                            <Text
                              variant="labelSmall"
                              style={{ textAlign: "center" }}
                            >
                              {label}
                            </Text>
                          </Pressable>
                        </View>
                      ))}
                      <View style={{ flex: 26, minWidth: 0 }}>
                        <Button
                          mode="contained"
                          onPress={onSave}
                          style={{
                            height: relativeUi.controlHeight,
                            borderRadius: relativeUi.controlRadius,
                          }}
                          contentStyle={{ height: relativeUi.controlHeight }}
                        >
                          SAVE
                        </Button>
                      </View>
                    </View>
                  </View>

                  <View
                    style={[
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: -relativeUi.setRowTightGap,
                      },
                    ]}
                  >
                    <View style={{ width: "15%", justifyContent: "center" }}>
                      <Text variant="labelMedium" numberOfLines={1}>
                        Set 1
                      </Text>
                    </View>
                    <View style={{ width: "70%", minWidth: 0 }}>
                      <MilestoneBar
                        min={scheme.min}
                        max={scheme.max}
                        step={scheme.step}
                        value={set1}
                        onValueChange={setSet1}
                        barHeight={relativeUi.milestoneBarHeight}
                        trackHeight={relativeUi.milestoneTrackHeight}
                        dotSize={relativeUi.milestoneDotSize}
                        selectedDotSize={relativeUi.milestoneSelectedDotSize}
                        dotHitPadding={relativeUi.milestoneDotHitPadding}
                      />
                    </View>
                    <View
                      style={{
                        width: "15%",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "flex-end",
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          justifyContent: "flex-end",
                          minWidth: 0,
                        }}
                      >
                        <Text variant="labelMedium" numberOfLines={1}>
                          {Math.round(set1)}
                        </Text>
                      </View>
                      <Text variant="labelMedium" numberOfLines={1}>
                        {" "}
                        {scheme.unitShort === "sec" ? "sec" : "Reps"}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ width: "15%", justifyContent: "center" }}>
                      <Text variant="labelMedium" numberOfLines={1}>
                        Set 2
                      </Text>
                    </View>
                    <View style={{ width: "70%", minWidth: 0 }}>
                      <MilestoneBar
                        min={scheme.min}
                        max={scheme.max}
                        step={scheme.step}
                        value={set2}
                        onValueChange={setSet2}
                        barHeight={relativeUi.milestoneBarHeight}
                        trackHeight={relativeUi.milestoneTrackHeight}
                        dotSize={relativeUi.milestoneDotSize}
                        selectedDotSize={relativeUi.milestoneSelectedDotSize}
                        dotHitPadding={relativeUi.milestoneDotHitPadding}
                      />
                    </View>
                    <View
                      style={{
                        width: "15%",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "flex-end",
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          justifyContent: "flex-end",
                          minWidth: 0,
                        }}
                      >
                        <Text variant="labelMedium" numberOfLines={1}>
                          {Math.round(set2)}
                        </Text>
                      </View>
                      <Text variant="labelMedium" numberOfLines={1}>
                        {" "}
                        {scheme.unitShort === "sec" ? "sec" : "Reps"}
                      </Text>
                    </View>
                  </View>
                </View>
              )
            ) : /* History mode */
            loading ? (
              <ActivityIndicator />
            ) : !entries.length ? (
              <Text variant="bodySmall" style={{ opacity: 0.7 }}>
                No history yet
              </Text>
            ) : (
              <View
                style={{
                  flex: 1,
                  minHeight: 0,
                }}
              >
                {/* Header row */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.outlineVariant,
                  }}
                >
                  {[
                    { key: "w", label: "Weight", flex: 1.05 },
                    { key: "s1", label: "Set 1", flex: 0.85 },
                    { key: "s2", label: "Set 2", flex: 0.85 },
                    { key: "d", label: "Date", flex: 1.25 },
                  ].map((c, idx) => (
                    <View
                      key={c.key}
                      style={{
                        flex: c.flex,
                        paddingVertical: 0,
                        paddingHorizontal: 8,
                        borderRightWidth:
                          idx < 3 ? StyleSheet.hairlineWidth : 0,
                        borderRightColor: colors.outlineVariant,
                      }}
                    >
                      <Text
                        variant="labelSmall"
                        style={{
                          opacity: 0.8,
                          textAlign: "center",
                          fontWeight: "600",
                        }}
                        numberOfLines={1}
                      >
                        {c.label}
                      </Text>
                    </View>
                  ))}
                  <View style={{ width: 40 }} />
                </View>

                {/* Scrollable rows */}
                <ScrollView
                  style={{ flex: 1, minHeight: 0 }}
                  contentContainerStyle={{ paddingBottom: 0 }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {sortedEntries.map((e, idx) => {
                    const isLast = idx === sortedEntries.length - 1;
                    return (
                      <View
                        key={String(e.date)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.outlineVariant,
                        }}
                      >
                        <View
                          style={{
                            flex: 1.05,
                            paddingVertical: 0,
                            paddingHorizontal: 8,
                            borderRightWidth: StyleSheet.hairlineWidth,
                            borderRightColor: colors.outlineVariant,
                          }}
                        >
                          <Text
                            variant="bodySmall"
                            style={{ textAlign: "center" }}
                            numberOfLines={1}
                          >
                            {e.weight ?? "—"}
                          </Text>
                        </View>
                        <View
                          style={{
                            flex: 0.85,
                            paddingVertical: 0,
                            paddingHorizontal: 8,
                            borderRightWidth: StyleSheet.hairlineWidth,
                            borderRightColor: colors.outlineVariant,
                          }}
                        >
                          <Text
                            variant="bodySmall"
                            style={{ textAlign: "center" }}
                            numberOfLines={1}
                          >
                            {e.top_reps ?? "—"}
                          </Text>
                        </View>
                        <View
                          style={{
                            flex: 0.85,
                            paddingVertical: 0,
                            paddingHorizontal: 8,
                            borderRightWidth: StyleSheet.hairlineWidth,
                            borderRightColor: colors.outlineVariant,
                          }}
                        >
                          <Text
                            variant="bodySmall"
                            style={{ textAlign: "center" }}
                            numberOfLines={1}
                          >
                            {e.back_reps ?? "—"}
                          </Text>
                        </View>
                        <View
                          style={{
                            flex: 1.25,
                            paddingVertical: 0,
                            paddingHorizontal: 8,
                          }}
                        >
                          <Text
                            variant="bodySmall"
                            style={{ textAlign: "center", opacity: 0.75 }}
                            numberOfLines={1}
                          >
                            {formatDateEuropean(e.date)}
                          </Text>
                        </View>

                        <IconButton
                          icon="trash-can-outline"
                          size={20}
                          onPress={() => onDelete(e.date)}
                          style={{ width: 40, margin: 0 }}
                          iconColor={colors.error}
                          hitSlop={12}
                        />
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        </Animated.View>
      )}

      <Snackbar
        visible={snack.visible}
        onDismiss={() => setSnack({ visible: false, text: "" })}
        duration={1600}
      >
        {snack.text}
      </Snackbar>
    </Surface>
  );
}

function RoutineRoute() {
  const [loading, setLoading] = React.useState(true);
  const [currentDayIndex, setCurrentDayIndex] = React.useState(null);
  const [workoutId, setWorkoutId] = React.useState(null);
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [expandedExercise, setExpandedExercise] = React.useState(null);
  const [closingExercise, setClosingExercise] = React.useState(null);
  const expandedExerciseName = expandedExercise?.name ?? null;
  const expandedMode = expandedExercise?.mode ?? "add";
  const { width: viewportWidth, height: viewportHeight } =
    useWindowDimensions();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const colors = React.useMemo(() => getAppColors(theme), [theme]);
  const layoutScale = React.useMemo(
    () => clamp(viewportWidth / 390, 0.85, 1.25),
    [viewportWidth],
  );
  const pagePadding = React.useMemo(
    () => Math.round(16 * layoutScale),
    [layoutScale],
  );
  const expandedWindowHeight = React.useMemo(
    () => Math.max(148, Math.round(viewportHeight * 0.1)),
    [viewportHeight],
  );

  const handleOpenAdd = React.useCallback(
    (exerciseName) => {
      if (expandedExerciseName === exerciseName && expandedMode === "add") {
        setClosingExercise({ name: exerciseName, mode: expandedMode });
        setExpandedExercise(null);
        return;
      }
      setClosingExercise(null);
      setExpandedExercise({ name: exerciseName, mode: "add" });
    },
    [expandedExerciseName, expandedMode],
  );

  const handleOpenHistory = React.useCallback(
    (exerciseName) => {
      if (expandedExerciseName === exerciseName && expandedMode === "history") {
        setClosingExercise({ name: exerciseName, mode: expandedMode });
        setExpandedExercise(null);
        return;
      }
      setClosingExercise(null);
      setExpandedExercise({ name: exerciseName, mode: "history" });
    },
    [expandedExerciseName, expandedMode],
  );

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initDatabase();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const contentStyle = React.useMemo(
    () => ({
      flex: 1,
      paddingTop: insets.top + TOP_PADDING,
      paddingLeft: insets.left + GRID_PADDING,
      paddingRight: insets.right + GRID_PADDING,
      paddingBottom: insets.bottom + GRID_PADDING,
    }),
    [insets.top, insets.left, insets.right, insets.bottom],
  );

  const fixedHeaderStyle = React.useMemo(
    () => ({
      paddingTop: insets.top + TOP_PADDING,
      paddingLeft: insets.left + GRID_PADDING,
      paddingRight: insets.right + GRID_PADDING,
      paddingBottom: 0,
      backgroundColor: colors.background,
      zIndex: 1,
      ...(Platform.OS === "ios"
        ? {
            shadowColor: APP_COLORS.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
          }
        : { elevation: 3 }),
    }),
    [insets, colors.background],
  );

  const scrollContentStyle = React.useMemo(
    () => ({
      paddingTop: GRID_PADDING,
      paddingLeft: insets.left + GRID_PADDING,
      paddingRight: insets.right + GRID_PADDING,
      paddingBottom: insets.bottom + GRID_PADDING,
      gap: 12,
      flexGrow: 1,
    }),
    [insets.left, insets.right, insets.bottom],
  );

  function openDay(dayIdx) {
    setCurrentDayIndex(dayIdx);
    setWorkoutId(null);
    setExpandedExercise(null);
    setClosingExercise(null);
    startWorkout({
      splitIndex: dayIdx,
      plannedName: SPLIT[dayIdx].name,
      startedAtISO: toISO(),
    }).then((id) => {
      setWorkoutId(id);
      setRefreshToken((x) => x + 1);
    });
  }

  function closeDay() {
    setCurrentDayIndex(null);
    setWorkoutId(null);
  }

  React.useEffect(() => {
    if (currentDayIndex === null) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeDay();
      return true;
    });
    return () => sub.remove();
  }, [currentDayIndex]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (currentDayIndex === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[contentStyle, { flexDirection: "row" }]}>
          <View style={{ width: "50%", paddingRight: GRID_PADDING / 2 }}>
            {[0, 1, 2].map((idx) => (
              <View
                key={idx}
                style={{ flex: 1, marginBottom: idx < 2 ? GRID_PADDING : 0 }}
              >
                <DayButton
                  dayIndex={idx}
                  title={SPLIT[idx].name}
                  subtitle={SPLIT[idx].name
                    .replace(/^DAY\s*\d+\s*\.?\s*/i, "")
                    .trim()}
                  onPress={() => openDay(idx)}
                />
              </View>
            ))}
          </View>
          <View style={{ width: "50%", paddingLeft: GRID_PADDING / 2 }}>
            {[3, 4, 5].map((idx) => (
              <View
                key={idx}
                style={{ flex: 1, marginBottom: idx < 5 ? GRID_PADDING : 0 }}
              >
                <DayButton
                  dayIndex={idx}
                  title={SPLIT[idx].name}
                  subtitle={SPLIT[idx].name
                    .replace(/^DAY\s*\d+\s*\.?\s*/i, "")
                    .trim()}
                  onPress={() => openDay(idx)}
                />
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  const day = SPLIT[currentDayIndex];
  const subtitle = day.name.replace(/^DAY\s*\d+\s*\.?\s*/i, "").trim();
  const headerPadding = 16;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={fixedHeaderStyle}>
          <Pressable
            onPress={closeDay}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Surface
              elevation={0}
              style={{
                padding: headerPadding,
                borderRadius: 16,
                backgroundColor: colors.surface,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text variant="titleMedium">{`DAY ${currentDayIndex + 1}`}</Text>
                <Text variant="bodySmall" style={{ opacity: 0.7 }}>
                  {subtitle}
                </Text>
              </View>
            </Surface>
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={scrollContentStyle}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {day.exercises.map((ex) => {
            const isExpanded = expandedExerciseName === ex;
            const isClosing = closingExercise?.name === ex;
            const isActiveCard = isExpanded || isClosing;
            const modeForCard = isExpanded
              ? expandedMode
              : isClosing
                ? closingExercise.mode
                : expandedMode;
            return (
              <View key={ex} style={{ minHeight: 0 }}>
                <ExerciseCard
                  workoutId={workoutId}
                  exerciseName={ex}
                  refreshToken={refreshToken}
                  onDidMutate={() => setRefreshToken((x) => x + 1)}
                  expanded={isExpanded}
                  expandedMode={modeForCard}
                  onOpenAdd={() => handleOpenAdd(ex)}
                  onOpenHistory={() => handleOpenHistory(ex)}
                  fillContainer={false}
                  expandedWindowHeight={expandedWindowHeight}
                  renderExpanded={isActiveCard}
                  onCollapseDone={
                    isClosing
                      ? () => {
                          // Only clear if this card is still the one closing.
                          setClosingExercise((cur) =>
                            cur?.name === ex ? null : cur,
                          );
                        }
                      : undefined
                  }
                />
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

export default function App() {
  // Preload MaterialCommunityIcons for offline reliability
  const [fontsLoaded] = useFonts({
    ...MaterialCommunityIcons.font,
  });

  const scheme = useColorScheme();
  const theme = scheme === "dark" ? MD3DarkTheme : MD3LightTheme;
  const colors = React.useMemo(() => getAppColors(theme), [theme]);

  // Wait for fonts to load before rendering icons
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <PaperProvider theme={theme}>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.background }}>
        <RoutineRoute />
      </SafeAreaProvider>
    </PaperProvider>
  );
}
