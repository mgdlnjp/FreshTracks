import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { font, formatSize, radius, space } from "../theme";

function TrackRow({ track, index, isCurrent, isPlaying, theme, onPress, onDelete }) {
  const meta = [track.format, formatSize(track.size)].filter(Boolean).join(" · ");

  return (
    <Pressable
      onPress={() => onPress(track)}
      onLongPress={() => onDelete(track)}
      accessibilityRole="button"
      accessibilityLabel={`${track.title}${isCurrent ? ", en cours" : ""}`}
      accessibilityHint="Appui long pour supprimer"
      style={({ pressed }) => [
        styles.row,
        isCurrent && { backgroundColor: theme.accentSoft },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View
        style={[
          styles.artwork,
          {
            backgroundColor: isCurrent ? theme.accent : theme.accentSoft,
            borderColor: isCurrent ? theme.accent : theme.accentSoftBorder,
          },
        ]}
      >
        {isCurrent ? (
          <Ionicons
            name={isPlaying ? "volume-high" : "pause"}
            size={20}
            color={theme.onAccent}
          />
        ) : (
          <Text style={[styles.index, { color: theme.accentText }]}>{index + 1}</Text>
        )}
      </View>

      <View style={styles.texts}>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: isCurrent ? theme.accentText : theme.text }]}
        >
          {track.title}
        </Text>
        {meta ? (
          <Text numberOfLines={1} style={[styles.meta, { color: theme.textMuted }]}>
            {meta}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={() => onDelete(track)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Supprimer ${track.title}`}
        style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.5 }]}
      >
        <Ionicons name="close" size={20} color={theme.textFaint} />
      </Pressable>
    </Pressable>
  );
}

export default React.memo(TrackRow);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
    paddingLeft: space.sm,
    paddingRight: space.xs,
    marginHorizontal: space.sm,
    borderRadius: radius.lg,
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  index: {
    fontSize: font.sm,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  texts: { flex: 1, gap: 2 },
  title: { fontSize: font.base, fontWeight: "600" },
  meta: { fontSize: font.sm },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
