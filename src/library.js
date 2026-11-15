import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";

const STORAGE_KEY = "freshtracks:library:v2";

function tracksDir() {
  const dir = new Directory(Paths.document, "tracks");
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

// On mémorise le NOM du fichier copié, pas son chemin complet : sur iPhone
// (et dans Expo Go) le chemin du dossier de l'app peut changer d'un lancement
// à l'autre, ce qui faisait « disparaître » les fichiers pourtant présents.
function storedFileName(track) {
  if (track.fileName) return track.fileName;
  // Anciennes entrées : on retrouve le nom à partir de l'ancien chemin.
  const m = track.uri?.match(/\/tracks\/([^/?#]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function resolveFile(track) {
  const name = storedFileName(track);
  if (name) {
    const f = new File(tracksDir(), name);
    if (f.exists) return f;
  }
  try {
    const f = new File(track.uri);
    if (f.exists) return f;
  } catch {}
  return null;
}

// Fichiers présents dans le dossier de l'app mais absents de la playlist
// (perdus par une ancienne version) : on les remet dans la playlist.
function recoverOrphans(known) {
  const names = new Set(known.map((t) => t.fileName).filter(Boolean));
  const recovered = [];
  try {
    for (const entry of tracksDir().list()) {
      if (!(entry instanceof File) || names.has(entry.name)) continue;
      const original = entry.name.replace(/^[a-z0-9]+-/i, "");
      const addedAt = entry.creationTime || entry.lastModified || 0;
      recovered.push({
        id: `r${Math.random().toString(36).slice(2, 10)}`,
        kind: "file",
        title: prettyName(original),
        format: extension(original),
        size: entry.size ?? null,
        uri: entry.uri,
        fileName: entry.name,
        addedAt,
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
    const tracks = stored.map((t) => {
      if (t.kind && t.kind !== "file") return t; // YouTube / streaming
      const f = resolveFile(t);
      if (!f) return { ...t, kind: "file", missing: true };
      return { ...t, kind: "file", uri: f.uri, fileName: f.name, missing: false };
    });
    return [...tracks, ...recoverOrphans(tracks)].sort(
      (a, b) => (b.addedAt || 0) - (a.addedAt || 0)
    );
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

function prettyName(fileName) {
  const base = fileName.replace(/\.[^.]+$/, "");
  return base.replace(/[_]+/g, " ").trim() || fileName;
}

function extension(fileName) {
  const m = fileName.match(/\.([^.]+)$/);
  return m ? m[1].toUpperCase() : "AUDIO";
}

async function copyInto(dir, sourceUri, fileName) {
  const dest = new File(dir, fileName);
  const source = new File(sourceUri);
  try {
    await source.copy(dest);
  } catch {
    source.copySync(dest);
  }
  if (!dest.exists) throw new Error("Le fichier copié est introuvable.");
  return dest;
}

// Copie les fichiers choisis dans le dossier de l'app pour qu'ils restent
// disponibles après fermeture, puis renvoie les morceaux prêts à l'emploi.
export async function importAssets(assets) {
  const dir = tracksDir();
  const imported = [];
  const failed = [];
  // Même date pour tout le lot : les fichiers gardent l'ordre de sélection.
  const batchAt = Date.now();
  for (const asset of assets) {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const name = asset.name || "audio";
    const fileName = `${id}-${name.replace(/[^\w.\-]+/g, "_")}`;
    try {
      const dest = await copyInto(dir, asset.uri, fileName);
      imported.push({
        id,
        kind: "file",
        title: prettyName(name),
        format: extension(name),
        size: asset.size ?? null,
        uri: dest.uri,
        fileName,
        addedAt: batchAt,
      });
    } catch (e) {
      console.warn("Copie impossible :", name, e);
      failed.push(name);
    }
  }
  return { imported, failed };
}

export function deleteTrackFile(track) {
  if (track.kind && track.kind !== "file") return;
  try {
    const f = resolveFile(track);
    if (f && f.uri.startsWith(tracksDir().uri)) f.delete();
  } catch {}
}
