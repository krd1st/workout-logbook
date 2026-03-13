import * as React from "react";
import { Pressable, View } from "react-native";
import {
  Button,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { getAppColors } from "../constants/colors";
import { useRelativeUi } from "../hooks/useRelativeUi";

export function ExerciseForm({
  initialName = "",
  initialUnitType = "reps",
  initialMin = 8,
  initialMax = 12,
  initialStep = 1,
  submitLabel = "Add",
  onSubmit,
  onCancel,
  onRemoveFromRoutine,
}) {
  const theme = useTheme();
  const colors = React.useMemo(() => getAppColors(theme), [theme]);
  const ui = useRelativeUi();
  const [name, setName] = React.useState(initialName);
  const [unitType, setUnitType] = React.useState(initialUnitType);
  const [minVal, setMinVal] = React.useState(String(initialMin));
  const [maxVal, setMaxVal] = React.useState(String(initialMax));
  const [stepVal, setStepVal] = React.useState(String(initialStep));

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({
      name: trimmed,
      unitType,
      min: Number(minVal) || 1,
      max: Number(maxVal) || 12,
      step: Number(stepVal) || 1,
    });
  };

  const compactH = Math.round(ui.controlHeight * 0.8);

  const inputStyle = {
    height: compactH,
    backgroundColor: "transparent",
    textAlign: "center",
    fontSize: ui.fontSizeBody * 0.85,
  };

  const outlineStyle = {
    borderRadius: ui.controlRadius,
    borderWidth: ui.controlBorderWidth,
  };

  const g = ui.gridPadding * 0.4;

  return (
    <View style={{ gap: g }}>
      {/* Row 1: Name + Reps/Sec toggle */}
      <View style={{ flexDirection: "row", gap: g }}>
        <TextInput
          mode="outlined"
          placeholder="Exercise name"
          value={name}
          onChangeText={setName}
          style={[inputStyle, { flex: 2 }]}
          contentStyle={{ height: compactH }}
          outlineStyle={outlineStyle}
          autoFocus
        />
        {["reps", "sec"].map((type) => (
          <Pressable
            key={type}
            onPress={() => {
              setUnitType(type);
              if (type === "sec") {
                setMinVal("30");
                setMaxVal("120");
                setStepVal("15");
              } else {
                setMinVal("8");
                setMaxVal("12");
                setStepVal("1");
              }
            }}
            style={{
              flex: 0.7,
              height: compactH,
              borderRadius: ui.controlRadius,
              justifyContent: "center",
              alignItems: "center",
              borderWidth: ui.controlBorderWidth,
              borderColor: unitType === type ? colors.outline : colors.outlineVariant,
              backgroundColor: unitType === type ? colors.surface : "transparent",
            }}
          >
            <Text
              variant="labelSmall"
              style={{ fontWeight: unitType === type ? "700" : "400" }}
            >
              {type === "reps" ? "Reps" : "Sec"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Row 2: Min / Max / Step */}
      <View style={{ flexDirection: "row", gap: g, alignItems: "center" }}>
        {[
          { label: "Min", val: minVal, set: setMinVal },
          { label: "Max", val: maxVal, set: setMaxVal },
          { label: "Step", val: stepVal, set: setStepVal },
        ].map((f) => (
          <View key={f.label} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 2 }}>
            <Text variant="labelSmall" style={{ opacity: 0.7 }}>{f.label}</Text>
            <TextInput
              mode="outlined"
              value={f.val}
              onChangeText={f.set}
              keyboardType="number-pad"
              style={[inputStyle, { flex: 1 }]}
              contentStyle={{ height: compactH }}
              outlineStyle={outlineStyle}
            />
          </View>
        ))}
      </View>

      {/* Row 3: Cancel / Save / Delete */}
      <View style={{ flexDirection: "row", gap: g }}>
        {onCancel && (
          <Button
            mode="outlined"
            onPress={onCancel}
            style={{ flex: 1, borderRadius: ui.controlRadius }}
            compact
          >
            Cancel
          </Button>
        )}
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={{ flex: 1, borderRadius: ui.controlRadius }}
          disabled={!name.trim()}
          compact
        >
          {submitLabel}
        </Button>
        {onRemoveFromRoutine && (
          <Button
            mode="outlined"
            icon="delete-outline"
            onPress={onRemoveFromRoutine}
            style={{ flex: 1, borderRadius: ui.controlRadius }}
            textColor={colors.error}
            compact
          >
            Delete
          </Button>
        )}
      </View>
    </View>
  );
}
