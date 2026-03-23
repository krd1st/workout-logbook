import * as React from "react";
import { Pressable, View } from "react-native";
import { Text } from "react-native-paper";
import { BRAND } from "../constants/colors";

export const ExerciseCard = React.memo(function ExerciseCard({ exerciseName, exerciseData, lastSession, onPress, onLongPress }) {
  const lastLine = React.useMemo(() => {
    if (!lastSession?.sets?.length) return "No record";
    return lastSession.sets.map((s) => `${s.weight}kg × ${s.reps}`).join("  ·  ");
  }, [lastSession]);

  const maxReps = exerciseData?.max_val ?? 12;
  const set1Maxed = lastSession?.sets?.length > 0 && Number(lastSession.sets[0]?.reps) >= maxReps;
  const allMaxed = set1Maxed && lastSession.sets.length > 1 && lastSession.sets.every((s) => Number(s.reps) >= maxReps);

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={500}>
      <View style={[
        { backgroundColor: BRAND.surface, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20 },
        set1Maxed && { borderLeftWidth: 3, borderLeftColor: BRAND.accent, paddingLeft: 17 },
        allMaxed && { borderRightWidth: 3, borderRightColor: BRAND.accent, paddingRight: 17 },
      ]}>
        <Text style={{ color: BRAND.text, fontSize: 16, fontWeight: "500" }} numberOfLines={1}>{exerciseName}</Text>
        <Text style={{ color: BRAND.textMuted, fontSize: 13, marginTop: 4 }} numberOfLines={1}>{lastLine}</Text>
      </View>
    </Pressable>
  );
});
