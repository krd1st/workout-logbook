import * as React from "react";
import { Animated, Dimensions, View } from "react-native";
import { Text } from "react-native-paper";
import { BRAND } from "../constants/colors";

const ITEM_W = 42;
const COPIES = 5;
const MID = Math.floor(COPIES / 2);

const WheelItem = React.memo(({ index, scrollX, height, fontSize, label }) => {
  const center = index * ITEM_W;
  const opacity = scrollX.interpolate({
    inputRange: [center - ITEM_W * 5, center - ITEM_W * 2.5, center, center + ITEM_W * 2.5, center + ITEM_W * 5],
    outputRange: [0.08, 0.2, 1, 0.2, 0.08], extrapolate: "clamp",
  });
  const scale = scrollX.interpolate({
    inputRange: [center - ITEM_W * 2.5, center, center + ITEM_W * 2.5],
    outputRange: [0.8, 1.1, 0.8], extrapolate: "clamp",
  });
  return (
    <Animated.View style={{ width: ITEM_W, alignItems: "center", justifyContent: "center", height, opacity, transform: [{ scale }] }}>
      <Text style={{ fontSize, fontWeight: "500", color: BRAND.text }}>{label}</Text>
    </Animated.View>
  );
});

const dataCache = new WeakMap();
function getLoopedData(values, fmt) {
  let c = dataCache.get(values);
  if (c) return c;
  const n = values.length, arr = new Array(COPIES * n);
  for (let ci = 0; ci < COPIES; ci++) for (let i = 0; i < n; i++) arr[ci * n + i] = { label: fmt(values[i]), key: ci * n + i };
  dataCache.set(values, arr);
  return arr;
}

export const NumberWheel = React.memo(function NumberWheel({ values, value, onValueChange, formatLabel }) {
  const scrollRef = React.useRef(null);
  const screenW = Dimensions.get("window").width;
  const estimatedWidth = screenW * 0.92 - 40;
  const [containerWidth, setContainerWidth] = React.useState(estimatedWidth);
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const isUserDragging = React.useRef(false);
  const h = 40;
  const pad = containerWidth / 2 - ITEM_W / 2;
  const n = values.length;

  const fmt = React.useCallback(formatLabel || ((v) => String(v)), [formatLabel]);
  const loopedData = React.useMemo(() => getLoopedData(values, fmt), [values, fmt]);

  const midIndexFor = React.useCallback((val) => { const i = values.indexOf(val); return MID * n + (i >= 0 ? i : 0); }, [values, n]);

  React.useEffect(() => {
    if (isUserDragging.current) return;
    const t = midIndexFor(value);
    if (scrollRef.current) scrollRef.current.scrollToOffset({ offset: t * ITEM_W, animated: false });
  }, [value, containerWidth, midIndexFor]);

  const handleScrollEnd = React.useCallback((x) => {
    const idx = Math.round(x / ITEM_W), cl = ((idx % n) + n) % n;
    onValueChange(values[cl]);
    const mo = (MID * n + cl) * ITEM_W;
    if (scrollRef.current && Math.abs(x - mo) > ITEM_W) scrollRef.current.scrollToOffset({ offset: mo, animated: false });
  }, [onValueChange, values, n]);

  const onScroll = React.useMemo(() => Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true }), [scrollX]);
  const renderItem = React.useCallback(({ item, index }) => <WheelItem index={index} scrollX={scrollX} height={h} fontSize={14} label={item.label} />, [scrollX]);
  const getItemLayout = React.useCallback((_, index) => ({ length: ITEM_W, offset: ITEM_W * index, index }), []);

  return (
    <View style={{ height: h, overflow: "hidden", backgroundColor: BRAND.surfaceHigh, borderRadius: 10 }} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      <Animated.FlatList ref={scrollRef} data={loopedData} keyExtractor={(item) => String(item.key)} renderItem={renderItem}
        horizontal showsHorizontalScrollIndicator={false} snapToInterval={ITEM_W} decelerationRate={0.985}
        contentContainerStyle={{ paddingHorizontal: pad }} onScroll={onScroll} scrollEventThrottle={16}
        onScrollBeginDrag={() => { isUserDragging.current = true; }} onScrollEndDrag={() => { isUserDragging.current = false; }}
        onMomentumScrollEnd={(e) => handleScrollEnd(e.nativeEvent.contentOffset.x)}
        getItemLayout={getItemLayout} contentOffset={{ x: midIndexFor(value) * ITEM_W, y: 0 }}
        windowSize={5} maxToRenderPerBatch={30} initialNumToRender={30} removeClippedSubviews />
      <View pointerEvents="none" style={{ position: "absolute", left: containerWidth / 2 - 0.5, top: 6, bottom: 6, width: 1, backgroundColor: BRAND.accent, opacity: 0.7, borderRadius: 1 }} />
    </View>
  );
});
