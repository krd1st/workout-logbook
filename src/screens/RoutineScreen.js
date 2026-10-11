import * as React from "react";
import {
  BackHandler,
  InteractionManager,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BRAND } from "../constants/colors";
import { clamp, toISO } from "../utils/helpers";
import { ExerciseCard } from "../components/ExerciseCard";
import { Stepper } from "../components/Stepper";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SortableList } from "../components/SortableList";
import { HeaderToggle } from "../components/HeaderToggle";
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
  reorderRoutines,
  reorderRoutineExercises,
  addLog,
  getLastSetsForExerciseIds,
} from "../../db/database";

const S = 20;
// Vertical offset for the LOG modal — negative shifts it up.
// Tweak this number to taste.
const LOG_MODAL_OFFSET = -70;

export function RoutineScreen({
  dataReady = true,
  routines = [],
  onRoutinesChange,
  exercises = [],
  section,
  onSwitchSection,
}) {
  const [loading, setLoading] = React.useState(!dataReady);
  const [currentRoutine, setCurrentRoutine] = React.useState(null);
  const [routineExercises, setRoutineExercises] = React.useState([]);
  const [workoutId, setWorkoutId] = React.useState(null);
  const [sessionsCache, setSessionsCache] = React.useState({}); // keyed by exercise_id
  const sessionsCacheRef = React.useRef({});
  sessionsCacheRef.current = sessionsCache;
  const insets = useSafeAreaInsets();

  const [showAddRoutine, setShowAddRoutine] = React.useState(false);
  const [newRoutineName, setNewRoutineName] = React.useState("");
  const [editingHeaderName, setEditingHeaderName] = React.useState(false);
  const [headerNameDraft, setHeaderNameDraft] = React.useState("");
  const [confirmAction, setConfirmAction] = React.useState(null);
  const routineNameRef = React.useRef(null);

  const [selectedRE, setSelectedRE] = React.useState(null);
  const [sets, setSets] = React.useState([]);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const openExerciseRef = React.useRef(null);

  const refreshRoutines = React.useCallback(async () => {
    const list = await getRoutines();
    onRoutinesChange?.(list);
    return list;
  }, [onRoutinesChange]);

  const loadRoutineExercises = React.useCallback(
    async (id) => setRoutineExercises(await getRoutineExercises(id)),
    [],
  );

  React.useEffect(() => {
    if (dataReady) {
      setLoading(false);
      return;
    }
    let c = false;
    (async () => {
      await initDatabase();
      await refreshRoutines();
      if (!c) setLoading(false);
    })();
    return () => {
      c = true;
    };
  }, [refreshRoutines, dataReady]);

  /* ── Toggle handler ── */
  function handleToggleSection(s) {
    if (s === "routines") {
      // Already in routines section — tap-active backs out of any nested view.
      setSelectedRE(null);
      setCurrentRoutine(null);
      setEditingHeaderName(false);
      setWorkoutId(null);
      return;
    }
    onSwitchSection?.(s);
  }

  /* ── Back handler ── */
  React.useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (confirmAction) {
        setConfirmAction(null);
        return true;
      }
      if (showAddRoutine) {
        setShowAddRoutine(false);
        setNewRoutineName("");
        return true;
      }
      if (pickerOpen) {
        setPickerOpen(false);
        return true;
      }
      if (selectedRE) {
        setSelectedRE(null);
        return true;
      }
      if (currentRoutine) {
        closeDay();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [confirmAction, showAddRoutine, pickerOpen, selectedRE, currentRoutine]);

  /* ── Exercise log helpers ── */
  const exScheme = React.useMemo(() => {
    if (!selectedRE) return null;
    return {
      repMin: selectedRE.min_val ?? 6,
      repMax: selectedRE.max_val ?? 12,
    };
  }, [selectedRE]);

  function openExercise(re) {
    const sch = { min: re.min_val ?? 6, max: re.max_val ?? 12 };
    const numSets = Math.max(1, Math.min(10, re.num_sets ?? 2));
    const last = sessionsCacheRef.current[re.exercise_id];
    const s = [];
    for (let i = 0; i < numSets; i++) {
      const p = last?.sets?.[i];
      s.push({
        weight: p?.weight != null ? String(p.weight) : "0",
        reps:
          p?.reps != null ? clamp(Number(p.reps), sch.min, sch.max) : sch.min,
      });
    }
    setSets(s);
    setSelectedRE(re);
  }

  function updateSet(i, field, v) {
    setSets((p) => p.map((s, j) => (j === i ? { ...s, [field]: v } : s)));
  }

  function onSaveLog() {
    if (!selectedRE || !sets.length) return;
    const re = selectedRE;
    const d = toISO();
    const loggedSets = [];
    for (let i = 0; i < sets.length; i++) {
      const w = Number(String(sets[i].weight).replace(",", "."));
      const r = clamp(
        Math.trunc(sets[i].reps),
        exScheme.repMin,
        exScheme.repMax,
      );
      if (!Number.isFinite(w) || w < 0 || !Number.isFinite(r)) continue;
      loggedSets.push({ weight: w, reps: r, setNumber: i + 1 });
    }
    if (!loggedSets.length) {
      setSelectedRE(null);
      return;
    }

    setSessionsCache((prev) => ({
      ...prev,
      [re.exercise_id]: { date: d, sets: loggedSets },
    }));
    setSelectedRE(null);

    (async () => {
      try {
        let wId = workoutId;
        if (wId == null && currentRoutine) {
          wId = await startWorkout({
            routineId: currentRoutine.id,
            routineName: currentRoutine.name,
            startedAtISO: d,
          });
          setWorkoutId(wId);
        }
        for (const s of loggedSets) {
          await addLog({
            workoutId: wId,
            exerciseId: re.exercise_id,
            dateISO: d,
            weight: s.weight,
            reps: s.reps,
            setNumber: s.setNumber,
          });
        }
      } catch {
        // Optimistic state already shown — surfacing a stale error mid-flow does more harm than good.
      }
    })();
  }

  /* ── Routine CRUD ── */
  async function openDay(r) {
    const ex = await getRoutineExercises(r.id);
    setRoutineExercises(ex ?? []);
    setCurrentRoutine(r);
    if (ex?.length) {
      const cache = await getLastSetsForExerciseIds(
        ex.map((e) => e.exercise_id),
      );
      setSessionsCache(cache);
    } else {
      setSessionsCache({});
    }
  }
  function closeDay() {
    setCurrentRoutine(null);
    setWorkoutId(null);
    setRoutineExercises([]);
    setEditingHeaderName(false);
    setSessionsCache({});
  }

  async function handleCreateRoutine() {
    const t = newRoutineName.trim();
    if (!t) return;
    await createRoutine({ name: t });
    setNewRoutineName("");
    setShowAddRoutine(false);
    await refreshRoutines();
  }
  function handleDeleteRoutine(r) {
    setConfirmAction({
      title: "Delete Routine",
      message: "Are you sure?",
      label: "Delete",
      onConfirm: async () => {
        setConfirmAction(null);
        await deleteRoutine(r.id);
        if (currentRoutine?.id === r.id) closeDay();
        onRoutinesChange?.(routines.filter((i) => i.id !== r.id));
      },
    });
  }

  async function handlePickExercise(ex) {
    if (!currentRoutine) return;
    setPickerOpen(false);
    await addExerciseToRoutine({
      routineId: currentRoutine.id,
      exerciseId: ex.id,
    });
    await loadRoutineExercises(currentRoutine.id);
    if (sessionsCacheRef.current[ex.id] === undefined) {
      const cache = await getLastSetsForExerciseIds([ex.id]);
      setSessionsCache((prev) => ({ ...prev, ...cache }));
    }
    // Update routine count optimistically.
    onRoutinesChange?.(
      routines.map((r) =>
        r.id === currentRoutine.id
          ? { ...r, exercise_count: (r.exercise_count ?? 0) + 1 }
          : r,
      ),
    );
  }

  function handleRemoveExercise(re) {
    setConfirmAction({
      title: "Remove Exercise",
      message: "Remove this exercise from the routine?",
      label: "Remove",
      onConfirm: async () => {
        setConfirmAction(null);
        setSelectedRE(null);
        await removeExerciseFromRoutine(re.id);
        await loadRoutineExercises(currentRoutine.id);
        onRoutinesChange?.(
          routines.map((r) =>
            r.id === currentRoutine.id
              ? {
                  ...r,
                  exercise_count: Math.max(0, (r.exercise_count ?? 0) - 1),
                }
              : r,
          ),
        );
      },
    });
  }

  function handleRoutineReorder(d) {
    onRoutinesChange?.(d);
    const ids = d.map((r) => r.id);
    InteractionManager.runAfterInteractions(() => {
      reorderRoutines(ids).catch(() => {});
    });
  }
  function handleExerciseReorder(d) {
    setRoutineExercises(d);
    const ids = d.map((r) => r.id);
    InteractionManager.runAfterInteractions(() => {
      reorderRoutineExercises(ids).catch(() => {});
    });
  }

  const saveHeaderName = React.useCallback(async () => {
    const t = headerNameDraft.trim();
    if (t && t !== currentRoutine?.name) {
      await updateRoutine({ id: currentRoutine.id, name: t });
      setCurrentRoutine((r) => ({ ...r, name: t }));
      onRoutinesChange?.(
        routines.map((r) =>
          r.id === currentRoutine.id ? { ...r, name: t } : r,
        ),
      );
    }
    setEditingHeaderName(false);
  }, [headerNameDraft, currentRoutine, routines, onRoutinesChange]);

  React.useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () => {
      if (editingHeaderName) saveHeaderName();
    });
    return () => sub.remove();
  }, [editingHeaderName, saveHeaderName]);

  if (loading) return <View style={{ flex: 1, backgroundColor: BRAND.bg }} />;

  /* ── Render helpers ── */
  openExerciseRef.current = openExercise;

  const renderRoutineItem = ({ item }) => {
    const count = item.exercise_count ?? 0;
    return (
      <View style={{ marginBottom: 12 }}>
        <View
          style={{
            backgroundColor: BRAND.surface,
            borderRadius: 16,
            paddingVertical: 16,
            paddingHorizontal: 20,
          }}
        >
          <Text
            style={{ color: BRAND.text, fontSize: 16, fontWeight: "500" }}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text style={{ color: BRAND.textMuted, fontSize: 13, marginTop: 4 }}>
            {count} exercise{count !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>
    );
  };

  const renderExerciseItem = ({ item: re }) => (
    <View style={{ marginBottom: 12 }}>
      <ExerciseCard
        exerciseName={re.name}
        lastSession={sessionsCacheRef.current[re.exercise_id]}
        maxVal={re.max_val}
      />
    </View>
  );

  const confirmModal = (
    <ConfirmDialog
      action={confirmAction}
      onDismiss={() => setConfirmAction(null)}
    />
  );

  /* ── Persistent header ── */
  const header = (
    <>
      <View
        style={{
          paddingTop: insets.top + S,
          paddingBottom: S * 0.75,
          paddingHorizontal: S,
        }}
      >
        <HeaderToggle
          active={section ?? "routines"}
          onSwitch={handleToggleSection}
        />
      </View>
      <View
        style={{
          height: StyleSheet.hairlineWidth,
          backgroundColor: BRAND.border,
        }}
      />
    </>
  );

  /* ═══ INSIDE A ROUTINE ═══ */
  if (currentRoutine) {
    const inRoutineIds = new Set(routineExercises.map((re) => re.exercise_id));
    const pickable = (exercises ?? []).filter((e) => !inRoutineIds.has(e.id));
    return (
      <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
        {header}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: S,
            paddingTop: S,
            paddingBottom: S * 0.5,
          }}
        >
          {editingHeaderName ? (
            <TextInput
              value={headerNameDraft}
              onChangeText={(t) => setHeaderNameDraft(t.slice(0, 40))}
              autoFocus
              onSubmitEditing={saveHeaderName}
              onBlur={saveHeaderName}
              cursorColor={BRAND.accent}
              selectionColor="transparent"
              style={{
                flex: 1,
                color: BRAND.text,
                fontSize: 16,
                fontWeight: "600",
                padding: 0,
                margin: 0,
              }}
            />
          ) : (
            <Pressable
              style={{ flex: 1 }}
              onPress={() => {
                setHeaderNameDraft(currentRoutine.name);
                setEditingHeaderName(true);
              }}
            >
              <Text
                style={{ color: BRAND.text, fontSize: 16, fontWeight: "600" }}
                numberOfLines={1}
              >
                {currentRoutine.name}
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => handleDeleteRoutine(currentRoutine)}
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name="delete-outline"
              size={20}
              color={BRAND.error}
            />
          </Pressable>
        </View>

        <SortableList
          data={routineExercises}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderExerciseItem}
          onReorder={handleExerciseReorder}
          onItemPress={(re) => openExerciseRef.current(re)}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: S, paddingTop: S * 0.5 }}
          bounces={false}
        />

        <View
          style={{
            paddingHorizontal: S,
            paddingTop: S,
            paddingBottom: insets.bottom + S,
            backgroundColor: BRAND.bg,
          }}
        >
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={{
              height: 48,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: BRAND.accent,
              borderStyle: "dashed",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text
              style={{ color: BRAND.accent, fontSize: 14, fontWeight: "500" }}
            >
              + Add Exercise
            </Text>
          </Pressable>
        </View>

        <ExercisePickerModal
          visible={pickerOpen}
          exercises={pickable}
          onPick={handlePickExercise}
          onDismiss={() => setPickerOpen(false)}
        />

        <LogModal
          visible={!!selectedRE}
          re={selectedRE}
          sets={sets}
          scheme={exScheme}
          onUpdateSet={updateSet}
          onSave={onSaveLog}
          onRemove={() => selectedRE && handleRemoveExercise(selectedRE)}
          onDismiss={() => setSelectedRE(null)}
        />

        {confirmModal}
      </View>
    );
  }

  /* ═══ ROUTINE LIST ═══ */
  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      {header}

      <SortableList
        data={routines}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderRoutineItem}
        onReorder={handleRoutineReorder}
        onItemPress={openDay}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: S }}
      />

      <View
        style={{
          paddingHorizontal: S,
          paddingTop: S,
          paddingBottom: insets.bottom + S,
          backgroundColor: BRAND.bg,
        }}
      >
        <Pressable
          onPress={() => setShowAddRoutine(true)}
          style={{
            height: 48,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: BRAND.accent,
            borderStyle: "dashed",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text
            style={{ color: BRAND.accent, fontSize: 14, fontWeight: "500" }}
          >
            + Add Routine
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={showAddRoutine}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          setShowAddRoutine(false);
          setNewRoutineName("");
        }}
        onShow={() => {
          setTimeout(() => routineNameRef.current?.focus(), 100);
        }}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              Keyboard.dismiss();
              setShowAddRoutine(false);
              setNewRoutineName("");
            }}
          >
            <View style={{ flex: 1, backgroundColor: BRAND.overlay }} />
          </Pressable>
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              justifyContent: "center",
              alignItems: "center",
            }}
            pointerEvents="box-none"
          >
            <View
              style={{
                width: "82%",
                maxWidth: 320,
                backgroundColor: BRAND.surface,
                borderRadius: 20,
                padding: S * 1.25,
              }}
            >
              <Text
                style={{
                  color: BRAND.text,
                  fontSize: 18,
                  fontWeight: "700",
                  marginBottom: S,
                }}
              >
                New Routine
              </Text>
              <TextInput
                ref={routineNameRef}
                placeholder="Routine name"
                value={newRoutineName}
                onChangeText={setNewRoutineName}
                onSubmitEditing={handleCreateRoutine}
                cursorColor={BRAND.accent}
                selectionColor="transparent"
                placeholderTextColor={BRAND.textMuted}
                style={{
                  height: 44,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: BRAND.border,
                  color: BRAND.text,
                  paddingHorizontal: 14,
                  fontSize: 16,
                }}
              />
              <Pressable
                onPress={handleCreateRoutine}
                disabled={!newRoutineName.trim()}
                style={{
                  height: 48,
                  borderRadius: 12,
                  marginTop: S,
                  backgroundColor: !newRoutineName.trim()
                    ? BRAND.surfaceHigh
                    : BRAND.accent,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: !newRoutineName.trim() ? BRAND.textMuted : BRAND.bg,
                    fontSize: 15,
                    fontWeight: "700",
                  }}
                >
                  Create
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {confirmModal}
    </View>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */

function ExercisePickerModal({ visible, exercises, onPick, onDismiss }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={{ flex: 1 }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss}>
          <View style={{ flex: 1, backgroundColor: BRAND.overlay }} />
        </Pressable>
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            justifyContent: "center",
            alignItems: "center",
          }}
          pointerEvents="box-none"
        >
          <View
            style={{
              width: "86%",
              maxWidth: 360,
              maxHeight: "75%",
              backgroundColor: BRAND.surface,
              borderRadius: 20,
              padding: S,
            }}
          >
            <Text
              style={{
                color: BRAND.text,
                fontSize: 18,
                fontWeight: "700",
                marginBottom: S,
              }}
            >
              Add Exercise
            </Text>
            {exercises.length === 0 ? (
              <Text
                style={{
                  color: BRAND.textMuted,
                  fontSize: 14,
                  paddingVertical: 12,
                }}
              >
                No exercises available. Create some in the Exercise Pool first.
              </Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                {exercises.map((ex) => (
                  <Pressable
                    key={ex.id}
                    onPress={() => onPick(ex)}
                    style={({ pressed }) => ({
                      backgroundColor: pressed
                        ? BRAND.surfaceHigh
                        : "transparent",
                      borderRadius: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      marginBottom: 4,
                    })}
                  >
                    <Text
                      style={{
                        color: BRAND.text,
                        fontSize: 15,
                        fontWeight: "500",
                      }}
                      numberOfLines={1}
                    >
                      {ex.name}
                    </Text>
                    <Text
                      style={{
                        color: BRAND.textMuted,
                        fontSize: 12,
                        marginTop: 2,
                      }}
                    >
                      {ex.num_sets} set{ex.num_sets !== 1 ? "s" : ""} ·{" "}
                      {ex.min_val}–{ex.max_val} reps
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function LogModal({
  visible,
  re,
  sets,
  scheme,
  onUpdateSet,
  onSave,
  onRemove,
  onDismiss,
}) {
  if (!re || !scheme) return <Modal visible={false} transparent />;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={{ flex: 1 }}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            Keyboard.dismiss();
            onDismiss();
          }}
        >
          <View style={{ flex: 1, backgroundColor: BRAND.overlay }} />
        </Pressable>
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: S,
          }}
          pointerEvents="box-none"
        >
          <View
            style={{
              width: "100%",
              maxWidth: 360,
              maxHeight: "85%",
              backgroundColor: BRAND.surface,
              borderRadius: 20,
              padding: S,
              transform: [{ translateY: LOG_MODAL_OFFSET }],
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: S,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  color: BRAND.text,
                  fontSize: 18,
                  fontWeight: "700",
                }}
                numberOfLines={1}
              >
                {re.name}
              </Text>
              <Pressable onPress={onRemove} hitSlop={8}>
                <MaterialCommunityIcons
                  name="delete-outline"
                  size={20}
                  color={BRAND.error}
                />
              </Pressable>
            </View>
            <ScrollView
              style={{ flexShrink: 1 }}
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="handled"
            >
              {sets.map((s, i) => (
                <View key={i} style={{ marginBottom: 14 }}>
                  <Text
                    style={{
                      color: BRAND.textSecondary,
                      fontSize: 11,
                      fontWeight: "600",
                      letterSpacing: 1,
                      marginBottom: 6,
                    }}
                  >
                    SET {i + 1}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      height: 44,
                      backgroundColor: BRAND.surfaceHigh,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                    }}
                  >
                    <TextInput
                      value={s.weight}
                      onChangeText={(text) => onUpdateSet(i, "weight", text)}
                      keyboardType="decimal-pad"
                      cursorColor={BRAND.accent}
                      selectionColor="transparent"
                      style={{
                        flex: 1,
                        height: 44,
                        color: BRAND.text,
                        fontSize: 16,
                        fontWeight: "600",
                        padding: 0,
                      }}
                    />
                    <Text
                      style={{
                        color: BRAND.textMuted,
                        fontSize: 13,
                        marginLeft: 8,
                      }}
                    >
                      kg
                    </Text>
                  </View>
                  <View style={{ height: 8 }} />
                  <Stepper
                    value={s.reps}
                    onValueChange={(v) => onUpdateSet(i, "reps", v)}
                    min={scheme.repMin}
                    max={scheme.repMax}
                    step={1}
                    unit="reps"
                  />
                </View>
              ))}
            </ScrollView>
            <Pressable
              onPress={onSave}
              style={{
                height: 48,
                borderRadius: 12,
                marginTop: 12,
                backgroundColor: BRAND.accent,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: BRAND.bg,
                  fontSize: 15,
                  fontWeight: "700",
                  letterSpacing: 1,
                }}
              >
                LOG
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
