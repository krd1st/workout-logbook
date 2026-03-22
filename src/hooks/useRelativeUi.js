import * as React from "react";
import { useWindowDimensions } from "react-native";
import { clamp } from "../utils/helpers";
import {
  BASE_WIDTH,
  BASE_TOP_PADDING,
  BASE_GRID_PADDING,
  BASE_SIDE_PADDING,
  BASE_ROW_GAP,
  BASE_NUMBERS_TO_INPUTS_GAP,
  BASE_CARD_BORDER_RADIUS,
  BASE_CARD_PADDING_V,
  BASE_CARD_PADDING_H,
  BASE_CARD_MIN_HEIGHT,
  BASE_CONTROL_HEIGHT,
  BASE_CONTROL_RADIUS,
  BASE_CONTROL_BORDER_WIDTH,
  BASE_HEADER_PADDING,
  BASE_ICON_SM,
  BASE_ICON_MD,
  BASE_ICON_LG,
  BASE_ICON_SPLASH,
  BASE_FONT_SIZE_BODY,
  BASE_TABLE_CELL_PADDING_H,
  BASE_TABLE_DELETE_WIDTH,
  BASE_HIT_SLOP_SM,
  BASE_HIT_SLOP_MD,
  BASE_HIT_SLOP_LG,
  BASE_SHADOW_OFFSET_H,
  BASE_SHADOW_RADIUS,
  BASE_NUTRITION_BLOCK_PADDING_H,
  BASE_NUTRITION_BLOCK_PADDING_TOP,
  BASE_NUTRITION_BLOCK_PADDING_BOTTOM,
  BASE_DIVIDER_HEIGHT,
  BASE_DIVIDER_MARGIN_V,
  BASE_NUTRITION_ENTRY_PADDING_V,
  BASE_NUTRITION_ENTRY_MARGIN_L,
  BASE_NUTRITION_EMPTY_PADDING_V,
  BASE_SAVED_FOOD_PADDING_V,
  BASE_SAVED_FOOD_MARGIN_R,
  BASE_NUTRITION_ACTIONS_GAP,
  BASE_SURFACE_PADDING_V,
  BASE_DAY_BUTTON_PADDING,
  BASE_DAY_BUTTON_SUBTITLE_MARGIN_TOP,
} from "../constants/layout";

/** Scales a base value by the responsive factor, rounding to the nearest integer with an optional minimum. */
function s(base, scale, min = 0) {
  return Math.max(min, Math.round(base * scale));
}

export function useRelativeUi() {
  const { width: viewportWidth, height: viewportHeight } =
    useWindowDimensions();

  return React.useMemo(() => {
    const scale = clamp(viewportWidth / BASE_WIDTH, 0.85, 1.25);

    return {
      // Raw scale for custom calculations
      scale,
      viewportWidth,
      viewportHeight,

      // Spacing
      topPadding: s(BASE_TOP_PADDING, scale, 4),
      gridPadding: s(BASE_GRID_PADDING, scale, 6),
      sidePadding: s(BASE_SIDE_PADDING, scale, 8),
      rowGap: s(BASE_ROW_GAP, scale, 4),
      numbersToInputsGap: s(BASE_NUMBERS_TO_INPUTS_GAP, scale, 4),

      // Cards
      cardBorderRadius: s(BASE_CARD_BORDER_RADIUS, scale, 8),
      cardPaddingV: s(BASE_CARD_PADDING_V, scale, 6),
      cardPaddingH: s(BASE_CARD_PADDING_H, scale, 8),
      cardMinHeight: s(BASE_CARD_MIN_HEIGHT, scale, 40),

      // Controls
      controlHeight: s(BASE_CONTROL_HEIGHT, scale, 32),
      controlRadius: s(BASE_CONTROL_RADIUS, scale, 16),
      controlBorderWidth: Math.max(1, Math.round(BASE_CONTROL_BORDER_WIDTH * scale)),

      // Header
      headerPadding: s(BASE_HEADER_PADDING, scale, 8),
      headerBorderRadius: s(BASE_CARD_BORDER_RADIUS, scale, 8),

      // Icons
      iconSm: s(BASE_ICON_SM, scale, 12),
      iconMd: s(BASE_ICON_MD, scale, 14),
      iconLg: s(BASE_ICON_LG, scale, 18),
      iconSplash: s(BASE_ICON_SPLASH, scale, 60),

      // Typography
      fontSizeBody: s(BASE_FONT_SIZE_BODY, scale, 11),

      // Table / history
      tableCellPaddingH: s(BASE_TABLE_CELL_PADDING_H, scale, 4),
      tableDeleteWidth: s(BASE_TABLE_DELETE_WIDTH, scale, 28),

      // Hit areas
      hitSlopSm: s(BASE_HIT_SLOP_SM, scale, 2),
      hitSlopMd: s(BASE_HIT_SLOP_MD, scale, 6),
      hitSlopLg: s(BASE_HIT_SLOP_LG, scale, 8),

      // Shadow
      shadowOffsetH: s(BASE_SHADOW_OFFSET_H, scale, 1),
      shadowRadius: s(BASE_SHADOW_RADIUS, scale, 2),

      // Nutrition block
      nutritionBlockPaddingH: s(BASE_NUTRITION_BLOCK_PADDING_H, scale, 6),
      nutritionBlockPaddingTop: s(BASE_NUTRITION_BLOCK_PADDING_TOP, scale, 3),
      nutritionBlockPaddingBottom: s(BASE_NUTRITION_BLOCK_PADDING_BOTTOM, scale, 6),
      dividerHeight: Math.max(1, Math.round(BASE_DIVIDER_HEIGHT * scale)),
      dividerMarginV: s(BASE_DIVIDER_MARGIN_V, scale, 2),
      nutritionEntryPaddingV: s(BASE_NUTRITION_ENTRY_PADDING_V, scale, 1),
      nutritionEntryMarginL: s(BASE_NUTRITION_ENTRY_MARGIN_L, scale, 2),
      nutritionEmptyPaddingV: s(BASE_NUTRITION_EMPTY_PADDING_V, scale, 4),
      savedFoodPaddingV: s(BASE_SAVED_FOOD_PADDING_V, scale, 1),
      savedFoodMarginR: s(BASE_SAVED_FOOD_MARGIN_R, scale, 2),
      nutritionActionsGap: s(BASE_NUTRITION_ACTIONS_GAP, scale, 2),
      surfacePaddingV: s(BASE_SURFACE_PADDING_V, scale, 2),

      // Day button
      dayButtonPadding: s(BASE_DAY_BUTTON_PADDING, scale, 4),
      dayButtonSubtitleMarginTop: s(BASE_DAY_BUTTON_SUBTITLE_MARGIN_TOP, scale, 3),

    };
  }, [viewportWidth, viewportHeight]);
}
