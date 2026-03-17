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
  initialNumSets = 2,
  submitLabel = "Add",
  onSubmit,
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
  const [numSets, setNumSets] = React.useState(String(initialNumSets));

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({
      name: trimmed,
      unitType,
      min: Number(minVal) || 1,
      max: Number(maxVal) || 12,
      step: Number(stepVal) || 1,
      numSets: Number(numSets) || 2,
    });
  };

  const inputStyle = {
    height: ui.controlHeight,
    backgroundColor: "transparent",
    textAlign: "center",
    fontSize: ui.fontSizeBody,
  };

  const outlineStyle = {
    borderRadius: ui.controlRadius,
    borderWidth: ui.controlBorderWidth,
  };

  const g = ui.gridPadding;

  return (
    <View style={{ gap: g * 1.5 }}>
      {/* Exercise name */}
      <View>
        <Text variant="labelMedium" style={{ marginBottom: g * 0.3, opacity: 0.6 }}>Exercise name</Text>
        <TextInput
          mode="outlined"
          placeholder="e.g. Bench Press"
          value={name}
          onChangeText={setName}
          style={inputStyle}
          contentStyle={{ height: ui.controlHeight }}
          outlineStyle={outlineStyle}
          autoFocus
        />
      </View>

      {/* Unit type toggle */}
      <View>
        <Text variant="labelMedium" style={{ marginBottom: g * 0.3, opacity: 0.6 }}>Unit type</Text>
        <View style={{ flexDirection: "row", gap: g * 0.5 }}>
          {["reps", "sec"].map((type) => (
            <Pressable
              key={type}
              onPress={() => {
                setUnitType(type);
                if (type === "sec") {
                  setMinVal("30"); setMaxVal("120"); setStepVal("15");
                } else {
                  setMinVal("8"); setMaxVal("12"); setStepVal("1");
                }
              }}
              style={{
                flex: 1,
                height: ui.controlHeight,
                borderRadius: ui.controlRadius,
                justifyContent: "center",
                alignItems: "center",
                borderWidth: ui.controlBorderWidth,
                borderColor: unitType === type ? colors.outline : colors.outlineVariant,
                backgroundColor: unitType === type ? colors.surface : "transparent",
              }}
            >
              <Text variant="labelMedium" style={{ fontWeight: unitType === type ? "700" : "400" }}>
                {type === "reps" ? "Reps" : "Seconds"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Range + Sets row */}
      <View style={{ flexDirection: "row", gap: g * 0.5 }}>
        <View style={{ flex: 1 }}>
          <Text variant="labelMedium" style={{ marginBottom: g * 0.3, opacity: 0.6, textAlign: "center" }}>Min</Text>
          <TextInput
            mode="outlined"
            value={minVal}
            onChangeText={setMinVal}
            keyboardType="number-pad"
            style={inputStyle}
            contentStyle={{ height: ui.controlHeight, textAlign: "center" }}
            outlineStyle={outlineStyle}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="labelMedium" style={{ marginBottom: g * 0.3, opacity: 0.6, textAlign: "center" }}>Max</Text>
          <TextInput
            mode="outlined"
            value={maxVal}
            onChangeText={setMaxVal}
            keyboardType="number-pad"
            style={inputStyle}
            contentStyle={{ height: ui.controlHeight, textAlign: "center" }}
            outlineStyle={outlineStyle}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="labelMedium" style={{ marginBottom: g * 0.3, opacity: 0.6, textAlign: "center" }}>Step</Text>
          <TextInput
            mode="outlined"
            value={stepVal}
            onChangeText={setStepVal}
            keyboardType="number-pad"
            style={inputStyle}
            contentStyle={{ height: ui.controlHeight, textAlign: "center" }}
            outlineStyle={outlineStyle}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="labelMedium" style={{ marginBottom: g * 0.3, opacity: 0.6, textAlign: "center" }}>Sets</Text>
          <TextInput
            mode="outlined"
            value={numSets}
            onChangeText={setNumSets}
            keyboardType="number-pad"
            style={inputStyle}
            contentStyle={{ height: ui.controlHeight, textAlign: "center" }}
            outlineStyle={outlineStyle}
          />
        </View>
      </View>

      {/* Action buttons */}
      <View style={{ flexDirection: "row", gap: g * 0.5 }}>
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={{ flex: 1, borderRadius: ui.controlRadius, height: ui.controlHeight }}
          contentStyle={{ height: ui.controlHeight }}
          disabled={!name.trim()}
        >
          {submitLabel}
        </Button>
        {onRemoveFromRoutine && (
          <Button
            mode="outlined"
            icon="delete-outline"
            onPress={onRemoveFromRoutine}
            style={{ flex: 1, borderRadius: ui.controlRadius, height: ui.controlHeight }}
            contentStyle={{ height: ui.controlHeight }}
            textColor={colors.error}
          >
            Delete
          </Button>
        )}
      </View>
    </View>
  );
}
