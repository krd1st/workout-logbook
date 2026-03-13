import * as React from "react";
import { BackHandler, View } from "react-native";
import { useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAppColors } from "../constants/colors";
import { useRelativeUi } from "../hooks/useRelativeUi";
import { DayButton } from "../components/DayButton";
import { RoutineScreen } from "./RoutineScreen";
import { NutritionSection } from "./NutritionSection";

export function HomeScreen({ dataReady = true }) {
  const [activeSection, setActiveSection] = React.useState(null);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const colors = React.useMemo(() => getAppColors(theme), [theme]);
  const ui = useRelativeUi();

  React.useEffect(() => {
    if (activeSection === null) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setActiveSection(null);
      return true;
    });
    return () => sub.remove();
  }, [activeSection]);

  if (activeSection === "workout") {
    return <RoutineScreen dataReady={dataReady} onBack={() => setActiveSection(null)} />;
  }

  if (activeSection === "nutrition") {
    return <NutritionSection onBack={() => setActiveSection(null)} />;
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top + ui.topPadding,
        paddingBottom: insets.bottom + ui.gridPadding,
        paddingLeft: insets.left + ui.gridPadding,
        paddingRight: insets.right + ui.gridPadding,
        gap: ui.gridPadding,
      }}
    >
      <View style={{ flex: 1 }}>
        <DayButton
          title="PROGRESSIVE OVERLOAD TRACKER"
          onPress={() => setActiveSection("workout")}
        />
      </View>
      <View style={{ flex: 1 }}>
        <DayButton
          title="CALORIE INTAKE TRACKER"
          onPress={() => setActiveSection("nutrition")}
        />
      </View>
    </View>
  );
}
