import * as React from "react";
import { Animated, Easing, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { SPLASH_MIN_DURATION_MS } from "../constants/layout";
import { useRelativeUi } from "../hooks/useRelativeUi";

export function PulsingSplashScreen({
  onFinish,
  backgroundColor,
  isAppReady,
  minDurationMs,
}) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const [minTimeElapsed, setMinTimeElapsed] = React.useState(false);
  const duration = minDurationMs ?? SPLASH_MIN_DURATION_MS;
  const ui = useRelativeUi();

  React.useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  React.useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.06,
          duration: 700,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [scale]);

  React.useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), duration);
    return () => clearTimeout(t);
  }, [duration]);

  React.useEffect(() => {
    if (minTimeElapsed && isAppReady) onFinish();
  }, [minTimeElapsed, isAppReady, onFinish]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <MaterialCommunityIcons name="dumbbell" size={ui.iconSplash} color="#9ca3af" />
      </Animated.View>
    </View>
  );
}
