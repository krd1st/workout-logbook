import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { BRAND } from "../constants/colors";

export function ExerciseForm({
  initialName = "", initialUnitType = "reps", initialMin = 8, initialMax = 12,
  initialStep = 1, initialNumSets = 2, initialWeightMin = 0, initialWeightMax = 250,
  initialWeightStep = 1.25, submitLabel = "Add", onSubmit, showNameField = true, pinButton = false,
}) {
  const [name, setName] = React.useState(initialName);
  const [unitType, setUnitType] = React.useState(initialUnitType);
  const [minVal, setMinVal] = React.useState(String(initialMin));
  const [maxVal, setMaxVal] = React.useState(String(initialMax));
  const [numSets, setNumSets] = React.useState(String(initialNumSets));
  const [weightMin, setWeightMin] = React.useState(String(initialWeightMin));
  const [weightMax, setWeightMax] = React.useState(String(initialWeightMax));
  const [weightStep, setWeightStep] = React.useState(String(initialWeightStep));

  const handleSubmit = () => {
    const t = name.trim(); if (!t) return;
    onSubmit({ name: t, unitType, min: Number(minVal) || 1, max: Number(maxVal) || 12, step: initialStep, numSets: Number(numSets) || 2, weightMin: Number(weightMin) || 0, weightMax: Number(weightMax) || 250, weightStep: Number(weightStep) || 1.25 });
  };

  const inputProps = (val, set, kb = "number-pad") => ({
    mode: "outlined", value: val, onChangeText: set, keyboardType: kb,
    style: { flex: 1, height: 44, backgroundColor: "transparent", textAlign: "center" },
    contentStyle: { height: 44, textAlign: "center" },
    outlineStyle: { borderRadius: 10, borderWidth: 1, borderColor: BRAND.border },
    textColor: BRAND.text,
  });

  const sectionLabel = (text) => (
    <Text style={{ color: BRAND.textSecondary, fontSize: 12, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{text}</Text>
  );

  const fieldLabel = (text) => (
    <Text style={{ color: BRAND.textMuted, fontSize: 11, textAlign: "center", marginBottom: 3 }}>{text}</Text>
  );

  const fields = (
    <View style={{ gap: 28 }}>
      {showNameField && (
        <View>
          {sectionLabel("Exercise name")}
          <TextInput {...inputProps(name, setName)} placeholder="e.g. Bench Press" autoFocus
            style={{ height: 44, backgroundColor: "transparent" }} contentStyle={{ height: 44 }}
            outlineStyle={{ borderRadius: 10, borderWidth: 1, borderColor: BRAND.border }} textColor={BRAND.text} />
        </View>
      )}

      <View>
        {sectionLabel("Unit type")}
        <View style={{ flexDirection: "row", gap: 10 }}>
          {["reps", "sec"].map((t) => (
            <Pressable key={t} onPress={() => { setUnitType(t); if (t === "sec") { setMinVal("30"); setMaxVal("120"); } else { setMinVal("8"); setMaxVal("12"); } }}
              style={{ flex: 1, height: 44, borderRadius: 10, justifyContent: "center", alignItems: "center", backgroundColor: unitType === t ? BRAND.accent : BRAND.surfaceHigh }}>
              <Text style={{ color: unitType === t ? BRAND.bg : BRAND.text, fontWeight: unitType === t ? "700" : "400", fontSize: 14 }}>{t === "reps" ? "Reps" : "Seconds"}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View>
        {sectionLabel(unitType === "sec" ? "Seconds range" : "Reps range")}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>{fieldLabel("Min")}<TextInput {...inputProps(minVal, setMinVal)} /></View>
          <View style={{ flex: 1 }}>{fieldLabel("Max")}<TextInput {...inputProps(maxVal, setMaxVal)} /></View>
          <View style={{ flex: 1 }}>{fieldLabel("Sets")}<TextInput {...inputProps(numSets, setNumSets)} /></View>
        </View>
      </View>

      <View>
        {sectionLabel("Weight range (kg)")}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>{fieldLabel("Min")}<TextInput {...inputProps(weightMin, setWeightMin, "decimal-pad")} /></View>
          <View style={{ flex: 1 }}>{fieldLabel("Max")}<TextInput {...inputProps(weightMax, setWeightMax, "decimal-pad")} /></View>
          <View style={{ flex: 1 }}>{fieldLabel("Step")}<TextInput {...inputProps(weightStep, setWeightStep, "decimal-pad")} /></View>
        </View>
      </View>
    </View>
  );

  const btn = (
    <Pressable onPress={handleSubmit} disabled={!name.trim()}
      style={{ height: 48, borderRadius: 12, backgroundColor: !name.trim() ? BRAND.surfaceHigh : BRAND.accent, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: !name.trim() ? BRAND.textMuted : BRAND.bg, fontSize: 15, fontWeight: "700" }}>{submitLabel}</Text>
    </Pressable>
  );

  if (pinButton) {
    return (
      <View style={{ flex: 1, justifyContent: "space-between" }}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>
          {fields}
        </ScrollView>
        <View style={{ marginTop: 20 }}>{btn}</View>
      </View>
    );
  }

  return <View style={{ gap: 24 }}>{fields}{btn}</View>;
}
