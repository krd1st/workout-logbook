import * as React from "react";
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  IconButton,
  List,
  Snackbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { getAppColors } from "../constants/colors";
import { bumpNumber, clamp, formatDateEuropean, formatLogLine, toISO } from "../utils/helpers";
import { useRelativeUi } from "../hooks/useRelativeUi";
import { SetRow } from "./SetRow";
import { ExerciseForm } from "./ExerciseForm";
import {
  addLog,
  deleteExerciseEntry,
  getExerciseEntries,
  getLastExerciseEntry,
  updateExercise,
} from "../../db/database";

export function ExerciseCard({
  workoutId,
  exerciseName,
  exerciseData,
  routineExerciseId,
  refreshToken,
  onDidMutate,
  expanded,
  expandedMode,
  onOpenAdd,
  onOpenHistory,
  onRemoveFromRoutine,
  onExerciseUpdated,
  onLongPress,
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
  const [editMode, setEditMode] = React.useState(false);
  const expandAnim = React.useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const wasExpandedRef = React.useRef(expanded);
  const ui = useRelativeUi();

  // Derive scheme from exerciseData (DB) if available, else default
  const scheme = React.useMemo(() => {
    if (exerciseData) {
      return {
        min: exerciseData.min_val,
        max: exerciseData.max_val,
        step: exerciseData.step,
        unitShort: exerciseData.unit_type === "sec" ? "sec" : "reps",
      };
    }
    return { min: 8, max: 12, step: 1, unitShort: "reps" };
  }, [exerciseData]);

  const [weight, setWeight] = React.useState("0");
  const [set1, setSet1] = React.useState(scheme.min);
  const [set2, setSet2] = React.useState(scheme.min);
  const [snack, setSnack] = React.useState({ visible: false, text: "" });
  const didInitAddFormRef = React.useRef(false);

  const weightSelection = React.useMemo(() => {
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

  async function handleEditExercise({ name, unitType, min, max, step }) {
    await updateExercise({
      oldName: exerciseName,
      name,
      unitType,
      min,
      max,
      step,
    });
    setEditMode(false);
    if (onExerciseUpdated) onExerciseUpdated();
    await refresh();
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
      paddingRight: ui.sidePadding,
      paddingBottom: 0,
      paddingLeft: ui.sidePadding,
    },
    fillContainer && {
      flex: 1,
      minHeight: 0,
      justifyContent: "space-between",
    },
    !fillContainer && { gap: 0 },
  ];

  React.useEffect(() => {
    if (expanded && !wasExpandedRef.current) {
      expandAnim.setValue(0);
    }

    const anim = Animated.timing(expandAnim, {
      toValue: expanded ? 1 : 0,
      duration: expanded ? 260 : 220,
      easing: expanded ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
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

  // Edit mode overlay
  if (editMode) {
    return (
      <Surface
        elevation={1}
        style={[
          { borderRadius: ui.cardBorderRadius, overflow: "hidden", padding: ui.gridPadding },
          fillContainer && { flex: 1, minHeight: 0 },
        ]}
      >
        <ExerciseForm
          initialName={exerciseName}
          initialUnitType={exerciseData?.unit_type ?? "reps"}
          initialMin={exerciseData?.min_val ?? 8}
          initialMax={exerciseData?.max_val ?? 12}
          initialStep={exerciseData?.step ?? 1}
          submitLabel="Save"
          onSubmit={handleEditExercise}
          onCancel={() => setEditMode(false)}
        />
      </Surface>
    );
  }

  return (
    <Surface
      elevation={1}
      style={[
        { borderRadius: ui.cardBorderRadius, overflow: "hidden" },
        readyToUpgrade && { backgroundColor: colors.readyHighlight },
        fillContainer && { flex: 1, minHeight: 0 },
      ]}
    >
      {/* Header row */}
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={200}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: ui.cardPaddingV,
          paddingHorizontal: ui.cardPaddingH,
          minHeight: ui.cardMinHeight,
        }}
      >
        <List.Icon icon="dumbbell" style={{ marginRight: ui.cardPaddingH }} />
        <View
          style={{
            flex: 1,
            minWidth: 0,
            justifyContent: "center",
            paddingRight: ui.tableCellPaddingH,
          }}
          pointerEvents="none"
        >
          <Text style={{ fontSize: ui.fontSizeBody }} numberOfLines={1}>
            {exerciseName}
          </Text>
          <Text variant="bodySmall" style={{ opacity: 0.7 }} numberOfLines={1}>
            {lastLine}
          </Text>
        </View>
        <IconButton
          icon="pencil-outline"
          size={ui.iconSm}
          onPress={() => setEditMode(true)}
        />
        {onRemoveFromRoutine && (
          <IconButton
            icon="close"
            size={ui.iconSm}
            onPress={onRemoveFromRoutine}
            iconColor={colors.error}
          />
        )}
        <IconButton
          icon="plus"
          size={ui.iconLg}
          onPress={onOpenAdd}
          mode={expanded && expandedMode === "add" ? "contained" : "outlined"}
        />
        <IconButton
          icon="history"
          size={ui.iconLg}
          onPress={onOpenHistory}
          mode={
            expanded && expandedMode === "history" ? "contained" : "outlined"
          }
        />
      </Pressable>

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
                  <View style={{ marginBottom: ui.setRowTightGap }}>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: ui.weightRowGap,
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
                            borderRadius: ui.controlRadius,
                            borderWidth: ui.controlBorderWidth,
                          }}
                          style={{
                            width: "100%",
                            height: ui.controlHeight,
                            backgroundColor: "transparent",
                            textAlign: "center",
                          }}
                          contentStyle={{
                            height: ui.controlHeight,
                            textAlign: "center",
                          }}
                          value={weight}
                          onChangeText={(text) => {
                            setWeight(text);
                          }}
                          onFocus={() => {
                            const raw = String(weight ?? "").trim();
                            if (raw === "0") {
                              setWeight("");
                              return;
                            }
                          }}
                          selection={weightSelection}
                          onBlur={() => {
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
                              height: ui.controlHeight,
                              borderRadius: ui.controlRadius,
                              justifyContent: "center",
                              alignItems: "center",
                              borderWidth: ui.controlBorderWidth,
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
                            height: ui.controlHeight,
                            borderRadius: ui.controlRadius,
                          }}
                          contentStyle={{ height: ui.controlHeight }}
                        >
                          LOG
                        </Button>
                      </View>
                    </View>
                  </View>

                  <SetRow
                    label="Set 1"
                    scheme={scheme}
                    value={set1}
                    onValueChange={setSet1}
                    relativeUi={ui}
                    style={{ marginBottom: -ui.setRowTightGap }}
                  />

                  <SetRow
                    label="Set 2"
                    scheme={scheme}
                    value={set2}
                    onValueChange={setSet2}
                    relativeUi={ui}
                  />
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
                        paddingHorizontal: ui.tableCellPaddingH,
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
                  <View style={{ width: ui.tableDeleteWidth }} />
                </View>

                {/* Scrollable rows */}
                <ScrollView
                  style={{ flex: 1, minHeight: 0 }}
                  contentContainerStyle={{ paddingBottom: 0 }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {sortedEntries.map((e) => {
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
                            paddingHorizontal: ui.tableCellPaddingH,
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
                            paddingHorizontal: ui.tableCellPaddingH,
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
                            paddingHorizontal: ui.tableCellPaddingH,
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
                            paddingHorizontal: ui.tableCellPaddingH,
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
                          icon="delete-outline"
                          size={ui.iconSm}
                          onPress={() => onDelete(e.date)}
                          mode="text"
                          style={{ width: ui.tableDeleteWidth, height: ui.iconLg, margin: 0 }}
                          iconColor={colors.error}
                          hitSlop={ui.hitSlopLg}
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
