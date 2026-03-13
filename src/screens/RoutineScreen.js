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
  const [exerciseAreaHeight, setExerciseAreaHeight] = React.useState(0);
  const [deleteModeRoutineId, setDeleteModeRoutineId] = React.useState(null);
  const deleteTimerRef = React.useRef(null);
  const editTimerRef = React.useRef(null);

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

  const handleOpenEdit = React.useCallback(
    (reId) => {
      if (expandedExerciseId === reId && expandedMode === "edit") {
        setClosingExercise({ id: reId, mode: expandedMode });
        setExpandedExercise(null);
        return;
      }
      setClosingExercise(null);
      setExpandedExercise({ id: reId, mode: "edit" });
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
    setDeleteModeRoutineId(null);
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
    // Delay state update to let the drag animation settle, avoiding a visual blink.
    requestAnimationFrame(() => setRoutines(reordered));
    await reorderRoutines(reordered.map((r) => r.id));
  }

  async function handleExerciseReorder(reordered) {
    requestAnimationFrame(() => setRoutineExercises(reordered));
    await reorderRoutineExercises(reordered.map((re) => re.id));
  }

  React.useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (deleteModeRoutineId !== null) {
        setDeleteModeRoutineId(null);
        return true;
      }
      if (expandedExerciseId !== null) {
        setClosingExercise({ id: expandedExerciseId, mode: expandedMode });
        setExpandedExercise(null);
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
  }, [currentRoutine, onBack, showAddExercise, deleteModeRoutineId, expandedExerciseId, expandedMode]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  // --- Height calculations for both routine and exercise lists ---
  const MAX_FILL = 7;
  const shouldScroll = routines.length > MAX_FILL;

  // Routine list heights
  const footerHeight = ui.controlHeight + insets.bottom + ui.gridPadding;
  const listTopPad = ui.gridPadding;
  const innerHeight = listAreaHeight - footerHeight - listTopPad - insets.top;
  const countForHeight = (n) => Math.max(n, 1);
  const itemHeightFor = (n) => Math.max((innerHeight - n * ui.gridPadding) / n, 48);
  const fixedItemHeight = itemHeightFor(MAX_FILL);
  const nonScrollItemHeight = itemHeightFor(countForHeight(routines.length));
  const itemHeight = shouldScroll ? fixedItemHeight : nonScrollItemHeight;

  // Exercise list heights — fixed size so 7 closed + 1 expanded panel = available height
  const exFooterHeight = ui.controlHeight + insets.bottom + ui.gridPadding;
  const exTopPad = insets.top + ui.gridPadding;
  const exInnerHeight = exerciseAreaHeight - exFooterHeight - exTopPad;
  // 7 * closedHeight + expandedPanelHeight + 7 * gap = available
  const totalExGaps = MAX_FILL * ui.gridPadding;
  // Before layout measurement, use null so items auto-size; after, use calculated height
  const exerciseItemHeight = exerciseAreaHeight > 0
    ? Math.max((exInnerHeight - ui.expandedWindowHeight - totalExGaps) / MAX_FILL, 48)
    : null;

  const renderRoutineItem = React.useCallback(({ item, drag }) => {
    const isDeleteMode = deleteModeRoutineId === item.id;

    return (
      <ScaleDecorator>
        <View
          style={{
            height: itemHeight,
            marginBottom: ui.gridPadding,
          }}
        >
          {isDeleteMode ? (
            <Pressable
              style={{ flex: 1 }}
              onPress={() => {
                setDeleteModeRoutineId(null);
                handleDeleteRoutine(item);
              }}
            >
              <Surface
                elevation={1}
                style={{
                  flex: 1,
                  borderRadius: ui.cardBorderRadius,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <IconButton
                  icon="delete-outline"
                  size={ui.iconLg}
                  iconColor={colors.error}
                />
              </Surface>
            </Pressable>
          ) : (
            <DayButton
              dayIndex={0}
              title={item.name}
              subtitle=""
              onPress={() => {
                if (deleteModeRoutineId !== null) {
                  setDeleteModeRoutineId(null);
                  return;
                }
                openDay(item);
              }}
              onLongPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                drag();
                clearTimeout(deleteTimerRef.current);
                deleteTimerRef.current = setTimeout(() => {
                  setDeleteModeRoutineId(item.id);
                }, 800);
              }}
            />
          )}
        </View>
      </ScaleDecorator>
    );
  }, [itemHeight, ui.gridPadding, ui.cardBorderRadius, ui.iconLg, deleteModeRoutineId, colors.error]);

  const renderExerciseItem = React.useCallback(({ item: re, drag }) => {
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

    const cardHeight = exerciseItemHeight == null
      ? undefined
      : isExpanded
        ? exerciseItemHeight + ui.expandedWindowHeight
        : exerciseItemHeight;

    return (
      <ScaleDecorator>
        <View style={{ height: cardHeight, marginBottom: ui.gridPadding }}>
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
            onOpenEdit={() => handleOpenEdit(re.id)}
            onRemoveFromRoutine={() => handleRemoveExercise(re)}
            onExerciseUpdated={() => loadRoutineExercises(currentRoutine.id)}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              drag();
              clearTimeout(editTimerRef.current);
              editTimerRef.current = setTimeout(() => {
                handleOpenEdit(re.id);
              }, 800);
            }}
            fillContainer
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
  }, [expandedExerciseId, expandedMode, closingExercise, workoutId, refreshToken, ui, currentRoutine, exerciseItemHeight]);

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
            extraData={deleteModeRoutineId}
            onPlaceholderIndexChange={() => {
              clearTimeout(deleteTimerRef.current);
            }}
            onDragEnd={({ data: reordered, from, to }) => {
              clearTimeout(deleteTimerRef.current);
              if (from !== to) {
                setDeleteModeRoutineId(null);
                handleRoutineReorder(reordered);
              }
            }}
            containerStyle={{ flex: 1 }}
            contentContainerStyle={{
              paddingTop: ui.gridPadding,
              paddingLeft: insets.left + ui.gridPadding,
              paddingRight: insets.right + ui.gridPadding,
              paddingBottom: 0,
              ...(shouldScroll ? {} : { flexGrow: 1 }),
            }}
            scrollEnabled={shouldScroll}
            showsVerticalScrollIndicator={false}
          />
          <View
            style={{
              paddingHorizontal: insets.left + ui.gridPadding,
              paddingTop: 0,
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
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1, backgroundColor: colors.background }}
        onLayout={(e) => setExerciseAreaHeight(e.nativeEvent.layout.height)}
      >
        <DraggableFlatList
          data={routineExercises}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderExerciseItem}
          extraData={exerciseItemHeight}
          onPlaceholderIndexChange={() => {
            clearTimeout(editTimerRef.current);
          }}
          onDragEnd={({ data: reordered, from, to }) => {
            clearTimeout(editTimerRef.current);
            if (from !== to) {
              handleExerciseReorder(reordered);
            }
          }}
          containerStyle={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: exTopPad,
            paddingLeft: insets.left + ui.gridPadding,
            paddingRight: insets.right + ui.gridPadding,
            paddingBottom: 0,
          }}
          scrollEnabled
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
        <View
          style={{
            paddingHorizontal: insets.left + ui.gridPadding,
            paddingTop: 0,
            paddingBottom: insets.bottom + ui.gridPadding,
          }}
        >
          {showAddExercise ? (
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
          )}
        </View>
      </View>
    </View>
  );
}
