import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { font, radius, space } from "../theme";
import { parseLink, trackFromLink } from "../links";

function describe(link, theme) {
  switch (link.kind) {
    case "youtube":
      return {
        icon: "logo-youtube",
        color: theme.accentText,
        text: "Vidéo YouTube : elle se lit dans l'app, mais pas écran verrouillé.",
      };
    case "stream":
      return {
        icon: "radio-outline",
        color: theme.accentText,
        text: `Audio en streaming depuis ${link.host}.`,
      };
    case "locked":
      return {
        icon: "lock-closed-outline",
        color: theme.textMuted,
        text: `${link.service} protège ses morceaux : ils ne peuvent pas être lus ailleurs que dans leur app.`,
      };
    default:
      return {
        icon: "information-circle-outline",
        color: theme.textMuted,
        text: "Colle un lien YouTube ou l'adresse d'un fichier audio (https://…).",
      };
  }
}

function Option({ icon, title, subtitle, onPress, theme }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.option,
        { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.optionIcon, { backgroundColor: theme.accentSoft }]}>
        <Ionicons name={icon} size={22} color={theme.accentText} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.optionTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.optionSub, { color: theme.textMuted }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.textFaint} />
    </Pressable>
  );
}

export default function AddSheet({ visible, initialMode = "choose", theme, onClose, onPickFiles, onAddTrack }) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState(initialMode);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Le sélecteur de fichiers ne s'ouvre qu'une fois ce panneau complètement
  // fermé : deux fenêtres qui se chevauchent perturbent le sélecteur sur iOS.
  const pickAfterClose = useRef(false);
  const openPickerIfPending = () => {
    if (!pickAfterClose.current) return;
    pickAfterClose.current = false;
    onPickFiles();
  };
  const chooseFiles = () => {
    pickAfterClose.current = true;
    onClose();
    if (Platform.OS !== "ios") setTimeout(openPickerIfPending, 350);
  };

  const link = useMemo(() => parseLink(text), [text]);
  const canAdd = link.kind === "youtube" || link.kind === "stream";
  const info = describe(link, theme);

  useEffect(() => {
    if (!visible) return;
    setMode(initialMode);
    setText("");
    setError(null);
    setBusy(false);
  }, [visible, initialMode]);

  // En mode « lien », on récupère automatiquement un lien déjà copié.
  useEffect(() => {
    if (!visible || mode !== "link") return;
    let cancelled = false;
    (async () => {
      try {
        if (!(await Clipboard.hasStringAsync())) return;
        const clip = await Clipboard.getStringAsync();
        const parsed = parseLink(clip);
        if (!cancelled && parsed.kind !== "invalid") setText(clip.trim());
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, mode]);

  const paste = async () => {
    try {
      const clip = await Clipboard.getStringAsync();
      if (clip) setText(clip.trim());
    } catch {}
  };

  const submit = async () => {
    if (!canAdd || busy) return;
    setBusy(true);
    setError(null);
    try {
      const track = await trackFromLink(link);
      onAddTrack(track);
      onClose();
    } catch (e) {
      setError(e.message || "Impossible d'ajouter ce lien.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={openPickerIfPending}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetWrap}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.background, paddingBottom: insets.bottom + space.md },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />

          {mode === "choose" ? (
            <>
              <Text style={[styles.title, { color: theme.text }]}>Ajouter à la playlist</Text>
              <View style={{ gap: space.sm }}>
                <Option
                  theme={theme}
                  icon="folder-open-outline"
                  title="Fichiers du téléphone"
                  subtitle={
                    Platform.OS === "ios"
                      ? "Plusieurs à la fois : touche « Sélectionner » en haut à droite"
                      : "Plusieurs à la fois : appui long sur un fichier"
                  }
                  onPress={chooseFiles}
                />
                <Option
                  theme={theme}
                  icon="link-outline"
                  title="Lien"
                  subtitle="YouTube, Dropbox, Drive, podcast, radio…"
                  onPress={() => setMode("link")}
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.linkHead}>
                {initialMode === "choose" ? (
                  <Pressable
                    onPress={() => setMode("choose")}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Retour"
                    style={styles.back}
                  >
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                  </Pressable>
                ) : null}
                <Text style={[styles.title, { color: theme.text, marginBottom: 0 }]}>Ajouter un lien</Text>
              </View>

              <View
                style={[
                  styles.inputRow,
                  { backgroundColor: theme.surface, borderColor: canAdd ? theme.accent : theme.border },
                ]}
              >
                <TextInput
                  value={text}
                  onChangeText={(t) => {
                    setText(t);
                    setError(null);
                  }}
                  placeholder="https://youtu.be/…"
                  placeholderTextColor={theme.textFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="done"
                  onSubmitEditing={submit}
                  style={[styles.input, { color: theme.text }]}
                  accessibilityLabel="Lien à ajouter"
                />
                {text ? (
                  <Pressable onPress={() => setText("")} hitSlop={8} accessibilityLabel="Effacer">
                    <Ionicons name="close-circle" size={20} color={theme.textFaint} />
                  </Pressable>
                ) : (
                  <Pressable onPress={paste} hitSlop={8} accessibilityRole="button">
                    <Text style={[styles.pasteText, { color: theme.accentText }]}>Coller</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.hint}>
                <Ionicons name={info.icon} size={16} color={info.color} style={{ marginTop: 2 }} />
                <Text style={[styles.hintText, { color: theme.textMuted }]}>{error || info.text}</Text>
              </View>

              <Pressable
                onPress={submit}
                disabled={!canAdd || busy}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canAdd || busy }}
                style={({ pressed }) => [
                  styles.cta,
                  { backgroundColor: canAdd ? theme.accent : theme.track },
                  pressed && { opacity: 0.85 },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={theme.onAccent} />
                ) : (
                  <Text style={[styles.ctaText, { color: canAdd ? theme.onAccent : theme.textMuted }]}>
                    Ajouter
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(12, 10, 9, 0.5)" },
  sheetWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: space.md,
  },
  title: { fontSize: font.xl, fontWeight: "700", marginBottom: space.md },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTitle: { fontSize: font.base, fontWeight: "600" },
  optionSub: { fontSize: font.sm, marginTop: 2 },
  linkHead: { flexDirection: "row", alignItems: "center", gap: space.xs, marginBottom: space.md },
  back: { width: 32, height: 44, justifyContent: "center", marginLeft: -space.xs },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: space.md,
  },
  input: { flex: 1, fontSize: font.base, height: "100%" },
  pasteText: { fontSize: font.sm, fontWeight: "700" },
  hint: { flexDirection: "row", gap: space.sm, marginTop: space.sm, marginBottom: space.lg, minHeight: 40 },
  hintText: { flex: 1, fontSize: font.sm, lineHeight: 20 },
  cta: {
    height: 52,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontSize: font.lg, fontWeight: "700" },
});
