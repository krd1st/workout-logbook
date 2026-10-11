import * as React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { BRAND } from "../constants/colors";
import { Pill } from "./Pill";

export function ConfirmDialog({ action, onDismiss }) {
  return (
    <Modal visible={action !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss}>
          <View style={{ flex: 1, backgroundColor: BRAND.overlay }} />
        </Pressable>
        <View style={{ width: "82%", maxWidth: 320, backgroundColor: BRAND.surface, borderRadius: 20, padding: 25 }}>
          <Text style={{ color: BRAND.text, fontSize: 18, fontWeight: "700", marginBottom: 6 }}>{action?.title}</Text>
          <Text style={{ color: BRAND.textSecondary, fontSize: 14, marginBottom: 20 }}>{action?.message}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pill label="Cancel" onPress={onDismiss} />
            <Pressable onPress={action?.onConfirm} style={({ pressed }) => ({ flex: 1, height: 44, borderRadius: 12, backgroundColor: BRAND.error, justifyContent: "center", alignItems: "center", opacity: pressed ? 0.8 : 1 })}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{action?.label}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
