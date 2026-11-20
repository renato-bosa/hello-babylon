import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { RaceRoom, PROTOCOL } from "./race-room.js";
import { pathToFileURL } from "node:url";

export async function startServer(port = Number(process.env.PORT || 2567)) {
  const server = new Server({
    transport: new WebSocketTransport({ maxPayload: 4096, pingInterval: 5000, pingMaxRetries: 2 }),
    greet: false,
    express(app) {
      app.get("/health", (req, res) => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Cache-Control", "no-store");
        res.json({ ok: true, protocol: PROTOCOL });
      });
    },
  });
  server.define("private_race", RaceRoom);
  await server.listen(port, "0.0.0.0");
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startServer();
  console.log(`Neon Rush multiplayer listening on ${process.env.PORT || 2567}`);
}
