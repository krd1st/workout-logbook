import * as React from "react";
import { Pressable, View } from "react-native";
import { Text } from "react-native-paper";
import { BRAND } from "../constants/colors";

const MOVE_THRESHOLD = 10;

export function DayButton({ title, subtitle, onPress, onLongPress, delayLongPress = 500 }) {
  const startPos = React.useRef(null);
  const moved = React.useRef(false);

  return (
    <Pressable
      style={{ flex: 1 }}
      onPressIn={(e) => { startPos.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }; moved.current = false; }}
      onTouchMove={(e) => {
        if (moved.current || !startPos.current) return;
        if (Math.abs(e.nativeEvent.pageX - startPos.current.x) > MOVE_THRESHOLD || Math.abs(e.nativeEvent.pageY - startPos.current.y) > MOVE_THRESHOLD) moved.current = true;
      }}
      onPress={() => { if (!moved.current && onPress) onPress(); }}
      onLongPress={() => { if (!moved.current && onLongPress) onLongPress(); }}
      delayLongPress={delayLongPress}
    >
      <View style={{ flex: 1, backgroundColor: BRAND.surface, borderRadius: 20, justifyContent: "center", alignItems: "center", paddingVertical: 20, paddingHorizontal: 16 }}>
        <Text style={{ color: BRAND.text, fontSize: 16, fontWeight: "600", textAlign: "center" }} numberOfLines={2}>{title}</Text>
        {!!subtitle && <Text style={{ color: BRAND.textSecondary, fontSize: 13, marginTop: 4, textAlign: "center" }} numberOfLines={2}>{subtitle}</Text>}
      </View>
    </Pressable>
  );
}
