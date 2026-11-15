import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";

const STORAGE_KEY = "freshtracks:library:v2";

function tracksDir() {
  const dir = new Directory(Paths.document, "tracks");
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export async function loadLibrary() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const tracks = JSON.parse(raw);
    // On ignore les fichiers locaux qui auraient disparu du téléphone
    // (les liens YouTube / streaming sont toujours conservés),
    // puis on trie du plus récent au plus ancien (tri stable).
    return tracks
      .filter((t) => {
        if (t.kind && t.kind !== "file") return true;
        try {
          return new File(t.uri).exists;
        } catch {
          return false;
        }
      })
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
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

// Copie les fichiers choisis dans le dossier de l'app pour qu'ils
// survivent au vidage du cache, puis renvoie les morceaux prêts à l'emploi.
export async function importAssets(assets) {
  const dir = tracksDir();
  const imported = [];
  // Même date pour tout le lot : les fichiers gardent l'ordre de sélection.
  const batchAt = Date.now();
  for (const asset of assets) {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const safeName = asset.name.replace(/[^\w.\-]+/g, "_");
    let uri = asset.uri;
    try {
      const dest = new File(dir, `${id}-${safeName}`);
      await new File(asset.uri).copy(dest);
      uri = dest.uri;
    } catch (e) {
      console.warn("Copie impossible, lecture depuis le cache :", e);
    }
    imported.push({
      id,
      kind: "file",
      title: prettyName(asset.name),
      format: extension(asset.name),
      size: asset.size ?? null,
      uri,
      addedAt: batchAt,
    });
  }
  return imported;
}

export function deleteTrackFile(track) {
  if (track.kind && track.kind !== "file") return;
  try {
    const f = new File(track.uri);
    if (f.exists && f.uri.startsWith(Paths.document.uri)) f.delete();
  } catch {}
}
