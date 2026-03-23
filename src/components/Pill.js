import * as React from "react";
import { Pressable } from "react-native";
import { IconButton, Text } from "react-native-paper";
import { BRAND } from "../constants/colors";

export function Pill({ label, onPress, active, danger, icon, uppercase, disabled }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => ({
        flex: 1, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center",
        flexDirection: "row", gap: 6,
        backgroundColor: active ? BRAND.accent : danger ? "transparent" : BRAND.surfaceHigh,
        borderWidth: danger ? 1 : 0, borderColor: danger ? BRAND.error : undefined,
        opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
      })}
    >
      {icon && <IconButton icon={icon} size={16} iconColor={active ? BRAND.bg : danger ? BRAND.error : BRAND.textSecondary} style={{ margin: 0, width: 16, height: 16 }} />}
      <Text style={{ color: active ? BRAND.bg : danger ? BRAND.error : BRAND.text, fontWeight: active ? "700" : "500", fontSize: 13, letterSpacing: uppercase ? 1 : 0 }}>{label}</Text>
    </Pressable>
  );
}
