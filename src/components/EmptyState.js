import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { font, radius, space } from "../theme";

export default function EmptyState({ theme, onAdd }) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.halo, { backgroundColor: theme.accentSoft }]}>
        <View style={[styles.disc, { backgroundColor: theme.accent }]}>
          <Ionicons name="musical-notes" size={36} color={theme.onAccent} />
        </View>
      </View>
      <Text style={[styles.title, { color: theme.text }]}>Ta playlist est vide</Text>
      <Text style={[styles.body, { color: theme.textMuted }]}>
        Importe des fichiers audio depuis ton téléphone. Ils restent dans l'app,
        même après l'avoir fermée.
      </Text>
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: theme.accent, shadowColor: theme.accent },
          pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        ]}
      >
        <Ionicons name="add" size={22} color={theme.onAccent} />
        <Text style={[styles.ctaText, { color: theme.onAccent }]}>Ajouter des morceaux</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
  },
  halo: {
    width: 128,
    height: 128,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.lg,
  },
  disc: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: font.xl,
    fontWeight: "700",
    marginBottom: space.sm,
  },
  body: {
    fontSize: font.base,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 300,
    marginBottom: space.lg,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    height: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.full,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  ctaText: { fontSize: font.lg, fontWeight: "700" },
});
