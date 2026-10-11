import * as React from "react";
import { Animated, Pressable, ScrollView, View } from "react-native";

export function SortableList({
  data,
  renderItem,
  keyExtractor,
  onReorder,
  onItemPress,
  contentContainerStyle,
  style,
  bounces,
  keyboardShouldPersistTaps,
}) {
  const [itemHeight, setItemHeight] = React.useState(85);
  const [scrollEnabled, setScrollEnabled] = React.useState(true);
  const [dragState, setDragState] = React.useState({ index: -1, hoverPos: -1 });

  const dragY = React.useRef(new Animated.Value(0)).current;
  const dragRef = React.useRef({ index: -1, origPos: -1, startY: 0, hoverPos: -1 });
  const dataRef = React.useRef(data);
  dataRef.current = data;
  const itemHeightRef = React.useRef(85);
  itemHeightRef.current = itemHeight;

  // Reset internal state when the parent rebuilds the list (e.g. after a reorder commit).
  React.useEffect(() => {
    dragRef.current = { index: -1, origPos: -1, startY: 0, hoverPos: -1 };
    dragY.setValue(0);
    setDragState({ index: -1, hoverPos: -1 });
  }, [data, dragY]);

  const onItemLayout = React.useCallback((e) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - itemHeightRef.current) > 2) setItemHeight(h);
  }, []);

  function startDrag(index, pageY) {
    dragRef.current = { index, origPos: index, startY: pageY, hoverPos: index };
    dragY.setValue(0);
    setDragState({ index, hoverPos: index });
    setScrollEnabled(false);
  }

  function onMove(e) {
    const d = dragRef.current;
    if (d.index < 0) return;
    const dy = e.nativeEvent.pageY - d.startY;
    dragY.setValue(dy);
    const count = dataRef.current.length;
    const newHover = Math.max(0, Math.min(count - 1, d.origPos + Math.round(dy / itemHeightRef.current)));
    if (newHover !== d.hoverPos) {
      d.hoverPos = newHover;
      setDragState((prev) => ({ ...prev, hoverPos: newHover }));
    }
  }

  function onDrop() {
    const d = { ...dragRef.current };
    if (d.index < 0) return;
    dragRef.current.index = -1; // guard against double-fire

    // Instant snap: no trailing Animated.timing — that animation was the source
    // of the visible "blink" because its completion callback raced React's render
    // of the new array order. Just commit the new order in one synchronous batch.
    setScrollEnabled(true);
    if (d.hoverPos === d.origPos) {
      // No real reorder — just clean up local state.
      dragRef.current = { index: -1, origPos: -1, startY: 0, hoverPos: -1 };
      dragY.setValue(0);
      setDragState({ index: -1, hoverPos: -1 });
      return;
    }
    const arr = [...dataRef.current];
    const [moved] = arr.splice(d.origPos, 1);
    arr.splice(d.hoverPos, 0, moved);
    dragRef.current = { index: -1, origPos: -1, startY: 0, hoverPos: -1 };
    dragY.setValue(0);
    setDragState({ index: -1, hoverPos: -1 });
    onReorder?.(arr);
  }

  if (!data.length) return <View style={style} />;

  const { index: dragIndex, hoverPos } = dragState;

  return (
    <ScrollView
      style={style}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      bounces={bounces}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      scrollEnabled={scrollEnabled}
    >
      <View
        style={{ height: data.length * itemHeight }}
        onMoveShouldSetResponder={() => dragRef.current.index >= 0}
        onResponderMove={onMove}
        onResponderRelease={onDrop}
        onResponderTerminate={onDrop}
        onTouchEnd={() => { if (dragRef.current.index >= 0) onDrop(); }}
      >
        {data.map((item, index) => {
          const isDragging = index === dragIndex;
          let vPos = index;
          if (!isDragging && dragIndex >= 0) {
            if (dragRef.current.origPos < index && hoverPos >= index) vPos = index - 1;
            else if (dragRef.current.origPos > index && hoverPos <= index) vPos = index + 1;
          }

          return (
            <Animated.View
              key={keyExtractor(item)}
              style={{
                position: "absolute",
                top: (isDragging ? dragRef.current.origPos : vPos) * itemHeight,
                left: 0,
                right: 0,
                zIndex: isDragging ? 100 : 0,
                opacity: isDragging ? 0.92 : 1,
                transform: isDragging ? [{ translateY: dragY }, { scale: 1.03 }] : [],
              }}
            >
              <View onLayout={index === 0 ? onItemLayout : undefined}>
                <Pressable
                  onPress={() => onItemPress?.(item, index)}
                  onLongPress={(e) => startDrag(index, e.nativeEvent.pageY)}
                  delayLongPress={250}
                >
                  {renderItem({ item, index })}
                </Pressable>
              </View>
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}
