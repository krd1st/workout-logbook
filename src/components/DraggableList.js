import * as React from "react";
import {
  Animated,
  PanResponder,
  ScrollView,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

const LONG_PRESS_DELAY = 400;
const DRAG_SCALE = 1.05;
const ANIM_DURATION = 180;
const SCROLL_CANCEL_THRESHOLD = 8;

export function DraggableList({
  data,
  keyExtractor,
  renderItem,
  onReorder,
  contentContainerStyle,
  scrollEnabled = true,
  ListFooterComponent,
  showsVerticalScrollIndicator = false,
  keyboardShouldPersistTaps,
}) {
  // ---- Measurements ----
  const itemRects = React.useRef({}); // key → { y, h } relative to container
  const containerPageY = React.useRef(0);
  const scrollOffset = React.useRef(0);
  const containerRef = React.useRef(null);

  // ---- Drag state (all in refs for synchronous access) ----
  const isDragging = React.useRef(false);
  const dragIdx = React.useRef(-1);
  const dragStartPageY = React.useRef(0);
  const order = React.useRef([]); // current visual order as data indices
  const longPressTimer = React.useRef(null);
  const touchStartY = React.useRef(0);

  // ---- Animated values ----
  const offsets = React.useRef({}); // key → Animated.Value (translateY offset from natural position)
  const dragTranslate = React.useRef(new Animated.Value(0)).current;
  const dragScaleAnim = React.useRef(new Animated.Value(1)).current;

  // ---- Force re-render for zIndex changes ----
  const [activeDragIdx, setActiveDragIdx] = React.useState(-1);

  // Keep order in sync with data.
  React.useEffect(() => {
    order.current = data.map((_, i) => i);
  }, [data]);

  const getOffset = (key) => {
    if (!offsets.current[key]) offsets.current[key] = new Animated.Value(0);
    return offsets.current[key];
  };

  // Compute cumulative Y positions for a given ordering.
  const getPositions = React.useCallback(
    (ord) => {
      const pos = [];
      let y = 0;
      for (const di of ord) {
        pos.push(y);
        const key = keyExtractor(data[di], di);
        const rect = itemRects.current[key];
        y += rect ? rect.h : 0;
      }
      return pos;
    },
    [data, keyExtractor],
  );

  // Natural position = where the item sits without any translateY.
  const getNaturalPositions = React.useCallback(() => {
    return getPositions(data.map((_, i) => i));
  }, [data, getPositions]);

  // Find which slot (index in current order) a pageY corresponds to.
  const findSlot = React.useCallback(
    (pageY) => {
      const localY = pageY - containerPageY.current + scrollOffset.current;
      const positions = getPositions(order.current);
      const ord = order.current;

      for (let i = 0; i < ord.length; i++) {
        const key = keyExtractor(data[ord[i]], ord[i]);
        const rect = itemRects.current[key];
        const h = rect ? rect.h : 0;
        if (localY < positions[i] + h / 2) return i;
      }
      return ord.length - 1;
    },
    [data, keyExtractor, getPositions],
  );

  // Animate non-dragged items to their positions in the current order.
  const animateToOrder = React.useCallback(
    (newOrder) => {
      const natural = getNaturalPositions();
      const newPositions = getPositions(newOrder);

      for (let slotIdx = 0; slotIdx < newOrder.length; slotIdx++) {
        const di = newOrder[slotIdx];
        if (di === dragIdx.current) continue;
        const key = keyExtractor(data[di], di);
        const offset = newPositions[slotIdx] - natural[di];
        Animated.timing(getOffset(key), {
          toValue: offset,
          duration: ANIM_DURATION,
          useNativeDriver: true,
        }).start();
      }
    },
    [data, keyExtractor, getNaturalPositions, getPositions],
  );

  // ---- Drag lifecycle ----

  const startDrag = React.useCallback(
    (index, pageY) => {
      isDragging.current = true;
      dragIdx.current = index;
      dragStartPageY.current = pageY;
      order.current = data.map((_, i) => i);

      // Reset all offsets to 0 before starting.
      for (let i = 0; i < data.length; i++) {
        getOffset(keyExtractor(data[i], i)).setValue(0);
      }
      dragTranslate.setValue(0);

      setActiveDragIdx(index);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Animated.spring(dragScaleAnim, {
        toValue: DRAG_SCALE,
        useNativeDriver: true,
        friction: 8,
      }).start();
    },
    [data, keyExtractor, dragTranslate, dragScaleAnim],
  );

  const onDragMove = React.useCallback(
    (pageY) => {
      if (!isDragging.current) return;
      const dy = pageY - dragStartPageY.current;
      dragTranslate.setValue(dy);

      const slot = findSlot(pageY);
      const ord = [...order.current];
      const curSlot = ord.indexOf(dragIdx.current);

      if (curSlot !== slot) {
        ord.splice(curSlot, 1);
        ord.splice(slot, 0, dragIdx.current);
        order.current = ord;
        animateToOrder(ord);
      }
    },
    [dragTranslate, findSlot, animateToOrder],
  );

  const finishDrag = React.useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!isDragging.current) return;

    const finalOrder = [...order.current];
    const di = dragIdx.current;

    // Compute where the dragged item should land.
    const natural = getNaturalPositions();
    const finalPositions = getPositions(finalOrder);
    const slotIdx = finalOrder.indexOf(di);
    const landingOffset = finalPositions[slotIdx] - natural[di];

    // Snap: clear the drag translate, put the landing offset on the item's own offset.
    const key = keyExtractor(data[di], di);
    dragTranslate.setValue(0);
    getOffset(key).setValue(landingOffset);

    // Animate scale back.
    Animated.spring(dragScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
    }).start(() => {
      // Reset everything.
      for (let i = 0; i < data.length; i++) {
        getOffset(keyExtractor(data[i], i)).setValue(0);
      }
      dragTranslate.setValue(0);
      isDragging.current = false;
      dragIdx.current = -1;
      setActiveDragIdx(-1);

      const changed = finalOrder.some((v, i) => v !== i);
      if (changed && onReorder) {
        onReorder(finalOrder.map((i) => data[i]));
      }
    });
  }, [data, keyExtractor, onReorder, getNaturalPositions, getPositions, dragTranslate, dragScaleAnim]);

  // ---- Gesture handling ----

  // PanResponder on outer wrapper — claims gesture only when dragging.
  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => isDragging.current,
        onStartShouldSetPanResponderCapture: () => isDragging.current,
        onMoveShouldSetPanResponder: () => isDragging.current,
        onMoveShouldSetPanResponderCapture: () => isDragging.current,
        onPanResponderMove: (evt) => onDragMove(evt.nativeEvent.pageY),
        onPanResponderRelease: () => finishDrag(),
        onPanResponderTerminate: () => finishDrag(),
      }),
    [onDragMove, finishDrag],
  );

  // Touch handlers on container for long-press detection. These are passive
  // and don't prevent ScrollView from scrolling.
  const onTouchStart = React.useCallback(
    (evt) => {
      if (isDragging.current) return;
      const pageY = evt.nativeEvent.pageY;
      touchStartY.current = pageY;

      // Measure container position synchronously-ish before the timer fires.
      if (containerRef.current) {
        containerRef.current.measureInWindow((_, y) => {
          containerPageY.current = y;
        });
      }

      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        // Re-measure in case scroll happened during the delay.
        if (containerRef.current) {
          containerRef.current.measureInWindow((_, y) => {
            containerPageY.current = y;
            const localY = pageY - y + scrollOffset.current;
            let cum = 0;
            for (let i = 0; i < data.length; i++) {
              const key = keyExtractor(data[i], i);
              const rect = itemRects.current[key];
              const h = rect ? rect.h : 0;
              if (localY < cum + h) {
                startDrag(i, pageY);
                return;
              }
              cum += h;
            }
          });
        }
      }, LONG_PRESS_DELAY);
    },
    [data, keyExtractor, startDrag],
  );

  const onTouchMove = React.useCallback(
    (evt) => {
      if (!isDragging.current && longPressTimer.current) {
        const dy = Math.abs(evt.nativeEvent.pageY - touchStartY.current);
        if (dy > SCROLL_CANCEL_THRESHOLD) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }
      if (isDragging.current) {
        onDragMove(evt.nativeEvent.pageY);
      }
    },
    [onDragMove],
  );

  const onTouchEnd = React.useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isDragging.current) finishDrag();
  }, [finishDrag]);

  // ---- Item layout tracking ----
  const onItemLayout = React.useCallback(
    (key, evt) => {
      const { y, height } = evt.nativeEvent.layout;
      const prev = itemRects.current[key];
      if (!prev || prev.y !== y || prev.h !== height) {
        itemRects.current[key] = { y, h: height };
      }
    },
    [],
  );

  // ---- Render ----
  const items = data.map((item, index) => {
    const key = keyExtractor(item, index);
    const isActive = activeDragIdx === index;
    const offset = getOffset(key);

    const transform = isActive
      ? [{ translateY: Animated.add(offset, dragTranslate) }, { scale: dragScaleAnim }]
      : [{ translateY: offset }];

    return (
      <Animated.View
        key={key}
        style={{
          transform,
          zIndex: isActive ? 999 : 0,
          ...(isActive ? { elevation: 10 } : {}),
        }}
        onLayout={(e) => onItemLayout(key, e)}
      >
        {renderItem({ item, index, isDragging: isActive })}
      </Animated.View>
    );
  });

  return (
    <View style={{ flex: scrollEnabled ? 1 : undefined }} {...panResponder.panHandlers}>
      <ScrollView
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        scrollEnabled={scrollEnabled && activeDragIdx < 0}
        onScroll={(e) => { scrollOffset.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
      >
        <View
          ref={containerRef}
          collapsable={false}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          {items}
        </View>
        {ListFooterComponent}
      </ScrollView>
    </View>
  );
}
