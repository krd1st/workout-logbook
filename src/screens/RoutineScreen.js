import * as React from "react";
import {
  BackHandler, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, View,
} from "react-native";
import {
  ActivityIndicator, IconButton, Text, TextInput,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BRAND } from "../constants/colors";
import { clamp, formatDateEuropean, toISO } from "../utils/helpers";
import { DayButton } from "../components/DayButton";
import { ExerciseCard } from "../components/ExerciseCard";
import { ExerciseForm } from "../components/ExerciseForm";
import { NumberWheel } from "../components/NumberWheel";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import * as Haptics from "expo-haptics";
import {
  initDatabase, startWorkout, getRoutines, createRoutine, updateRoutine, deleteRoutine,
  getRoutineExercises, addExerciseToRoutine, removeExerciseFromRoutine, createExercise,
  reorderRoutines, reorderRoutineExercises, addLog, deleteExerciseSession,
  getExerciseEntriesGrouped, getLastExerciseSets, updateExercise,
} from "../../db/database";

const S = 20; // spacing unit

/* ── Pill Button ── */
function Pill({ label, onPress, active, danger, icon }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 6, backgroundColor: active ? BRAND.accent : danger ? "transparent" : BRAND.surfaceHigh, borderWidth: danger ? 1 : 0, borderColor: danger ? BRAND.error : undefined }}>
      {icon && <IconButton icon={icon} size={16} iconColor={active ? BRAND.bg : danger ? BRAND.error : BRAND.textSecondary} style={{ margin: 0, width: 16, height: 16 }} />}
      <Text style={{ color: active ? BRAND.bg : danger ? BRAND.error : BRAND.text, fontWeight: active ? "700" : "500", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function RoutineScreen({ dataReady = true, preloadedRoutines = null, onBack }) {
  const [loading, setLoading] = React.useState(!dataReady || !preloadedRoutines);
  const [routines, setRoutines] = React.useState(preloadedRoutines ?? []);
  const [currentRoutine, setCurrentRoutine] = React.useState(null);
  const [routineExercises, setRoutineExercises] = React.useState([]);
  const [workoutId, setWorkoutId] = React.useState(null);
  const [refreshToken, setRefreshToken] = React.useState(0);
  const insets = useSafeAreaInsets();

  const [showAddRoutine, setShowAddRoutine] = React.useState(false);
  const [newRoutineName, setNewRoutineName] = React.useState("");
  const [showAddExercise, setShowAddExercise] = React.useState(false);
  const [editingHeaderName, setEditingHeaderName] = React.useState(false);
  const [headerNameDraft, setHeaderNameDraft] = React.useState("");
  const [confirmAction, setConfirmAction] = React.useState(null);

  const [selectedExercise, setSelectedExercise] = React.useState(null);
  const [modalTab, setModalTab] = React.useState("log");
  const [modalLoading, setModalLoading] = React.useState(false);
  const [modalHistory, setModalHistory] = React.useState([]);
  const [sets, setSets] = React.useState([]);
  const [editingExName, setEditingExName] = React.useState(false);
  const [exNameDraft, setExNameDraft] = React.useState("");

  const loadRoutines = React.useCallback(async () => setRoutines(await getRoutines()), []);
  const loadRoutineExercises = React.useCallback(async (id) => setRoutineExercises(await getRoutineExercises(id)), []);

  React.useEffect(() => {
    if (dataReady && preloadedRoutines) { setLoading(false); return; }
    let c = false;
    (async () => { if (!dataReady) await initDatabase(); await loadRoutines(); if (!c) setLoading(false); })();
    return () => { c = true; };
  }, [loadRoutines, dataReady, preloadedRoutines]);

  /* ── Exercise modal ── */
  const refreshModal = React.useCallback(async (n) => {
    setModalLoading(true);
    try { setModalHistory(await getExerciseEntriesGrouped({ exerciseName: n, limit: 500 })); } finally { setModalLoading(false); }
  }, []);

  function openExerciseModal(re) {
    setModalTab("log"); setEditingExName(false);
    const n = re.num_sets ?? 2, sch = { min: re.min_val ?? 8, max: re.max_val ?? 12 };
    (async () => {
      const [last, hist] = await Promise.all([getLastExerciseSets({ exerciseName: re.exercise_name }), getExerciseEntriesGrouped({ exerciseName: re.exercise_name, limit: 500 })]);
      setModalHistory(hist);
      const s = [];
      for (let i = 0; i < n; i++) { const p = last?.sets?.[i]; s.push({ weight: p?.weight != null ? String(p.weight) : "0", reps: p?.reps != null ? clamp(Number(p.reps), sch.min, sch.max) : sch.min }); }
      setSets(s); setSelectedExercise(re);
    })();
  }
  function closeExerciseModal() { setSelectedExercise(null); setEditingExName(false); }

  const modalScheme = React.useMemo(() => {
    if (!selectedExercise) return { min: 8, max: 12, step: 1, unitShort: "reps" };
    return { min: selectedExercise.min_val ?? 8, max: selectedExercise.max_val ?? 12, step: selectedExercise.step ?? 1, unitShort: selectedExercise.unit_type === "sec" ? "sec" : "reps" };
  }, [selectedExercise]);

  const weightValues = React.useMemo(() => {
    if (!selectedExercise) return [0];
    const a = []; for (let v = selectedExercise.weight_min ?? 0; v <= (selectedExercise.weight_max ?? 250); v = Math.round((v + (selectedExercise.weight_step ?? 1.25)) * 100) / 100) a.push(v); return a;
  }, [selectedExercise]);
  const weightLabel = React.useCallback((v) => v % 1 === 0 ? String(v) : v.toFixed(2), []);
  const repsValues = React.useMemo(() => { const a = []; for (let v = modalScheme.min; v <= modalScheme.max; v += modalScheme.step) a.push(v); return a; }, [modalScheme]);

  function updateSet(i, f, v) { setSets((p) => p.map((s, j) => j === i ? { ...s, [f]: v } : s)); }
  function addSet() { setSets((p) => [...p, { weight: p.length ? p[p.length - 1].weight : "0", reps: modalScheme.min }]); }
  function removeSet(i) { setSets((p) => p.filter((_, j) => j !== i)); }

  async function onSaveLog() {
    if (!selectedExercise || !workoutId || !sets.length) return;
    const d = toISO();
    for (let i = 0; i < sets.length; i++) { const w = Number(String(sets[i].weight).replace(",", ".")); if (!Number.isFinite(w) || w < 0) continue; await addLog({ workoutId, exerciseName: selectedExercise.exercise_name, dateISO: d, weight: w, unit: "kg", reps: clamp(Math.trunc(sets[i].reps), modalScheme.min, modalScheme.max), setNumber: i + 1 }); }
    await refreshModal(selectedExercise.exercise_name); setRefreshToken((x) => x + 1);
  }
  async function onDeleteSession(d) { if (!selectedExercise) return; await deleteExerciseSession({ exerciseName: selectedExercise.exercise_name, dateISO: d }); await refreshModal(selectedExercise.exercise_name); setRefreshToken((x) => x + 1); }

  async function handleEditExercise({ name, unitType, min, max, step, numSets, weightMin, weightMax, weightStep }) {
    if (!selectedExercise) return;
    await updateExercise({ oldName: selectedExercise.exercise_name, name, unitType, min, max, step, numSets, weightMin, weightMax, weightStep });
    const u = { ...selectedExercise, exercise_name: name, unit_type: unitType, min_val: min, max_val: max, step, num_sets: numSets, weight_min: weightMin, weight_max: weightMax, weight_step: weightStep };
    setSelectedExercise(u);
    setSets((p) => { const r = []; for (let i = 0; i < numSets; i++) r.push(p[i] ?? { weight: "0", reps: min }); return r; });
    setModalTab("log");
    if (currentRoutine) await loadRoutineExercises(currentRoutine.id); setRefreshToken((x) => x + 1);
  }

  /* ── Routine CRUD ── */
  async function openDay(r) {
    const [ex, wId] = await Promise.all([getRoutineExercises(r.id), startWorkout({ splitIndex: r.sort_order, plannedName: r.name, startedAtISO: toISO(), routineId: r.id })]);
    setRoutineExercises(ex); setWorkoutId(wId); setShowAddExercise(false); setRefreshToken((x) => x + 1); setCurrentRoutine(r);
  }
  function closeDay() { setCurrentRoutine(null); setWorkoutId(null); setRoutineExercises([]); }
  async function handleCreateRoutine() { const t = newRoutineName.trim(); if (!t) return; await createRoutine({ name: t }); setNewRoutineName(""); setShowAddRoutine(false); await loadRoutines(); }
  function handleDeleteRoutine(r) { setConfirmAction({ title: "Delete Routine", message: "Are you sure?", label: "Delete", onConfirm: async () => { setConfirmAction(null); await deleteRoutine(r.id); if (currentRoutine?.id === r.id) closeDay(); await loadRoutines(); } }); }
  async function handleAddExerciseSubmit(d) { try { await createExercise(d); } catch {} await addExerciseToRoutine({ routineId: currentRoutine.id, exerciseName: d.name }); setShowAddExercise(false); await loadRoutineExercises(currentRoutine.id); }
  function handleRemoveExercise(re) { setConfirmAction({ title: "Remove Exercise", message: "Are you sure?", label: "Remove", onConfirm: async () => { setConfirmAction(null); closeExerciseModal(); await removeExerciseFromRoutine(re.id); await loadRoutineExercises(currentRoutine.id); } }); }
  async function handleRoutineReorder(d) { requestAnimationFrame(() => setRoutines(d)); await reorderRoutines(d.map((r) => r.id)); }
  async function handleExerciseReorder(d) { requestAnimationFrame(() => setRoutineExercises(d)); await reorderRoutineExercises(d.map((r) => r.id)); }

  const saveHeaderName = React.useCallback(async () => {
    const t = headerNameDraft.trim();
    if (t && t !== currentRoutine?.name) { await updateRoutine({ id: currentRoutine.id, name: t }); setCurrentRoutine((r) => ({ ...r, name: t })); await loadRoutines(); }
    setEditingHeaderName(false);
  }, [headerNameDraft, currentRoutine, loadRoutines]);

  const saveExName = React.useCallback(async () => {
    const t = exNameDraft.trim(); setEditingExName(false);
    if (t && t !== selectedExercise?.exercise_name) {
      const se = selectedExercise;
      await updateExercise({ oldName: se.exercise_name, name: t, unitType: se.unit_type, min: se.min_val, max: se.max_val, step: se.step, numSets: se.num_sets, weightMin: se.weight_min, weightMax: se.weight_max, weightStep: se.weight_step });
      setSelectedExercise((p) => ({ ...p, exercise_name: t })); if (currentRoutine) await loadRoutineExercises(currentRoutine.id); setRefreshToken((x) => x + 1);
    }
  }, [exNameDraft, selectedExercise, currentRoutine, loadRoutineExercises]);

  React.useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (confirmAction) { setConfirmAction(null); return true; }
      if (showAddExercise) { setShowAddExercise(false); return true; }
      if (currentRoutine) { closeDay(); return true; }
      if (onBack) { onBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [currentRoutine, onBack, showAddExercise, confirmAction]);

  if (loading) return <View style={{ flex: 1, backgroundColor: BRAND.bg }} />;

  /* ── Render items ── */
  const renderRoutineItem = React.useCallback(({ item, drag }) => (
    <ScaleDecorator activeScale={1.02}>
      <View style={{ marginBottom: 12 }}>
        <DayButton title={item.name} onPress={() => openDay(item)} onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); drag(); }} />
      </View>
    </ScaleDecorator>
  ), []);

  const renderExerciseItem = React.useCallback(({ item: re, drag }) => (
    <ScaleDecorator activeScale={1.02}>
      <View style={{ marginBottom: 12 }}>
        <ExerciseCard workoutId={workoutId} exerciseName={re.exercise_name} refreshToken={refreshToken}
          exerciseData={{ name: re.exercise_name, unit_type: re.unit_type, min_val: re.min_val, max_val: re.max_val, step: re.step }}
          onPress={() => openExerciseModal(re)} onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); drag(); }} />
      </View>
    </ScaleDecorator>
  ), [workoutId, refreshToken]);

  /* ── Modals ── */
  const overlay = (visible, onClose, children) => (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { Keyboard.dismiss(); onClose(); }}><View style={{ flex: 1, backgroundColor: BRAND.overlay }} /></Pressable>
        <View style={{ ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" }} pointerEvents="box-none">
          {children}
        </View>
      </View>
    </Modal>
  );

  const handleExerciseModalBack = React.useCallback(() => {
    if (editingExName) { setEditingExName(false); return; }
    if (modalTab !== "log") { setModalTab("log"); return; }
    closeExerciseModal();
  }, [modalTab, editingExName]);

  /* ── Exercise Modal ── */
  const exerciseModal = (
    <Modal visible={selectedExercise !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={handleExerciseModalBack}>
      <View style={{ flex: 1 }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { Keyboard.dismiss(); closeExerciseModal(); }}><View style={{ flex: 1, backgroundColor: BRAND.overlay }} /></Pressable>
        <View style={{ ...StyleSheet.absoluteFillObject, justifyContent: "flex-end" }} pointerEvents="box-none">
          <View style={{ height: "80%", backgroundColor: BRAND.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: S, paddingBottom: insets.bottom + S }}>
            {selectedExercise && (
              <View style={{ flex: 1 }}>
                {/* Handle bar */}
                <View style={{ alignItems: "center", marginBottom: S }}>
                  <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: BRAND.border }} />
                </View>

                {/* Name */}
                {editingExName ? (
                  <TextInput mode="flat" value={exNameDraft} onChangeText={setExNameDraft} autoFocus onSubmitEditing={saveExName} onBlur={saveExName}
                    style={{ backgroundColor: "transparent", fontSize: 22, fontWeight: "600", paddingHorizontal: 0, paddingVertical: 0, margin: 0, minHeight: 0, height: 28, marginBottom: S * 1.5 }}
                    contentStyle={{ paddingHorizontal: 0, paddingVertical: 0 }} textColor={BRAND.text} underlineStyle={{ display: "none" }} activeUnderlineColor="transparent" />
                ) : (
                  <Pressable disabled={modalTab !== "edit"} onPress={() => { setExNameDraft(selectedExercise.exercise_name); setEditingExName(true); }}>
                    <Text style={{ color: BRAND.text, fontSize: 22, fontWeight: "600", marginBottom: S * 1.5 }} numberOfLines={1}>{selectedExercise.exercise_name}</Text>
                  </Pressable>
                )}

                {/* ── LOG TAB ── */}
                {modalTab === "log" && (
                  <View style={{ flex: 1, justifyContent: "space-between" }}>
                    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" nestedScrollEnabled bounces={false}>
                      {sets.map((s, i) => (
                        <View key={i} style={{ marginBottom: S }}>
                          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                            <Text style={{ color: BRAND.textSecondary, fontSize: 12, fontWeight: "600", letterSpacing: 1, flex: 1 }}>SET {i + 1}</Text>
                            {i >= 2 && <Pressable onPress={() => removeSet(i)} hitSlop={8}><Text style={{ color: BRAND.error, fontSize: 12 }}>Remove</Text></Pressable>}
                          </View>
                          <NumberWheel values={weightValues} value={Number(s.weight)} onValueChange={(v) => updateSet(i, "weight", String(v))} formatLabel={weightLabel} />
                          <View style={{ height: 6 }} />
                          <NumberWheel values={repsValues} value={s.reps} onValueChange={(v) => updateSet(i, "reps", v)} />
                        </View>
                      ))}
                    </ScrollView>

                    <View style={{ gap: 10, marginTop: S * 0.75 }}>
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <Pill label="Add Set" icon="plus" onPress={addSet} />
                        <Pill label="LOG" active onPress={onSaveLog} />
                      </View>
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <Pill label="Edit" icon="pencil-outline" onPress={() => setModalTab("edit")} />
                        <Pill label="History" icon="history" onPress={() => setModalTab("history")} />
                        <Pill label="Delete" icon="delete-outline" danger onPress={() => handleRemoveExercise(selectedExercise)} />
                      </View>
                    </View>
                  </View>
                )}

                {/* ── EDIT TAB ── */}
                {modalTab === "edit" && (
                  <ExerciseForm
                    initialName={selectedExercise.exercise_name} initialUnitType={selectedExercise.unit_type ?? "reps"}
                    initialMin={selectedExercise.min_val ?? 8} initialMax={selectedExercise.max_val ?? 12}
                    initialStep={selectedExercise.step ?? 1} initialNumSets={selectedExercise.num_sets ?? 2}
                    initialWeightMin={selectedExercise.weight_min ?? 0} initialWeightMax={selectedExercise.weight_max ?? 250}
                    initialWeightStep={selectedExercise.weight_step ?? 1.25}
                    submitLabel="Save" onSubmit={handleEditExercise} showNameField={false} pinButton />
                )}

                {/* ── HISTORY TAB ── */}
                {modalTab === "history" && (
                  <View style={{ flex: 1 }}>
                    {modalLoading ? <ActivityIndicator style={{ flex: 1 }} color={BRAND.accent} /> : !modalHistory.length ? (
                      <Text style={{ color: BRAND.textMuted, marginTop: S }}>No history yet</Text>
                    ) : (
                      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} bounces={false}>
                        {modalHistory.map((session) => (
                          <View key={session.date} style={{ marginBottom: S }}>
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BRAND.border, paddingBottom: 6 }}>
                              <Text style={{ color: BRAND.text, fontSize: 13, fontWeight: "600" }}>{formatDateEuropean(session.date)}</Text>
                              <Pressable onPress={() => onDeleteSession(session.date)} hitSlop={8}><Text style={{ color: BRAND.error, fontSize: 12 }}>Delete</Text></Pressable>
                            </View>
                            {session.sets.map((s, i) => (
                              <View key={i} style={{ flexDirection: "row", paddingVertical: 6, paddingHorizontal: 4 }}>
                                <Text style={{ color: BRAND.textMuted, fontSize: 13, width: 44 }}>Set {s.setNumber}</Text>
                                <Text style={{ color: BRAND.text, fontSize: 13, flex: 1 }}>{s.weight} kg</Text>
                                <Text style={{ color: BRAND.textSecondary, fontSize: 13 }}>{s.reps} {modalScheme.unitShort}</Text>
                              </View>
                            ))}
                          </View>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );

  const confirmModal = overlay(confirmAction !== null, () => setConfirmAction(null),
    <View style={{ width: "82%", maxWidth: 320, backgroundColor: BRAND.surface, borderRadius: 20, padding: S * 1.25 }}>
      <Text style={{ color: BRAND.text, fontSize: 18, fontWeight: "600", marginBottom: 6 }}>{confirmAction?.title}</Text>
      <Text style={{ color: BRAND.textSecondary, fontSize: 14, marginBottom: S }}>{confirmAction?.message}</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pill label="Cancel" onPress={() => setConfirmAction(null)} />
        <Pressable onPress={confirmAction?.onConfirm} style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: BRAND.error, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{confirmAction?.label}</Text>
        </Pressable>
      </View>
    </View>,
  );

  /* ═══ ROUTINE LIST ═══ */
  if (currentRoutine === null) {
    return (
      <View style={{ flex: 1, backgroundColor: BRAND.bg, paddingTop: insets.top }}>
        <DraggableFlatList data={routines} keyExtractor={(item) => String(item.id)} renderItem={renderRoutineItem}
          onDragEnd={({ data: d }) => handleRoutineReorder(d)} containerStyle={{ flex: 1 }}
          contentContainerStyle={{ padding: S, flexGrow: 1 }} showsVerticalScrollIndicator={false} />
        <View style={{ paddingHorizontal: S, paddingBottom: insets.bottom + S }}>
          <Pressable onPress={() => setShowAddRoutine(true)} style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: BRAND.border, borderStyle: "dashed", justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: BRAND.textSecondary, fontSize: 14, fontWeight: "500" }}>+ Add Routine</Text>
          </Pressable>
        </View>

        {overlay(showAddRoutine, () => { setShowAddRoutine(false); setNewRoutineName(""); },
          <View style={{ width: "82%", maxWidth: 320, backgroundColor: BRAND.surface, borderRadius: 20, padding: S * 1.25 }}>
            <Text style={{ color: BRAND.text, fontSize: 18, fontWeight: "600", marginBottom: S }}>New Routine</Text>
            <TextInput mode="outlined" placeholder="Routine name" value={newRoutineName} onChangeText={setNewRoutineName} autoFocus onSubmitEditing={handleCreateRoutine}
              style={{ height: 44, backgroundColor: "transparent" }} contentStyle={{ height: 44 }} textColor={BRAND.text}
              outlineStyle={{ borderRadius: 10, borderWidth: 1, borderColor: BRAND.border }} placeholderTextColor={BRAND.textMuted} />
            <Pressable onPress={handleCreateRoutine} disabled={!newRoutineName.trim()}
              style={{ height: 48, borderRadius: 12, marginTop: S, backgroundColor: !newRoutineName.trim() ? BRAND.surfaceHigh : BRAND.accent, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ color: !newRoutineName.trim() ? BRAND.textMuted : BRAND.bg, fontSize: 15, fontWeight: "700" }}>Create</Text>
            </Pressable>
          </View>,
        )}
        {confirmModal}
      </View>
    );
  }

  /* ═══ EXERCISE LIST ═══ */
  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + S, paddingBottom: S * 0.75, paddingHorizontal: S, backgroundColor: BRAND.bg }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {editingHeaderName ? (
            <TextInput mode="flat" value={headerNameDraft} onChangeText={setHeaderNameDraft} autoFocus onSubmitEditing={saveHeaderName} onBlur={saveHeaderName}
              style={{ flex: 1, backgroundColor: "transparent", fontSize: 18, fontWeight: "600", paddingHorizontal: 0, paddingVertical: 0, margin: 0, minHeight: 0, height: 24 }}
              contentStyle={{ paddingHorizontal: 0, paddingVertical: 0 }} textColor={BRAND.text} underlineStyle={{ display: "none" }} activeUnderlineColor="transparent" />
          ) : (
            <Pressable style={{ flex: 1 }} onPress={() => { setHeaderNameDraft(currentRoutine.name); setEditingHeaderName(true); }}>
              <Text style={{ color: BRAND.text, fontSize: 18, fontWeight: "600" }} numberOfLines={1}>{currentRoutine.name}</Text>
            </Pressable>
          )}
          <Pressable onPress={() => handleDeleteRoutine(currentRoutine)} hitSlop={8} style={{ marginLeft: 12 }}>
            <IconButton icon="delete-outline" size={20} iconColor={BRAND.error} style={{ margin: 0 }} />
          </Pressable>
        </View>
      </View>
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: BRAND.border }} />

      <DraggableFlatList data={routineExercises} keyExtractor={(item) => String(item.id)} renderItem={renderExerciseItem}
        onDragEnd={({ data: d }) => handleExerciseReorder(d)} containerStyle={{ flex: 1 }}
        contentContainerStyle={{ padding: S }} showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled" />

      <View style={{ paddingHorizontal: S, paddingBottom: insets.bottom + S }}>
        {showAddExercise ? (
          <View style={{ backgroundColor: BRAND.surface, borderRadius: 16, padding: S }}>
            <ExerciseForm submitLabel="Add Exercise" onSubmit={handleAddExerciseSubmit} />
          </View>
        ) : (
          <Pressable onPress={() => setShowAddExercise(true)} style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: BRAND.border, borderStyle: "dashed", justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: BRAND.textSecondary, fontSize: 14, fontWeight: "500" }}>+ Add Exercise</Text>
          </Pressable>
        )}
      </View>

      {exerciseModal}
      {confirmModal}
    </View>
  );
}
