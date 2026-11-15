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

function RepeatButton({ repeat, theme, onPress }) {
  const label =
    repeat === "off" ? "Répéter : désactivé" : repeat === "all" ? "Répéter : tout" : "Répéter : ce morceau";
  return (
    <View>
      <ControlButton
        theme={theme}
        icon="repeat"
        label={label}
        active={repeat !== "off"}
        color={repeat !== "off" ? theme.accentText : theme.textMuted}
        onPress={onPress}
      />
      {repeat === "one" ? (
        <Text style={[styles.badge, { backgroundColor: theme.accent, color: theme.onAccent }]}>1</Text>
      ) : null}
    </View>
  );
}

function ShuffleButton({ shuffle, theme, onPress }) {
  return (
    <ControlButton
      theme={theme}
      icon="shuffle"
      label={shuffle ? "Lecture aléatoire activée" : "Lecture aléatoire désactivée"}
      active={shuffle}
      color={shuffle ? theme.accentText : theme.textMuted}
      onPress={onPress}
    />
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
  onClose,
}) {
  const [scrub, setScrub] = useState(null);

  // Réinitialise le scrub si le morceau change.
  useEffect(() => setScrub(null), [track?.id]);

  // Panneau toujours ouvert : sans morceau en cours, il reste prêt à jouer
  // (lecture lance le premier morceau, ou un au hasard en aléatoire).
  const idle = !track;
  const duration = !idle && status.duration > 0 ? status.duration : 0;
  const current = idle ? 0 : scrub ?? status.currentTime ?? 0;
  const shown = track ?? { title: "Prêt à jouer", kind: "file" };
  const sourceLabel = shown.kind === "youtube" ? "YouTube · " : shown.kind === "stream" ? "Streaming · " : "";
  const subtitle = idle
    ? `${total} morceau${total > 1 ? "x" : ""} · touche lecture ou un titre`
    : `${sourceLabel}${position} sur ${total}`;

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
          <View
            style={[
              styles.artwork,
              { backgroundColor: idle ? theme.accentSoft : theme.accent },
            ]}
          >
            <Ionicons
              name={shown.kind === "stream" ? "radio" : "musical-note"}
              size={22}
              color={idle ? theme.accentText : theme.onAccent}
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
            {shown.title}
          </Text>
          <Text numberOfLines={1} style={[styles.sub, { color: theme.textMuted }]}>
            {subtitle}
          </Text>
        </View>
        {video ? (
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Fermer la vidéo"
            style={({ pressed }) => [styles.close, { backgroundColor: theme.background }, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="close" size={20} color={theme.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* Vidéo YouTube : lecture/pause et avance se font sur la vidéo ;
          on garde la navigation dans la playlist. */}
      {video ? (
        <View style={[styles.videoControls, { borderTopColor: theme.border }]}>
          <ShuffleButton shuffle={shuffle} theme={theme} onPress={onToggleShuffle} />
          <View style={styles.skipGroup}>
            <ControlButton theme={theme} icon="play-skip-back" label="Précédent" color={theme.text} onPress={onPrev} />
            <ControlButton theme={theme} icon="play-skip-forward" label="Suivant" color={theme.text} onPress={onNext} />
          </View>
          <RepeatButton repeat={repeat} theme={theme} onPress={onCycleRepeat} />
        </View>
      ) : (
      <>
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
        <ShuffleButton shuffle={shuffle} theme={theme} onPress={onToggleShuffle} />
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
        <RepeatButton repeat={repeat} theme={theme} onPress={onCycleRepeat} />
      </View>
      </>
      )}
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
    paddingBottom: space.md,
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
  videoControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.md,
    paddingTop: space.sm,
    paddingHorizontal: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  skipGroup: { flexDirection: "row", gap: space.lg },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
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
