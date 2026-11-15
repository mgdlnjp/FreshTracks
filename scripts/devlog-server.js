// Petit serveur de développement : reçoit les logs envoyés par l'app
// (src/devlog.js) et les écrit dans le terminal et dans un fichier.
// Usage : node scripts/devlog-server.js [fichier-de-sortie]
const http = require("http");
const fs = require("fs");

const PORT = 8099;
const out = process.argv[2] || "devlog.txt";

http
  .createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/log") {
      res.writeHead(404).end();
      return;
    }
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 100_000) req.destroy();
    });
    req.on("end", () => {
      try {
        const { level, message, time } = JSON.parse(body);
        const line = `[${time}] ${String(level).toUpperCase()} ${message}\n`;
        process.stdout.write(line);
        fs.appendFileSync(out, line);
      } catch {}
      res.writeHead(204).end();
    });
  })
  .listen(PORT, "0.0.0.0", () => console.log(`devlog : écoute sur le port ${PORT} → ${out}`));
