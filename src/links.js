// Reconnaissance et préparation des liens collés par l'utilisateur.

const YT_PATTERNS = [
  /(?:youtube\.com|music\.youtube\.com)\/watch\?(?:.*&)?v=([\w-]{11})/i,
  /youtu\.be\/([\w-]{11})/i,
  /youtube\.com\/(?:shorts|embed|live|v)\/([\w-]{11})/i,
];

const LOCKED_SERVICES = [
  { re: /(open\.)?spotify\.com|spotify:/i, name: "Spotify" },
  { re: /deezer\.(com|page\.link)|link\.deezer/i, name: "Deezer" },
  { re: /music\.apple\.com/i, name: "Apple Music" },
];

// Repère le premier lien http(s) dans un texte partagé (« Regarde ça : https://… »).
export function extractUrl(text) {
  if (!text) return null;
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0] : null;
}

export function youtubeId(url) {
  for (const re of YT_PATTERNS) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

/**
 * Analyse un texte et renvoie :
 *  { kind: "youtube", videoId, url }
 *  { kind: "stream", url, title, format, host }
 *  { kind: "locked", service }     → Spotify / Deezer… (non lisible)
 *  { kind: "invalid" }
 */
export function parseLink(text) {
  const url = extractUrl(text?.trim());
  if (!url) return { kind: "invalid" };

  const locked = LOCKED_SERVICES.find((s) => s.re.test(url));
  if (locked) return { kind: "locked", service: locked.name };

  const videoId = youtubeId(url);
  if (videoId) return { kind: "youtube", videoId, url };

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: "invalid" };
  }

  const host = parsed.hostname.replace(/^www\./, "");
  let streamUrl = url;

  // Dropbox : forcer le fichier brut plutôt que la page d'aperçu.
  if (/dropbox\.com$/i.test(host)) {
    parsed.searchParams.delete("dl");
    parsed.searchParams.set("raw", "1");
    streamUrl = parsed.toString();
  }

  // Google Drive : lien de téléchargement direct.
  const drive = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?.*id=)([\w-]+)/i);
  if (drive) {
    streamUrl = `https://drive.google.com/uc?export=download&id=${drive[1]}`;
  }

  const lastSegment = safeDecode(parsed.pathname.split("/").filter(Boolean).pop() || "");
  const extMatch = lastSegment.match(/\.([a-z0-9]{2,4})$/i);
  const format = extMatch ? extMatch[1].toUpperCase() : "STREAM";
  const title = drive
    ? "Fichier Google Drive"
    : lastSegment.replace(/\.[^.]+$/, "").replace(/[_+]+/g, " ").trim() || host;

  return { kind: "stream", url: streamUrl, title, format, host };
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// Métadonnées YouTube via oEmbed (pas de clé API nécessaire).
export async function fetchYoutubeInfo(videoId) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const res = await fetch(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`
  );
  if (!res.ok) {
    throw new Error(
      res.status === 401 || res.status === 403
        ? "Cette vidéo ne peut pas être lue en dehors de YouTube."
        : "Vidéo introuvable ou privée."
    );
  }
  const data = await res.json();
  return {
    title: data.title || "Vidéo YouTube",
    author: data.author_name || null,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
  };
}

function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Transforme un lien analysé en morceau de la playlist.
export async function trackFromLink(link) {
  if (link.kind === "youtube") {
    const info = await fetchYoutubeInfo(link.videoId);
    return {
      id: newId(),
      kind: "youtube",
      videoId: link.videoId,
      uri: link.url,
      title: info.title,
      author: info.author,
      thumbnail: info.thumbnail,
      format: "YOUTUBE",
      size: null,
      addedAt: Date.now(),
    };
  }
  if (link.kind === "stream") {
    return {
      id: newId(),
      kind: "stream",
      uri: link.url,
      title: link.title,
      author: link.host,
      format: link.format,
      size: null,
      addedAt: Date.now(),
    };
  }
  throw new Error("Lien non pris en charge.");
}
