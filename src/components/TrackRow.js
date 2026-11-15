import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { font, formatSize, radius, space } from "../theme";

const SOURCE = {
  youtube: { icon: "logo-youtube", label: "YouTube" },
  stream: { icon: "radio-outline", label: "Streaming" },
};

function TrackRow({ track, index, isCurrent, isPlaying, theme, onPress, onDelete }) {
  const source = SOURCE[track.kind];
  const meta = track.missing
    ? "Fichier introuvable · à réimporter"
    : source
    ? [source.label, track.author].filter(Boolean).join(" · ")
    : [track.format, formatSize(track.size)].filter(Boolean).join(" · ");

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
        track.missing && { opacity: 0.5 },
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
        {track.thumbnail ? (
          <Image source={{ uri: track.thumbnail }} style={styles.thumb} resizeMode="cover" />
        ) : null}
        {isCurrent ? (
          <View style={[styles.currentOverlay, track.thumbnail && styles.thumbOverlay]}>
            <Ionicons
              name={isPlaying ? "volume-high" : "pause"}
              size={20}
              color={track.thumbnail ? "#FFFFFF" : theme.onAccent}
            />
          </View>
        ) : track.thumbnail ? null : (
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
          <View style={styles.metaRow}>
            {source ? <Ionicons name={source.icon} size={14} color={theme.textMuted} /> : null}
            <Text numberOfLines={1} style={[styles.meta, { color: theme.textMuted }]}>
              {meta}
            </Text>
          </View>
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
    overflow: "hidden",
  },
  thumb: { ...StyleSheet.absoluteFillObject },
  currentOverlay: { alignItems: "center", justifyContent: "center" },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(12, 10, 9, 0.55)",
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  index: {
    fontSize: font.sm,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  texts: { flex: 1, gap: 2 },
  title: { fontSize: font.base, fontWeight: "600" },
  meta: { fontSize: font.sm, flexShrink: 1 },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
