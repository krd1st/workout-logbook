import * as React from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";
import { MilestoneBar } from "./MilestoneBar";

export function SetRow({
  label,
  scheme,
  value,
  onValueChange,
  relativeUi,
  style,
}) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center" }, style]}>
      <View style={{ flex: 15, justifyContent: "center" }}>
        <Text variant="labelMedium" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={{ flex: 70, minWidth: 0 }}>
        <MilestoneBar
          min={scheme.min}
          max={scheme.max}
          step={scheme.step}
          value={value}
          onValueChange={onValueChange}
          barHeight={relativeUi.milestoneBarHeight}
          trackHeight={relativeUi.milestoneTrackHeight}
          dotSize={relativeUi.milestoneDotSize}
          selectedDotSize={relativeUi.milestoneSelectedDotSize}
          dotHitPadding={relativeUi.milestoneDotHitPadding}
          hitSlopSm={relativeUi.hitSlopSm}
        />
      </View>
      <View
        style={{
          flex: 15,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            justifyContent: "flex-end",
            minWidth: 0,
          }}
        >
          <Text variant="labelMedium" numberOfLines={1}>
            {Math.round(value)}
          </Text>
        </View>
        <Text variant="labelMedium" numberOfLines={1}>
          {" "}
          {scheme.unitShort === "sec" ? "sec" : "Reps"}
        </Text>
      </View>
    </View>
  );
}
