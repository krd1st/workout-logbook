import * as React from "react";
import { Pressable } from "react-native";
import { Surface, Text } from "react-native-paper";
import { useRelativeUi } from "../hooks/useRelativeUi";

export function DayButton({ dayIndex, title, subtitle, onPress, onLongPress, delayLongPress = 200 }) {
  const ui = useRelativeUi();

  return (
    <Pressable
      style={{ flex: 1 }}
      onPress={onPress}
      onLongPress={onLongPress}
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
