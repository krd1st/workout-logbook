import * as React from "react";
import { View } from "react-native";
import { HorizontalPicker } from "expo-horizontal-picker";
import { BRAND } from "../constants/colors";

export const NumberWheel = React.memo(function NumberWheel({ values, value, onValueChange, formatLabel }) {
  const fmt = formatLabel || ((v) => String(v));

  const items = React.useMemo(() =>
    values.map((v) => ({ label: fmt(v), value: v })),
  [values, fmt]);

  const currentIndex = React.useMemo(() => {
    if (!values.length) return 0;
    // Exact match first
    const idx = values.indexOf(value);
    if (idx >= 0) return idx;
    // Closest match (handles floating point or step mismatch)
    let closest = 0;
    let minDist = Math.abs(values[0] - value);
    for (let i = 1; i < values.length; i++) {
      const d = Math.abs(values[i] - value);
      if (d < minDist) { minDist = d; closest = i; }
    }
    return closest;
  }, [values, value]);

  // Sync parent state with what the wheel actually displays on mount
  React.useEffect(() => {
    const displayed = values[currentIndex];
    if (displayed !== value) onValueChange(displayed);
  }, []); // only on mount

  const handleChange = React.useCallback((selected, index) => {
    onValueChange(values[index]);
  }, [onValueChange, values]);

  return (
    <View style={{ height: 40, overflow: "hidden", backgroundColor: BRAND.surfaceHigh, borderRadius: 10, position: "relative" }}>
      <HorizontalPicker
        items={items}
        initialScrollIndex={currentIndex}
        onChange={handleChange}
        visibleItemCount={7}
        focusedOpacityStyle={1}
        unfocusedOpacityStyle={0.2}
        focusedTransformStyle={[{ scale: 1.1 }]}
        unfocusedTransformStyle={[{ scale: 0.85 }]}
        pickerItemStyle={{ height: 40, justifyContent: "center", alignItems: "center" }}
        pickerItemTextStyle={{ fontSize: 14, fontWeight: "500", color: BRAND.text }}
        style={{ height: 40 }}
        decelerationRate="fast"
      />
      <View pointerEvents="none" style={{ position: "absolute", left: "50%", marginLeft: -0.5, top: 6, bottom: 6, width: 1, backgroundColor: BRAND.accent, opacity: 0.7, borderRadius: 1 }} />
    </View>
  );
});
