import * as React from "react";
import { RoutineScreen } from "./RoutineScreen";
import { ExercisePoolScreen } from "./ExercisePoolScreen";

export function HomeScreen({ dataReady = true, preloadedRoutines = null, preloadedExercises = null }) {
  const [section, setSection] = React.useState("routines");
  const [routines, setRoutines] = React.useState(preloadedRoutines ?? []);
  const [exercises, setExercises] = React.useState(preloadedExercises ?? []);

  React.useEffect(() => {
    if (preloadedRoutines) setRoutines(preloadedRoutines);
  }, [preloadedRoutines]);

  React.useEffect(() => {
    if (preloadedExercises) setExercises(preloadedExercises);
  }, [preloadedExercises]);

  if (section === "exercises") {
    return (
      <ExercisePoolScreen
        exercises={exercises}
        onExercisesChange={setExercises}
        section={section}
        onSwitchSection={setSection}
      />
    );
  }

  return (
    <RoutineScreen
      dataReady={dataReady}
      routines={routines}
      onRoutinesChange={setRoutines}
      exercises={exercises}
      section={section}
      onSwitchSection={setSection}
    />
  );
}
