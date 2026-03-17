import * as React from "react";
import { Pressable, View } from "react-native";
import {
  List,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { getAppColors } from "../constants/colors";
import { useRelativeUi } from "../hooks/useRelativeUi";
import { getLastExerciseSets } from "../../db/database";

export function ExerciseCard({
  workoutId,
  exerciseName,
  exerciseData,
  refreshToken,
  onPress,
  onLongPress,
}) {
  const theme = useTheme();
  const colors = React.useMemo(() => getAppColors(theme), [theme]);
  const ui = useRelativeUi();
  const [lastSession, setLastSession] = React.useState(null);

  React.useEffect(() => {
    if (workoutId == null) return;
    let cancelled = false;
    (async () => {
      const session = await getLastExerciseSets({ exerciseName });
      if (!cancelled) setLastSession(session);
    })();
    return () => { cancelled = true; };
  }, [workoutId, exerciseName, refreshToken]);

  const lastLine = React.useMemo(() => {
    if (!lastSession?.sets?.length) return "No record";
    return lastSession.sets
      .map((s) => `${s.weight}kg × ${s.reps}`)
      .join("  |  ");
  }, [lastSession]);

  const maxReps = exerciseData?.max_val ?? 12;
  const readyToUpgrade = lastSession?.sets?.length > 0 &&
    lastSession.sets.every((s) => Number(s.reps) >= maxReps);

  return (
    <Surface
      elevation={1}
      style={[
        { borderRadius: ui.cardBorderRadius, overflow: "hidden", flex: 1, minHeight: 0 },
        readyToUpgrade && { backgroundColor: colors.readyHighlight },
      ]}
    >
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={500}
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: ui.cardPaddingV,
          paddingHorizontal: ui.cardPaddingH,
        }}
      >
        <List.Icon icon="dumbbell" style={{ marginRight: ui.cardPaddingH }} />
        <View
          style={{ flex: 1, minWidth: 0, justifyContent: "center" }}
          pointerEvents="none"
        >
          <Text style={{ fontSize: ui.fontSizeBody }} numberOfLines={1}>
            {exerciseName}
          </Text>
          <Text variant="bodySmall" style={{ opacity: 0.7 }} numberOfLines={1}>
            {lastLine}
          </Text>
        </View>
      </Pressable>
    </Surface>
  );
}
