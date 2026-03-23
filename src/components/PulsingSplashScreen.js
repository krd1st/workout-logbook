import * as React from "react";
import { Animated, Easing, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BRAND } from "../constants/colors";
import { SPLASH_MIN_DURATION_MS } from "../constants/layout";

export function PulsingSplashScreen({ onFinish, isAppReady, minDurationMs }) {
  const scale = React.useRef(new Animated.Value(0.97)).current;
  const opacity = React.useRef(new Animated.Value(1)).current;
  const [minTimeElapsed, setMinTimeElapsed] = React.useState(false);
  const duration = minDurationMs ?? SPLASH_MIN_DURATION_MS;

  React.useEffect(() => { SplashScreen.hideAsync(); }, []);

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.03, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(scale, { toValue: 0.97, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ]),
    ).start();
    return () => scale.stopAnimation();
  }, [scale]);

  React.useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), duration);
    return () => clearTimeout(t);
  }, [duration]);

  React.useEffect(() => {
    if (minTimeElapsed && isAppReady) onFinish();
  }, [minTimeElapsed, isAppReady, onFinish]);

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg, justifyContent: "center", alignItems: "center" }}>
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <MaterialCommunityIcons name="dumbbell" size={72} color={BRAND.accent} />
      </Animated.View>
    </View>
  );
}
