// src/games/GuessingCard/GuessingCardGame.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import "./GuessingCard.css";

const WS_URL =
  (import.meta.env.VITE_WS_URL && import.meta.env.VITE_WS_URL.replace(/\/$/, "")) ||
  "ws://localhost:3000/ws";

function labelForValue(v) {
  const names = { 1: "A", 11: "J", 12: "Q", 13: "K" };
  return names[v] || String(v);
}

function getUserKey(p) {
  if (!p) return "";
  const k = p.user_id ?? p.userId ?? p.id;
  return k ? String(k) : "";
}

export default function GuessingCardGame({
  sessionCode,
  players = [],
  isHost = false,
}) {
  const wsRef = useRef(null);
  const runningRef = useRef(false);

  const [connLine, setConnLine] = useState("disconnected");

  const code = sessionCode || localStorage.getItem("session_code") || "local";

  const playerList = useMemo(() => {
    return (players || []).slice(0, 4).map((p, idx) => ({
      id: getUserKey(p) || String(idx + 1),
      name: p.display_name || p.name || `Player ${idx + 1}`,
    }));
  }, [players]);

  const stateRef = useRef({
    phase: "countdown", // countdown -> picking -> reveal
    timer: 3,
    aiCard: null,
    players: [],
    outcome: "",
    tick: 0,
  });

  const [ui, setUi] = useState({
    phase: "countdown",
    timer: 3,
    aiCard: null,
    players: [],
    outcome: "",
  });

  function syncUiFromState() {
    const s = stateRef.current;
    setUi({
      phase: s.phase,
      timer: s.timer,
      aiCard: s.aiCard,
      players: s.players,
      outcome: s.outcome,
    });
  }

  function wsSend(obj) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
  }

  // initialise players once
  useEffect(() => {
    if (!playerList.length) return;

    const s = stateRef.current;
    if (s.players.length) return;

    s.players = playerList.map((p) => ({
      id: p.id,
      name: p.name,
      value: 1,
      locked: false,
      distance: null,
    }));

    syncUiFromState();
  }, [playerList]);

  // WS connect
  useEffect(() => {
    if (runningRef.current) return;
    runningRef.current = true;

    setConnLine("connecting…");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnLine("connected ✅");
      wsSend({ type: "join", sessionCode: code });
    };

    ws.onclose = () => setConnLine("disconnected");
    ws.onerror = () => setConnLine("error");

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }

      if (!msg || msg.sessionCode !== code) return;

      if (msg.type === "guessing_card_state") {
        if (isHost) return;

        const payload = msg.payload;
        if (!payload) return;

        stateRef.current = {
          ...stateRef.current,
          ...payload,
          players: payload.players || stateRef.current.players,
        };

        syncUiFromState();
      }
    };

    return () => {
      try {
        wsRef.current?.close();
      } catch {}
      wsRef.current = null;
      runningRef.current = false;
    };
  }, [code, isHost]);

  // Host game loop / timer
  useEffect(() => {
    if (!isHost) return;

    const s = stateRef.current;

    // don’t start until players exist
    if (!s.players.length) return;

    const interval = setInterval(() => {
      if (s.phase === "countdown") {
        s.timer -= 1;

        if (s.timer < 0) {
          s.phase = "picking";
          s.timer = 20;
          s.aiCard = Math.floor(Math.random() * 13) + 1;
        }
      } else if (s.phase === "picking") {
        const allLocked = s.players.length > 0 && s.players.every((p) => p.locked);
        s.timer -= 1;

        if (s.timer <= 0 || allLocked) {
          const ai = s.aiCard ?? Math.floor(Math.random() * 13) + 1;

          let smallestDiff = Infinity;
          let winners = [];

          s.players = s.players.map((player) => {
            const diff = Math.abs(Number(player.value) - ai);

            if (diff < smallestDiff) {
              smallestDiff = diff;
              winners = [player.id];
            } else if (diff === smallestDiff) {
              winners.push(player.id);
            }

            return {
              ...player,
              distance: diff,
            };
          });

          if (winners.length === 1) {
            const winner = s.players.find((p) => p.id === winners[0]);
            s.outcome = `${winner?.name || "Player"} wins 🎉`;
          } else {
            const names = winners
              .map((id) => s.players.find((p) => p.id === id)?.name)
              .filter(Boolean);
            s.outcome = `It's a tie between ${names.join(", ")}!`;
          }

          s.phase = "reveal";
          s.timer = 0;
        }
      }

      s.tick += 1;
      syncUiFromState();

      wsSend({
        type: "guessing_card_state",
        sessionCode: code,
        payload: {
          phase: s.phase,
          timer: s.timer,
          aiCard: s.aiCard,
          players: s.players,
          outcome: s.outcome,
          tick: s.tick,
        },
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isHost, code, playerList.length]);

  // Host controls only (for MVP)
  function updatePlayerValue(id, value) {
    if (!isHost) return;

    const s = stateRef.current;
    if (s.phase !== "picking") return;

    s.players = s.players.map((p) =>
      p.id === id ? { ...p, value: Number(value) } : p
    );

    syncUiFromState();
  }

  function lockPlayer(id) {
    if (!isHost) return;

    const s = stateRef.current;
    if (s.phase !== "picking") return;

    s.players = s.players.map((p) =>
      p.id === id ? { ...p, locked: true } : p
    );

    syncUiFromState();
  }

  function handleReplay() {
    if (!isHost) return;

    const s = stateRef.current;
    s.phase = "countdown";
    s.timer = 3;
    s.aiCard = null;
    s.outcome = "";
    s.tick = 0;
    s.players = s.players.map((p) => ({
      ...p,
      value: 1,
      locked: false,
      distance: null,
    }));

    syncUiFromState();
  }

  let heading = "";
  if (ui.phase === "countdown") {
    heading = ui.timer > 0 ? `${ui.timer}…` : "Go!";
  } else if (ui.phase === "picking") {
    heading = `Pick your cards (${ui.timer}s)`;
  } else {
    heading = "Results";
  }

  return (
    <div className="guessing-card-page">
      <h1 className="title">Guessing Card</h1>

      <div style={{ color: "white", opacity: 0.7, fontSize: 12, marginBottom: 8 }}>
        {connLine} {isHost ? "— HOST" : "— CLIENT"} (room: {code})
      </div>

      <h2>{heading}</h2>

      <div className="card-row">
        {ui.players.map((player) => (
          <div className="card" key={player.id}>
            <p>{player.name}</p>
            <div className="card-face">{labelForValue(player.value)}</div>
            {ui.phase === "reveal" && (
              <p style={{ opacity: 0.75 }}>Δ {player.distance}</p>
            )}
          </div>
        ))}

        <div className="card">
          <p>AI Card</p>
          <div className="card-face">
            {ui.phase === "reveal" && ui.aiCard ? labelForValue(ui.aiCard) : "?"}
          </div>
        </div>
      </div>

      <div className="controls">
        {ui.players.map((player) => (
          <div key={player.id} className="player-controls">
            <span>{player.name}</span>

            <select
              disabled={!isHost || ui.phase !== "picking" || player.locked}
              value={player.value}
              onChange={(e) => updatePlayerValue(player.id, e.target.value)}
            >
              {Array.from({ length: 13 }).map((_, i) => {
                const v = i + 1;
                return (
                  <option key={v} value={v}>
                    {labelForValue(v)}
                  </option>
                );
              })}
            </select>

            <button
              disabled={!isHost || ui.phase !== "picking" || player.locked}
              onClick={() => lockPlayer(player.id)}
            >
              {player.locked ? "Locked" : "Lock"}
            </button>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: 20 }}>{ui.outcome}</h2>

      {ui.phase === "reveal" && (
        <div style={{ marginTop: 14 }}>
          {isHost ? (
            <button onClick={handleReplay}>Replay (host)</button>
          ) : (
            <p style={{ opacity: 0.8 }}>Waiting for host…</p>
          )}
        </div>
      )}
    </div>
  );
}