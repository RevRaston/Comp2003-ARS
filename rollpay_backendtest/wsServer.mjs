// wsServer.mjs
import { WebSocketServer } from "ws";

/**
 * Attach a WebSocket server to an existing HTTP server.
 * Defaults to path "/ws".
 */
export function attachWs(server, { path = "/ws" } = {}) {
  const wss = new WebSocketServer({ server, path });

  // sessionCode -> Set of sockets
  const rooms = new Map();

  function joinRoom(code, ws) {
    if (!rooms.has(code)) rooms.set(code, new Set());
    rooms.get(code).add(ws);
    ws._roomCode = code;
  }

  function leaveRoom(ws) {
    const code = ws._roomCode;
    if (!code) return;
    const set = rooms.get(code);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) rooms.delete(code);
  }

  function broadcast(code, data, exceptWs = null) {
    const set = rooms.get(code);
    if (!set) return;
    for (const client of set) {
      if (client.readyState === 1 && client !== exceptWs) {
        client.send(data);
      }
    }
  }

  wss.on("connection", (ws) => {
    ws.on("message", (buf) => {
      let msg;
      try {
        msg = JSON.parse(buf.toString());
      } catch {
        return;
      }

      const { type, sessionCode } = msg || {};
      if (!sessionCode) return;

      // First message from frontend should be join
      if (type === "join") {
        joinRoom(sessionCode, ws);
        ws.send(JSON.stringify({ type: "joined", sessionCode }));
        return;
      }

      // Must join first
      if (!ws._roomCode) return;

      // Relay to everyone else in the same sessionCode room
      broadcast(sessionCode, JSON.stringify(msg), ws);
    });

    ws.on("close", () => leaveRoom(ws));
    ws.on("error", () => leaveRoom(ws));
  });

  console.log(`✅ WebSocket server ready (path: ${path})`);
}