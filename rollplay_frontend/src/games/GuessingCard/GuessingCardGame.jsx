import { useEffect, useMemo, useRef, useState } from "react";
import "./GuessingCard.css";

const defaultWsBase =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "ws://localhost:3000/ws"
    : "wss://comp2003-ars.onrender.com/ws";

const WS_URL = (
  import.meta.env.VITE_WS_URL ||
  import.meta.env.VITE_BACKEND_WS_URL ||
  defaultWsBase
).replace(/\/$/, "");

function labelForValue(v) {
  const names = { 1: "A", 11: "J", 12: "Q", 13: "K" };
  return names[v] || String(v);
}

function getUserKey(p) {
  if (!p) return "";
  const k = p.user_id ?? p.userId ?? p.id;
  return k ? String(k) : "";
}

function getSeatClass(index, total) {
  if (total <= 1) return "seat-center";

  if (total === 2) {
    return index === 0 ? "seat-left" : "seat-right";
  }

  if (total === 3) {
    return ["seat-left", "seat-center", "seat-right"][index] || "seat-center";
  }

  return (
    ["seat-far-left", "seat-left", "seat-right", "seat-far-right"][index] ||
    "seat-center"
  );
}

export default function GuessingCardGame({
  sessionCode,
  players = [],
  isHost = false,
  onRoundComplete,
}) {
  const wsRef = useRef(null);
  const runningRef = useRef(false);
  const announcedRef = useRef(false);
  const onRoundCompleteRef = useRef(onRoundComplete);

  useEffect(() => {
    onRoundCompleteRef.current = onRoundComplete;
  }, [onRoundComplete]);

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
    winnerIds: [],
    tick: 0,
  });

  const [ui, setUi] = useState({
    phase: "countdown",
    timer: 3,
    aiCard: null,
    players: [],
    outcome: "",
    winnerIds: [],
  });

  function syncUiFromState() {
    const s = stateRef.current;
    setUi({
      phase: s.phase,
      timer: s.timer,
      aiCard: s.aiCard,
      players: s.players,
      outcome: s.outcome,
      winnerIds: s.winnerIds || [],
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

    if (s.players.length === playerList.length && s.players.length > 0) return;

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
    announcedRef.current = false;

    setConnLine("connecting…");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnLine("connected");
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

        if (
          stateRef.current.phase === "reveal" &&
          !announcedRef.current &&
          typeof onRoundCompleteRef.current === "function"
        ) {
          announcedRef.current = true;
          onRoundCompleteRef.current({
            winnerKey:
              stateRef.current.winnerIds?.length === 1
                ? stateRef.current.winnerIds[0]
                : null,
            outcome: stateRef.current.outcome,
          });
        }
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
        const allLocked =
          s.players.length > 0 && s.players.every((p) => p.locked);

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

          s.winnerIds = winners;

          if (winners.length === 1) {
            const winner = s.players.find((p) => p.id === winners[0]);
            s.outcome = `${winner?.name || "Player"} wins the hand`;
          } else {
            const names = winners
              .map((id) => s.players.find((p) => p.id === id)?.name)
              .filter(Boolean);
            s.outcome = `Split hand: ${names.join(", ")}`;
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
          winnerIds: s.winnerIds,
          tick: s.tick,
        },
      });

      if (
        s.phase === "reveal" &&
        !announcedRef.current &&
        typeof onRoundCompleteRef.current === "function"
      ) {
        announcedRef.current = true;
        onRoundCompleteRef.current({
          winnerKey: s.winnerIds?.length === 1 ? s.winnerIds[0] : null,
          outcome: s.outcome,
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isHost, code, playerList.length]);

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

    announcedRef.current = false;

    const s = stateRef.current;
    s.phase = "countdown";
    s.timer = 3;
    s.aiCard = null;
    s.outcome = "";
    s.winnerIds = [];
    s.tick = 0;
    s.players = s.players.map((p) => ({
      ...p,
      value: 1,
      locked: false,
      distance: null,
    }));

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
        winnerIds: s.winnerIds,
        tick: s.tick,
      },
    });
  }

  let heading = "";
  let subheading = "";

  if (ui.phase === "countdown") {
    heading = ui.timer > 0 ? `${ui.timer}…` : "Deal!";
    subheading = "Dealer is preparing the next hand.";
  } else if (ui.phase === "picking") {
    heading = "Place your guess";
    subheading = `${ui.timer}s remaining`;
  } else {
    heading = "Showdown";
    subheading = "Dealer card revealed.";
  }

  return (
    <div className="gc-shell">
      <div className="gc-top-info">
        <div className="gc-info-block">
          <div className="gc-info-label">Game</div>
          <div className="gc-info-value">Dealer Guess</div>
        </div>

        <div className="gc-info-block">
          <div className="gc-info-label">Role</div>
          <div className="gc-info-value">
            {isHost ? "Dealer / Host" : "Player Table View"}
          </div>
        </div>

        <div className="gc-info-block">
          <div className="gc-info-label">Connection</div>
          <div className="gc-info-value">{connLine}</div>
        </div>
      </div>

      <h1 className="gc-title">Dealer Guess</h1>

      <p className="gc-instruction">
        Pick the card value closest to the dealer’s hidden card. Closest guess
        wins the hand.
      </p>

      <div className="gc-phase-card">
        <div className="gc-phase-main">{heading}</div>
        <div className="gc-phase-sub">{subheading}</div>
      </div>

      <div className="gc-table-wrap">
        <div className="gc-table-outer-glow" />

        <div className="gc-table">
          <div className="gc-table-wood" />

          <div className="gc-dealer-area">
            <div className="gc-dealer-badge">
              {isHost ? "YOU ARE THE DEALER" : "DEALER"}
            </div>

            <div className="gc-dealer-label">House Card</div>

            <div className={`gc-playing-card gc-ai-card`}>
              <div className="gc-card-corner top-left">
                {ui.phase === "reveal" && ui.aiCard ? labelForValue(ui.aiCard) : "?"}
              </div>

              <div className="gc-card-center">
                {ui.phase === "reveal" && ui.aiCard ? labelForValue(ui.aiCard) : "?"}
              </div>

              <div className="gc-card-corner bottom-right">
                {ui.phase === "reveal" && ui.aiCard ? labelForValue(ui.aiCard) : "?"}
              </div>
            </div>

            <div className="gc-dealer-status">
              {ui.phase === "reveal" ? "Dealer reveals the card" : "Card hidden"}
            </div>
          </div>

          <div className="gc-felt-center-mark">
            <span>BLACKJACK TABLE</span>
          </div>

          <div className={`gc-seat-row gc-seat-count-${ui.players.length || 1}`}>
            {ui.players.map((player, index) => {
              const isWinner = ui.winnerIds?.includes(player.id);
              const seatClass = getSeatClass(index, ui.players.length);

              return (
                <div
                  key={player.id}
                  className={`gc-seat ${seatClass} ${player.locked ? "is-locked" : ""} ${
                    isWinner ? "is-winner" : ""
                  }`}
                >
                  <div className="gc-seat-name">{player.name}</div>

                  <div className={`gc-playing-card ${isWinner ? "winner-card" : ""}`}>
                    <div className="gc-card-corner top-left">
                      {labelForValue(player.value)}
                    </div>

                    <div className="gc-card-center">
                      {labelForValue(player.value)}
                    </div>

                    <div className="gc-card-corner bottom-right">
                      {labelForValue(player.value)}
                    </div>
                  </div>

                  <div className="gc-seat-status">
                    {ui.phase === "countdown" && "Waiting for deal"}
                    {ui.phase === "picking" &&
                      (player.locked ? "Bet placed" : "Choosing")}
                    {ui.phase === "reveal" &&
                      (isWinner
                        ? "Winning hand"
                        : `Off by ${player.distance ?? "?"}`)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="gc-controls-card">
        <div className="gc-controls-title">Dealer controls</div>

        <div className="gc-controls-sub">
          {isHost
            ? "As host, you control and lock each player's card for now."
            : "Waiting for the dealer to run the hand."}
        </div>

        <div className="gc-controls-list">
          {ui.players.map((player) => (
            <div key={player.id} className="gc-player-controls">
              <div className="gc-player-name">{player.name}</div>

              <select
                className="gc-select"
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
                className="gc-lock-btn"
                disabled={!isHost || ui.phase !== "picking" || player.locked}
                onClick={() => lockPlayer(player.id)}
              >
                {player.locked ? "Locked" : "Lock"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="gc-outcome-card">
        <div className="gc-outcome-title">Table result</div>
        <div className="gc-outcome-text">
          {ui.outcome || "The result of the hand will appear here."}
        </div>
      </div>

      {ui.phase === "reveal" && (
        <div className="gc-finish-panel">
          {isHost ? (
            <button className="gc-replay-btn" onClick={handleReplay}>
              Deal another hand
            </button>
          ) : (
            <p className="gc-waiting">Waiting for dealer…</p>
          )}
        </div>
      )}
    </div>
  );
}