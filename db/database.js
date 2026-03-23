import { openDatabaseAsync } from 'expo-sqlite';

const DB_NAME = 'gym_log_book.db';

let dbPromise = null;
async function getDb() {
  if (!dbPromise) dbPromise = openDatabaseAsync(DB_NAME);
  return dbPromise;
}

async function ensureColumnExists({ tableName, columnName, columnDDL }) {
  const db = await getDb();
  const cols = await db.getAllAsync(`PRAGMA table_info(${tableName});`, []);
  const has = cols.some((c) => String(c.name).toLowerCase() === String(columnName).toLowerCase());
  if (!has) {
    await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnDDL};`);
  }
}

export async function initDatabase() {
  const db = await getDb();

  // Multi-statement init. (Foreign keys are disabled by default in SQLite.)
  await db.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      split_index INTEGER NOT NULL,
      planned_name TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL,
      exercise_name TEXT NOT NULL,
      date TEXT NOT NULL,
      weight REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT 'kg',
      reps INTEGER NOT NULL,
      set_type TEXT NOT NULL CHECK (set_type IN ('TOP_SET','BACK_OFF')),
      FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_logs_exercise_date ON logs(exercise_name, date);
    CREATE INDEX IF NOT EXISTS idx_logs_workout ON logs(workout_id);

    CREATE TABLE IF NOT EXISTS nutrition_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      calories REAL NOT NULL DEFAULT 0,
      protein REAL NOT NULL DEFAULT 0,
      carbs REAL NOT NULL DEFAULT 0,
      fat REAL NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_nutrition_logs_date ON nutrition_logs(date);

    CREATE TABLE IF NOT EXISTS nutrition_quota (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      calories REAL NOT NULL DEFAULT 2500,
      protein REAL NOT NULL DEFAULT 150,
      carbs REAL NOT NULL DEFAULT 300,
      fat REAL NOT NULL DEFAULT 80
    );
    INSERT OR IGNORE INTO nutrition_quota (id, calories, protein, carbs, fat) VALUES (1, 2500, 150, 300, 80);

    CREATE TABLE IF NOT EXISTS saved_foods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      calories REAL NOT NULL DEFAULT 0,
      protein REAL NOT NULL DEFAULT 0,
      carbs REAL NOT NULL DEFAULT 0,
      fat REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS exercises (
      name TEXT PRIMARY KEY,
      unit_type TEXT NOT NULL DEFAULT 'reps' CHECK (unit_type IN ('reps','sec')),
      min_val INTEGER NOT NULL DEFAULT 8,
      max_val INTEGER NOT NULL DEFAULT 12,
      step INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS routines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS routine_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_id INTEGER NOT NULL,
      exercise_name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_name) REFERENCES exercises(name) ON UPDATE CASCADE ON DELETE CASCADE
    );
  `);

  // Migration for older installs (before `unit` existed).
  await ensureColumnExists({ tableName: 'logs', columnName: 'unit', columnDDL: "unit TEXT NOT NULL DEFAULT 'kg'" });
  await ensureColumnExists({ tableName: 'nutrition_logs', columnName: 'food_name', columnDDL: "food_name TEXT DEFAULT ''" });
  await ensureColumnExists({ tableName: 'workouts', columnName: 'routine_id', columnDDL: "routine_id INTEGER" });

  // Migration: add set_number to logs and num_sets to exercises for double progression.
  await ensureColumnExists({ tableName: 'logs', columnName: 'set_number', columnDDL: "set_number INTEGER NOT NULL DEFAULT 1" });
  await ensureColumnExists({ tableName: 'exercises', columnName: 'num_sets', columnDDL: "num_sets INTEGER NOT NULL DEFAULT 2" });
  await ensureColumnExists({ tableName: 'exercises', columnName: 'weight_min', columnDDL: "weight_min REAL NOT NULL DEFAULT 0" });
  await ensureColumnExists({ tableName: 'exercises', columnName: 'weight_max', columnDDL: "weight_max REAL NOT NULL DEFAULT 100" });
  await ensureColumnExists({ tableName: 'exercises', columnName: 'weight_step', columnDDL: "weight_step REAL NOT NULL DEFAULT 2.5" });

  // Backfill set_number from set_type for existing rows.
  await db.runAsync(`UPDATE logs SET set_number = 2 WHERE set_type = 'BACK_OFF' AND set_number != 2;`);

  // Migration: serving_grams for saved foods
  await ensureColumnExists({ tableName: 'saved_foods', columnName: 'serving_grams', columnDDL: "serving_grams REAL NOT NULL DEFAULT 100" });
}

export async function startWorkout({ splitIndex, plannedName, startedAtISO, routineId }) {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO workouts (split_index, planned_name, started_at, routine_id) VALUES (?, ?, ?, ?);`,
    [splitIndex ?? 0, plannedName, startedAtISO, routineId ?? null],
  );
  return res.lastInsertRowId;
}

// --- Routines CRUD ---
export async function getRoutines() {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT r.*, COUNT(re.id) as exercise_count
     FROM routines r LEFT JOIN routine_exercises re ON re.routine_id = r.id
     GROUP BY r.id ORDER BY r.sort_order ASC, r.id ASC;`, []);
}

export async function createRoutine({ name }) {
  const db = await getDb();
  // Push all existing routines down by 1 so the new one appears at the top.
  await db.runAsync(`UPDATE routines SET sort_order = sort_order + 1;`, []);
  const res = await db.runAsync(
    `INSERT INTO routines (name, sort_order) VALUES (?, 0);`,
    [name.trim()],
  );
  return res.lastInsertRowId;
}

export async function updateRoutine({ id, name }) {
  const db = await getDb();
  await db.runAsync(`UPDATE routines SET name = ? WHERE id = ?;`, [name.trim(), id]);
}

export async function deleteRoutine(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM routines WHERE id = ?;`, [id]);
}

// --- Exercises CRUD ---
export async function createExercise({ name, unitType = 'reps', min = 6, max = 12, step = 1, numSets = 2, weightMin = 0, weightMax = 100, weightStep = 2.5 }) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO exercises (name, unit_type, min_val, max_val, step, num_sets, weight_min, weight_max, weight_step) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [name.trim(), unitType, min, max, step, numSets, weightMin, weightMax, weightStep],
  );
}

export async function updateExercise({ oldName, name, unitType, min, max, step, numSets = 2, weightMin = 0, weightMax = 100, weightStep = 2.5 }) {
  const db = await getDb();
  const newName = name.trim();
  await db.runAsync(
    `UPDATE exercises SET name = ?, unit_type = ?, min_val = ?, max_val = ?, step = ?, num_sets = ?, weight_min = ?, weight_max = ?, weight_step = ? WHERE name = ?;`,
    [newName, unitType, min, max, step, numSets, weightMin, weightMax, weightStep, oldName],
  );
  // Cascade rename in logs if name changed.
  if (newName !== oldName) {
    await db.runAsync(`UPDATE logs SET exercise_name = ? WHERE exercise_name = ?;`, [newName, oldName]);
    await db.runAsync(`UPDATE routine_exercises SET exercise_name = ? WHERE exercise_name = ?;`, [newName, oldName]);
  }
}


// --- Routine ↔ Exercise junction ---
export async function getRoutineExercises(routineId) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT re.id, re.routine_id, re.exercise_name, re.sort_order,
            e.unit_type, e.min_val, e.max_val, e.step, e.num_sets,
            e.weight_min, e.weight_max, e.weight_step
     FROM routine_exercises re
     JOIN exercises e ON e.name = re.exercise_name
     WHERE re.routine_id = ?
     ORDER BY re.sort_order ASC, re.id ASC;`,
    [routineId],
  );
}

export async function addExerciseToRoutine({ routineId, exerciseName, sortOrder }) {
  const db = await getDb();
  let order = sortOrder;
  if (order == null) {
    const maxRow = await db.getFirstAsync(
      `SELECT COALESCE(MAX(sort_order), -1) as m FROM routine_exercises WHERE routine_id = ?;`,
      [routineId],
    );
    order = (maxRow?.m ?? -1) + 1;
  }
  const res = await db.runAsync(
    `INSERT INTO routine_exercises (routine_id, exercise_name, sort_order) VALUES (?, ?, ?);`,
    [routineId, exerciseName, order],
  );
  return res.lastInsertRowId;
}

export async function removeExerciseFromRoutine(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM routine_exercises WHERE id = ?;`, [id]);
}

// Reorder routines: orderedIds is the full list of routine IDs in new order.
export async function reorderRoutines(orderedIds) {
  const db = await getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.runAsync(`UPDATE routines SET sort_order = ? WHERE id = ?;`, [i, orderedIds[i]]);
  }
}

// Reorder exercises within a routine: orderedIds is the full list of routine_exercises IDs in new order.
export async function reorderRoutineExercises(orderedIds) {
  const db = await getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.runAsync(`UPDATE routine_exercises SET sort_order = ? WHERE id = ?;`, [i, orderedIds[i]]);
  }
}

export async function addLog({
  workoutId,
  exerciseName,
  dateISO,
  weight,
  unit, // 'kg' | 'lbs'
  reps,
  setType, // legacy — ignored if setNumber provided
  setNumber,
}) {
  const db = await getDb();
  const sn = setNumber ?? (setType === 'BACK_OFF' ? 2 : 1);
  await db.runAsync(
    `INSERT INTO logs (workout_id, exercise_name, date, weight, unit, reps, set_type, set_number)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [workoutId, exerciseName, dateISO, weight, unit || 'kg', reps, setType || 'TOP_SET', sn],
  );
}

// Returns individual sets ordered by date desc, then set_number asc.
async function getExerciseEntries({ exerciseName, limit = 200 }) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT id, date, weight, unit, reps, set_number
      FROM logs
      WHERE exercise_name = ?
      ORDER BY date DESC, set_number ASC
      LIMIT ?;`,
    [exerciseName, limit],
  );
}

// Returns sets grouped by date for history display.
export async function getExerciseEntriesGrouped({ exerciseName, limit = 100 }) {
  const raw = await getExerciseEntries({ exerciseName, limit });
  const grouped = [];
  let current = null;
  for (const row of raw) {
    if (!current || current.date !== row.date) {
      current = { date: row.date, sets: [] };
      grouped.push(current);
    }
    current.sets.push({ weight: row.weight, reps: row.reps, setNumber: row.set_number });
  }
  return grouped;
}

// Returns the most recent session's sets as an array.
export async function getLastExerciseSets({ exerciseName }) {
  const grouped = await getExerciseEntriesGrouped({ exerciseName, limit: 50 });
  return grouped.length ? grouped[0] : null;
}

export async function deleteExerciseSession({ exerciseName, dateISO }) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM logs WHERE exercise_name = ? AND date = ?;`, [exerciseName, dateISO]);
}

// --- Nutrition (standalone calorie/macros log) ---
export async function addNutritionLog({ date, calories = 0, protein = 0, carbs = 0, fat = 0, foodName = "" }) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO nutrition_logs (date, calories, protein, carbs, fat, food_name) VALUES (?, ?, ?, ?, ?, ?);`,
    [date, Number(calories) || 0, Number(protein) || 0, Number(carbs) || 0, Number(fat) || 0, String(foodName || "").trim()],
  );
}

export async function getNutritionLogsForDate(date) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT id, date, calories, protein, carbs, fat, food_name FROM nutrition_logs WHERE date = ? ORDER BY id DESC;`,
    [date],
  );
  return (rows || []).map((r) => ({
    id: r.id,
    date: r.date,
    calories: r.calories ?? 0,
    protein: r.protein ?? 0,
    carbs: r.carbs ?? 0,
    fat: r.fat ?? 0,
    foodName: r.food_name ?? "",
  }));
}

export async function deleteNutritionLog(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM nutrition_logs WHERE id = ?;`, [id]);
}

export async function updateNutritionLogFoodName(id, foodName) {
  const db = await getDb();
  await db.runAsync(`UPDATE nutrition_logs SET food_name = ? WHERE id = ?;`, [String(foodName ?? "").trim(), id]);
}

export async function getNutritionTotalsForDate(date) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT
       COALESCE(SUM(calories), 0) as calories,
       COALESCE(SUM(protein), 0) as protein,
       COALESCE(SUM(carbs), 0) as carbs,
       COALESCE(SUM(fat), 0) as fat
     FROM nutrition_logs WHERE date = ?;`,
    [date],
  );
  return row
    ? {
        calories: row.calories ?? 0,
        protein: row.protein ?? 0,
        carbs: row.carbs ?? 0,
        fat: row.fat ?? 0,
      }
    : { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

export async function getNutritionQuota() {
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT calories, protein, carbs, fat FROM nutrition_quota WHERE id = 1;`, []);
  return row
    ? {
        calories: row.calories ?? 2500,
        protein: row.protein ?? 150,
        carbs: row.carbs ?? 300,
        fat: row.fat ?? 80,
      }
    : { calories: 2500, protein: 150, carbs: 300, fat: 80 };
}

export async function setNutritionQuota({ calories, protein, carbs, fat }) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO nutrition_quota (id, calories, protein, carbs, fat) VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET calories = ?, protein = ?, carbs = ?, fat = ?;`,
    [
      Number(calories) ?? 2500,
      Number(protein) ?? 150,
      Number(carbs) ?? 300,
      Number(fat) ?? 80,
      Number(calories) ?? 2500,
      Number(protein) ?? 150,
      Number(carbs) ?? 300,
      Number(fat) ?? 80,
    ],
  );
}

// --- Saved Foods ---
export async function addSavedFood({ name, calories = 0, protein = 0, carbs = 0, fat = 0, servingGrams = 100 }) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO saved_foods (name, calories, protein, carbs, fat, serving_grams) VALUES (?, ?, ?, ?, ?, ?);`,
    [String(name).trim(), Number(calories) || 0, Number(protein) || 0, Number(carbs) || 0, Number(fat) || 0, Number(servingGrams) || 100],
  );
}

export async function getSavedFoods() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT id, name, calories, protein, carbs, fat, serving_grams FROM saved_foods ORDER BY id DESC;`,
    [],
  );
  return (rows || []).map((r) => ({
    id: r.id,
    name: r.name ?? "",
    calories: r.calories ?? 0,
    protein: r.protein ?? 0,
    carbs: r.carbs ?? 0,
    fat: r.fat ?? 0,
    servingGrams: r.serving_grams ?? 100,
  }));
}

export async function deleteSavedFood(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM saved_foods WHERE id = ?;`, [id]);
}

