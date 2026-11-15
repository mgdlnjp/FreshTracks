import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as SystemUI from "expo-system-ui";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import YoutubePlayer from "react-native-youtube-iframe";

import { font, formatSize, radius, space, useTheme } from "./src/theme";
import { deleteTrackFile, describeStorage, importAssets, loadLibrary, saveLibrary } from "./src/library";
import TrackRow from "./src/components/TrackRow";
import EmptyState from "./src/components/EmptyState";
import NowPlaying from "./src/components/NowPlaying";
import AddSheet from "./src/components/AddSheet";

const REPEAT_CYCLE = { off: "all", all: "one", one: "off" };

function tap() {
  Haptics.selectionAsync().catch(() => {});
}

function Player() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [tracks, setTracks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState("off");
  const [sheet, setSheet] = useState({ visible: false, mode: "choose" });
  const [cardHeight, setCardHeight] = useState(0);

  // Lecteur audio (fichiers + streaming)
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const audioStatus = useAudioPlayerStatus(player);

  // Lecteur YouTube (iframe officielle)
  // ytPlaying = ce qu'on demande au lecteur ; ytState = ce qu'il fait vraiment.
  const ytRef = useRef(null);
  const [ytPlaying, setYtPlaying] = useState(false);
  const [ytState, setYtState] = useState("unstarted");
  const [ytTime, setYtTime] = useState(0);
  const [ytDuration, setYtDuration] = useState(0);
  const ytActuallyPlaying = ytState === "playing" || ytState === "buffering";

  // Refs pour toujours lire l'état à jour dans les callbacks.
  const tracksRef = useRef(tracks);
  const currentIdRef = useRef(currentId);
  tracksRef.current = tracks;
  currentIdRef.current = currentId;

  const currentIndex = tracks.findIndex((t) => t.id === currentId);
  const currentTrack = currentIndex >= 0 ? tracks[currentIndex] : null;
  const isYT = currentTrack?.kind === "youtube";

  // État de lecture unifié pour l'interface.
  const status = isYT
    ? { playing: ytActuallyPlaying, currentTime: ytTime, duration: ytDuration }
    : {
        playing: audioStatus.playing,
        currentTime: audioStatus.currentTime,
        duration: audioStatus.duration,
      };

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

  // Position de la vidéo YouTube (l'iframe ne pousse pas de mises à jour).
  useEffect(() => {
    if (!isYT || !ytPlaying) return;
    const id = setInterval(async () => {
      try {
        const [t, d] = await Promise.all([
          ytRef.current?.getCurrentTime(),
          ytRef.current?.getDuration(),
        ]);
        if (Number.isFinite(t)) setYtTime(t);
        if (Number.isFinite(d) && d > 0) setYtDuration(d);
      } catch {}
    }, 500);
    return () => clearInterval(id);
  }, [isYT, ytPlaying]);

  // Demande la lecture YouTube. Si la demande était déjà « en cours » (bloquée),
  // on la relance pour renvoyer réellement l'ordre au lecteur.
  const ytPlayingRef = useRef(ytPlaying);
  ytPlayingRef.current = ytPlaying;
  const requestYtPlay = useCallback(() => {
    if (ytPlayingRef.current) {
      setYtPlaying(false);
      setTimeout(() => setYtPlaying(true), 60);
    } else {
      setYtPlaying(true);
    }
  }, []);

  // --- Lecture --------------------------------------------------------------
  const playTrack = useCallback(
    (track) => {
      if (track.missing) {
        Alert.alert(
          "Fichier introuvable",
          `« ${track.title} » n'est plus sur le téléphone. Retire-le et ajoute-le de nouveau.`
        );
        return;
      }
      if (track.kind === "youtube") {
        player.pause();
        try {
          player.clearLockScreenControls();
        } catch {}
        setYtTime(0);
        setYtDuration(0);
        setYtState("unstarted");
        setYtPlaying(true);
        setCurrentId(track.id);
        return;
      }
      setYtPlaying(false);
      player.replace({ uri: track.uri });
      player.play();
      setCurrentId(track.id);
      try {
        player.setActiveForLockScreen(true, {
          title: track.title,
          artist: track.author || "FreshTracks",
        });
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

  const seekTo = useCallback(
    (sec) => {
      if (isYT) {
        ytRef.current?.seekTo(sec, true);
        setYtTime(sec);
      } else {
        player.seekTo(sec).catch(() => {});
      }
    },
    [isYT, player]
  );

  const handleNext = useCallback(
    (opts) => {
      const next = pickNext(1, opts);
      if (next) {
        playTrack(next);
      } else {
        // Fin de la playlist : on s'arrête au début du dernier morceau.
        if (isYT) setYtPlaying(false);
        else player.pause();
        seekTo(0);
      }
    },
    [pickNext, playTrack, player, isYT, seekTo]
  );

  const handlePrev = useCallback(() => {
    tap();
    if (status.currentTime > 3) {
      seekTo(0);
      return;
    }
    const prev = pickNext(-1);
    if (prev) playTrack(prev);
  }, [status.currentTime, pickNext, playTrack, seekTo]);

  // Fin d'un fichier / flux audio.
  useEffect(() => {
    if (!isYT && audioStatus.didJustFinish && repeat !== "one") handleNext({ auto: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioStatus.didJustFinish]);

  // Événements de l'iframe YouTube.
  const onYoutubeState = useCallback(
    (state) => {
      setYtState(state);
      if (state === "playing") setYtPlaying(true);
      else if (state === "paused") setYtPlaying(false);
      else if (state === "ended") {
        if (repeat === "one") {
          ytRef.current?.seekTo(0, true);
          requestYtPlay();
        } else {
          handleNext({ auto: true });
        }
      }
    },
    [repeat, handleNext, requestYtPlay]
  );

  const onYoutubeError = useCallback(
    (err) => {
      setYtPlaying(false);
      const embed = /embed|150|101/i.test(String(err));
      Alert.alert(
        "Vidéo indisponible",
        embed
          ? "Son auteur interdit la lecture en dehors de YouTube."
          : "Cette vidéo n'a pas pu être lue.",
        [{ text: "Passer au suivant", onPress: () => handleNext({ auto: true }) }, { text: "OK" }]
      );
    },
    [handleNext]
  );

  const setPlaying = useCallback(
    (shouldPlay) => {
      if (isYT) {
        if (shouldPlay) requestYtPlay();
        else setYtPlaying(false);
        return;
      }
      if (shouldPlay) {
        if (audioStatus.duration > 0 && audioStatus.currentTime >= audioStatus.duration - 0.5) {
          player.seekTo(0).catch(() => {});
        }
        player.play();
      } else {
        player.pause();
      }
    },
    [isYT, audioStatus.duration, audioStatus.currentTime, player, requestYtPlay]
  );

  const handleTogglePlay = useCallback(() => {
    tap();
    if (!currentTrack) {
      if (tracks.length) playTrack(shuffle ? tracks[Math.floor(Math.random() * tracks.length)] : tracks[0]);
      return;
    }
    setPlaying(!status.playing);
  }, [currentTrack, tracks, shuffle, status.playing, playTrack, setPlaying]);

  const handleRowPress = useCallback(
    (track) => {
      tap();
      if (track.id === currentIdRef.current) setPlaying(!status.playing);
      else playTrack(track);
    },
    [status.playing, setPlaying, playTrack]
  );

  // --- Bibliothèque ---------------------------------------------------------
  const stopPlayback = useCallback(() => {
    player.pause();
    setYtPlaying(false);
    setCurrentId(null);
    try {
      player.clearLockScreenControls();
    } catch {}
  }, [player]);

  const openSheet = useCallback((mode = "choose") => {
    tap();
    setSheet({ visible: true, mode });
  }, []);

  const handlePickFiles = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["audio/*"],
        // iOS : le sélecteur fournit déjà une copie du fichier. Passer par le
        // cache d'Expo Go la place dans un dossier que le module de fichiers
        // n'a pas le droit de lire (« permission manquante »).
        copyToCacheDirectory: Platform.OS !== "ios",
        multiple: true,
      });
      if (res.canceled || !res.assets?.length) return;
      const { imported, failed } = await importAssets(res.assets);
      // Les derniers ajouts passent en tête de playlist.
      if (imported.length) {
        setTracks((prev) => [...imported, ...prev]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      if (failed.length) {
        Alert.alert(
          failed.length > 1 ? `${failed.length} fichiers non ajoutés` : "Fichier non ajouté",
          `${failed.map((f) => `${f.name}\n→ ${f.reason}`).join("\n\n")}`
        );
      }
    } catch (e) {
      Alert.alert("Import impossible", "Ce fichier n'a pas pu être ajouté.");
      console.warn(e);
    }
  }, []);

  const handleAddTrack = useCallback((track) => {
    setTracks((prev) => [track, ...prev]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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
          <Text
            style={[styles.appName, { color: theme.text }]}
            // Diagnostic en développement : appui long sur le titre.
            onLongPress={
              __DEV__
                ? async () => Alert.alert("Diagnostic stockage", await describeStorage())
                : undefined
            }
          >
            Fresh<Text style={{ color: theme.accentText }}>Tracks</Text>
          </Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
        </View>
        {tracks.length ? (
          <Pressable
            onPress={() => openSheet("choose")}
            accessibilityRole="button"
            accessibilityLabel="Ajouter des morceaux ou un lien"
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

  // Largeur de la vidéo = carte (écran − 2×8) − padding (2×16).
  const videoWidth = width - space.sm * 2 - space.md * 2;
  // Vidéo YouTube pilotée directement (ses propres contrôles), sans nos boutons.
  // YouTube impose un lecteur visible d'au moins 200 px de haut.
  const video = isYT ? (
    <YoutubePlayer
      ref={ytRef}
      width={videoWidth}
      height={Math.max(200, Math.round((videoWidth * 9) / 16))}
      videoId={currentTrack.videoId}
      play={ytPlaying}
      onChangeState={onYoutubeState}
      onError={onYoutubeError}
      initialPlayerParams={{ controls: true, modestbranding: true, rel: false }}
      webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false }}
    />
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
        ListEmptyComponent={loaded ? <EmptyState theme={theme} onAdd={() => openSheet("choose")} /> : null}
        contentContainerStyle={{
          paddingBottom: (currentTrack ? cardHeight + space.sm : 0) + insets.bottom + space.xl,
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
        video={video}
        onClose={() => {
          tap();
          stopPlayback();
        }}
        onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}
        onTogglePlay={handleTogglePlay}
        onPrev={handlePrev}
        onNext={() => {
          tap();
          handleNext();
        }}
        onSeek={seekTo}
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

      <AddSheet
        visible={sheet.visible}
        initialMode={sheet.mode}
        theme={theme}
        onClose={() => setSheet((s) => ({ ...s, visible: false }))}
        onPickFiles={handlePickFiles}
        onAddTrack={handleAddTrack}
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
