import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { BRAND } from "../constants/colors";

export function ExerciseForm({
  initialName = "", initialUnitType = "reps", initialMin = 6, initialMax = 12,
  initialStep = 1, initialNumSets = 2, initialWeightMin = 0, initialWeightMax = 100,
  initialWeightStep = 2.5, submitLabel = "Add", onSubmit, showNameField = true, pinButton = false, showButton = true, onSubmitRef,
}) {
  const [name, setName] = React.useState(initialName);
  const [unitType, setUnitType] = React.useState(initialUnitType);
  const [minVal, setMinVal] = React.useState(String(initialMin));
  const [maxVal, setMaxVal] = React.useState(String(initialMax));
  const [weightMin, setWeightMin] = React.useState(String(initialWeightMin));
  const [weightMax, setWeightMax] = React.useState(String(initialWeightMax));
  const [weightStep, setWeightStep] = React.useState(String(initialWeightStep));
  const [numSets, setNumSets] = React.useState(String(initialNumSets));

  const getFormData = () => ({
    name: name.trim(), unitType,
    min: parseInt(minVal, 10) || (unitType === "sec" ? 30 : 6),
    max: parseInt(maxVal, 10) || (unitType === "sec" ? 120 : 12),
    step: unitType === "sec" ? 5 : 1,
    numSets: parseInt(numSets, 10) || 2,
    weightMin: parseFloat(weightMin) || 0,
    weightMax: parseFloat(weightMax) || 100,
    weightStep: parseFloat(weightStep) || 2.5,
  });

  const handleSubmit = () => {
    const data = getFormData();
    if (!data.name) return;
    onSubmit(data);
  };

  // Expose submit to parent via stable ref that always calls the latest handleSubmit
  const latestSubmit = React.useRef(handleSubmit);
  latestSubmit.current = handleSubmit;
  React.useEffect(() => {
    if (onSubmitRef) onSubmitRef(() => latestSubmit.current());
  }, [onSubmitRef]);

  const inputProps = (val, set, kb = "number-pad") => ({
    mode: "outlined", value: val, onChangeText: set, keyboardType: kb,
    cursorColor: BRAND.accent, selectionColor: "transparent",
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

  const toggle = (
    <View style={{ flex: 1 }}>
      {fieldLabel("")}
      <Pressable
        onPress={() => {
          const next = unitType === "reps" ? "sec" : "reps";
          setUnitType(next);
          if (next === "sec") { setMinVal("30"); setMaxVal("120"); }
          else { setMinVal("6"); setMaxVal("12"); }
        }}
        style={{ height: 44, borderRadius: 10, flexDirection: "row", overflow: "hidden", borderWidth: 1, borderColor: BRAND.border }}
      >
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: unitType === "reps" ? BRAND.accent : BRAND.surfaceHigh }}>
          <Text style={{ color: unitType === "reps" ? BRAND.bg : BRAND.textMuted, fontSize: 12, fontWeight: "700" }}>Reps</Text>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: unitType === "sec" ? BRAND.accent : BRAND.surfaceHigh }}>
          <Text style={{ color: unitType === "sec" ? BRAND.bg : BRAND.textMuted, fontSize: 12, fontWeight: "700" }}>Sec</Text>
        </View>
      </Pressable>
    </View>
  );

  const fields = (
    <View style={{ gap: 28 }}>
      {showNameField && (
        <View>
          {sectionLabel("Exercise name")}
          <TextInput {...inputProps(name, setName, "default")} placeholder="Bench Press" placeholderTextColor={BRAND.textMuted}
            style={{ height: 44, backgroundColor: "transparent" }} contentStyle={{ height: 44 }}
            outlineStyle={{ borderRadius: 10, borderWidth: 1, borderColor: BRAND.border }} textColor={BRAND.text} />
        </View>
      )}

      <View>
        {sectionLabel("Weight range")}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>{fieldLabel("Min")}<TextInput {...inputProps(weightMin, setWeightMin, "decimal-pad")} /></View>
          <View style={{ flex: 1 }}>{fieldLabel("Max")}<TextInput {...inputProps(weightMax, setWeightMax, "decimal-pad")} /></View>
          <View style={{ flex: 1 }}>{fieldLabel("Step")}<TextInput {...inputProps(weightStep, setWeightStep, "decimal-pad")} /></View>
        </View>
      </View>

      <View>
        {sectionLabel(unitType === "sec" ? "Time range" : "Rep range")}
        <View style={{ flexDirection: "row", gap: 10 }}>
          {toggle}
          <View style={{ flex: 1 }}>{fieldLabel("Min")}<TextInput {...inputProps(minVal, setMinVal)} /></View>
          <View style={{ flex: 1 }}>{fieldLabel("Max")}<TextInput {...inputProps(maxVal, setMaxVal)} /></View>
        </View>
      </View>

      <View>
        {sectionLabel("Sets per exercise")}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>{fieldLabel("Sets")}<TextInput {...inputProps(numSets, setNumSets)} /></View>
          <View style={{ flex: 2 }} />
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

  if (!showButton) {
    return fields;
  }

  if (pinButton) {
    return (
      <View style={{ flex: 1, justifyContent: "space-between" }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>
          {fields}
        </ScrollView>
        <View style={{ marginTop: 34 }}>{btn}</View>
      </View>
    );
  }

  return <View style={{ gap: 24 }}>{fields}{btn}</View>;
}
