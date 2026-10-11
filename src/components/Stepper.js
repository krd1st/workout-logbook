import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { BRAND } from "../constants/colors";

export function Stepper({ value, onValueChange, min, max, step = 1, unit = "", formatValue }) {
  const display = formatValue ? formatValue(value) : String(value);

  const adjust = (dir) => {
    const next = Math.round((value + dir * step) * 1000) / 1000;
    if (next >= min && next <= max) onValueChange(next);
  };

  return (
    <View style={{ flexDirection: "row", alignItems: "center", height: 48, backgroundColor: BRAND.surfaceHigh, borderRadius: 12 }}>
      <Pressable onPress={() => adjust(-1)} style={({ pressed }) => ({ width: 52, height: 48, justifyContent: "center", alignItems: "center", opacity: value <= min ? 0.25 : pressed ? 0.5 : 1 })}>
        <Text style={{ color: BRAND.accent, fontSize: 22, fontWeight: "700" }}>−</Text>
      </Pressable>
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={{ color: BRAND.text, fontSize: 17, fontWeight: "600" }}>{display}{unit ? ` ${unit}` : ""}</Text>
      </View>
      <Pressable onPress={() => adjust(1)} style={({ pressed }) => ({ width: 52, height: 48, justifyContent: "center", alignItems: "center", opacity: value >= max ? 0.25 : pressed ? 0.5 : 1 })}>
        <Text style={{ color: BRAND.accent, fontSize: 22, fontWeight: "700" }}>+</Text>
      </Pressable>
    </View>
  );
}
