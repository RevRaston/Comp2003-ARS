// src/ws.js
import { BACKEND_WS_URL } from "./config";

/**
 * Connect to backend WebSocket.
 * Backend expects first message: { type:"join", sessionCode:"ABC123" }
 */
export function connectWs({ sessionCode, onOpen, onMessage, onClose, onError }) {
  const ws = new WebSocket(BACKEND_WS_URL);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "join", sessionCode }));
    onOpen?.(ws);
  };

  ws.onmessage = (e) => {
    let msg = null;
    try {
      msg = JSON.parse(e.data);
    } catch {
      msg = { type: "raw", data: e.data };
    }
    onMessage?.(msg, ws);
  };

  ws.onclose = (e) => onClose?.(e, ws);
  ws.onerror = (e) => onError?.(e, ws);

  return ws;
}