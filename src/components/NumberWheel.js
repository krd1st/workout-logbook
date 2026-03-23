import * as React from "react";
import { FlatList, View } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { BRAND } from "../constants/colors";

const VISIBLE_COUNT = 7;
const HEIGHT = 40;
const PAD = Math.floor(VISIBLE_COUNT / 2); // 3

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

const PickerItem = React.memo(function PickerItem({ label, width, scrollX, itemOffset }) {
  const animStyle = useAnimatedStyle(() => {
    const dist = Math.abs(scrollX.value - itemOffset);
    const maxDist = width * 2;
    return {
      opacity: interpolate(dist, [0, maxDist], [1, 0.2], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(dist, [0, maxDist], [1.1, 0.85], Extrapolation.CLAMP) }],
    };
  });

  if (!label) return <View style={{ width, height: HEIGHT }} />;

  return (
    <View style={{ width, height: HEIGHT, justifyContent: "center", alignItems: "center" }}>
      <Animated.Text style={[{ fontSize: 14, fontWeight: "500", color: BRAND.text }, animStyle]}>
        {label}
      </Animated.Text>
    </View>
  );
});

export const NumberWheel = React.memo(function NumberWheel({ values, value, onValueChange, formatLabel, resetKey }) {
  const fmt = formatLabel || ((v) => String(v));
  const flatListRef = React.useRef(null);
  const [itemWidth, setItemWidth] = React.useState(0);
  const scrollX = useSharedValue(0);

  const currentIndex = React.useMemo(() => {
    if (!values.length) return 0;
    const idx = values.indexOf(value);
    if (idx >= 0) return idx;
    let closest = 0, minDist = Math.abs(values[0] - value);
    for (let i = 1; i < values.length; i++) {
      const d = Math.abs(values[i] - value);
      if (d < minDist) { minDist = d; closest = i; }
    }
    return closest;
  }, [values, value]);

  const paddedItems = React.useMemo(() => {
    const formatted = values.map((v, i) => ({ key: `v${i}`, label: fmt(v) }));
    const before = Array.from({ length: PAD }, (_, i) => ({ key: `b${i}`, label: "" }));
    const after = Array.from({ length: PAD }, (_, i) => ({ key: `a${i}`, label: "" }));
    return [...before, ...formatted, ...after];
  }, [values, fmt]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollX.value = e.contentOffset.x; },
  });

  const onLayout = React.useCallback((e) => {
    setItemWidth(e.nativeEvent.layout.width / VISIBLE_COUNT);
  }, []);

  // Scroll to correct position after layout and whenever resetKey changes
  React.useEffect(() => {
    if (itemWidth > 0) {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToOffset({ offset: currentIndex * itemWidth, animated: false });
      });
    }
  }, [itemWidth, resetKey]);

  const onScrollEnd = React.useCallback((e) => {
    if (!itemWidth) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / itemWidth);
    const clamped = Math.max(0, Math.min(idx, values.length - 1));
    onValueChange(values[clamped]);
  }, [itemWidth, values, onValueChange]);

  const snapOffsets = React.useMemo(() =>
    itemWidth > 0 ? values.map((_, i) => i * itemWidth) : undefined,
  [itemWidth, values.length]);

  const getItemLayout = React.useCallback((_, index) => ({
    length: itemWidth, offset: itemWidth * index, index,
  }), [itemWidth]);

  const renderItem = React.useCallback(({ item, index }) => (
    <PickerItem label={item.label} width={itemWidth} scrollX={scrollX} itemOffset={(index - PAD) * itemWidth} />
  ), [itemWidth, scrollX]);

  return (
    <View
      style={{ height: HEIGHT, overflow: "hidden", backgroundColor: BRAND.surfaceHigh, borderRadius: 10, position: "relative" }}
      onLayout={onLayout}
    >
      {itemWidth > 0 && (
        <AnimatedFlatList
          ref={flatListRef}
          data={paddedItems}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToOffsets={snapOffsets}
          decelerationRate="fast"
          getItemLayout={getItemLayout}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onMomentumScrollEnd={onScrollEnd}
          overScrollMode="never"
          bounces={false}
        />
      )}
      <View pointerEvents="none" style={{ position: "absolute", left: "50%", marginLeft: -0.5, top: 6, bottom: 6, width: 1, backgroundColor: BRAND.accent, opacity: 0.7, borderRadius: 1 }} />
    </View>
  );
});
