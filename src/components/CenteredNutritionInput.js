import * as React from "react";
import { TextInput as NativeTextInput, View } from "react-native";
import { useTheme } from "react-native-paper";
import { useRelativeUi } from "../hooks/useRelativeUi";

export function CenteredNutritionInput({
  value,
  onChangeText,
  placeholder,
  controlHeight,
  controlRadius,
  controlBorderWidth,
  placeholderColor,
  outlineColor,
  keyboardType = "decimal-pad",
}) {
  const showPlaceholder = !value || String(value).trim() === "";
  const theme = useTheme();
  const ui = useRelativeUi();
  const [focused, setFocused] = React.useState(false);
  const borderColor = focused
    ? theme.colors.primary
    : outlineColor || theme.colors.outline;
  return (
    <View
      style={{
        width: "100%",
        height: controlHeight,
        borderRadius: controlRadius,
        borderWidth: controlBorderWidth,
        borderColor,
        overflow: "hidden",
        justifyContent: "center",
      }}
    >
      <NativeTextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType={keyboardType}
        caretHidden={keyboardType === "decimal-pad"}
        style={{
          width: "100%",
          height: "100%",
          textAlign: "center",
          fontSize: ui.fontSizeBody,
          color: theme.colors.onSurface,
          padding: 0,
          margin: 0,
        }}
        placeholder={showPlaceholder ? placeholder : ""}
        placeholderTextColor={placeholderColor}
      />
    </View>
  );
}
