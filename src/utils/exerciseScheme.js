export function getSchemeForExercise(exerciseName) {
  const name = String(exerciseName || "")
    .trim()
    .toLowerCase();
  if (
    name === "barbell bench press (flat)" ||
    name === "flat barbell bench press"
  )
    return { min: 3, max: 6, step: 1, unitShort: "reps" };
  if (name === "elbow plank" || name === "weighted elbow plank")
    return { min: 30, max: 120, step: 15, unitShort: "sec" };
  return { min: 8, max: 12, step: 1, unitShort: "reps" };
}
