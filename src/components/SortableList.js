import * as React from "react";
import { ScrollView, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

const MOVE_DURATION = 300;

function clampW(v, min, max) {
  "worklet";
  return Math.max(min, Math.min(max, v));
}

function SortableItem({ index, order, activeIndex, dragTransY, itemHeight, itemCount, onDragFinish, setScrollEnabled, mounted, children }) {
  const gesture = Gesture.Pan()
    .activateAfterLongPress(500)
    .onStart(() => {
      activeIndex.value = index;
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      runOnJS(setScrollEnabled)(false);
    })
    .onUpdate((e) => {
      dragTransY.value = e.translationY;
    })
    .onEnd(() => {
      const myPos = order.value.indexOf(index);
      const newPos = clampW(myPos + Math.round(dragTransY.value / itemHeight), 0, itemCount - 1);
      const snapY = (newPos - myPos) * itemHeight;

      dragTransY.value = withTiming(snapY, { duration: 200 }, (finished) => {
        if (finished) {
          const newOrder = order.value.slice();
          newOrder.splice(myPos, 1);
          newOrder.splice(newPos, 0, index);
          order.value = newOrder;
          activeIndex.value = -1;
          dragTransY.value = 0;
          runOnJS(setScrollEnabled)(true);
          runOnJS(onDragFinish)();
        }
      });
    });

  const animStyle = useAnimatedStyle(() => {
    const myPos = order.value.indexOf(index);
    const isActive = activeIndex.value === index;
    const y = myPos * itemHeight;

    if (isActive) {
      return {
        position: "absolute",
        top: 0, left: 0, right: 0,
        transform: [{ translateY: y + dragTransY.value }, { scale: 1.03 }],
        zIndex: 100,
        opacity: 0.95,
      };
    }

    if (activeIndex.value < 0) {
      // No drag — go to position (no animation on first mount)
      const translateY = mounted.value ? withTiming(y, { duration: MOVE_DURATION }) : y;
      return {
        position: "absolute",
        top: 0, left: 0, right: 0,
        transform: [{ translateY }, { scale: 1 }],
        zIndex: 0,
        opacity: 1,
      };
    }

    // Another item is being dragged — shift to make room
    const dragOrigPos = order.value.indexOf(activeIndex.value);
    const dragNewPos = clampW(dragOrigPos + Math.round(dragTransY.value / itemHeight), 0, itemCount - 1);

    let targetPos = myPos;
    if (dragOrigPos < myPos && dragNewPos >= myPos) targetPos = myPos - 1;
    else if (dragOrigPos > myPos && dragNewPos <= myPos) targetPos = myPos + 1;

    return {
      position: "absolute",
      top: 0, left: 0, right: 0,
      transform: [{ translateY: withTiming(targetPos * itemHeight, { duration: MOVE_DURATION }) }, { scale: 1 }],
      zIndex: 0,
      opacity: 1,
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={animStyle}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

export function SortableList({ data, renderItem, keyExtractor, onReorder, contentContainerStyle, style, bounces, keyboardShouldPersistTaps }) {
  const [itemHeight, setItemHeight] = React.useState(85);
  const [scrollEnabled, setScrollEnabled] = React.useState(true);
  const order = useSharedValue(data.map((_, i) => i));
  const activeIndex = useSharedValue(-1);
  const dragTransY = useSharedValue(0);
  const mounted = useSharedValue(false);
  const dataRef = React.useRef(data);
  dataRef.current = data;

  // Reset order when data changes (items loaded, added, removed)
  React.useEffect(() => {
    mounted.value = false;
    order.value = data.map((_, i) => i);
    requestAnimationFrame(() => { mounted.value = true; });
  }, [data]);

  const onItemLayout = React.useCallback((e) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - 85) > 2) setItemHeight(h);
  }, []);

  const onDragFinish = React.useCallback(() => {
    const reordered = order.value.map((i) => dataRef.current[i]);
    onReorder(reordered);
  }, [onReorder]);

  if (!data.length) return <View style={style} />;

  return (
    <ScrollView
      style={style}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      bounces={bounces}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      scrollEnabled={scrollEnabled}
    >
      <View style={{ height: data.length * itemHeight }}>
        {data.map((item, index) => (
          <SortableItem
            key={keyExtractor(item)}
            index={index}
            order={order}
            activeIndex={activeIndex}
            dragTransY={dragTransY}
            itemHeight={itemHeight}
            itemCount={data.length}
            onDragFinish={onDragFinish}
            setScrollEnabled={setScrollEnabled}
            mounted={mounted}
          >
            <View onLayout={index === 0 ? onItemLayout : undefined}>
              {renderItem({ item, index })}
            </View>
          </SortableItem>
        ))}
      </View>
    </ScrollView>
  );
}
