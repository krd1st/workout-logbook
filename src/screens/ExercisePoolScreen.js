import * as React from "react";
import {
  BackHandler, InteractionManager, Keyboard, Modal, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BRAND } from "../constants/colors";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SortableList } from "../components/SortableList";
import { HeaderToggle } from "../components/HeaderToggle";
import {
  getExercises, createExercise, updateExercise, deleteExercise, reorderExercises,
} from "../../db/database";

const S = 20;
const MAX_NAME_LEN = 30;
// Vertical offset for centered modals — negative shifts the card up.
// Tweak this number to taste.
const MODAL_VERTICAL_OFFSET = -30;

export function ExercisePoolScreen({ exercises: initialExercises = [], onExercisesChange, section, onSwitchSection }) {
  const [exercises, setExercises] = React.useState(initialExercises);
  const [adding, setAdding] = React.useState(false);
  const [selected, setSelected] = React.useState(null);
  const [confirmAction, setConfirmAction] = React.useState(null);

  const insets = useSafeAreaInsets();

  const propagate = React.useCallback((next) => {
    setExercises(next);
    onExercisesChange?.(next);
  }, [onExercisesChange]);

  const reload = React.useCallback(async () => {
    const list = await getExercises();
    propagate(list);
    return list;
  }, [propagate]);

  /* ── Toggle handler ── */
  function handleToggleSection(s) {
    if (s === "exercises") {
      setSelected(null); setAdding(false);
      return;
    }
    onSwitchSection?.(s);
  }

  /* ── Back handler ── */
  React.useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (confirmAction) { setConfirmAction(null); return true; }
      if (selected) { setSelected(null); return true; }
      if (adding) { setAdding(false); return true; }
      if (onSwitchSection) { onSwitchSection("routines"); return true; }
      return false;
    });
    return () => sub.remove();
  }, [confirmAction, selected, adding, onSwitchSection]);

  /* ── CRUD ── */
  async function handleCreate(data) {
    try {
      const id = await createExercise(data);
      const newRow = {
        id, name: data.name, min_val: data.min, max_val: data.max,
        num_sets: data.numSets, sort_order: 0,
      };
      propagate([newRow, ...exercises.map((e) => ({ ...e, sort_order: (e.sort_order ?? 0) + 1 }))]);
      setAdding(false);
    } catch {
      // Duplicate name; keep modal open.
    }
  }

  function handleUpdate(data) {
    if (!selected) return;
    const next = { ...selected, name: data.name, min_val: data.min, max_val: data.max, num_sets: data.numSets };
    propagate(exercises.map((e) => (e.id === next.id ? next : e)));
    updateExercise({ id: selected.id, ...data }).catch(() => {});
  }

  function handleDelete(ex) {
    setConfirmAction({
      title: "Delete Exercise",
      message: "Removes this exercise and all of its logs everywhere. Are you sure?",
      label: "Delete",
      onConfirm: async () => {
        setConfirmAction(null);
        setSelected(null);
        await deleteExercise(ex.id);
        propagate(exercises.filter((e) => e.id !== ex.id));
      },
    });
  }

  function handleReorder(d) {
    propagate(d);
    const ids = d.map((e) => e.id);
    InteractionManager.runAfterInteractions(() => {
      reorderExercises(ids).catch(() => {});
    });
  }

  function openExercise(ex) {
    setSelected(ex);
  }

  /* ── Render ── */
  const renderItem = ({ item }) => (
    <View style={{ marginBottom: 12 }}>
      <View style={{ backgroundColor: BRAND.surface, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20 }}>
        <Text style={{ color: BRAND.text, fontSize: 16, fontWeight: "500" }} numberOfLines={1}>{item.name}</Text>
        <Text style={{ color: BRAND.textMuted, fontSize: 13, marginTop: 4 }}>
          {item.num_sets} set{item.num_sets !== 1 ? "s" : ""} · {item.min_val}–{item.max_val} reps
        </Text>
      </View>
    </View>
  );

  const confirmModal = <ConfirmDialog action={confirmAction} onDismiss={() => setConfirmAction(null)} />;

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <View style={{ paddingTop: insets.top + S, paddingBottom: S * 0.75, paddingHorizontal: S }}>
        <HeaderToggle active={section ?? "exercises"} onSwitch={handleToggleSection} />
      </View>
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: BRAND.border }} />

      <SortableList
        data={exercises}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        onReorder={handleReorder}
        onItemPress={openExercise}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: S }}
        bounces={false}
      />

      <View style={{ paddingHorizontal: S, paddingTop: S, paddingBottom: insets.bottom + S, backgroundColor: BRAND.bg }}>
        <Pressable onPress={() => setAdding(true)} style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: BRAND.accent, borderStyle: "dashed", justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: BRAND.accent, fontSize: 14, fontWeight: "500" }}>+ Add Exercise</Text>
        </Pressable>
      </View>

      <CreateExerciseModal
        visible={adding}
        onSubmit={handleCreate}
        onDismiss={() => setAdding(false)}
      />

      <EditExerciseModal
        key={selected?.id ?? "none"}
        visible={!!selected}
        exercise={selected}
        onUpdate={handleUpdate}
        onDelete={() => selected && handleDelete(selected)}
        onDismiss={() => setSelected(null)}
      />

      {confirmModal}
    </View>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */

function FieldGroup({ children }) {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {children}
    </View>
  );
}

function NumField({ label, value, onChange }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: BRAND.textMuted, fontSize: 11, textAlign: "center", marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        cursorColor={BRAND.accent}
        selectionColor="transparent"
        style={{ height: 44, textAlign: "center", color: BRAND.text, borderRadius: 10, borderWidth: 1, borderColor: BRAND.border, fontSize: 15 }}
      />
    </View>
  );
}

function CreateExerciseModal({ visible, onSubmit, onDismiss }) {
  const [name, setName] = React.useState("");
  const [numSets, setNumSets] = React.useState("2");
  const [minR, setMinR] = React.useState("6");
  const [maxR, setMaxR] = React.useState("12");
  const nameRef = React.useRef(null);

  React.useEffect(() => {
    if (visible) { setName(""); setNumSets("2"); setMinR("6"); setMaxR("12"); }
  }, [visible]);

  function submit() {
    const t = name.trim();
    if (!t) return;
    const sets = clampInt(numSets, 1, 10, 2);
    const min = clampInt(minR, 1, 999, 6);
    const max = clampInt(maxR, min, 999, Math.max(12, min));
    onSubmit({ name: t, numSets: sets, min, max });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
      onShow={() => setTimeout(() => nameRef.current?.focus(), 100)}
    >
      <View style={{ flex: 1 }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { Keyboard.dismiss(); onDismiss(); }}>
          <View style={{ flex: 1, backgroundColor: BRAND.overlay }} />
        </Pressable>
        <View style={{ ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", paddingHorizontal: S }} pointerEvents="box-none">
          <View style={{ width: "100%", maxWidth: 360, backgroundColor: BRAND.surface, borderRadius: 20, padding: S, transform: [{ translateY: MODAL_VERTICAL_OFFSET }] }}>
            <Text style={{ color: BRAND.text, fontSize: 18, fontWeight: "700", marginBottom: S }}>New Exercise</Text>
            <TextInput
              ref={nameRef}
              placeholder="Exercise name"
              value={name}
              onChangeText={(t) => setName(t.slice(0, MAX_NAME_LEN))}
              cursorColor={BRAND.accent} selectionColor="transparent"
              placeholderTextColor={BRAND.textMuted}
              style={{ height: 44, borderRadius: 10, borderWidth: 1, borderColor: BRAND.border, color: BRAND.text, paddingHorizontal: 14, fontSize: 16, marginBottom: S }}
            />
            <FieldGroup>
              <NumField label="Sets" value={numSets} onChange={setNumSets} />
              <NumField label="Min" value={minR} onChange={setMinR} />
              <NumField label="Max" value={maxR} onChange={setMaxR} />
            </FieldGroup>
            <Pressable
              onPress={submit}
              disabled={!name.trim()}
              style={{ height: 48, borderRadius: 12, marginTop: S, backgroundColor: !name.trim() ? BRAND.surfaceHigh : BRAND.accent, justifyContent: "center", alignItems: "center" }}
            >
              <Text style={{ color: !name.trim() ? BRAND.textMuted : BRAND.bg, fontSize: 15, fontWeight: "700" }}>Create</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EditExerciseModal({ visible, exercise, onUpdate, onDelete, onDismiss }) {
  const [editingName, setEditingName] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState("");
  const [numSets, setNumSets] = React.useState("2");
  const [minR, setMinR] = React.useState("6");
  const [maxR, setMaxR] = React.useState("12");

  // Reset form whenever modal opens for a new exercise.
  React.useEffect(() => {
    if (!exercise) return;
    setNameDraft(exercise.name);
    setNumSets(String(exercise.num_sets ?? 2));
    setMinR(String(exercise.min_val ?? 6));
    setMaxR(String(exercise.max_val ?? 12));
    setEditingName(false);
  }, [exercise]);

  function persist({ overrides } = {}) {
    if (!exercise) return;
    const t = (overrides?.name ?? nameDraft).trim();
    if (!t) return;
    const sets = clampInt(overrides?.numSets ?? numSets, 1, 10, exercise.num_sets ?? 2);
    const min = clampInt(overrides?.minR ?? minR, 1, 999, exercise.min_val ?? 6);
    const max = clampInt(overrides?.maxR ?? maxR, min, 999, Math.max(exercise.max_val ?? 12, min));
    onUpdate({ name: t, numSets: sets, min, max });
  }

  function commitName() {
    setEditingName(false);
    if (!exercise || !nameDraft.trim() || nameDraft.trim() === exercise.name) return;
    persist({ overrides: { name: nameDraft } });
  }

  if (!exercise) return <Modal visible={false} transparent />;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={{ flex: 1 }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { Keyboard.dismiss(); persist(); onDismiss(); }}>
          <View style={{ flex: 1, backgroundColor: BRAND.overlay }} />
        </Pressable>
        <View style={{ ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", paddingHorizontal: S }} pointerEvents="box-none">
          <View style={{ width: "100%", maxWidth: 360, backgroundColor: BRAND.surface, borderRadius: 20, padding: S, transform: [{ translateY: MODAL_VERTICAL_OFFSET }] }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: S }}>
              {editingName ? (
                <TextInput
                  value={nameDraft}
                  onChangeText={(t) => setNameDraft(t.slice(0, MAX_NAME_LEN))}
                  autoFocus onSubmitEditing={commitName} onBlur={commitName}
                  cursorColor={BRAND.accent} selectionColor="transparent"
                  style={{ flex: 1, color: BRAND.text, fontSize: 18, fontWeight: "700", padding: 0, margin: 0 }}
                />
              ) : (
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => setEditingName(true)}
                >
                  <Text style={{ color: BRAND.text, fontSize: 18, fontWeight: "700" }} numberOfLines={1}>{exercise.name}</Text>
                </Pressable>
              )}
              <Pressable onPress={onDelete} hitSlop={8} style={{ marginLeft: 12 }}>
                <MaterialCommunityIcons name="delete-outline" size={20} color={BRAND.error} />
              </Pressable>
            </View>

            <FieldGroup>
              <NumField label="Sets" value={numSets} onChange={(v) => { setNumSets(v); }} />
              <NumField label="Min" value={minR} onChange={(v) => { setMinR(v); }} />
              <NumField label="Max" value={maxR} onChange={(v) => { setMaxR(v); }} />
            </FieldGroup>

            <Pressable
              onPress={() => { persist(); onDismiss(); }}
              style={{ height: 48, borderRadius: 12, marginTop: S, backgroundColor: BRAND.accent, justifyContent: "center", alignItems: "center" }}
            >
              <Text style={{ color: BRAND.bg, fontSize: 15, fontWeight: "700" }}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function clampInt(raw, min, max, fallback) {
  const n = parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
