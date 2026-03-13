import * as React from "react";
import { Pressable, Vibration, View } from "react-native";
import { APP_COLORS } from "../constants/colors";

export function MilestoneBar({
  min,
  max,
  step,
  value,
  onValueChange,
  style,
  barHeight,
  trackHeight,
  dotSize,
  selectedDotSize,
  dotHitPadding,
  hitSlopSm,
}) {
  const [barWidth, setBarWidth] = React.useState(0);

  const stepValues = React.useMemo(() => {
    const arr = [];
    for (let v = min; v <= max; v += step) arr.push(v);
    return arr;
  }, [min, max, step]);

  const handlePress = React.useCallback(
    (v) => {
      onValueChange(v);
      Vibration.vibrate(10);
    },
    [onValueChange],
  );

  const n = stepValues.length;

  return (
    <View
      style={[{ height: barHeight, justifyContent: "center" }, style]}
      onLayout={(e) => {
        const w = e?.nativeEvent?.layout?.width;
        if (typeof w === "number" && w > 0) setBarWidth(w);
      }}
    >
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: (barHeight - trackHeight) / 2,
          height: trackHeight,
          borderRadius: trackHeight / 2,
          backgroundColor: APP_COLORS.milestoneTrack,
        }}
      />
      {stepValues.map((v, i) => {
        const selected = value === v;
        const size = selected ? selectedDotSize : dotSize;
        const dotLeft =
          barWidth > 0 && n > 1 ? (barWidth - size) * (i / (n - 1)) : 0;
        const pressableLeft = dotLeft - dotHitPadding / 2;
        return (
          <Pressable
            key={v}
            onPress={() => handlePress(v)}
            style={{
              position: "absolute",
              left: pressableLeft,
              top: 0,
              width: size + dotHitPadding,
              height: barHeight,
              alignItems: "center",
              justifyContent: "center",
            }}
            hitSlop={hitSlopSm}
          >
            <View
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: selected
                  ? APP_COLORS.milestoneDotSelected
                  : APP_COLORS.milestoneDot,
              }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
