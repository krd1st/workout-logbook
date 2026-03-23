import * as React from "react";
import { AppState, BackHandler, Keyboard, Modal, Pressable, ScrollView, StyleSheet, TextInput as RNTextInput, View } from "react-native";
import { ActivityIndicator, IconButton, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetModal, BottomSheetModalProvider, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { BRAND } from "../constants/colors";
import { Pill } from "../components/Pill";
import {
  addNutritionLog, addSavedFood, deleteNutritionLog, deleteSavedFood,
  getNutritionLogsForDate, getNutritionQuota, getNutritionTotalsForDate,
  getSavedFoods, setNutritionQuota,
} from "../../db/database";

const S = 20;
const CAL_P = 4, CAL_C = 4, CAL_F = 9;
const TOLERANCE = 50; // allow up to 50 cal mismatch when all 4 are filled

function resolveNutrition(calStr, pStr, cStr, fStr) {
  const cal = calStr.trim() ? Math.round(Number(calStr)) : null;
  const p = pStr.trim() ? Math.round(Number(pStr)) : null;
  const c = cStr.trim() ? Math.round(Number(cStr)) : null;
  const f = fStr.trim() ? Math.round(Number(fStr)) : null;
  const filled = [cal !== null, p !== null, c !== null, f !== null].filter(Boolean).length;
  if (filled < 3) return null;
  if (filled === 4) {
    // All 4 filled — check coherence with tolerance
    const macroCal = p * CAL_P + c * CAL_C + f * CAL_F;
    if (Math.abs(cal - macroCal) > TOLERANCE) return null; // too far off
    return { calories: cal, protein: p, carbs: c, fat: f };
  }
  // 3 of 4 — auto-calc the missing one
  if (cal === null) return { calories: Math.round(p * CAL_P + c * CAL_C + f * CAL_F), protein: p, carbs: c, fat: f };
  if (p === null) { const v = Math.round((cal - c * CAL_C - f * CAL_F) / CAL_P); return v >= 0 ? { calories: cal, protein: v, carbs: c, fat: f } : null; }
  if (c === null) { const v = Math.round((cal - p * CAL_P - f * CAL_F) / CAL_C); return v >= 0 ? { calories: cal, protein: p, carbs: v, fat: f } : null; }
  if (f === null) { const v = Math.round((cal - p * CAL_P - c * CAL_C) / CAL_F); return v >= 0 ? { calories: cal, protein: p, carbs: c, fat: v } : null; }
  return null;
}

function MacroInput({ label, value, onChangeText, kb = "number-pad" }) {
  return (
    <View style={{ flex: 1, marginBottom: 12 }}>
      <Text style={{ color: BRAND.textSecondary, fontSize: 11, marginBottom: 4 }}>{label}</Text>
      <RNTextInput value={value} onChangeText={onChangeText} keyboardType={kb} placeholderTextColor={BRAND.textMuted}
        cursorColor={BRAND.accent} selectionColor={BRAND.accent}
        style={{ height: 44, backgroundColor: BRAND.surfaceHigh, borderRadius: 12, paddingHorizontal: 14, color: BRAND.text, fontSize: 15 }} />
    </View>
  );
}

export function NutritionSection({ onBack }) {
  const insets = useSafeAreaInsets();

  // Data state
  const [today, setToday] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [totals, setTotals] = React.useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [quota, setQuota] = React.useState({ calories: 2500, protein: 150, carbs: 300, fat: 80 });
  const [logEntries, setLogEntries] = React.useState([]);
  const [savedFoodsList, setSavedFoodsList] = React.useState([]);

  // Add food sheet state
  const addSheetRef = React.useRef(null);
  const [addMode, setAddMode] = React.useState("manual");
  const [manualName, setManualName] = React.useState("");
  const [manualCal, setManualCal] = React.useState("");
  const [manualP, setManualP] = React.useState("");
  const [manualC, setManualC] = React.useState("");
  const [manualF, setManualF] = React.useState("");
  const [selectedSaved, setSelectedSaved] = React.useState(null);
  const [gramAmount, setGramAmount] = React.useState("100");

  // Targets sheet state
  const targetsSheetRef = React.useRef(null);
  const [targetCal, setTargetCal] = React.useState("");
  const [targetP, setTargetP] = React.useState("");
  const [targetC, setTargetC] = React.useState("");
  const [targetF, setTargetF] = React.useState("");

  // Confirm modal
  const [confirmAction, setConfirmAction] = React.useState(null);
  const [addSheetOpen, setAddSheetOpen] = React.useState(false);
  const [targetsSheetOpen, setTargetsSheetOpen] = React.useState(false);

  // Data loading
  const loadTotals = React.useCallback(async () => setTotals(await getNutritionTotalsForDate(today)), [today]);
  const loadQuota = React.useCallback(async () => setQuota(await getNutritionQuota()), []);
  const loadEntries = React.useCallback(async () => setLogEntries(await getNutritionLogsForDate(today)), [today]);
  const loadSaved = React.useCallback(async () => setSavedFoodsList(await getSavedFoods()), []);

  React.useEffect(() => { loadTotals(); }, [loadTotals]);
  React.useEffect(() => { loadQuota(); }, [loadQuota]);
  React.useEffect(() => { loadEntries(); }, [loadEntries]);
  React.useEffect(() => { loadSaved(); }, [loadSaved]);

  // Day change detection
  React.useEffect(() => {
    const check = () => { const now = new Date().toISOString().slice(0, 10); if (now !== today) setToday(now); };
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") check(); });
    check();
    const interval = setInterval(check, 60000);
    return () => { sub.remove(); clearInterval(interval); };
  }, [today]);

  // Back handler
  React.useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (confirmAction) { setConfirmAction(null); return true; }
      if (selectedSaved) { setSelectedSaved(null); return true; }
      if (addSheetOpen) { addSheetRef.current?.dismiss(); return true; }
      if (targetsSheetOpen) { targetsSheetRef.current?.dismiss(); return true; }
      if (onBack) { onBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [onBack, confirmAction, selectedSaved, addSheetOpen, targetsSheetOpen]);

  // Actions
  function openAddSheet() {
    setAddMode("manual"); setManualName(""); setManualCal(""); setManualP(""); setManualC(""); setManualF("");
    setSelectedSaved(null); setGramAmount("100");
    setAddSheetOpen(true);
    addSheetRef.current?.present();
  }

  function openTargetsSheet() {
    setTargetCal(String(Math.round(quota.calories)));
    setTargetP(String(Math.round(quota.protein)));
    setTargetC(String(Math.round(quota.carbs)));
    setTargetF(String(Math.round(quota.fat)));
    setTargetsSheetOpen(true);
    targetsSheetRef.current?.present();
  }

  async function handleLogManual() {
    const resolved = resolveNutrition(manualCal, manualP, manualC, manualF);
    if (!resolved) return;
    const name = manualName.trim();
    await addNutritionLog({ date: today, ...resolved, foodName: name });
    Keyboard.dismiss();
    setManualName(""); setManualCal(""); setManualP(""); setManualC(""); setManualF("");
    await loadEntries(); await loadTotals();
  }

  async function handleAddFromSaved() {
    if (!selectedSaved) return;
    const g = Number(gramAmount) || 100;
    const scale = g / (selectedSaved.servingGrams || 100);
    const cal = Math.round(selectedSaved.calories * scale);
    const p = Math.round(selectedSaved.protein * scale);
    const c = Math.round(selectedSaved.carbs * scale);
    const f = Math.round(selectedSaved.fat * scale);
    await addNutritionLog({ date: today, calories: cal, protein: p, carbs: c, fat: f, foodName: selectedSaved.name });
    Keyboard.dismiss();
    setSelectedSaved(null);
    await loadEntries(); await loadTotals();
  }

  async function handleSaveTargets() {
    const resolved = resolveNutrition(targetCal, targetP, targetC, targetF);
    if (!resolved) return;
    await setNutritionQuota(resolved);
    Keyboard.dismiss();
    targetsSheetRef.current?.dismiss();
    await loadQuota();
  }

  function handleDeleteEntry(entry) {
    setConfirmAction({
      title: "Delete Entry", message: "Remove this food log?", label: "Delete",
      onConfirm: async () => { setConfirmAction(null); await deleteNutritionLog(entry.id); await loadEntries(); await loadTotals(); },
    });
  }

  function handleDeleteSaved(food) {
    setConfirmAction({
      title: "Delete Saved Food", message: `Remove "${food.name}" from saved?`, label: "Delete",
      onConfirm: async () => { setConfirmAction(null); await deleteSavedFood(food.id); await loadSaved(); },
    });
  }

  // Backdrop
  const renderBackdrop = React.useCallback((props) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="close" style={[props.style, { backgroundColor: BRAND.overlay }]} />
  ), []);

  const sheetConfig = { enablePanDownToClose: true, enableDynamicSizing: false, enableOverDrag: false, enableContentPanningGesture: false,
    backdropComponent: renderBackdrop, handleIndicatorStyle: { backgroundColor: BRAND.border, width: 36 }, handleStyle: { paddingVertical: 12 },
    backgroundStyle: { backgroundColor: BRAND.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28 } };

  // Progress percentage
  const calPct = quota.calories > 0 ? Math.min(100, (totals.calories / quota.calories) * 100) : 0;

  // Confirm modal
  const confirmModal = (
    <Modal visible={confirmAction !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setConfirmAction(null)}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setConfirmAction(null)}>
          <View style={{ flex: 1, backgroundColor: BRAND.overlay }} />
        </Pressable>
        <View style={{ width: "82%", maxWidth: 320, backgroundColor: BRAND.surface, borderRadius: 20, padding: S * 1.25 }}>
          <Text style={{ color: BRAND.text, fontSize: 18, fontWeight: "700", marginBottom: 6 }}>{confirmAction?.title}</Text>
          <Text style={{ color: BRAND.textSecondary, fontSize: 14, marginBottom: S }}>{confirmAction?.message}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pill label="Cancel" onPress={() => setConfirmAction(null)} />
            <Pressable onPress={confirmAction?.onConfirm} style={({ pressed }) => ({ flex: 1, height: 44, borderRadius: 12, backgroundColor: BRAND.error, justifyContent: "center", alignItems: "center", opacity: pressed ? 0.8 : 1 })}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{confirmAction?.label}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <BottomSheetModalProvider>
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>

      {/* ── Header ── */}
      <View style={{ paddingTop: insets.top + S, paddingBottom: S * 0.75, paddingHorizontal: S }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ color: BRAND.text, fontSize: 18, fontWeight: "700", flex: 1 }}>Calorie Intake</Text>
          <IconButton icon="calendar-month-outline" size={20} iconColor={BRAND.textSecondary} style={{ margin: 0 }} />
        </View>
      </View>
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: BRAND.border }} />

      {/* ── Daily Summary ── */}
      <Pressable style={({ pressed }) => ({ padding: S, opacity: pressed ? 0.8 : 1 })} onPress={openTargetsSheet}>
        <View style={{ backgroundColor: BRAND.surface, borderRadius: 16, padding: S }}>
          <View style={{ flexDirection: "row" }}>
            {[
              { label: "Calories", cur: totals.calories, tgt: quota.calories },
              { label: "Protein", cur: totals.protein, tgt: quota.protein },
              { label: "Carbs", cur: totals.carbs, tgt: quota.carbs },
              { label: "Fat", cur: totals.fat, tgt: quota.fat },
            ].map((m) => (
              <View key={m.label} style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ color: BRAND.textSecondary, fontSize: 10, fontWeight: "600", letterSpacing: 0.5 }}>{m.label}</Text>
                <Text style={{ color: BRAND.text, fontSize: 20, fontWeight: "700", marginTop: 2 }}>{Math.round(m.cur)}</Text>
                <Text style={{ color: BRAND.textMuted, fontSize: 11 }}>/ {Math.round(m.tgt)}</Text>
              </View>
            ))}
          </View>
          <View style={{ marginTop: 14, height: 3, borderRadius: 2, backgroundColor: BRAND.surfaceHigh }}>
            <View style={{ width: `${calPct}%`, height: 3, borderRadius: 2, backgroundColor: BRAND.accent }} />
          </View>
        </View>
      </Pressable>

      {/* ── Today's Log ── */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: S, paddingBottom: S }} showsVerticalScrollIndicator={false} bounces={false}>
        {logEntries.length === 0 ? (
          <Text style={{ color: BRAND.textMuted, fontSize: 13 }}>No entries yet</Text>
        ) : (
          logEntries.map((entry) => (
            <Pressable key={entry.id} onPress={() => handleDeleteEntry(entry)} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
              <View style={{ backgroundColor: BRAND.surface, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10 }}>
                <Text style={{ color: BRAND.text, fontSize: 15, fontWeight: "500" }} numberOfLines={1}>
                  {entry.foodName || "New Entry"}
                </Text>
                <Text style={{ color: BRAND.textMuted, fontSize: 12, marginTop: 4 }}>
                  {Math.round(entry.calories)} cal · {Math.round(entry.protein)}P · {Math.round(entry.carbs)}C · {Math.round(entry.fat)}F
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* ── Add Food Button ── */}
      <View style={{ paddingHorizontal: S, paddingTop: S, paddingBottom: insets.bottom + S, backgroundColor: BRAND.bg }}>
        <Pressable onPress={openAddSheet} style={({ pressed }) => ({ height: 48, borderRadius: 14, borderWidth: 1, borderColor: BRAND.border, borderStyle: "dashed", justifyContent: "center", alignItems: "center", opacity: pressed ? 0.8 : 1 })}>
          <Text style={{ color: BRAND.textSecondary, fontSize: 14, fontWeight: "500" }}>+ Add Food</Text>
        </Pressable>
      </View>

      {/* ── Add Food Sheet ── */}
      <BottomSheetModal ref={addSheetRef} snapPoints={["57%"]} {...sheetConfig} onDismiss={() => setAddSheetOpen(false)}>
        <View style={{ flex: 1, padding: S, paddingBottom: insets.bottom + S }}>
          <Text style={{ color: BRAND.text, fontSize: 22, fontWeight: "700", marginBottom: S }}>Add Food</Text>

          {/* Mode toggle */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: S }}>
            <Pill label="New Food" active={addMode === "manual"} onPress={() => setAddMode("manual")} />
            <Pill label="Saved Foods" active={addMode === "saved"} onPress={() => setAddMode("saved")} />
          </View>

          {addMode === "manual" ? (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>
              <MacroInput label="Food name" value={manualName} onChangeText={setManualName} kb="default" />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <MacroInput label="Calories" value={manualCal} onChangeText={setManualCal} />
                <MacroInput label="Protein" value={manualP} onChangeText={setManualP} />
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <MacroInput label="Carbs" value={manualC} onChangeText={setManualC} />
                <MacroInput label="Fat" value={manualF} onChangeText={setManualF} />
              </View>
            </ScrollView>
          ) : (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
              {savedFoodsList.length === 0 ? (
                <Text style={{ color: BRAND.textMuted, fontSize: 13 }}>No saved foods yet</Text>
              ) : (
                savedFoodsList.map((food) => (
                  <Pressable key={food.id} onPress={() => {
                    if (selectedSaved?.id === food.id) { setSelectedSaved(null); }
                    else { setSelectedSaved(food); setGramAmount(String(food.servingGrams)); }
                  }}>
                    <View style={{ backgroundColor: selectedSaved?.id === food.id ? BRAND.surfaceHigh : BRAND.surface, borderRadius: 12, padding: 14, marginBottom: 8 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ color: BRAND.text, fontWeight: "500", flex: 1 }} numberOfLines={1}>{food.name}</Text>
                        <Pressable onPress={() => handleDeleteSaved(food)} hitSlop={8}>
                          <Text style={{ color: BRAND.error, fontSize: 12 }}>Delete</Text>
                        </Pressable>
                      </View>
                      <Text style={{ color: BRAND.textMuted, fontSize: 12, marginTop: 2 }}>
                        {Math.round(food.calories)} cal · {Math.round(food.protein)}P · {Math.round(food.carbs)}C · {Math.round(food.fat)}F per {food.servingGrams}g
                      </Text>
                      {selectedSaved?.id === food.id && (
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12, gap: 10 }}>
                          <RNTextInput value={gramAmount} onChangeText={setGramAmount} keyboardType="decimal-pad"
                            cursorColor={BRAND.accent} selectionColor={BRAND.accent}
                            style={{ flex: 1, height: 44, backgroundColor: BRAND.bg, borderRadius: 12, paddingHorizontal: 14, color: BRAND.text, fontSize: 15 }} />
                          <Text style={{ color: BRAND.textSecondary, fontSize: 13 }}>grams</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                ))
              )}
              {selectedSaved && <Pressable onPress={() => setSelectedSaved(null)} style={{ flex: 1, minHeight: 100 }} />}
            </ScrollView>
          )}

          {/* Action */}
          {addMode === "manual" && (() => {
            const canResolve = !!resolveNutrition(manualCal, manualP, manualC, manualF);
            return (
          <View style={{ flexDirection: "row", gap: 10, marginTop: S }}>
            <>
              <Pill label="LOG" active disabled={!canResolve} onPress={handleLogManual} uppercase />
              <Pill label="SAVE" disabled={!manualName.trim() || !canResolve} onPress={async () => {
                const n = manualName.trim(); if (!n) return;
                const resolved = resolveNutrition(manualCal, manualP, manualC, manualF);
                if (!resolved) return;
                await addSavedFood({ name: n, ...resolved, servingGrams: 100 });
                await loadSaved(); Keyboard.dismiss();
                setManualName(""); setManualCal(""); setManualP(""); setManualC(""); setManualF("");
              }} uppercase />
            </>
          </View>
            );
          })()}
          {addMode === "saved" && (
          <View style={{ flexDirection: "row", gap: 10, marginTop: S }}>
              <Pill label="ADD" active={!!selectedSaved} disabled={!selectedSaved} onPress={handleAddFromSaved} uppercase />
          </View>
          )}
        </View>
      </BottomSheetModal>

      {/* ── Targets Sheet ── */}
      <BottomSheetModal ref={targetsSheetRef} snapPoints={["57%"]} {...sheetConfig} onDismiss={() => setTargetsSheetOpen(false)}>
        <View style={{ flex: 1, padding: S, paddingBottom: insets.bottom + S }}>
          <Text style={{ color: BRAND.text, fontSize: 22, fontWeight: "700", marginBottom: S * 1.5 }}>Daily Targets</Text>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>
            <MacroInput label="Calories" value={targetCal} onChangeText={setTargetCal} />
            <MacroInput label="Protein" value={targetP} onChangeText={setTargetP} />
            <MacroInput label="Carbs" value={targetC} onChangeText={setTargetC} />
            <MacroInput label="Fat" value={targetF} onChangeText={setTargetF} />
          </ScrollView>
          <View style={{ flexDirection: "row", marginTop: S }}>
            <Pill label="SAVE" active disabled={!resolveNutrition(targetCal, targetP, targetC, targetF)} onPress={handleSaveTargets} uppercase />
          </View>
        </View>
      </BottomSheetModal>

      {confirmModal}
    </View>
    </BottomSheetModalProvider>
  );
}
