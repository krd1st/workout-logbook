import * as React from "react";
import { BackHandler, Pressable, View } from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BRAND } from "../constants/colors";
import { RoutineScreen } from "./RoutineScreen";
import { NutritionSection } from "./NutritionSection";

const MOVE_THRESHOLD = 10;

function HeroCard({ accent, title, icon, onPress }) {
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
    >
      <View style={{ flex: 1, backgroundColor: BRAND.surface, borderRadius: 24, padding: 28 }}>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <MaterialCommunityIcons name={icon} size={48} color={BRAND.accent} style={{ opacity: 1 }} />
        </View>
        <View>
          <Text style={{ color: BRAND.accent, fontSize: 13, fontWeight: "600", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{accent}</Text>
          <Text style={{ color: BRAND.text, fontSize: 28, fontWeight: "700", lineHeight: 34 }}>{title}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function HomeScreen({ dataReady = true, preloadedRoutines = null }) {
  const [activeSection, setActiveSection] = React.useState(null);
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (!activeSection) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { setActiveSection(null); return true; });
    return () => sub.remove();
  }, [activeSection]);

  if (activeSection === "workout")
    return <RoutineScreen dataReady={dataReady} preloadedRoutines={preloadedRoutines} onBack={() => setActiveSection(null)} />;
  if (activeSection === "nutrition")
    return <NutritionSection onBack={() => setActiveSection(null)} />;

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{ flex: 1, padding: 20, gap: 16 }}>
        <HeroCard accent="Workout" title={"Progressive\nOverload Tracker"} icon="weight-lifter" onPress={() => setActiveSection("workout")} />
        <HeroCard accent="Nutrition" title={"Calorie\nIntake Tracker"} icon="silverware-variant" onPress={() => setActiveSection("nutrition")} />
      </View>
    </View>
  );
}
