import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { BRAND } from "../constants/colors";

export function HeaderToggle({ active, onSwitch }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 28 }}>
      <ToggleLabel label="Routines" isActive={active === "routines"} onPress={() => onSwitch("routines")} />
      <ToggleLabel label="Exercises" isActive={active === "exercises"} onPress={() => onSwitch("exercises")} />
    </View>
  );
}

function ToggleLabel({ label, isActive, onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      {({ pressed }) => (
        <Text
          style={{
            color: isActive ? BRAND.text : BRAND.textMuted,
            fontSize: 18,
            fontWeight: "700",
            opacity: pressed ? 0.6 : 1,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
