import * as React from "react";
import {
  BackHandler,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  IconButton,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_COLORS, getAppColors } from "../constants/colors";
import { clamp, formatDateEuropean, toISO } from "../utils/helpers";
import { useRelativeUi } from "../hooks/useRelativeUi";
import { DayButton } from "../components/DayButton";
import { ExerciseCard } from "../components/ExerciseCard";
import { ExerciseForm } from "../components/ExerciseForm";
import { SetRow } from "../components/SetRow";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import * as Haptics from "expo-haptics";
import {
  initDatabase,
  startWorkout,
  getRoutines,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  getRoutineExercises,
  addExerciseToRoutine,
  removeExerciseFromRoutine,
  createExercise,
  reorderRoutines,
  reorderRoutineExercises,
  addLog,
  deleteExerciseSession,
  getExerciseEntriesGrouped,
  getLastExerciseSets,
  updateExercise,
} from "../../db/database";

export function RoutineScreen({ dataReady = true, onBack }) {
  const [loading, setLoading] = React.useState(!dataReady);
  const [routines, setRoutines] = React.useState([]);
  const [currentRoutine, setCurrentRoutine] = React.useState(null);
  const [routineExercises, setRoutineExercises] = React.useState([]);
  const [workoutId, setWorkoutId] = React.useState(null);
  const [refreshToken, setRefreshToken] = React.useState(0);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const colors = React.useMemo(() => getAppColors(theme), [theme]);
  const ui = useRelativeUi();

  // UI state for inline forms
  const [showAddRoutine, setShowAddRoutine] = React.useState(false);
  const [newRoutineName, setNewRoutineName] = React.useState("");
  const [editingRoutineId, setEditingRoutineId] = React.useState(null);
  const [editRoutineName, setEditRoutineName] = React.useState("");
  const [showAddExercise, setShowAddExercise] = React.useState(false);
  const [editingHeaderName, setEditingHeaderName] = React.useState(false);
  const [headerNameDraft, setHeaderNameDraft] = React.useState("");
  const [confirmAction, setConfirmAction] = React.useState(null);
  const [listAreaHeight, setListAreaHeight] = React.useState(0);
  const [exerciseAreaHeight, setExerciseAreaHeight] = React.useState(0);
  const [exFooterMeasured, setExFooterMeasured] = React.useState(0);
  const [routineFooterMeasured, setRoutineFooterMeasured] = React.useState(0);

  // Exercise detail modal state
  const [selectedExercise, setSelectedExercise] = React.useState(null);
  const [modalTab, setModalTab] = React.useState("log"); // "log" | "edit" | "history"
  const [modalLoading, setModalLoading] = React.useState(false);
  const [modalHistory, setModalHistory] = React.useState([]); // grouped sessions
  // sets: array of { weight: string, reps: number }
  const [sets, setSets] = React.useState([]);

  const loadRoutines = React.useCallback(async () => {
    const rows = await getRoutines();
    setRoutines(rows);
  }, []);

  const loadRoutineExercises = React.useCallback(async (routineId) => {
    const rows = await getRoutineExercises(routineId);
    setRoutineExercises(rows);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initDatabase();
        await loadRoutines();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadRoutines]);

  const footerPadding = insets.bottom + ui.gridPadding;

  const fixedHeaderStyle = React.useMemo(
    () => ({
      paddingTop: insets.top + ui.gridPadding,
      paddingLeft: insets.left + ui.gridPadding,
      paddingRight: insets.right + ui.gridPadding,
      paddingBottom: ui.gridPadding,
      backgroundColor: colors.background,
      zIndex: 1,
      ...(Platform.OS === "ios"
        ? {
            shadowColor: APP_COLORS.shadow,
            shadowOffset: { width: 0, height: ui.shadowOffsetH },
            shadowOpacity: 0.08,
            shadowRadius: ui.shadowRadius,
          }
        : { elevation: 3 }),
    }),
    [insets, colors.background, ui],
  );

  // --- Exercise modal helpers ---
  const refreshModal = React.useCallback(async (exName) => {
    setModalLoading(true);
    try {
      const hist = await getExerciseEntriesGrouped({ exerciseName: exName, limit: 500 });
      setModalHistory(hist);
    } finally {
      setModalLoading(false);
    }
  }, []);

  function openExerciseModal(re) {
    setSelectedExercise(re);
    setModalTab("log");
    setModalLoading(true);

    const numSets = re.num_sets ?? 2;
    const scheme = { min: re.min_val ?? 8, max: re.max_val ?? 12 };

    (async () => {
      const [lastSession, hist] = await Promise.all([
        getLastExerciseSets({ exerciseName: re.exercise_name }),
        getExerciseEntriesGrouped({ exerciseName: re.exercise_name, limit: 500 }),
      ]);
      setModalHistory(hist);

      // Pre-fill sets from last session or create empty ones
      const prefilled = [];
      for (let i = 0; i < numSets; i++) {
        const prev = lastSession?.sets?.[i];
        prefilled.push({
          weight: prev?.weight != null ? String(prev.weight) : "0",
          reps: prev?.reps != null ? clamp(Number(prev.reps), scheme.min, scheme.max) : scheme.min,
        });
      }
      setSets(prefilled);
      setModalLoading(false);
    })();
  }

  function closeExerciseModal() {
    setSelectedExercise(null);
  }

  const modalScheme = React.useMemo(() => {
    if (!selectedExercise) return { min: 8, max: 12, step: 1, unitShort: "reps" };
    return {
      min: selectedExercise.min_val ?? 8,
      max: selectedExercise.max_val ?? 12,
      step: selectedExercise.step ?? 1,
      unitShort: selectedExercise.unit_type === "sec" ? "sec" : "reps",
    };
  }, [selectedExercise]);

  function updateSet(index, field, value) {
    setSets((prev) => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }

  function addSet() {
    setSets((prev) => [...prev, { weight: prev.length ? prev[prev.length - 1].weight : "0", reps: modalScheme.min }]);
  }

  async function onSaveLog() {
    if (!selectedExercise || !workoutId || sets.length === 0) return;
    const dateISO = toISO();
    for (let i = 0; i < sets.length; i++) {
      const w = Number(String(sets[i].weight).replace(",", "."));
      if (!Number.isFinite(w) || w < 0) continue;
      await addLog({
        workoutId,
        exerciseName: selectedExercise.exercise_name,
        dateISO,
        weight: w,
        unit: "kg",
        reps: clamp(Math.trunc(sets[i].reps), modalScheme.min, modalScheme.max),
        setNumber: i + 1,
      });
    }
    await refreshModal(selectedExercise.exercise_name);
    setRefreshToken((x) => x + 1);
  }

  async function onDeleteSession(dateISO) {
    if (!selectedExercise) return;
    await deleteExerciseSession({ exerciseName: selectedExercise.exercise_name, dateISO });
    await refreshModal(selectedExercise.exercise_name);
    setRefreshToken((x) => x + 1);
  }

  async function handleEditExercise({ name, unitType, min, max, step, numSets }) {
    if (!selectedExercise) return;
    await updateExercise({ oldName: selectedExercise.exercise_name, name, unitType, min, max, step, numSets });
    closeExerciseModal();
    if (currentRoutine) await loadRoutineExercises(currentRoutine.id);
    setRefreshToken((x) => x + 1);
  }

  // --- Routine CRUD ---
  async function openDay(routine) {
    setCurrentRoutine(routine);
    setWorkoutId(null);
    setShowAddExercise(false);
    await loadRoutineExercises(routine.id);
    startWorkout({
      splitIndex: routine.sort_order,
      plannedName: routine.name,
      startedAtISO: toISO(),
      routineId: routine.id,
    }).then((id) => {
      setWorkoutId(id);
      setRefreshToken((x) => x + 1);
    });
  }

  function closeDay() {
    setCurrentRoutine(null);
    setWorkoutId(null);
    setRoutineExercises([]);
  }

  async function handleCreateRoutine() {
    const trimmed = newRoutineName.trim();
    if (!trimmed) return;
    await createRoutine({ name: trimmed });
    setNewRoutineName("");
    setShowAddRoutine(false);
    await loadRoutines();
  }

  async function handleSaveRoutineName() {
    const trimmed = editRoutineName.trim();
    if (!trimmed || !editingRoutineId) return;
    await updateRoutine({ id: editingRoutineId, name: trimmed });
    setEditingRoutineId(null);
    setEditRoutineName("");
    if (currentRoutine?.id === editingRoutineId) {
      setCurrentRoutine((r) => ({ ...r, name: trimmed }));
    }
    await loadRoutines();
  }

  function handleDeleteRoutine(routine) {
    setConfirmAction({
      title: "Delete Routine",
      message: "Are you sure?",
      label: "Delete",
      onConfirm: async () => {
        setConfirmAction(null);
        await deleteRoutine(routine.id);
        if (currentRoutine?.id === routine.id) closeDay();
        await loadRoutines();
      },
    });
  }

  async function handleAddExerciseSubmit({ name, unitType, min, max, step, numSets }) {
    try {
      await createExercise({ name, unitType, min, max, step, numSets });
    } catch {
      // Already exists — that's fine.
    }
    await addExerciseToRoutine({ routineId: currentRoutine.id, exerciseName: name });
    setShowAddExercise(false);
    await loadRoutineExercises(currentRoutine.id);
  }

  function handleRemoveExercise(re) {
    setConfirmAction({
      title: "Remove Exercise",
      message: "Are you sure?",
      label: "Remove",
      onConfirm: async () => {
        setConfirmAction(null);
        closeExerciseModal();
        await removeExerciseFromRoutine(re.id);
        await loadRoutineExercises(currentRoutine.id);
      },
    });
  }

  async function handleRoutineReorder(reordered) {
    requestAnimationFrame(() => setRoutines(reordered));
    await reorderRoutines(reordered.map((r) => r.id));
  }

  async function handleExerciseReorder(reordered) {
    requestAnimationFrame(() => setRoutineExercises(reordered));
    await reorderRoutineExercises(reordered.map((re) => re.id));
  }

  React.useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (confirmAction !== null) {
        setConfirmAction(null);
        return true;
      }
      if (selectedExercise !== null) {
        closeExerciseModal();
        return true;
      }
      if (showAddExercise) {
        setShowAddExercise(false);
        return true;
      }
      if (currentRoutine !== null) {
        closeDay();
        return true;
      }
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [currentRoutine, onBack, showAddExercise, selectedExercise, confirmAction]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  // --- Height calculations ---
  const MAX_FILL = 7;
  const listTopPad = ui.gridPadding;
  const innerHeight = listAreaHeight - routineFooterMeasured - listTopPad - insets.top;
  const countForHeight = (n) => Math.max(n, 1);
  const itemHeightFor = (n) => Math.max((innerHeight - n * ui.gridPadding) / n, 48);
  const fixedItemHeight = itemHeightFor(MAX_FILL);
  const nonScrollItemHeight = itemHeightFor(countForHeight(routines.length));
  const itemHeight = (listAreaHeight > 0 && routineFooterMeasured > 0)
    ? (routines.length > MAX_FILL ? fixedItemHeight : nonScrollItemHeight)
    : null;

  const exInnerHeight = exerciseAreaHeight - exFooterMeasured - ui.gridPadding;
  const totalExGaps = MAX_FILL * ui.gridPadding;
  const exerciseItemHeight = (exerciseAreaHeight > 0 && exFooterMeasured > 0)
    ? Math.max(Math.ceil((exInnerHeight - totalExGaps) / MAX_FILL), 48)
    : null;

  const renderRoutineItem = React.useCallback(({ item, drag }) => {
    return (
      <ScaleDecorator activeScale={1.03}>
        <View style={{ height: itemHeight ?? undefined, marginBottom: ui.gridPadding }}>
          <DayButton
            dayIndex={0}
            title={item.name}
            subtitle=""
            onPress={() => openDay(item)}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              drag();
            }}
          />
        </View>
      </ScaleDecorator>
    );
  }, [itemHeight, ui.gridPadding]);

  const renderExerciseItem = React.useCallback(({ item: re, drag }) => {
    return (
      <ScaleDecorator activeScale={1.03}>
        <View style={{ height: exerciseItemHeight ?? undefined, marginBottom: ui.gridPadding }}>
          <ExerciseCard
            workoutId={workoutId}
            exerciseName={re.exercise_name}
            exerciseData={{
              name: re.exercise_name,
              unit_type: re.unit_type,
              min_val: re.min_val,
              max_val: re.max_val,
              step: re.step,
            }}
            refreshToken={refreshToken}
            onPress={() => openExerciseModal(re)}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              drag();
            }}
          />
        </View>
      </ScaleDecorator>
    );
  }, [exerciseItemHeight, ui.gridPadding, workoutId, refreshToken]);

  // --- Shared modal backdrop helpers ---
  const smallModal = (visible, onClose, children) => (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={() => { Keyboard.dismiss(); onClose(); }} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }} pointerEvents="box-none">
          <Surface elevation={3} style={{ width: "80%", maxWidth: 340, borderRadius: ui.cardBorderRadius, padding: ui.gridPadding * 1.5 }}>
            {children}
          </Surface>
        </View>
      </View>
    </Modal>
  );

  const largeModal = (visible, onClose, children) => (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        {/* Backdrop — separate layer so it doesn't wrap content */}
        <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={() => { Keyboard.dismiss(); onClose(); }} />
        {/* Content — not a child of Pressable, so ScrollView works */}
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }} pointerEvents="box-none">
          <Surface elevation={3} style={{ width: "92%", aspectRatio: 3 / 4, borderRadius: ui.cardBorderRadius, padding: ui.gridPadding * 1.5 }}>
            {children}
          </Surface>
        </View>
      </View>
    </Modal>
  );

  // --- Confirm modal ---
  const confirmModal = smallModal(
    confirmAction !== null,
    () => setConfirmAction(null),
    <>
      <Text variant="titleMedium" style={{ marginBottom: ui.gridPadding * 0.5 }}>
        {confirmAction?.title}
      </Text>
      <Text variant="bodyMedium" style={{ marginBottom: ui.gridPadding }}>
        {confirmAction?.message}
      </Text>
      <View style={{ flexDirection: "row", gap: ui.gridPadding * 0.5 }}>
        <Button mode="outlined" onPress={() => setConfirmAction(null)} style={{ flex: 1, borderRadius: ui.controlRadius }}>
          Cancel
        </Button>
        <Button mode="contained" onPress={confirmAction?.onConfirm} style={{ flex: 1, borderRadius: ui.controlRadius }} buttonColor={colors.error}>
          {confirmAction?.label}
        </Button>
      </View>
    </>,
  );

  // --- Exercise detail modal ---
  const exerciseModal = largeModal(
    selectedExercise !== null,
    closeExerciseModal,
    selectedExercise && (
      <View style={{ flex: 1 }}>
        {/* Header: title + edit/history icons */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: ui.gridPadding }}>
          <Text variant="titleLarge" style={{ flex: 1 }} numberOfLines={1}>
            {selectedExercise.exercise_name}
          </Text>
          <IconButton
            icon="pencil-outline"
            size={ui.iconLg}
            onPress={() => setModalTab(modalTab === "edit" ? "log" : "edit")}
            mode={modalTab === "edit" ? "contained" : "outlined"}
            style={{ marginLeft: ui.gridPadding * 0.25 }}
          />
          <IconButton
            icon="history"
            size={ui.iconLg}
            onPress={() => setModalTab(modalTab === "history" ? "log" : "history")}
            mode={modalTab === "history" ? "contained" : "outlined"}
            style={{ marginLeft: ui.gridPadding * 0.25 }}
          />
        </View>

        {/* Log tab */}
        {modalTab === "log" && (
          modalLoading ? <ActivityIndicator style={{ flex: 1 }} /> : (
            <View style={{ flex: 1, justifyContent: "space-between" }}>
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {sets.map((s, i) => (
                  <View key={i} style={{ marginBottom: ui.gridPadding * 1.5 }}>
                    {/* Weight input for this set */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: ui.gridPadding * 0.5, marginBottom: ui.gridPadding * 0.5 }}>
                      <Text variant="labelMedium" style={{ width: 50 }}>Set {i + 1}</Text>
                      <TextInput
                        mode="outlined"
                        outlineStyle={{ borderRadius: ui.controlRadius, borderWidth: ui.controlBorderWidth }}
                        style={{ flex: 1, height: ui.controlHeight, backgroundColor: "transparent", textAlign: "center" }}
                        contentStyle={{ height: ui.controlHeight, textAlign: "center" }}
                        value={s.weight}
                        onChangeText={(t) => updateSet(i, "weight", t)}
                        onFocus={() => { if (s.weight === "0") updateSet(i, "weight", ""); }}
                        onBlur={() => { if (s.weight.trim() === "") updateSet(i, "weight", "0"); }}
                        keyboardType="decimal-pad"
                      />
                      <Text variant="labelSmall" style={{ opacity: 0.5 }}>kg</Text>
                    </View>
                    {/* Reps milestone bar */}
                    <SetRow
                      label=""
                      scheme={modalScheme}
                      value={s.reps}
                      onValueChange={(v) => updateSet(i, "reps", v)}
                      relativeUi={ui}
                    />
                  </View>
                ))}

                <Button
                  mode="outlined"
                  icon="plus"
                  onPress={addSet}
                  style={{ borderRadius: ui.controlRadius, marginTop: ui.gridPadding * 0.5 }}
                  compact
                >
                  Add Set
                </Button>
              </ScrollView>

              {/* LOG button pinned to bottom */}
              <Button
                mode="contained"
                onPress={onSaveLog}
                style={{ borderRadius: ui.controlRadius, height: ui.controlHeight * 1.12, marginTop: ui.gridPadding }}
                contentStyle={{ height: ui.controlHeight * 1.12 }}
              >
                LOG
              </Button>
            </View>
          )
        )}

        {/* Edit tab */}
        {modalTab === "edit" && (
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <ExerciseForm
              initialName={selectedExercise.exercise_name}
              initialUnitType={selectedExercise.unit_type ?? "reps"}
              initialMin={selectedExercise.min_val ?? 8}
              initialMax={selectedExercise.max_val ?? 12}
              initialStep={selectedExercise.step ?? 1}
              initialNumSets={selectedExercise.num_sets ?? 2}
              submitLabel="Save"
              onSubmit={handleEditExercise}
              onRemoveFromRoutine={() => handleRemoveExercise(selectedExercise)}
            />
          </ScrollView>
        )}

        {/* History tab */}
        {modalTab === "history" && (
          <View style={{ flex: 1 }}>
            {modalLoading ? <ActivityIndicator style={{ flex: 1 }} /> : !modalHistory.length ? (
              <Text variant="bodySmall" style={{ opacity: 0.7, marginTop: ui.gridPadding }}>No history yet</Text>
            ) : (
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {modalHistory.map((session) => (
                  <View key={session.date} style={{ marginBottom: ui.gridPadding }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outlineVariant, paddingBottom: ui.gridPadding * 0.3 }}>
                      <Text variant="labelMedium" style={{ fontWeight: "600" }}>{formatDateEuropean(session.date)}</Text>
                      <IconButton
                        icon="delete-outline"
                        size={ui.iconSm}
                        onPress={() => onDeleteSession(session.date)}
                        mode="text"
                        style={{ margin: 0, width: ui.iconSm + 8, height: ui.iconSm + 8 }}
                        iconColor={colors.error}
                      />
                    </View>
                    {session.sets.map((s, i) => (
                      <View key={i} style={{ flexDirection: "row", paddingVertical: ui.gridPadding * 0.3, paddingHorizontal: ui.gridPadding * 0.5 }}>
                        <Text variant="bodySmall" style={{ flex: 0.3, opacity: 0.5 }}>Set {s.setNumber}</Text>
                        <Text variant="bodySmall" style={{ flex: 1 }}>{s.weight} kg</Text>
                        <Text variant="bodySmall" style={{ flex: 0.5, textAlign: "right" }}>{s.reps} {modalScheme.unitShort}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>
    ),
  );

  // --- Routine list view ---
  if (currentRoutine === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{ flex: 1, paddingTop: insets.top }}
          onLayout={(e) => setListAreaHeight(e.nativeEvent.layout.height)}
        >
          <DraggableFlatList
            data={routines}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderRoutineItem}
            onDragEnd={({ data: reordered }) => handleRoutineReorder(reordered)}
            containerStyle={{ flex: 1 }}
            contentContainerStyle={{
              paddingTop: ui.gridPadding,
              paddingLeft: insets.left + ui.gridPadding,
              paddingRight: insets.right + ui.gridPadding,
              paddingBottom: 0,
              flexGrow: 1,
            }}
            showsVerticalScrollIndicator={false}
          />
          <View
            style={{ paddingHorizontal: insets.left + ui.gridPadding, paddingTop: ui.gridPadding, paddingBottom: footerPadding }}
            onLayout={(e) => setRoutineFooterMeasured(e.nativeEvent.layout.height)}
          >
            <Button
              mode="outlined"
              icon="plus"
              onPress={() => setShowAddRoutine(true)}
              style={{ borderRadius: ui.controlRadius, height: ui.controlHeight * 1.12 }}
              contentStyle={{ height: ui.controlHeight * 1.12 }}
            >
              Add Routine
            </Button>
          </View>
        </View>

        {/* Add Routine modal */}
        {smallModal(
          showAddRoutine,
          () => { setShowAddRoutine(false); setNewRoutineName(""); },
          <>
            <Text variant="titleMedium" style={{ marginBottom: ui.gridPadding }}>
              New Routine
            </Text>
            <TextInput
              mode="outlined"
              placeholder="Routine name"
              value={newRoutineName}
              onChangeText={setNewRoutineName}
              style={{ height: ui.controlHeight, backgroundColor: "transparent" }}
              contentStyle={{ height: ui.controlHeight }}
              outlineStyle={{ borderRadius: ui.controlRadius, borderWidth: ui.controlBorderWidth }}
              autoFocus
              onSubmitEditing={handleCreateRoutine}
            />
            <Button
              mode="contained"
              onPress={handleCreateRoutine}
              style={{ borderRadius: ui.controlRadius, marginTop: ui.gridPadding }}
              disabled={!newRoutineName.trim()}
            >
              Create
            </Button>
          </>,
        )}

        {confirmModal}
      </View>
    );
  }

  // --- Routine detail view (workout) ---
  return (
    <View style={{ flex: 1 }}>
      {/* Header bar with routine name + delete */}
      <View style={fixedHeaderStyle}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: ui.controlHeight,
          }}
        >
          {editingHeaderName ? (
            <TextInput
              mode="flat"
              value={headerNameDraft}
              onChangeText={setHeaderNameDraft}
              style={{ flex: 1, backgroundColor: "transparent", fontSize: ui.fontSizeBody, fontWeight: "500", paddingHorizontal: 0, marginLeft: -4 }}
              underlineStyle={{ display: "none" }}
              activeUnderlineColor="transparent"
              autoFocus
              onSubmitEditing={async () => {
                const trimmed = headerNameDraft.trim();
                if (trimmed && trimmed !== currentRoutine.name) {
                  await updateRoutine({ id: currentRoutine.id, name: trimmed });
                  setCurrentRoutine((r) => ({ ...r, name: trimmed }));
                  await loadRoutines();
                }
                setEditingHeaderName(false);
              }}
              onBlur={() => setEditingHeaderName(false)}
            />
          ) : (
            <Pressable
              style={{ flex: 1 }}
              onPress={() => {
                setHeaderNameDraft(currentRoutine.name);
                setEditingHeaderName(true);
              }}
            >
              <Text variant="titleMedium" numberOfLines={1}>
                {currentRoutine.name}
              </Text>
            </Pressable>
          )}
          <IconButton
            icon="delete-outline"
            size={ui.iconLg}
            iconColor={colors.error}
            onPress={() => handleDeleteRoutine(currentRoutine)}
          />
        </View>
      </View>
      <View
        style={{ flex: 1, backgroundColor: colors.background }}
        onLayout={(e) => setExerciseAreaHeight(e.nativeEvent.layout.height)}
      >
        <DraggableFlatList
          data={routineExercises}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderExerciseItem}
          extraData={exerciseItemHeight}
          onDragEnd={({ data: reordered }) => handleExerciseReorder(reordered)}
          containerStyle={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: ui.gridPadding,
            paddingLeft: insets.left + ui.gridPadding,
            paddingRight: insets.right + ui.gridPadding,
            paddingBottom: 0,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
        <View
          style={{ paddingHorizontal: insets.left + ui.gridPadding, paddingTop: ui.gridPadding, paddingBottom: footerPadding }}
          onLayout={(e) => setExFooterMeasured(e.nativeEvent.layout.height)}
        >
          {showAddExercise ? (
            <Surface elevation={1} style={{ borderRadius: ui.cardBorderRadius, padding: ui.gridPadding }}>
              <ExerciseForm
                submitLabel="Add Exercise"
                onSubmit={handleAddExerciseSubmit}
              />
            </Surface>
          ) : (
            <Button
              mode="outlined"
              icon="plus"
              onPress={() => setShowAddExercise(true)}
              style={{ borderRadius: ui.controlRadius, height: ui.controlHeight * 1.12 }}
              contentStyle={{ height: ui.controlHeight * 1.12 }}
            >
              Add Exercise
            </Button>
          )}
        </View>
      </View>

      {exerciseModal}
      {confirmModal}
    </View>
  );
}
