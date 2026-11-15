import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { font, formatTime, radius, space } from "../theme";

function ControlButton({ icon, label, onPress, color, active, theme, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      style={({ pressed }) => [styles.ctrl, pressed && { opacity: 0.5 }, disabled && { opacity: 0.35 }]}
    >
      <Ionicons name={icon} size={24} color={color} />
      {active ? <View style={[styles.dot, { backgroundColor: theme.accent }]} /> : null}
    </Pressable>
  );
}

export default function NowPlaying({
  theme,
  track,
  position,
  total,
  status,
  shuffle,
  repeat,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onToggleShuffle,
  onCycleRepeat,
  bottomInset,
  video,
  onLayout,
}) {
  const [scrub, setScrub] = useState(null);
  const duration = status.duration > 0 ? status.duration : 0;
  const current = scrub ?? status.currentTime ?? 0;

  // Réinitialise le scrub si le morceau change.
  useEffect(() => setScrub(null), [track?.id]);

  if (!track) return null;

  const repeatIcon = "repeat";
  const sourceLabel = track.kind === "youtube" ? "YouTube · " : track.kind === "stream" ? "Streaming · " : "";
  const repeatLabel =
    repeat === "off" ? "Répéter : désactivé" : repeat === "all" ? "Répéter : tout" : "Répéter : ce morceau";

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.card,
        {
          backgroundColor: theme.surfaceRaised,
          borderColor: theme.border,
          shadowColor: theme.dark ? "#000" : "#1C1917",
          bottom: bottomInset + space.sm,
        },
      ]}
    >
      {video ? <View style={styles.video}>{video}</View> : null}
      <View style={styles.head}>
        {video ? null : (
          <View style={[styles.artwork, { backgroundColor: theme.accent }]}>
            <Ionicons
              name={track.kind === "stream" ? "radio" : "musical-note"}
              size={22}
              color={theme.onAccent}
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
            {track.title}
          </Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            {sourceLabel}
            {position} sur {total}
          </Text>
        </View>
      </View>

      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={Math.max(duration, 1)}
        value={current}
        onValueChange={setScrub}
        onSlidingComplete={(v) => {
          onSeek(v);
          setScrub(null);
        }}
        minimumTrackTintColor={theme.accent}
        maximumTrackTintColor={theme.track}
        thumbTintColor={theme.accent}
        disabled={!duration}
        accessibilityLabel="Position de lecture"
      />
      <View style={styles.times}>
        <Text style={[styles.time, { color: theme.textMuted }]}>{formatTime(current)}</Text>
        <Text style={[styles.time, { color: theme.textMuted }]}>
          -{formatTime(Math.max(duration - current, 0))}
        </Text>
      </View>

      <View style={styles.controls}>
        <ControlButton
          theme={theme}
          icon="shuffle"
          label={shuffle ? "Lecture aléatoire activée" : "Lecture aléatoire désactivée"}
          active={shuffle}
          color={shuffle ? theme.accentText : theme.textMuted}
          onPress={onToggleShuffle}
        />
        <ControlButton theme={theme} icon="play-skip-back" label="Précédent" color={theme.text} onPress={onPrev} />
        <Pressable
          onPress={onTogglePlay}
          accessibilityRole="button"
          accessibilityLabel={status.playing ? "Pause" : "Lecture"}
          style={({ pressed }) => [
            styles.playBtn,
            { backgroundColor: theme.accent, shadowColor: theme.accent },
            pressed && { transform: [{ scale: 0.94 }] },
          ]}
        >
          <Ionicons
            name={status.playing ? "pause" : "play"}
            size={28}
            color={theme.onAccent}
            style={!status.playing && { marginLeft: 3 }}
          />
        </Pressable>
        <ControlButton theme={theme} icon="play-skip-forward" label="Suivant" color={theme.text} onPress={onNext} />
        <View>
          <ControlButton
            theme={theme}
            icon={repeatIcon}
            label={repeatLabel}
            active={repeat !== "off"}
            color={repeat !== "off" ? theme.accentText : theme.textMuted}
            onPress={onCycleRepeat}
          />
          {repeat === "one" ? (
            <Text style={[styles.badge, { backgroundColor: theme.accent, color: theme.onAccent }]}>1</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    left: space.sm,
    right: space.sm,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: space.md,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  video: {
    borderRadius: radius.md,
    overflow: "hidden",
    marginBottom: space.md,
    backgroundColor: "#000",
  },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: font.base, fontWeight: "700" },
  sub: { fontSize: font.xs, marginTop: 2 },
  slider: { marginTop: space.sm, marginHorizontal: -space.xs, height: 32 },
  times: { flexDirection: "row", justifyContent: "space-between", marginTop: -space.xs },
  time: { fontSize: font.xs, fontVariant: ["tabular-nums"] },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.xs,
    paddingHorizontal: space.sm,
  },
  ctrl: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", bottom: 6, width: 4, height: 4, borderRadius: 2 },
  badge: {
    position: "absolute",
    top: 6,
    right: 4,
    fontSize: 10,
    fontWeight: "800",
    minWidth: 14,
    height: 14,
    lineHeight: 14,
    textAlign: "center",
    borderRadius: 7,
    overflow: "hidden",
  },
  playBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
});
