import * as React from "react";
import {
  BackHandler, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput as RNTextInput, View,
} from "react-native";
import { BottomSheetModal, BottomSheetModalProvider, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import {
  ActivityIndicator, IconButton, Text, TextInput,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BRAND } from "../constants/colors";
import { clamp, formatDateEuropean, toISO } from "../utils/helpers";

import { ExerciseCard } from "../components/ExerciseCard";
import { ExerciseForm } from "../components/ExerciseForm";
import { NumberWheel } from "../components/NumberWheel";
import { Pill } from "../components/Pill";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import * as Haptics from "expo-haptics";
import {
  initDatabase, startWorkout, getRoutines, createRoutine, updateRoutine, deleteRoutine,
  getRoutineExercises, addExerciseToRoutine, removeExerciseFromRoutine, createExercise,
  reorderRoutines, reorderRoutineExercises, addLog, deleteExerciseSession,
  getExerciseEntriesGrouped, getLastExerciseSets, updateExercise,
} from "../../db/database";

const S = 20; // spacing unit

/* (Add Exercise sheet is handled inline as a permanent overlay like the exercise sheet) */


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
  const routineNameRef = React.useRef(null);
  const editSubmitRef = React.useRef(null);

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

  async function openExerciseModal(re) {
    setModalTab("log"); setEditingExName(false);
    const isSec = re.unit_type === "sec";
    const n = re.num_sets ?? 2, sch = { min: re.min_val ?? (isSec ? 30 : 6), max: re.max_val ?? (isSec ? 120 : 12) };
    // Build weight values to snap weights to valid positions
    const wMin = re.weight_min ?? 0, wMax = re.weight_max ?? 100, wStep = re.weight_step ?? 2.5;
    const wVals = [];
    for (let v = wMin; v <= wMax; v = Math.round((v + wStep) * 100) / 100) wVals.push(v);
    const snapWeight = (w) => {
      const num = Number(w);
      if (!wVals.length) return String(wMin);
      let closest = wVals[0];
      for (const v of wVals) { if (Math.abs(v - num) < Math.abs(closest - num)) closest = v; }
      return String(closest);
    };
    // Load data FIRST so wheels mount with correct values
    try {
      const [last, hist] = await Promise.all([getLastExerciseSets({ exerciseName: re.exercise_name }), getExerciseEntriesGrouped({ exerciseName: re.exercise_name, limit: 500 })]);
      setModalHistory(hist ?? []);
      const s = [];
      for (let i = 0; i < n; i++) {
        const p = last?.sets?.[i];
        const w = p?.weight != null ? snapWeight(p.weight) : String(wMin);
        s.push({ weight: w, reps: p?.reps != null ? clamp(Number(p.reps), sch.min, sch.max) : sch.min });
      }
      setSets(s);
    } catch (e) {
      const s = [];
      for (let i = 0; i < n; i++) s.push({ weight: String(wMin), reps: sch.min });
      setSets(s);
    }
    setSelectedExercise(re);
    openSheetAnimated();
  }
  function closeExerciseModal() { closeSheetAnimated(); }

  const modalScheme = React.useMemo(() => {
    if (!selectedExercise) return { min: 6, max: 12, step: 1, unitShort: "reps" };
    const isSec = selectedExercise.unit_type === "sec";
    return { min: selectedExercise.min_val ?? (isSec ? 30 : 6), max: selectedExercise.max_val ?? (isSec ? 120 : 12), step: isSec ? 5 : 1, unitShort: isSec ? "sec" : "reps" };
  }, [selectedExercise]);

  const weightValues = React.useMemo(() => {
    if (!selectedExercise) return [0];
    const a = []; for (let v = selectedExercise.weight_min ?? 0; v <= (selectedExercise.weight_max ?? 100); v = Math.round((v + (selectedExercise.weight_step ?? 2.5)) * 100) / 100) a.push(v); return a;
  }, [selectedExercise]);
  const weightLabel = React.useCallback((v) => v % 1 === 0 ? String(v) : parseFloat(v.toFixed(2)).toString(), []);
  const repsValues = React.useMemo(() => { const a = []; for (let v = modalScheme.min; v <= modalScheme.max; v += modalScheme.step) a.push(v); return a; }, [modalScheme]);

  function updateSet(i, f, v) { setSets((p) => p.map((s, j) => j === i ? { ...s, [f]: v } : s)); }

  const [logSaved, setLogSaved] = React.useState(false);
  function onSaveLog() {
    // Ensure workoutId exists
    let wId = workoutId;

    const doLog = async () => {
      if (!selectedExercise || !sets.length) return;
      if (wId == null && currentRoutine) {
        wId = await startWorkout({ splitIndex: currentRoutine.sort_order, plannedName: currentRoutine.name, startedAtISO: toISO(), routineId: currentRoutine.id });
        setWorkoutId(wId);
      }
      if (wId == null) return;
      const d = toISO();
      for (let i = 0; i < sets.length; i++) {
        const w = Number(String(sets[i].weight).replace(",", "."));
        const r = Number(sets[i].reps);
        if (!Number.isFinite(w) || w < 0) continue;
        if (!Number.isFinite(r)) continue;
        await addLog({ workoutId: wId, exerciseName: selectedExercise.exercise_name, dateISO: d, weight: w, unit: "kg", reps: clamp(Math.trunc(r), modalScheme.min, modalScheme.max), setNumber: i + 1 });
      }
      await refreshModal(selectedExercise.exercise_name);
      setRefreshToken((x) => x + 1);
    };

    setLogSaved(true);
    doLog().finally(() => setTimeout(() => setLogSaved(false), 1500));
  }
  async function onDeleteSession(d) {
    if (!selectedExercise) return;
    await deleteExerciseSession({ exerciseName: selectedExercise.exercise_name, dateISO: d });
    await refreshModal(selectedExercise.exercise_name);
    setRefreshToken((x) => x + 1);
    // Auto-fill from the next latest log
    const last = await getLastExerciseSets({ exerciseName: selectedExercise.exercise_name });
    const n = selectedExercise.num_sets ?? 2;
    const sch = { min: selectedExercise.min_val ?? 6, max: selectedExercise.max_val ?? 12 };
    if (last?.sets?.length) {
      const s = [];
      for (let i = 0; i < n; i++) { const p = last.sets[i]; s.push({ weight: p?.weight != null ? String(p.weight) : "0", reps: p?.reps != null ? clamp(Number(p.reps), sch.min, sch.max) : sch.min }); }
      setSets(s);
    } else {
      const s = [];
      for (let i = 0; i < n; i++) s.push({ weight: "0", reps: sch.min });
      setSets(s);
    }
  }

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
    try {
      const [ex, wId] = await Promise.all([getRoutineExercises(r.id), startWorkout({ splitIndex: r.sort_order, plannedName: r.name, startedAtISO: toISO(), routineId: r.id })]);
      setRoutineExercises(ex ?? []); setWorkoutId(wId); setShowAddExercise(false); setRefreshToken((x) => x + 1); setCurrentRoutine(r);
    } catch (e) {
      setRoutineExercises([]); setCurrentRoutine(r);
    }
  }
  function closeDay() { setCurrentRoutine(null); setWorkoutId(null); setRoutineExercises([]); setEditingHeaderName(false); }
  async function handleCreateRoutine() { const t = newRoutineName.trim(); if (!t) return; await createRoutine({ name: t }); setNewRoutineName(""); setShowAddRoutine(false); await loadRoutines(); }
  function handleDeleteRoutine(r) { setConfirmAction({ title: "Delete Routine", message: "Are you sure?", label: "Delete", onConfirm: async () => { setConfirmAction(null); await deleteRoutine(r.id); if (currentRoutine?.id === r.id) closeDay(); await loadRoutines(); } }); }
  async function handleAddExerciseSubmit(d) { try { await createExercise(d); } catch {} await addExerciseToRoutine({ routineId: currentRoutine.id, exerciseName: d.name }); closeAddSheet(); await loadRoutineExercises(currentRoutine.id); }
  function handleRemoveExercise(re) { setConfirmAction({ title: "Remove Exercise", message: "Are you sure?", label: "Remove", onConfirm: async () => { setConfirmAction(null); closeExerciseModal(); await removeExerciseFromRoutine(re.id); await loadRoutineExercises(currentRoutine.id); } }); }
  async function handleRoutineReorder(d) { setRoutines(d); reorderRoutines(d.map((r) => r.id)); }
  async function handleExerciseReorder(d) { setRoutineExercises(d); reorderRoutineExercises(d.map((r) => r.id)); }

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

  // Keyboard hide → exit name editing
  React.useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () => {
      if (editingHeaderName) saveHeaderName();
      if (editingExName) saveExName();
    });
    return () => sub.remove();
  }, [editingHeaderName, editingExName, saveHeaderName, saveExName]);

  // Keyboard → change snap point
  React.useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => setKbOpen(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKbOpen(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Single back handler — refs ensure synchronous checks
  React.useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (addSheetOpenRef.current) { closeAddSheet(); return true; }
      if (exSheetOpenRef.current) { closeSheetAnimated(); return true; }
      if (confirmAction) { setConfirmAction(null); return true; }
      if (currentRoutine) { closeDay(); return true; }
      if (onBack) { onBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [currentRoutine, onBack, confirmAction]);

  if (loading) return <View style={{ flex: 1, backgroundColor: BRAND.bg }} />;

  /* ── Render items ── */
  const renderRoutineItem = React.useCallback(({ item, drag }) => {
    const count = item.exercise_count ?? 0;
    return (
      <ScaleDecorator activeScale={1.02}>
        <View style={{ marginBottom: 12 }}>
          <Pressable
            onPress={() => openDay(item)}
            onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); drag(); }}
            delayLongPress={500}
          >
            <View style={{ backgroundColor: BRAND.surface, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20 }}>
              <Text style={{ color: BRAND.text, fontSize: 16, fontWeight: "500" }} numberOfLines={1}>{item.name}</Text>
              <Text style={{ color: BRAND.textMuted, fontSize: 13, marginTop: 4 }}>{count} exercise{count !== 1 ? "s" : ""}</Text>
            </View>
          </Pressable>
        </View>
      </ScaleDecorator>
    );
  }, []);

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
    closeSheetAnimated();
  }, [modalTab, editingExName]);

  /* ── Bottom sheets (gorhom) ── */
  const exerciseSheetRef = React.useRef(null);
  const addSheetRef = React.useRef(null);
  const [kbOpen, setKbOpen] = React.useState(false);
  const exerciseSnapPoints = React.useMemo(() => [kbOpen ? "70%" : "57%"], [kbOpen]);
  const addSnapPoints = React.useMemo(() => [kbOpen ? "86%" : "57%"], [kbOpen]);

  const exSheetOpenRef = React.useRef(false);
  function openSheetAnimated() { exSheetOpenRef.current = true; exerciseSheetRef.current?.present(); }
  function closeSheetAnimated() { Keyboard.dismiss(); exSheetOpenRef.current = false; exerciseSheetRef.current?.dismiss(); setSelectedExercise(null); setEditingExName(false); setLogSaved(false); }
  const addSheetOpenRef = React.useRef(false);
  function openAddSheet() { addSheetOpenRef.current = true; addSheetRef.current?.present(); }
  function closeAddSheet() { Keyboard.dismiss(); addSheetOpenRef.current = false; addSheetRef.current?.dismiss(); }

  const renderBackdrop = React.useCallback((props) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="close" style={[props.style, { backgroundColor: BRAND.overlay }]} />
  ), []);


  const exerciseSheet = (
    <BottomSheetModal
      ref={exerciseSheetRef}

      snapPoints={exerciseSnapPoints}
      enablePanDownToClose
      enableDynamicSizing={false}
      enableOverDrag={false}
      enableContentPanningGesture={false}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: BRAND.border, width: 36 }}
      handleStyle={{ paddingVertical: 12 }}
      backgroundStyle={{ backgroundColor: BRAND.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
      onClose={() => { exSheetOpenRef.current = false; setSelectedExercise(null); setEditingExName(false); setLogSaved(false); }}
    >
      <View style={{ flex: 1, padding: S, paddingBottom: insets.bottom + S }}>
        {selectedExercise && (
          <View style={{ flex: 1 }}>
            {/* Name */}
            {editingExName ? (
              <RNTextInput value={exNameDraft} onChangeText={(t) => setExNameDraft(t.slice(0, 30))} autoFocus onSubmitEditing={saveExName} onBlur={saveExName}
                cursorColor={BRAND.accent}                style={{ color: BRAND.text, fontSize: 22, fontWeight: "700", padding: 0, margin: 0, marginBottom: S * 1.5 }} />
            ) : (
              <Pressable disabled={modalTab !== "edit"} onPress={() => { setExNameDraft(selectedExercise.exercise_name); setEditingExName(true); }}>
                <Text style={{ color: BRAND.text, fontSize: 22, fontWeight: "700", marginBottom: S * 1.5 }} numberOfLines={1}>{selectedExercise.exercise_name}</Text>
              </Pressable>
            )}

            {/* Content area */}
            <View style={{ flex: 1 }}>
              {modalTab === "log" && (
                <View style={{ flex: 1 }}>
                  <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" nestedScrollEnabled bounces={false}>
                    {sets.map((s, i) => (
                      <View key={i} style={{ marginBottom: S }}>
                        <Text style={{ color: BRAND.textSecondary, fontSize: 12, fontWeight: "600", letterSpacing: 1, marginBottom: 6 }}>SET {i + 1}</Text>
                        <NumberWheel values={weightValues} value={Number(s.weight)} onValueChange={(v) => updateSet(i, "weight", String(v))} formatLabel={weightLabel} />
                        <View style={{ height: 6 }} />
                        <NumberWheel values={repsValues} value={s.reps} onValueChange={(v) => updateSet(i, "reps", v)} />
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {modalTab === "edit" && (
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>
                  <ExerciseForm
                    initialName={selectedExercise.exercise_name} initialUnitType={selectedExercise.unit_type ?? "reps"}
                    initialMin={selectedExercise.min_val ?? 6} initialMax={selectedExercise.max_val ?? 12}
                    initialStep={selectedExercise.step ?? 1} initialNumSets={selectedExercise.num_sets ?? 2}
                    initialWeightMin={selectedExercise.weight_min ?? 0} initialWeightMax={selectedExercise.weight_max ?? 100}
                    initialWeightStep={selectedExercise.weight_step ?? 2.5}
                    onSubmit={handleEditExercise} showNameField={false} showButton={false}
                    onSubmitRef={(fn) => { editSubmitRef.current = fn; }} />
                </ScrollView>
              )}

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
                            <View key={i} style={{ flexDirection: "row", paddingVertical: 4}}>
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


            {/* Action button */}
            {modalTab === "log" && (
              <View style={{ flexDirection: "row", marginBottom: 10 }}>
                <Pill label={logSaved ? "SAVED" : "LOG"} active onPress={onSaveLog} uppercase />
              </View>
            )}
            {modalTab === "edit" && (
              <View style={{ flexDirection: "row", marginBottom: 10 }}>
                <Pill label="UPDATE" active onPress={() => { if (editSubmitRef.current) editSubmitRef.current(); }} />
              </View>
            )}
            {modalTab === "history" && (
              <View style={{ flexDirection: "row", marginBottom: 10 }}>
                <Pill label="CLEAR" active onPress={() => {
                  if (!modalHistory.length) return;
                  setConfirmAction({ title: "Clear History", message: "Delete all logs for this exercise?", label: "Clear",
                    onConfirm: async () => {
                      setConfirmAction(null);
                      for (const session of modalHistory) await deleteExerciseSession({ exerciseName: selectedExercise.exercise_name, dateISO: session.date });
                      await refreshModal(selectedExercise.exercise_name);
                      setRefreshToken((x) => x + 1);
                    },
                  });
                }} />
              </View>
            )}

            {/* Bottom nav — always pinned */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pill label="Edit" icon="pencil-outline" active={modalTab === "edit"} onPress={() => setModalTab(modalTab === "edit" ? "log" : "edit")} />
              <Pill label="History" icon="history" active={modalTab === "history"} onPress={() => setModalTab(modalTab === "history" ? "log" : "history")} />
              <Pill label="Delete" icon="delete-outline" danger onPress={() => handleRemoveExercise(selectedExercise)} />
            </View>
          </View>
        )}
      </View>
    </BottomSheetModal>
  );

  const addExSheet = (
    <BottomSheetModal
      ref={addSheetRef}

      snapPoints={addSnapPoints}
      enablePanDownToClose
      enableDynamicSizing={false}
      enableOverDrag={false}
      enableContentPanningGesture={false}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: BRAND.border, width: 36 }}
      handleStyle={{ paddingVertical: 12 }}
      backgroundStyle={{ backgroundColor: BRAND.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
      onDismiss={() => { addSheetOpenRef.current = false; }}
    >
      <BottomSheetView style={{ flex: 1, padding: S, paddingBottom: insets.bottom + S }}>
        <Text style={{ color: BRAND.text, fontSize: 22, fontWeight: "700", marginBottom: S * 1.5 }}>New Exercise</Text>
        <ExerciseForm submitLabel="Add Exercise" onSubmit={handleAddExerciseSubmit} pinButton />
      </BottomSheetView>
    </BottomSheetModal>
  );

  const confirmModal = overlay(confirmAction !== null, () => setConfirmAction(null),
    <View style={{ width: "82%", maxWidth: 320, backgroundColor: BRAND.surface, borderRadius: 20, padding: S * 1.25 }}>
      <Text style={{ color: BRAND.text, fontSize: 18, fontWeight: "700", marginBottom: 6 }}>{confirmAction?.title}</Text>
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
      <BottomSheetModalProvider>
      <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
        {/* Header */}
        <View style={{ paddingTop: insets.top + S, paddingBottom: S * 0.75, paddingHorizontal: S }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ color: BRAND.text, fontSize: 18, fontWeight: "700", flex: 1 }}>Workout Routine</Text>
            <IconButton icon="calendar-month-outline" size={20} iconColor={BRAND.textSecondary} style={{ margin: 0 }} />
          </View>
        </View>
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: BRAND.border }} />

        <DraggableFlatList data={routines} keyExtractor={(item) => String(item.id)} renderItem={renderRoutineItem}
          onDragEnd={({ data: d }) => handleRoutineReorder(d)} containerStyle={{ flex: 1 }}
          contentContainerStyle={{ padding: S, flexGrow: 1 }} showsVerticalScrollIndicator={false} />
        <View style={{ paddingHorizontal: S, paddingTop: S, paddingBottom: insets.bottom + S, backgroundColor: BRAND.bg }}>
          <Pressable onPress={() => setShowAddRoutine(true)} style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: BRAND.border, borderStyle: "dashed", justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: BRAND.textSecondary, fontSize: 14, fontWeight: "500" }}>+ Add Routine</Text>
          </Pressable>
        </View>

        <Modal visible={showAddRoutine} transparent animationType="fade" statusBarTranslucent
          onRequestClose={() => { setShowAddRoutine(false); setNewRoutineName(""); }}
          onShow={() => { setTimeout(() => routineNameRef.current?.focus(), 100); }}>
          <View style={{ flex: 1 }}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => { Keyboard.dismiss(); setShowAddRoutine(false); setNewRoutineName(""); }}><View style={{ flex: 1, backgroundColor: BRAND.overlay }} /></Pressable>
            <View style={{ ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" }} pointerEvents="box-none">
              <View style={{ width: "82%", maxWidth: 320, backgroundColor: BRAND.surface, borderRadius: 20, padding: S * 1.25 }}>
                <Text style={{ color: BRAND.text, fontSize: 18, fontWeight: "700", marginBottom: S }}>New Routine</Text>
                <TextInput ref={routineNameRef} mode="outlined" placeholder="Routine name" value={newRoutineName} onChangeText={setNewRoutineName} onSubmitEditing={handleCreateRoutine}
                  style={{ height: 44, backgroundColor: "transparent" }} contentStyle={{ height: 44 }} textColor={BRAND.text}
                  outlineStyle={{ borderRadius: 10, borderWidth: 1, borderColor: BRAND.border }} placeholderTextColor={BRAND.textMuted} />
                <Pressable onPress={handleCreateRoutine} disabled={!newRoutineName.trim()}
                  style={{ height: 48, borderRadius: 12, marginTop: S, backgroundColor: !newRoutineName.trim() ? BRAND.surfaceHigh : BRAND.accent, justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ color: !newRoutineName.trim() ? BRAND.textMuted : BRAND.bg, fontSize: 15, fontWeight: "700" }}>Create</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
        {confirmModal}
      </View>
      </BottomSheetModalProvider>
    );
  }

  /* ═══ EXERCISE LIST ═══ */
  return (
    <BottomSheetModalProvider>
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + S, paddingBottom: S * 0.75, paddingHorizontal: S, backgroundColor: BRAND.bg }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {editingHeaderName ? (
            <RNTextInput value={headerNameDraft} onChangeText={(t) => setHeaderNameDraft(t.slice(0, 40))} autoFocus onSubmitEditing={saveHeaderName} onBlur={saveHeaderName}
              cursorColor={BRAND.accent}              style={{ flex: 1, color: BRAND.text, fontSize: 18, fontWeight: "700", padding: 0, margin: 0 }} />
          ) : (
            <Pressable style={{ flex: 1 }} onPress={() => { setHeaderNameDraft(currentRoutine.name); setEditingHeaderName(true); }}>
              <Text style={{ color: BRAND.text, fontSize: 18, fontWeight: "700" }} numberOfLines={1}>{currentRoutine.name}</Text>
            </Pressable>
          )}
          <IconButton icon="delete-outline" size={20} iconColor={BRAND.error} onPress={() => handleDeleteRoutine(currentRoutine)} style={{ margin: 0 }} />
        </View>
      </View>
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: BRAND.border }} />

      <DraggableFlatList data={routineExercises} keyExtractor={(item) => String(item.id)} renderItem={renderExerciseItem}
        onDragEnd={({ data: d }) => handleExerciseReorder(d)} containerStyle={{ flex: 1 }}
        contentContainerStyle={{ padding: S }} showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled" />

      <View style={{ paddingHorizontal: S, paddingTop: S, paddingBottom: insets.bottom + S, backgroundColor: BRAND.bg }}>
        <Pressable onPress={openAddSheet} style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: BRAND.border, borderStyle: "dashed", justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: BRAND.textSecondary, fontSize: 14, fontWeight: "500" }}>+ Add Exercise</Text>
        </Pressable>
      </View>

      {/* Add Exercise bottom sheet */}
      {addExSheet}

      {exerciseSheet}
      {confirmModal}
    </View>
    </BottomSheetModalProvider>
  );
}
