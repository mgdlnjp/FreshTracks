// En développement uniquement : renvoie les logs et erreurs de l'app vers le
// Mac qui fait tourner Expo (scripts/devlog-server.js, port 8099), pour les
// lire sans capture d'écran. Inactif dans la vraie application.
import Constants from "expo-constants";

const PORT = 8099;

function stringify(args) {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.message}\n${a.stack || ""}`;
      if (typeof a === "string") return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ")
    .slice(0, 4000);
}

if (__DEV__) {
  const host = (Constants.expoConfig?.hostUri || "").split(":")[0];
  if (host) {
    const url = `http://${host}:${PORT}/log`;
    const send = (level, args) => {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, message: stringify(args), time: new Date().toISOString() }),
      }).catch(() => {});
    };

    for (const level of ["log", "info", "warn", "error"]) {
      const original = console[level];
      console[level] = (...args) => {
        original(...args);
        send(level, args);
      };
    }

    const previous = global.ErrorUtils?.getGlobalHandler?.();
    global.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
      send(isFatal ? "fatal" : "error", [error]);
      previous?.(error, isFatal);
    });

    send("info", ["App démarrée"]);
  }
}
