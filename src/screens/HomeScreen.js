import * as React from "react";
import { BackHandler, Pressable, View } from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BRAND } from "../constants/colors";
import { RoutineScreen } from "./RoutineScreen";
import { NutritionSection } from "./NutritionSection";

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
        {/* Hero card — Workout */}
        <Pressable style={{ flex: 1 }} onPress={() => setActiveSection("workout")}>
          <View style={{ flex: 1, backgroundColor: BRAND.surface, borderRadius: 24, justifyContent: "flex-end", padding: 28 }}>
            <Text style={{ color: BRAND.accent, fontSize: 13, fontWeight: "600", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
              Workout
            </Text>
            <Text style={{ color: BRAND.text, fontSize: 28, fontWeight: "700", lineHeight: 34 }}>
              Progressive{"\n"}Overload Tracker
            </Text>
          </View>
        </Pressable>

        {/* Hero card — Nutrition */}
        <Pressable style={{ flex: 1 }} onPress={() => setActiveSection("nutrition")}>
          <View style={{ flex: 1, backgroundColor: BRAND.surface, borderRadius: 24, justifyContent: "flex-end", padding: 28 }}>
            <Text style={{ color: BRAND.accent, fontSize: 13, fontWeight: "600", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
              Nutrition
            </Text>
            <Text style={{ color: BRAND.text, fontSize: 28, fontWeight: "700", lineHeight: 34 }}>
              Calorie{"\n"}Intake Tracker
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
