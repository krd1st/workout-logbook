import * as React from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BRAND } from "./src/constants/colors";
import { SPLASH_MIN_DURATION_MS } from "./src/constants/layout";
import { PulsingSplashScreen } from "./src/components/PulsingSplashScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { initDatabase, getRoutines, getExercises } from "./db/database";

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = useFonts({
    ...MaterialCommunityIcons.font,
  });
  const [showSplash, setShowSplash] = React.useState(true);
  const [dataReady, setDataReady] = React.useState(false);
  const [preloadedRoutines, setPreloadedRoutines] = React.useState(null);
  const [preloadedExercises, setPreloadedExercises] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      await initDatabase();
      const [routines, exercises] = await Promise.all([getRoutines(), getExercises()]);
      if (!cancelled) {
        setPreloadedRoutines(routines);
        setPreloadedExercises(exercises);
        setDataReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSplashFinish = React.useCallback(() => setShowSplash(false), []);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: BRAND.bg }} />;

  if (showSplash) {
    return (
      <PulsingSplashScreen onFinish={handleSplashFinish} isAppReady={dataReady} minDurationMs={SPLASH_MIN_DURATION_MS} />
    );
  }

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <HomeScreen
        dataReady={dataReady}
        preloadedRoutines={preloadedRoutines}
        preloadedExercises={preloadedExercises}
      />
    </SafeAreaProvider>
  );
}
