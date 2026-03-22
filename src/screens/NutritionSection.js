import * as React from "react";
import {
  AppState,
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import {
  Button,
  IconButton,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_COLORS, BRAND, getAppColors } from "../constants/colors";
import { useRelativeUi } from "../hooks/useRelativeUi";
import { CenteredNutritionInput } from "../components/CenteredNutritionInput";
import {
  addNutritionLog,
  addSavedFood,
  deleteNutritionLog,
  deleteSavedFood,
  getNutritionLogsForDate,
  getNutritionQuota,
  getNutritionTotalsForDate,
  getSavedFoods,
  setNutritionQuota,
  updateNutritionLogFoodName,
} from "../../db/database";

const CAL_PER_P = 4;
const CAL_PER_C = 4;
const CAL_PER_F = 9;
const CAL_TOLERANCE_PCT = 0.05;
const CAL_TOLERANCE_ABS = 50;

function parseNum(s) {
  const t = String(s ?? "")
    .trim()
    .replace(",", ".");
  if (t === "" || isNaN(Number(t))) return null;
  return Number(t);
}

export function NutritionSection({ onBack }) {
  const theme = useTheme();
  const colors = React.useMemo(() => getAppColors(theme), [theme]);
  const insets = useSafeAreaInsets();
  const ui = useRelativeUi();

  const blockMinHeight = React.useMemo(() => {
    const headerEstimate = ui.topPadding + ui.headerPadding * 2 + ui.gridPadding * 2 + 40;
    const contentHeight = Math.max(0, ui.viewportHeight - headerEstimate);
    const oneRowHeight = (contentHeight - 2 * ui.gridPadding) / 3;
    return Math.round(oneRowHeight * 0.5);
  }, [ui]);

  const [today, setToday] = React.useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [totals, setTotals] = React.useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
  const [quota, setQuota] = React.useState({
    calories: 2500,
    protein: 150,
    carbs: 300,
    fat: 80,
  });
  const [calories, setCalories] = React.useState("");
  const [protein, setProtein] = React.useState("");
  const [carbs, setCarbs] = React.useState("");
  const [fat, setFat] = React.useState("");
  const [isEditingQuota, setIsEditingQuota] = React.useState(false);
  const [namingEntryId, setNamingEntryId] = React.useState(null);
  const [foodName, setFoodName] = React.useState("");
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);

  React.useEffect(() => {
    const show = (e) => setKeyboardHeight(e.endCoordinates.height);
    const hide = () => setKeyboardHeight(0);
    const subShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      show,
    );
    const subHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      hide,
    );
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const loadTotals = React.useCallback(async () => {
    const t = await getNutritionTotalsForDate(today);
    setTotals(t);
  }, [today]);

  const loadQuota = React.useCallback(async () => {
    const q = await getNutritionQuota();
    setQuota(q);
  }, []);

  const [logEntries, setLogEntries] = React.useState([]);
  const loadLogEntries = React.useCallback(async () => {
    const list = await getNutritionLogsForDate(today);
    setLogEntries(list);
  }, [today]);

  const [savedFoodsList, setSavedFoodsList] = React.useState([]);
  const loadSavedFoods = React.useCallback(async () => {
    const list = await getSavedFoods();
    setSavedFoodsList(list);
  }, []);

  React.useEffect(() => {
    loadTotals();
  }, [loadTotals]);

  React.useEffect(() => {
    loadQuota();
  }, [loadQuota]);

  React.useEffect(() => {
    loadLogEntries();
  }, [loadLogEntries]);

  React.useEffect(() => {
    loadSavedFoods();
  }, [loadSavedFoods]);

  React.useEffect(() => {
    const checkNewDay = () => {
      const now = new Date().toISOString().slice(0, 10);
      if (now !== today) {
        setToday(now);
      }
    };
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") checkNewDay();
    });
    checkNewDay();
    const interval = setInterval(checkNewDay, 60 * 1000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [today]);

  const cVal = parseNum(calories);
  const pVal = parseNum(protein);
  const cbVal = parseNum(carbs);
  const fVal = parseNum(fat);

  const filled = [cVal !== null, pVal !== null, cbVal !== null, fVal !== null];
  const filledCount = filled.filter(Boolean).length;

  const resolved = React.useMemo(() => {
    if (filledCount === 4) {
      const macroCal = pVal * CAL_PER_P + cbVal * CAL_PER_C + fVal * CAL_PER_F;
      return {
        calories: Math.round(macroCal),
        protein: pVal,
        carbs: cbVal,
        fat: fVal,
        _macroCal: macroCal,
      };
    }
    if (filledCount === 3) {
      if (cVal === null) {
        const calc = pVal * CAL_PER_P + cbVal * CAL_PER_C + fVal * CAL_PER_F;
        return {
          calories: Math.ceil(calc),
          protein: pVal,
          carbs: cbVal,
          fat: fVal,
        };
      }
      if (pVal === null) {
        const remainder = cVal - cbVal * CAL_PER_C - fVal * CAL_PER_F;
        return {
          calories: cVal,
          protein: Math.ceil(remainder / CAL_PER_P),
          carbs: cbVal,
          fat: fVal,
        };
      }
      if (cbVal === null) {
        const remainder = cVal - pVal * CAL_PER_P - fVal * CAL_PER_F;
        return {
          calories: cVal,
          protein: pVal,
          carbs: Math.ceil(remainder / CAL_PER_C),
          fat: fVal,
        };
      }
      if (fVal === null) {
        const remainder = cVal - pVal * CAL_PER_P - cbVal * CAL_PER_C;
        return {
          calories: cVal,
          protein: pVal,
          carbs: cbVal,
          fat: Math.ceil(remainder / CAL_PER_F),
        };
      }
    }
    return null;
  }, [cVal, pVal, cbVal, fVal, filledCount]);

  const isValid = React.useMemo(() => {
    if (!resolved) return false;
    const {
      calories: rc,
      protein: rp,
      carbs: rcb,
      fat: rf,
      _macroCal,
    } = resolved;
    if (rc < 0 || rp < 0 || rcb < 0 || rf < 0) return false;
    if (filledCount === 4 && _macroCal != null) {
      const tolerance = Math.max(
        CAL_TOLERANCE_ABS,
        _macroCal * CAL_TOLERANCE_PCT,
      );
      if (Math.abs(cVal - _macroCal) > tolerance) return false;
    }
    return true;
  }, [resolved, filledCount, cVal]);

  const canSave = filledCount >= 3;
  const showError = canSave && !isValid;

  const openQuotaEdit = React.useCallback(() => {
    setNamingEntryId(null);
    setFoodName("");
    setCalories(String(Math.round(quota.calories)));
    setProtein(String(Math.round(quota.protein)));
    setCarbs(String(Math.round(quota.carbs)));
    setFat(String(Math.round(quota.fat)));
    setIsEditingQuota(true);
  }, [quota.calories, quota.protein, quota.carbs, quota.fat]);

  const exitQuotaEdit = React.useCallback(() => {
    setIsEditingQuota(false);
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
  }, []);

  React.useEffect(() => {
    const handleBack = () => {
      if (namingEntryId != null) {
        setNamingEntryId(null);
        setFoodName("");
        return true;
      }
      if (isEditingQuota) {
        exitQuotaEdit();
        return true;
      }
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", handleBack);
    return () => sub.remove();
  }, [isEditingQuota, namingEntryId, exitQuotaEdit, onBack]);

  const handleLog = React.useCallback(async () => {
    if (!resolved || !isValid) return;
    Keyboard.dismiss();
    const { _macroCal, ...toSave } = resolved;
    await addNutritionLog({
      date: today,
      calories: toSave.calories,
      protein: toSave.protein,
      carbs: toSave.carbs,
      fat: toSave.fat,
    });
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    loadTotals();
    loadLogEntries();
  }, [today, resolved, isValid, loadTotals, loadLogEntries]);

  const handleSaveQuota = React.useCallback(async () => {
    if (!resolved || !isValid) return;
    Keyboard.dismiss();
    const { _macroCal, ...toSave } = resolved;
    await setNutritionQuota(toSave);
    loadQuota();
    exitQuotaEdit();
  }, [resolved, isValid, loadQuota, exitQuotaEdit]);

  const handleSaveFoodName = React.useCallback(async () => {
    if (namingEntryId == null) return;
    Keyboard.dismiss();
    await updateNutritionLogFoodName(namingEntryId, foodName);
    const entry = logEntries.find((e) => e.id === namingEntryId);
    if (entry && foodName.trim()) {
      await addSavedFood({
        name: foodName.trim(),
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
      });
      loadSavedFoods();
    }
    setNamingEntryId(null);
    setFoodName("");
    loadLogEntries();
  }, [namingEntryId, foodName, logEntries, loadLogEntries, loadSavedFoods]);

  const contentPadding = {
    paddingLeft: insets.left + ui.gridPadding,
    paddingRight: insets.right + ui.gridPadding,
    paddingBottom: insets.bottom + ui.gridPadding,
    paddingTop: ui.gridPadding / 2,
  };
  const placeholderColor = theme.dark
    ? "rgba(255,255,255,0.4)"
    : "rgba(0,0,0,0.4)";

  const rowLayout = {
    flexDirection: "row",
    alignItems: "center",
    gap: ui.rowGap,
  };
  const colFlex = (n) => ({ flex: n, minWidth: 0 });

  const S = 20;

  const translateY =
    namingEntryId != null && keyboardHeight > 0 ? -keyboardHeight * 0.15 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + S, paddingBottom: S * 0.75, paddingHorizontal: S }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ color: BRAND.text, fontSize: 18, fontWeight: "600", flex: 1 }}>Calorie Intake</Text>
          <IconButton icon="calendar-month-outline" size={20} iconColor={BRAND.textSecondary} style={{ margin: 0 }} />
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: BRAND.border }} />
      <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
        <View
          style={[
            { flex: 1, flexDirection: "column", transform: [{ translateY }] },
            contentPadding,
          ]}
        >
          <Surface
            elevation={1}
            style={{
              borderRadius: ui.cardBorderRadius,
              paddingHorizontal: ui.nutritionBlockPaddingH,
              paddingTop: ui.nutritionBlockPaddingTop,
              paddingBottom: ui.nutritionBlockPaddingBottom,
              height: blockMinHeight,
              minHeight: blockMinHeight,
              alignSelf: "stretch",
              justifyContent: "center",
            }}
          >
            <View style={{ alignSelf: "stretch" }}>
              <View style={rowLayout}>
                {[
                  {
                    key: "cal",
                    current: totals.calories,
                    target: quota.calories,
                    flex: 26,
                  },
                  {
                    key: "p",
                    current: totals.protein,
                    target: quota.protein,
                    flex: 16,
                  },
                  {
                    key: "c",
                    current: totals.carbs,
                    target: quota.carbs,
                    flex: 16,
                  },
                  { key: "f", current: totals.fat, target: quota.fat, flex: 16 },
                ].map(({ key, current, target, flex: f }) => (
                  <View
                    key={key}
                    style={[
                      colFlex(f),
                      { alignItems: "center", justifyContent: "center" },
                    ]}
                  >
                    <Text variant="titleMedium">{Math.round(current)}</Text>
                    <View
                      style={{
                        width: "80%",
                        height: ui.dividerHeight,
                        backgroundColor: colors.outline,
                        marginVertical: ui.dividerMarginV,
                      }}
                    />
                    <Text variant="labelMedium">{Math.round(target)}</Text>
                  </View>
                ))}
                <View
                  style={[
                    colFlex(26),
                    { alignItems: "center", justifyContent: "center" },
                  ]}
                >
                  <IconButton
                    icon="cog"
                    size={ui.iconLg}
                    onPress={() =>
                      isEditingQuota ? exitQuotaEdit() : openQuotaEdit()
                    }
                    mode={isEditingQuota ? "contained" : "outlined"}
                  />
                </View>
              </View>
              <View
                style={[rowLayout, { marginTop: ui.numbersToInputsGap }]}
              >
                {namingEntryId != null ? (
                  <>
                    <View
                      style={{
                        flex: 82,
                        minWidth: 0,
                        marginRight: -3 * ui.rowGap,
                      }}
                    >
                      <CenteredNutritionInput
                        value={foodName}
                        onChangeText={setFoodName}
                        placeholder="Food name"
                        controlHeight={ui.controlHeight}
                        controlRadius={ui.controlRadius}
                        controlBorderWidth={ui.controlBorderWidth}
                        placeholderColor={placeholderColor}
                        outlineColor={colors.outline}
                        keyboardType="default"
                      />
                    </View>
                    <View style={colFlex(0)} />
                    <View style={colFlex(0)} />
                    <View style={colFlex(0)} />
                  </>
                ) : (
                  <>
                    <View style={colFlex(26)}>
                      <CenteredNutritionInput
                        value={calories}
                        onChangeText={setCalories}
                        placeholder="Cal"
                        controlHeight={ui.controlHeight}
                        controlRadius={ui.controlRadius}
                        controlBorderWidth={ui.controlBorderWidth}
                        placeholderColor={placeholderColor}
                        outlineColor={colors.outline}
                      />
                    </View>
                    <View style={colFlex(16)}>
                      <CenteredNutritionInput
                        value={protein}
                        onChangeText={setProtein}
                        placeholder="P"
                        controlHeight={ui.controlHeight}
                        controlRadius={ui.controlRadius}
                        controlBorderWidth={ui.controlBorderWidth}
                        placeholderColor={placeholderColor}
                        outlineColor={colors.outline}
                      />
                    </View>
                    <View style={colFlex(16)}>
                      <CenteredNutritionInput
                        value={carbs}
                        onChangeText={setCarbs}
                        placeholder="C"
                        controlHeight={ui.controlHeight}
                        controlRadius={ui.controlRadius}
                        controlBorderWidth={ui.controlBorderWidth}
                        placeholderColor={placeholderColor}
                        outlineColor={colors.outline}
                      />
                    </View>
                    <View style={colFlex(16)}>
                      <CenteredNutritionInput
                        value={fat}
                        onChangeText={setFat}
                        placeholder="F"
                        controlHeight={ui.controlHeight}
                        controlRadius={ui.controlRadius}
                        controlBorderWidth={ui.controlBorderWidth}
                        placeholderColor={placeholderColor}
                        outlineColor={colors.outline}
                      />
                    </View>
                  </>
                )}
                <View style={colFlex(26)}>
                  <Button
                    mode="contained"
                    onPress={
                      isEditingQuota
                        ? handleSaveQuota
                        : namingEntryId != null
                          ? handleSaveFoodName
                          : handleLog
                    }
                    disabled={
                      namingEntryId != null ? false : !canSave || showError
                    }
                    buttonColor={showError ? "#d32f2f" : undefined}
                    style={{
                      width: "100%",
                      height: ui.controlHeight,
                      borderRadius: ui.controlRadius,
                    }}
                    contentStyle={{
                      height: ui.controlHeight,
                      flexShrink: 0,
                    }}
                    labelStyle={{ flexShrink: 0 }}
                  >
                    {showError
                      ? "X"
                      : isEditingQuota
                        ? "SAVE"
                        : namingEntryId != null
                          ? "SAVE"
                          : "LOG"}
                  </Button>
                </View>
              </View>
            </View>
          </Surface>
          <View
            style={{
              flex: 1,
              minHeight: 0,
              marginTop: ui.gridPadding,
              flexDirection: "column",
              gap: ui.gridPadding,
            }}
          >
            <Surface
              elevation={1}
              style={{
                flex: 1,
                minHeight: 0,
                borderRadius: ui.cardBorderRadius,
                paddingHorizontal: ui.nutritionBlockPaddingH,
                paddingVertical: ui.surfacePaddingV,
                overflow: "hidden",
              }}
            >
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingRight: ui.nutritionActionsGap, flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {logEntries.length === 0 ? (
                  <View style={{ paddingVertical: ui.nutritionEmptyPaddingV, alignItems: "center" }}>
                    <Text variant="bodySmall" style={{ opacity: 0.6 }}>
                      No entries today
                    </Text>
                  </View>
                ) : (
                  logEntries.map((entry) => (
                    <View
                      key={entry.id}
                      style={[rowLayout, { paddingVertical: ui.nutritionEntryPaddingV }]}
                    >
                      <View
                        style={[
                          colFlex(26),
                          { alignItems: "center", justifyContent: "center" },
                        ]}
                      >
                        <Text
                          variant="bodySmall"
                          numberOfLines={1}
                          style={{ textAlign: "center", width: "100%" }}
                        >
                          {Math.round(entry.calories)}
                        </Text>
                      </View>
                      <View
                        style={[
                          colFlex(16),
                          {
                            alignItems: "center",
                            justifyContent: "center",
                            marginLeft: ui.nutritionEntryMarginL,
                          },
                        ]}
                      >
                        <Text
                          variant="bodySmall"
                          numberOfLines={1}
                          style={{ textAlign: "center", width: "100%" }}
                        >
                          {Math.round(entry.protein)}
                        </Text>
                      </View>
                      <View
                        style={[
                          colFlex(16),
                          {
                            alignItems: "center",
                            justifyContent: "center",
                            marginLeft: ui.nutritionEntryMarginL,
                          },
                        ]}
                      >
                        <Text
                          variant="bodySmall"
                          numberOfLines={1}
                          style={{ textAlign: "center", width: "100%" }}
                        >
                          {Math.round(entry.carbs)}
                        </Text>
                      </View>
                      <View
                        style={[
                          colFlex(16),
                          {
                            alignItems: "center",
                            justifyContent: "center",
                            marginLeft: ui.nutritionEntryMarginL,
                          },
                        ]}
                      >
                        <Text
                          variant="bodySmall"
                          numberOfLines={1}
                          style={{ textAlign: "center", width: "100%" }}
                        >
                          {Math.round(entry.fat)}
                        </Text>
                      </View>
                      <View
                        style={[
                          colFlex(26),
                          {
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: ui.nutritionActionsGap,
                          },
                        ]}
                      >
                        <IconButton
                          icon="content-save"
                          size={ui.iconMd}
                          onPress={() => {
                            setNamingEntryId(entry.id);
                            setFoodName(entry.foodName ?? "");
                          }}
                          mode="text"
                          style={{ margin: 0 }}
                        />
                        <IconButton
                          icon="delete-outline"
                          size={ui.iconMd}
                          onPress={async () => {
                            await deleteNutritionLog(entry.id);
                            loadLogEntries();
                            loadTotals();
                          }}
                          mode="text"
                          style={{ margin: 0 }}
                        />
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            </Surface>
            <Surface
              elevation={1}
              style={{
                flex: 1,
                minHeight: 0,
                borderRadius: ui.cardBorderRadius,
                paddingHorizontal: ui.nutritionBlockPaddingH,
                paddingVertical: ui.surfacePaddingV,
                overflow: "hidden",
              }}
            >
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingRight: ui.nutritionActionsGap, flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {savedFoodsList.length === 0 ? (
                  <View style={{ paddingVertical: ui.nutritionEmptyPaddingV, alignItems: "center" }}>
                    <Text variant="bodySmall" style={{ opacity: 0.6 }}>
                      No saved foods
                    </Text>
                  </View>
                ) : (
                  savedFoodsList.map((food) => (
                    <Pressable
                      key={food.id}
                      onPress={() => {
                        setCalories(String(Math.round(food.calories)));
                        setProtein(String(Math.round(food.protein)));
                        setCarbs(String(Math.round(food.carbs)));
                        setFat(String(Math.round(food.fat)));
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: ui.savedFoodPaddingV,
                      }}
                    >
                      <Text
                        variant="bodySmall"
                        numberOfLines={1}
                        style={{ flex: 1, minWidth: 0 }}
                      >
                        {food.name}
                      </Text>
                      <Text
                        variant="labelSmall"
                        numberOfLines={1}
                        style={{ opacity: 0.6, marginRight: ui.savedFoodMarginR }}
                      >
                        {Math.round(food.calories)} · {Math.round(food.protein)} ·{" "}
                        {Math.round(food.carbs)} · {Math.round(food.fat)}
                      </Text>
                      <IconButton
                        icon="delete-outline"
                        size={ui.iconMd}
                        onPress={async () => {
                          await deleteSavedFood(food.id);
                          loadSavedFoods();
                        }}
                        style={{ margin: 0 }}
                      />
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </Surface>
          </View>
        </View>
      </View>
    </View>
  );
}
