import AsyncStorage from "@react-native-async-storage/async-storage";
// API « legacy » d'expo-file-system : ses règles d'accès sont les mêmes que
// celles du sélecteur de fichiers. Avec la nouvelle API, Expo Go sur iOS
// refuse de lire les fichiers choisis (« Missing 'READ' permission »).
import * as FS from "expo-file-system/legacy";

const STORAGE_KEY = "freshtracks:library:v2";

function tracksDirUri() {
  return `${FS.documentDirectory}tracks/`;
}

async function ensureTracksDir() {
  const dir = tracksDirUri();
  const info = await FS.getInfoAsync(dir);
  if (!info.exists) await FS.makeDirectoryAsync(dir, { intermediates: true });
  return dir;
}

async function exists(uri) {
  try {
    return (await FS.getInfoAsync(uri)).exists;
  } catch {
    return false;
  }
}

// On mémorise le NOM du fichier copié, pas son chemin complet : sur iPhone
// (et dans Expo Go) le chemin du dossier de l'app peut changer d'un lancement
// à l'autre.
function storedFileName(track) {
  if (track.fileName) return track.fileName;
  const m = track.uri?.match(/\/tracks\/([^/?#]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function resolveUri(track) {
  const name = storedFileName(track);
  if (name) {
    const uri = tracksDirUri() + encodeURIComponent(name);
    if (await exists(uri)) return uri;
  }
  if (track.uri && (await exists(track.uri))) return track.uri;
  return null;
}

function prettyName(fileName) {
  const base = fileName.replace(/\.[^.]+$/, "");
  return base.replace(/[_]+/g, " ").trim() || fileName;
}

function extension(fileName) {
  const m = fileName.match(/\.([^.]+)$/);
  return m ? m[1].toUpperCase() : "AUDIO";
}

// Fichiers présents dans le dossier de l'app mais absents de la playlist
// (perdus par une ancienne version) : on les remet dans la playlist.
async function recoverOrphans(known) {
  const names = new Set(known.map((t) => t.fileName).filter(Boolean));
  const recovered = [];
  try {
    const dir = await ensureTracksDir();
    for (const name of await FS.readDirectoryAsync(dir)) {
      if (names.has(name)) continue;
      const uri = dir + encodeURIComponent(name);
      const info = await FS.getInfoAsync(uri);
      if (!info.exists || info.isDirectory) continue;
      const original = name.replace(/^[a-z0-9]+-/i, "");
      recovered.push({
        id: `r${Math.random().toString(36).slice(2, 10)}`,
        kind: "file",
        title: prettyName(original),
        format: extension(original),
        size: info.size ?? null,
        uri,
        fileName: name,
        addedAt: info.modificationTime ? info.modificationTime * 1000 : 0,
      });
    }
  } catch (e) {
    console.warn("Récupération des fichiers impossible :", e);
  }
  return recovered;
}

export async function loadLibrary() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : [];
    const tracks = await Promise.all(
      stored.map(async (t) => {
        if (t.kind && t.kind !== "file") return t; // YouTube / streaming
        const uri = await resolveUri(t);
        if (!uri) return { ...t, kind: "file", missing: true };
        return { ...t, kind: "file", uri, fileName: storedFileName(t), missing: false };
      })
    );
    // On garde l'ordre enregistré (l'utilisateur peut réordonner la playlist) ;
    // les fichiers récupérés vont à la fin, du plus récent au plus ancien.
    const orphans = (await recoverOrphans(tracks)).sort(
      (a, b) => (b.addedAt || 0) - (a.addedAt || 0)
    );
    return [...tracks, ...orphans];
  } catch (e) {
    console.warn("Chargement de la bibliothèque impossible :", e);
    return [];
  }
}

export async function saveLibrary(tracks) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tracks));
  } catch (e) {
    console.warn("Sauvegarde de la bibliothèque impossible :", e);
  }
}

// Copie les fichiers choisis dans le dossier de l'app pour qu'ils restent
// disponibles après fermeture, puis renvoie les morceaux prêts à l'emploi.
export async function importAssets(assets) {
  const dir = await ensureTracksDir();
  const imported = [];
  const failed = [];
  // Même date pour tout le lot : les fichiers gardent l'ordre de sélection.
  const batchAt = Date.now();
  for (const asset of assets) {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const name = asset.name || "audio";
    const fileName = `${id}-${name.replace(/[^\w.\-]+/g, "_")}`;
    const dest = dir + fileName;
    try {
      await FS.copyAsync({ from: asset.uri, to: dest });
      if (!(await exists(dest))) throw new Error("Le fichier copié est introuvable.");
      imported.push({
        id,
        kind: "file",
        title: prettyName(name),
        format: extension(name),
        size: asset.size ?? null,
        uri: dest,
        fileName,
        addedAt: batchAt,
      });
    } catch (e) {
      console.warn("Copie impossible :", name, e);
      failed.push({ name, reason: String(e?.message || e).slice(0, 160) });
    }
  }
  return { imported, failed };
}

export async function deleteTrackFile(track) {
  if (track.kind && track.kind !== "file") return;
  try {
    const uri = await resolveUri(track);
    if (uri && uri.startsWith(tracksDirUri())) await FS.deleteAsync(uri, { idempotent: true });
  } catch {}
}

// Diagnostic (mode développement) : ce que l'app voit réellement sur le téléphone.
export async function describeStorage() {
  const lines = [];
  try {
    const dir = await ensureTracksDir();
    lines.push(`Dossier : …${dir.slice(-60)}`);
    const names = await FS.readDirectoryAsync(dir);
    lines.push(`Fichiers dans le dossier : ${names.length}`);
    names.slice(0, 8).forEach((n) => lines.push(`  • ${n.slice(0, 40)}`));
  } catch (e) {
    lines.push(`Dossier illisible : ${e.message}`);
  }
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : [];
    const local = stored.filter((t) => !t.kind || t.kind === "file");
    lines.push(`Fichiers mémorisés : ${local.length} (sur ${stored.length} morceaux)`);
    for (const t of local.slice(0, 8)) {
      const found = (await resolveUri(t)) ? "OK" : "ABSENT";
      const where = t.fileName ? `nom=${t.fileName.slice(0, 28)}` : `chemin=…${(t.uri || "").slice(-40)}`;
      lines.push(`  • ${found} · ${where}`);
    }
  } catch (e) {
    lines.push(`Mémoire illisible : ${e.message}`);
  }
  return lines.join("\n");
}
