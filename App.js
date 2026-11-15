import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as SystemUI from "expo-system-ui";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

import { font, formatSize, radius, space, useTheme } from "./src/theme";
import { deleteTrackFile, importAssets, loadLibrary, saveLibrary } from "./src/library";
import TrackRow from "./src/components/TrackRow";
import EmptyState from "./src/components/EmptyState";
import NowPlaying from "./src/components/NowPlaying";

const NOW_PLAYING_HEIGHT = 210;
const REPEAT_CYCLE = { off: "all", all: "one", one: "off" };

function tap() {
  Haptics.selectionAsync().catch(() => {});
}

function Player() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [tracks, setTracks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState("off");

  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  // Refs pour toujours lire l'état à jour dans les callbacks audio.
  const tracksRef = useRef(tracks);
  const currentIdRef = useRef(currentId);
  tracksRef.current = tracks;
  currentIdRef.current = currentId;

  const currentIndex = tracks.findIndex((t) => t.id === currentId);
  const currentTrack = currentIndex >= 0 ? tracks[currentIndex] : null;

  // --- Initialisation -------------------------------------------------------
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    }).catch(() => {});
    loadLibrary().then((lib) => {
      setTracks(lib);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) saveLibrary(tracks);
  }, [tracks, loaded]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.background).catch(() => {});
  }, [theme.background]);

  useEffect(() => {
    player.loop = repeat === "one";
  }, [player, repeat]);

  // --- Lecture --------------------------------------------------------------
  const playTrack = useCallback(
    (track) => {
      player.replace({ uri: track.uri });
      player.play();
      setCurrentId(track.id);
      try {
        player.setActiveForLockScreen(true, { title: track.title, artist: "FreshTracks" });
      } catch {}
    },
    [player]
  );

  const pickNext = useCallback(
    (direction, { auto = false } = {}) => {
      const list = tracksRef.current;
      if (!list.length) return null;
      const idx = list.findIndex((t) => t.id === currentIdRef.current);
      if (shuffle && list.length > 1 && direction > 0) {
        let r = idx;
        while (r === idx) r = Math.floor(Math.random() * list.length);
        return list[r];
      }
      const target = idx + direction;
      if (target >= list.length) return auto && repeat === "off" ? null : list[0];
      if (target < 0) return list[list.length - 1];
      return list[target];
    },
    [shuffle, repeat]
  );

  const handleNext = useCallback(
    (opts) => {
      const next = pickNext(1, opts);
      if (next) {
        playTrack(next);
      } else {
        // Fin de la playlist : on s'arrête au début du dernier morceau.
        player.pause();
        player.seekTo(0).catch(() => {});
      }
    },
    [pickNext, playTrack, player]
  );

  const handlePrev = useCallback(() => {
    tap();
    if (status.currentTime > 3) {
      player.seekTo(0).catch(() => {});
      return;
    }
    const prev = pickNext(-1);
    if (prev) playTrack(prev);
  }, [status.currentTime, pickNext, playTrack, player]);

  useEffect(() => {
    if (status.didJustFinish && repeat !== "one") handleNext({ auto: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.didJustFinish]);

  const handleTogglePlay = useCallback(() => {
    tap();
    if (!currentTrack) {
      if (tracks.length) playTrack(shuffle ? tracks[Math.floor(Math.random() * tracks.length)] : tracks[0]);
      return;
    }
    if (status.playing) {
      player.pause();
    } else {
      if (status.duration > 0 && status.currentTime >= status.duration - 0.5) {
        player.seekTo(0).catch(() => {});
      }
      player.play();
    }
  }, [currentTrack, tracks, shuffle, status, player, playTrack]);

  const handleRowPress = useCallback(
    (track) => {
      tap();
      if (track.id === currentIdRef.current) {
        status.playing ? player.pause() : player.play();
      } else {
        playTrack(track);
      }
    },
    [status.playing, player, playTrack]
  );

  const handleSeek = useCallback((sec) => player.seekTo(sec).catch(() => {}), [player]);

  // --- Bibliothèque ---------------------------------------------------------
  const stopPlayback = useCallback(() => {
    player.pause();
    setCurrentId(null);
    try {
      player.clearLockScreenControls();
    } catch {}
  }, [player]);

  const handleAdd = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["audio/*"],
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (res.canceled || !res.assets?.length) return;
      const imported = await importAssets(res.assets);
      setTracks((prev) => [...prev, ...imported]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      Alert.alert("Import impossible", "Ce fichier n'a pas pu être ajouté.");
      console.warn(e);
    }
  }, []);

  const handleDelete = useCallback(
    (track) => {
      Alert.alert("Retirer ce morceau ?", track.title, [
        { text: "Annuler", style: "cancel" },
        {
          text: "Retirer",
          style: "destructive",
          onPress: () => {
            if (track.id === currentIdRef.current) stopPlayback();
            deleteTrackFile(track);
            setTracks((prev) => prev.filter((t) => t.id !== track.id));
          },
        },
      ]);
    },
    [stopPlayback]
  );

  const handleClearAll = useCallback(() => {
    Alert.alert("Vider la playlist ?", "Tous les morceaux seront retirés de l'app.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Tout retirer",
        style: "destructive",
        onPress: () => {
          stopPlayback();
          tracksRef.current.forEach(deleteTrackFile);
          setTracks([]);
        },
      },
    ]);
  }, [stopPlayback]);

  // --- Rendu ----------------------------------------------------------------
  const totalSize = useMemo(() => tracks.reduce((s, t) => s + (t.size || 0), 0), [tracks]);
  const subtitle = tracks.length
    ? [`${tracks.length} morceau${tracks.length > 1 ? "x" : ""}`, formatSize(totalSize)]
        .filter(Boolean)
        .join(" · ")
    : "Ton lecteur audio de poche";

  const renderItem = useCallback(
    ({ item, index }) => (
      <TrackRow
        track={item}
        index={index}
        isCurrent={item.id === currentId}
        isPlaying={item.id === currentId && status.playing}
        theme={theme}
        onPress={handleRowPress}
        onDelete={handleDelete}
      />
    ),
    [currentId, status.playing, theme, handleRowPress, handleDelete]
  );

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + space.lg }]}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.appName, { color: theme.text }]}>
            Fresh<Text style={{ color: theme.accentText }}>Tracks</Text>
          </Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
        </View>
        {tracks.length ? (
          <Pressable
            onPress={handleAdd}
            accessibilityRole="button"
            accessibilityLabel="Ajouter des morceaux"
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="add" size={26} color={theme.accentText} />
          </Pressable>
        ) : null}
      </View>

      {tracks.length ? (
        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              tap();
              setShuffle(false);
              playTrack(tracks[0]);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.pill,
              { backgroundColor: theme.accent },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="play" size={18} color={theme.onAccent} />
            <Text style={[styles.pillText, { color: theme.onAccent }]}>Tout lire</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              tap();
              setShuffle(true);
              playTrack(tracks[Math.floor(Math.random() * tracks.length)]);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.pill,
              { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="shuffle" size={18} color={theme.accentText} />
            <Text style={[styles.pillText, { color: theme.text }]}>Aléatoire</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const footer = tracks.length ? (
    <Pressable onPress={handleClearAll} accessibilityRole="button" style={styles.clearBtn} hitSlop={8}>
      <Text style={[styles.clearText, { color: theme.textFaint }]}>Vider la playlist</Text>
    </Pressable>
  ) : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar style={theme.dark ? "light" : "dark"} />

      <FlatList
        data={tracks}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={loaded ? <EmptyState theme={theme} onAdd={handleAdd} /> : null}
        contentContainerStyle={{
          paddingBottom: (currentTrack ? NOW_PLAYING_HEIGHT : 0) + insets.bottom + space.xl,
        }}
        ItemSeparatorComponent={() => <View style={{ height: space.xs }} />}
        showsVerticalScrollIndicator={false}
      />

      {/* Bandeau derrière la barre d'état pour que la liste ne passe pas dessous. */}
      <View
        pointerEvents="none"
        style={[styles.statusScrim, { height: insets.top, backgroundColor: theme.background }]}
      />

      <NowPlaying
        theme={theme}
        track={currentTrack}
        position={currentIndex + 1}
        total={tracks.length}
        status={status}
        shuffle={shuffle}
        repeat={repeat}
        onTogglePlay={handleTogglePlay}
        onPrev={handlePrev}
        onNext={() => {
          tap();
          handleNext();
        }}
        onSeek={handleSeek}
        onToggleShuffle={() => {
          tap();
          setShuffle((s) => !s);
        }}
        onCycleRepeat={() => {
          tap();
          setRepeat((r) => REPEAT_CYCLE[r]);
        }}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Player />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  statusScrim: { position: "absolute", top: 0, left: 0, right: 0 },
  header: {
    paddingHorizontal: space.md,
    paddingBottom: space.md,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  appName: {
    fontSize: font.display,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  subtitle: { fontSize: font.sm, marginTop: space.xs },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.lg,
  },
  pill: {
    flex: 1,
    height: 48,
    borderRadius: radius.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  pillText: { fontSize: font.base, fontWeight: "700" },
  clearBtn: { alignSelf: "center", paddingVertical: space.lg },
  clearText: { fontSize: font.sm, fontWeight: "500" },
});
