import * as React from "react";
import { Pressable } from "react-native";
import { Surface, Text } from "react-native-paper";
import { useRelativeUi } from "../hooks/useRelativeUi";

const MOVE_THRESHOLD = 10;

export function DayButton({ dayIndex, title, subtitle, onPress, onLongPress, delayLongPress = 500 }) {
  const ui = useRelativeUi();
  const startPos = React.useRef(null);
  const moved = React.useRef(false);

  return (
    <Pressable
      style={{ flex: 1 }}
      onPressIn={(e) => {
        startPos.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
        moved.current = false;
      }}
      onTouchMove={(e) => {
        if (moved.current || !startPos.current) return;
        const dx = Math.abs(e.nativeEvent.pageX - startPos.current.x);
        const dy = Math.abs(e.nativeEvent.pageY - startPos.current.y);
        if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
          moved.current = true;
        }
      }}
      onPress={() => {
        if (!moved.current && onPress) onPress();
      }}
      onLongPress={() => {
        if (!moved.current && onLongPress) onLongPress();
      }}
      delayLongPress={delayLongPress}
    >
      <Surface
        elevation={1}
        style={{
          flex: 1,
          borderRadius: ui.cardBorderRadius,
          justifyContent: "center",
          alignItems: "center",
          padding: ui.dayButtonPadding,
        }}
      >
        <Text
          variant="titleMedium"
          style={{ textAlign: "center" }}
          numberOfLines={2}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text
            variant="labelSmall"
            style={{ opacity: 0.75, marginTop: ui.dayButtonSubtitleMarginTop, textAlign: "center" }}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        )}
      </Surface>
    </Pressable>
  );
}
