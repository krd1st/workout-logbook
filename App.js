import "react-native-gesture-handler";
import * as React from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityIndicator, MD3DarkTheme, PaperProvider } from "react-native-paper";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { getAppColors } from "./src/constants/colors";
import { SPLASH_MIN_DURATION_MS } from "./src/constants/layout";
import { PulsingSplashScreen } from "./src/components/PulsingSplashScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { initDatabase, getRoutines } from "./db/database";

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = useFonts({
    ...MaterialCommunityIcons.font,
  });
  const [showSplash, setShowSplash] = React.useState(true);
  const [dataReady, setDataReady] = React.useState(false);
  const [preloadedRoutines, setPreloadedRoutines] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      await initDatabase();
      const routines = await getRoutines();
      if (!cancelled) {
        setPreloadedRoutines(routines);
        setDataReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const theme = MD3DarkTheme;
  const colors = React.useMemo(() => getAppColors(theme), [theme]);

  const handleSplashFinish = React.useCallback(() => {
    setShowSplash(false);
  }, []);

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0A0A0A",
        }}
      >
        <ActivityIndicator size="large" color="#9ca3af" />
      </View>
    );
  }

  if (showSplash) {
    return (
      <PulsingSplashScreen
        onFinish={handleSplashFinish}
        backgroundColor={colors.background}
        isAppReady={dataReady}
        minDurationMs={SPLASH_MIN_DURATION_MS}
      />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.background }}>
          <HomeScreen dataReady={dataReady} preloadedRoutines={preloadedRoutines} />
        </SafeAreaProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
