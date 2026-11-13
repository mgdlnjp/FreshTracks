import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
  Alert,
  Modal,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { FAB } from "react-native-paper";
import { Audio } from "expo-av";
import Slider from "@react-native-community/slider";

// Thèmes
const darkTheme = {
  background: "#181A20",
  headerBg: "#23243A",
  card: "#23243A",
  text: "#fff",
  secondaryText: "#aaa",
  accent: "#6C63FF",
  danger: "#FF6C63",
  icon: "#fff",
  iconAccent: "#6C63FF",
  iconDanger: "#FF6C63",
};
const lightTheme = {
  background: "#f7f7f7",
  headerBg: "#e3e3e8",
  card: "#fff",
  text: "#181A20",
  secondaryText: "#555",
  accent: "#6C63FF",
  danger: "#FF6C63",
  icon: "#181A20",
  iconAccent: "#6C63FF",
  iconDanger: "#FF6C63",
};

// ProgressBar
const ProgressBar = React.memo(function ProgressBar({
  soundRef,
  duration,
  isPaused,
  playingId,
  onPauseResume,
  onSeek,
  theme,
  repeat,
  onToggleRepeat,
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval = null;
    let isMounted = true;
    if (playingId && soundRef.current) {
      interval = setInterval(async () => {
        if (soundRef.current) {
          const status = await soundRef.current.getStatusAsync();
          if (status.isLoaded) {
            setProgress(status.positionMillis || 0);
          }
        }
      }, 200);
    } else {
      setProgress(0);
    }
    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, [playingId, soundRef, duration]);

  useEffect(() => {
    if (!playingId) {
      setProgress(0);
    }
  }, [playingId, duration]);

  return (
    <View style={styles.progressInlineRow}>
      <TouchableOpacity
        onPress={onPauseResume}
        disabled={!playingId}
        style={styles.progressPauseBtn}
      >
        <Ionicons
          name={
            !playingId
              ? "pause-circle-outline"
              : isPaused
              ? "play-circle-outline"
              : "pause-circle-outline"
          }
          size={28}
          color={playingId ? theme.iconAccent : theme.secondaryText}
        />
      </TouchableOpacity>
      <Text style={[styles.progressTime, styles.hiddenTimer]} />
      <Slider
        style={styles.progressSliderInline}
        minimumValue={0}
        maximumValue={duration}
        value={progress}
        onSlidingComplete={onSeek}
        minimumTrackTintColor={theme.accent}
        maximumTrackTintColor={theme.secondaryText}
        thumbTintColor={theme.accent}
        disabled={!playingId}
      />
      <Text style={[styles.progressTime, styles.hiddenTimer]} />
      <TouchableOpacity
        onPress={onToggleRepeat}
        style={styles.repeatBtn}
        disabled={!playingId}
      >
        <Ionicons
          name={repeat ? "repeat" : "repeat-outline"}
          size={26}
          color={repeat ? theme.iconAccent : theme.secondaryText}
        />
      </TouchableOpacity>
    </View>
  );
});

// VolumeBar
const VolumeBar = React.memo(function VolumeBar({ soundRef, visible, onClose, theme }) {
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    let interval = null;
    let isMounted = true;
    if (visible && soundRef.current) {
      soundRef.current.getStatusAsync().then(status => {
        if (isMounted && status.isLoaded && typeof status.volume === "number") {
          setVolume(status.volume);
        }
      });
      interval = setInterval(async () => {
        if (soundRef.current) {
          const status = await soundRef.current.getStatusAsync();
          if (status.isLoaded && typeof status.volume === "number") {
            setVolume(status.volume);
          }
        }
      }, 300);
    }
    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, [visible, soundRef]);

  const handleVolumeChange = async (val) => {
    setVolume(val);
    if (soundRef.current) {
      try {
        await soundRef.current.setVolumeAsync(val);
      } catch (e) {}
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>
            Volume
          </Text>
          <Ionicons
            name="volume-high-outline"
            size={40}
            color={theme.iconAccent}
            style={{ alignSelf: "center", marginBottom: 16 }}
          />
          <Slider
            style={{ width: 220, height: 40, alignSelf: "center" }}
            minimumValue={0}
            maximumValue={1}
            value={volume}
            onValueChange={handleVolumeChange}
            minimumTrackTintColor={theme.accent}
            maximumTrackTintColor={theme.secondaryText}
            thumbTintColor={theme.accent}
            step={0.01}
          />
          <Text
            style={{ color: theme.text, alignSelf: "center", marginTop: 8 }}
          >
            {(volume * 100).toFixed(0)}%
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={{ alignSelf: "center", marginTop: 18 }}
          >
            <Text
              style={{
                color: theme.accent,
                fontWeight: "bold",
                fontSize: 16,
              }}
            >
              Fermer
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

export default function App() {
  const [tracks, setTracks] = useState([]);
  const [playingId, setPlayingId] = useState(null);
  const [isDark, setIsDark] = useState(true);
  const [showVolume, setShowVolume] = useState(false);
  const [duration, setDuration] = useState(1); // ms
  const [isPaused, setIsPaused] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const soundRef = useRef(null);

  // --- Correction repeat synchronisé ---
  const repeatRef = useRef(repeat);
  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);
  // -------------------------------------

  const theme = isDark ? darkTheme : lightTheme;

  // Lecture en background/veille
  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      playsInSilentModeIOS: true,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      shouldDuckIOS: true,
    });
  }, []);

  // Clear playlist
  const handleClearPlaylist = () => {
    Alert.alert(
      "Vider la playlist",
      "Es-tu sûr de vouloir supprimer tous les morceaux ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            setTracks([]);
            handleStop();
          },
        },
      ]
    );
  };

  // Suppression individuelle
  const handleDeleteTrack = (id) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
    if (playingId === id) handleStop();
  };

  // Ajout multiple de morceaux, robustesse contre structure et gestion erreurs
  const handleAddTrack = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["audio/*"], // CRUCIAL avec Expo SDK 48+
        copyToCacheDirectory: true,
        multiple: true,
      });
      console.log("Picker result:", res);
      if (!res.canceled && Array.isArray(res.assets) && res.assets.length > 0) {
        const newTracks = res.assets.map((file) => ({
          id: Date.now().toString() + Math.random().toString(36).slice(2),
          name: file.name,
          uri: file.uri,
        }));
        setTracks((prev) => [...newTracks, ...prev]);
      }
    } catch (e) {
      console.error("Erreur ajout musique:", e);
    }
  };

  // Lecture d'un morceau avec repeat prioritaire et auto-next
  const handlePlay = async (track) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: track.uri });
      soundRef.current = sound;
      setPlayingId(track.id);
      setDuration(1);
      setIsPaused(false);
      await sound.setVolumeAsync(1);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.isLoaded) {
          setDuration(status.durationMillis || 1);
          setIsPaused(!status.isPlaying && !status.didJustFinish);
        }
        if (status.didJustFinish) {
          if (repeatRef.current) {
            try {
              await sound.setPositionAsync(0);
              await sound.playAsync();
            } catch (e) {}
          } else {
            // Sinon, auto-next
            const idx = tracks.findIndex((t) => t.id === track.id);
            if (idx !== -1 && idx + 1 < tracks.length) {
              handlePlay(tracks[idx + 1]);
            } else {
              setPlayingId(null);
              setDuration(1);
              setIsPaused(false);
              sound.unloadAsync();
            }
          }
        }
      });
    } catch (e) {
      console.error("Erreur lecture musique:", e);
      setPlayingId(null);
      setDuration(1);
      setIsPaused(false);
    }
  };

  const handleToggleRepeat = () => setRepeat((prev) => !prev);

  const handleStop = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setPlayingId(null);
    setDuration(1);
    setIsPaused(false);
  };

  const handlePauseResume = async () => {
    if (soundRef.current && playingId) {
      if (isPaused) {
        await soundRef.current.playAsync();
        setIsPaused(false);
      } else {
        await soundRef.current.pauseAsync();
        setIsPaused(true);
      }
    }
  };

  const handleSeek = useCallback(
    async (val) => {
      if (soundRef.current && playingId) {
        try {
          await soundRef.current.setPositionAsync(val);
        } catch (e) {}
      }
    },
    [playingId]
  );

  const handleTrackPress = (item) => {
    if (playingId === item.id) {
      handleStop();
    } else {
      handlePlay(item);
    }
  };

  // Header sticky avec barre de progression classique optimisée
  const CustomHeader = () => (
    <View style={[styles.headerContainer, { backgroundColor: theme.headerBg }]}>
      <SafeAreaView>
        <View style={styles.headerRow}>
          <Text style={[styles.appName, { color: theme.text }]}>FreshTracks</Text>
          <View style={[styles.headerIconsRow, { marginBottom: 8 }]}>
            <TouchableOpacity
              onPress={() => setShowVolume(true)}
              style={styles.headerIcon}
            >
              <Ionicons
                name="volume-high-outline"
                size={26}
                color={theme.icon}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleClearPlaylist}
              style={styles.headerIcon}
            >
              <Ionicons name="trash-bin-outline" size={26} color={theme.icon} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsDark((v) => !v)}
              style={styles.headerIcon}
              accessibilityLabel="Changer de thème"
            >
              {isDark ? (
                <Ionicons name="sunny-outline" size={26} color={theme.icon} />
              ) : (
                <Ionicons name="moon-outline" size={26} color={theme.icon} />
              )}
            </TouchableOpacity>
          </View>
        </View>
        <ProgressBar
          soundRef={soundRef}
          duration={duration}
          isPaused={isPaused}
          playingId={playingId}
          onPauseResume={handlePauseResume}
          onSeek={handleSeek}
          theme={theme}
          repeat={repeat}
          onToggleRepeat={handleToggleRepeat}
        />
      </SafeAreaView>
    </View>
  );

  const renderTrack = ({ item }) => (
    <TouchableOpacity
      style={[styles.trackItem, { backgroundColor: theme.card }]}
      onPress={() => handleTrackPress(item)}
      activeOpacity={0.7}
    >
      {/* Icône suppression à gauche */}
      <TouchableOpacity
        onPress={() => handleDeleteTrack(item.id)}
        style={styles.deleteButton}
        activeOpacity={0.7}
      >
        <Ionicons name="trash-outline" size={24} color={theme.iconDanger} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={[styles.trackName, { color: theme.text }]}>{item.name}</Text>
      </View>
      {/* Icône play/stop à droite, sans fond */}
      <TouchableOpacity
        onPress={() => handleTrackPress(item)}
        style={styles.playButtonNoBg}
        activeOpacity={0.7}
      >
        <Ionicons
          name={playingId === item.id ? "stop" : "play"}
          size={28}
          color={theme.iconAccent}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const HEADER_HEIGHT = 140;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View
        style={[styles.headerBackground, { backgroundColor: theme.headerBg }]}
      />
      <View style={styles.stickyHeader}>
        <CustomHeader />
      </View>

      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        renderItem={renderTrack}
        contentContainerStyle={{
          paddingBottom: 100,
          paddingTop: HEADER_HEIGHT,
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="musical-notes-outline"
              size={80}
              color={theme.iconAccent}
              style={{ marginBottom: 20 }}
            />
            <Text style={[styles.emptyText, { color: theme.secondaryText }]}>
              Ajoute ta première musique !
            </Text>
          </View>
        }
        style={{ flex: 1 }}
      />

      <FAB
        style={[styles.fab, { backgroundColor: theme.accent }]}
        icon={({ size, color }) => (
          <MaterialCommunityIcons name="plus" color={color} size={size} />
        )}
        color="#fff"
        onPress={handleAddTrack}
        label="Ajouter"
      />

      <VolumeBar
        soundRef={soundRef}
        visible={showVolume}
        onClose={() => setShowVolume(false)}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) : 0,
  },
  headerBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    zIndex: 0,
  },
  stickyHeader: {
    position: "absolute",
    top: Platform.OS === "android" ? (StatusBar.currentHeight || 0) : 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerContainer: {
    zIndex: 1,
    paddingHorizontal: 12,
    paddingTop: 24,
    paddingBottom: 0,
    backgroundColor: "transparent",
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 0,
  },
  appName: {
    fontSize: 24,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  headerIconsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  headerIcon: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  progressInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  progressPauseBtn: {
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  progressSliderInline: {
    flex: 1,
    marginHorizontal: 8,
    height: 30,
  },
  progressTime: {
    fontSize: 12,
    width: 48,
    textAlign: "right",
  },
  hiddenTimer: {
    opacity: 0,
    width: 0,
    height: 0,
    margin: 0,
    padding: 0,
  },
  repeatBtn: {
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  listContainer: { flex: 1, padding: 18 },
  trackItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#23243A",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    marginHorizontal: 16,
  },
  deleteButton: {
    marginRight: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  playButtonNoBg: {
    marginLeft: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  trackName: { fontSize: 16, fontWeight: "600" },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 32,
    borderRadius: 32,
    elevation: 6,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
  },
  emptyText: { fontSize: 18, marginTop: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    width: 300,
    alignItems: "stretch",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    alignSelf: "center",
  },
});