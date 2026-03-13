import * as React from "react";
import {
  Alert,
  BackHandler,
  Keyboard,
  Modal,
  Platform,
  Pressable,
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
import { toISO } from "../utils/helpers";
import { useRelativeUi } from "../hooks/useRelativeUi";
import { DayButton } from "../components/DayButton";
import { ExerciseCard } from "../components/ExerciseCard";
import { ExerciseForm } from "../components/ExerciseForm";
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
} from "../../db/database";

export function RoutineScreen({ dataReady = true, onBack }) {
  const [loading, setLoading] = React.useState(!dataReady);
  const [routines, setRoutines] = React.useState([]);
  const [currentRoutine, setCurrentRoutine] = React.useState(null);
  const [routineExercises, setRoutineExercises] = React.useState([]);
  const [workoutId, setWorkoutId] = React.useState(null);
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [expandedExercise, setExpandedExercise] = React.useState(null);
  const [closingExercise, setClosingExercise] = React.useState(null);
  const expandedExerciseId = expandedExercise?.id ?? null;
  const expandedMode = expandedExercise?.mode ?? "add";
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
  const [listAreaHeight, setListAreaHeight] = React.useState(0);

  const loadRoutines = React.useCallback(async () => {
    const rows = await getRoutines();
    setRoutines(rows);
  }, []);

  const loadRoutineExercises = React.useCallback(async (routineId) => {
    const rows = await getRoutineExercises(routineId);
    setRoutineExercises(rows);
  }, []);

  const handleOpenAdd = React.useCallback(
    (reId) => {
      if (expandedExerciseId === reId && expandedMode === "add") {
        setClosingExercise({ id: reId, mode: expandedMode });
        setExpandedExercise(null);
        return;
      }
      setClosingExercise(null);
      setExpandedExercise({ id: reId, mode: "add" });
    },
    [expandedExerciseId, expandedMode],
  );

  const handleOpenHistory = React.useCallback(
    (reId) => {
      if (expandedExerciseId === reId && expandedMode === "history") {
        setClosingExercise({ id: reId, mode: expandedMode });
        setExpandedExercise(null);
        return;
      }
      setClosingExercise(null);
      setExpandedExercise({ id: reId, mode: "history" });
    },
    [expandedExerciseId, expandedMode],
  );

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
    return () => {
      cancelled = true;
    };
  }, [loadRoutines]);

  const fixedHeaderStyle = React.useMemo(
    () => ({
      paddingTop: insets.top + ui.topPadding,
      paddingLeft: insets.left + ui.gridPadding,
      paddingRight: insets.right + ui.gridPadding,
      paddingBottom: 0,
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

  async function openDay(routine) {
    setCurrentRoutine(routine);
    setWorkoutId(null);
    setExpandedExercise(null);
    setClosingExercise(null);
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
    Alert.alert("Delete Routine", `Delete "${routine.name}"? Exercises will not be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteRoutine(routine.id);
          if (currentRoutine?.id === routine.id) closeDay();
          await loadRoutines();
        },
      },
    ]);
  }

  async function handleAddExerciseSubmit({ name, unitType, min, max, step }) {
    try {
      await createExercise({ name, unitType, min, max, step });
    } catch {
      // Already exists — that's fine.
    }
    await addExerciseToRoutine({ routineId: currentRoutine.id, exerciseName: name });
    setShowAddExercise(false);
    await loadRoutineExercises(currentRoutine.id);
  }

  function handleRemoveExercise(re) {
    Alert.alert("Remove Exercise", `Remove "${re.exercise_name}" from this routine?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await removeExerciseFromRoutine(re.id);
          await loadRoutineExercises(currentRoutine.id);
        },
      },
    ]);
  }

  async function handleRoutineReorder(reordered) {
    setRoutines(reordered);
    await reorderRoutines(reordered.map((r) => r.id));
  }

  async function handleExerciseReorder(reordered) {
    setRoutineExercises(reordered);
    await reorderRoutineExercises(reordered.map((re) => re.id));
  }

  React.useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
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
  }, [currentRoutine, onBack, showAddExercise]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  const MAX_FILL = 7;
  const shouldScroll = routines.length > MAX_FILL;

  // Space taken by the fixed footer: add-button height + its vertical padding + bottom inset.
  const footerHeight = ui.controlHeight + ui.gridPadding * 2 + insets.bottom + ui.gridPadding;
  // Space available for the draggable list content (excluding list's own top/bottom padding).
  const listPaddingV = ui.gridPadding * 2; // top + bottom padding inside DraggableList
  const listInnerHeight = listAreaHeight - footerHeight - listPaddingV;

  // At exactly MAX_FILL items, total gaps = (MAX_FILL) * gridPadding (each item has marginBottom).
  const totalGaps7 = MAX_FILL * ui.gridPadding;
  const fixedItemHeight = Math.max((listInnerHeight - totalGaps7) / MAX_FILL, 48);

  // For non-scroll: fill available space equally.
  const nonScrollCount = Math.max(routines.length, 1);
  const totalGapsNon = nonScrollCount * ui.gridPadding;
  const nonScrollItemHeight = Math.max((listInnerHeight - totalGapsNon) / nonScrollCount, 48);

  // --- Routine list view ---
  if (currentRoutine === null) {
    const itemHeight = shouldScroll ? fixedItemHeight : nonScrollItemHeight;

    const renderRoutineItem = ({ item, drag, isActive }) => (
      <ScaleDecorator>
        <View
          style={{
            height: itemHeight,
            marginBottom: ui.gridPadding,
          }}
        >
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

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={fixedHeaderStyle}>
          <Pressable
            onPress={onBack}
            hitSlop={{
              top: ui.hitSlopMd,
              bottom: ui.hitSlopMd,
              left: ui.hitSlopMd,
              right: ui.hitSlopMd,
            }}
          >
            <Surface
              elevation={0}
              style={{
                paddingVertical: ui.headerPadding,
                paddingHorizontal: 0,
                borderRadius: ui.headerBorderRadius,
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
                <Text variant="titleMedium">PROGRESSIVE OVERLOAD TRACKER</Text>
              </View>
            </Surface>
          </Pressable>
        </View>

        <View
          style={{ flex: 1 }}
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
              paddingBottom: ui.gridPadding,
              ...(shouldScroll ? {} : { flexGrow: 1 }),
            }}
            scrollEnabled={shouldScroll}
            showsVerticalScrollIndicator={false}
          />
          <View
            style={{
              paddingHorizontal: insets.left + ui.gridPadding,
              paddingTop: ui.gridPadding,
              paddingBottom: insets.bottom + ui.gridPadding,
            }}
          >
            <Button
              mode="outlined"
              icon="plus"
              onPress={() => setShowAddRoutine(true)}
              style={{ borderRadius: ui.controlRadius }}
            >
              Add Routine
            </Button>
          </View>
        </View>

        {/* Add Routine modal */}
        <Modal
          visible={showAddRoutine}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => { setShowAddRoutine(false); setNewRoutineName(""); }}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
            }}
            onPress={() => { Keyboard.dismiss(); setShowAddRoutine(false); setNewRoutineName(""); }}
          >
            <View
              style={{
                position: "absolute",
                top: "30%",
                left: 0,
                right: 0,
                alignItems: "center",
              }}
              pointerEvents="box-none"
            >
              <Pressable
                onPress={() => {}}
                style={{
                  width: "80%",
                  maxWidth: 340,
                }}
              >
                <Surface
                  elevation={3}
                  style={{
                    borderRadius: ui.cardBorderRadius,
                    padding: ui.gridPadding * 1.5,
                  }}
                >
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
                </Surface>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </View>
    );
  }

  // --- Routine detail view (workout) ---
  const renderExerciseItem = ({ item: re, drag, isActive }) => {
    const isExpanded = expandedExerciseId === re.id;
    const isClosing = closingExercise?.id === re.id;
    const isActiveCard = isExpanded || isClosing;
    const modeForCard = isExpanded
      ? expandedMode
      : isClosing
        ? closingExercise.mode
        : expandedMode;

    const exerciseData = {
      name: re.exercise_name,
      unit_type: re.unit_type,
      min_val: re.min_val,
      max_val: re.max_val,
      step: re.step,
    };

    return (
      <ScaleDecorator>
        <View style={{ marginBottom: ui.gridPadding }}>
          <ExerciseCard
            workoutId={workoutId}
            exerciseName={re.exercise_name}
            exerciseData={exerciseData}
            routineExerciseId={re.id}
            refreshToken={refreshToken}
            onDidMutate={() => setRefreshToken((x) => x + 1)}
            expanded={isExpanded}
            expandedMode={modeForCard}
            onOpenAdd={() => handleOpenAdd(re.id)}
            onOpenHistory={() => handleOpenHistory(re.id)}
            onRemoveFromRoutine={() => handleRemoveExercise(re)}
            onExerciseUpdated={() => loadRoutineExercises(currentRoutine.id)}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              drag();
            }}
            fillContainer={false}
            expandedWindowHeight={ui.expandedWindowHeight}
            renderExpanded={isActiveCard}
            onCollapseDone={
              isClosing
                ? () => {
                    setClosingExercise((cur) =>
                      cur?.id === re.id ? null : cur,
                    );
                  }
                : undefined
            }
          />
        </View>
      </ScaleDecorator>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={fixedHeaderStyle}>
          <Pressable
            onPress={closeDay}
            hitSlop={{
              top: ui.hitSlopMd,
              bottom: ui.hitSlopMd,
              left: ui.hitSlopMd,
              right: ui.hitSlopMd,
            }}
          >
            <Surface
              elevation={0}
              style={{
                paddingVertical: ui.headerPadding,
                paddingHorizontal: 0,
                borderRadius: ui.headerBorderRadius,
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
                {editingRoutineId === currentRoutine.id ? (
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: ui.gridPadding * 0.5 }}>
                    <TextInput
                      mode="outlined"
                      value={editRoutineName}
                      onChangeText={setEditRoutineName}
                      style={{ flex: 1, height: ui.controlHeight, backgroundColor: "transparent" }}
                      contentStyle={{ height: ui.controlHeight }}
                      outlineStyle={{ borderRadius: ui.controlRadius, borderWidth: ui.controlBorderWidth }}
                      autoFocus
                      onSubmitEditing={handleSaveRoutineName}
                    />
                    <IconButton icon="check" size={ui.iconLg} onPress={handleSaveRoutineName} />
                    <IconButton
                      icon="close"
                      size={ui.iconLg}
                      onPress={() => { setEditingRoutineId(null); setEditRoutineName(""); }}
                    />
                  </View>
                ) : (
                  <>
                    <Pressable
                      onPress={() => {
                        setEditingRoutineId(currentRoutine.id);
                        setEditRoutineName(currentRoutine.name);
                      }}
                      style={{ flex: 1 }}
                    >
                      <Text variant="titleMedium" numberOfLines={2}>
                        {currentRoutine.name}
                      </Text>
                    </Pressable>
                    <IconButton
                      icon="delete-outline"
                      size={ui.iconLg}
                      onPress={() => handleDeleteRoutine(currentRoutine)}
                      iconColor={colors.error}
                    />
                  </>
                )}
              </View>
            </Surface>
          </Pressable>
        </View>

        <DraggableFlatList
          data={routineExercises}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderExerciseItem}
          onDragEnd={({ data: reordered }) => handleExerciseReorder(reordered)}
          contentContainerStyle={{
            paddingTop: ui.gridPadding,
            paddingLeft: insets.left + ui.gridPadding,
            paddingRight: insets.right + ui.gridPadding,
            paddingBottom: insets.bottom + ui.gridPadding,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            showAddExercise ? (
              <Surface elevation={1} style={{ borderRadius: ui.cardBorderRadius, padding: ui.gridPadding }}>
                <ExerciseForm
                  submitLabel="Add Exercise"
                  onSubmit={handleAddExerciseSubmit}
                  onCancel={() => setShowAddExercise(false)}
                />
              </Surface>
            ) : (
              <Button
                mode="outlined"
                icon="plus"
                onPress={() => setShowAddExercise(true)}
                style={{ borderRadius: ui.controlRadius }}
              >
                Add Exercise
              </Button>
            )
          }
        />
      </View>
    </View>
  );
}
