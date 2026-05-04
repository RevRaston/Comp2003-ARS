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

function getUserKey(p, fallback = "") {
  if (!p) return fallback;
  const k = p.user_id ?? p.userId ?? p.id ?? p.profile_id ?? p.profileId;
  return k ? String(k) : fallback;
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

function makeSafePlayers(players) {
  const usable =
    Array.isArray(players) && players.length > 0
      ? players.slice(0, 4)
      : [{ id: "p1", name: "Player 1" }, { id: "p2", name: "Player 2" }];

  return usable.map((p, idx) => ({
    id: getUserKey(p, String(idx + 1)),
    name: p.display_name || p.name || `Player ${idx + 1}`,
    value: 1,
    locked: false,
    distance: null,
  }));
}

export default function GuessingCardGame({
  sessionCode,
  players = [],
  isHost = false,
  myUserId = null,
  onRoundComplete,
}) {
  const wsRef = useRef(null);
  const runningRef = useRef(false);
  const announcedRef = useRef(false);
  const onRoundCompleteRef = useRef(onRoundComplete);

  const code = sessionCode || localStorage.getItem("session_code") || "local";
  const localUserId = String(myUserId || localStorage.getItem("user_id") || "");

  const initialPlayers = useMemo(() => makeSafePlayers(players), [players]);

  const [connLine, setConnLine] = useState("disconnected");
  const [ui, setUi] = useState({
    phase: "setup", // setup -> countdown -> picking -> reveal
    timer: 3,
    aiCard: null,
    players: initialPlayers,
    outcome: "",
    winnerIds: [],
    tick: 0,
  });

  const stateRef = useRef(ui);

  useEffect(() => {
    onRoundCompleteRef.current = onRoundComplete;
  }, [onRoundComplete]);

  const myPlayerIndex = useMemo(() => {
    if (!localUserId) return -1;
    return ui.players.findIndex((p) => String(p.id) === String(localUserId));
  }, [ui.players, localUserId]);

  const myPlayer = myPlayerIndex >= 0 ? ui.players[myPlayerIndex] : null;

  function syncUiFromState() {
    setUi({ ...stateRef.current });
  }

  function wsSend(obj) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
  }

  function buildPayload(overrides = {}) {
    return {
      ...stateRef.current,
      ...overrides,
    };
  }

  function broadcastState(overrides = {}) {
    if (!isHost) return;

    wsSend({
      type: "guessing_card_state",
      sessionCode: code,
      payload: buildPayload(overrides),
    });
  }

  function applyState(payload) {
    if (!payload) return;

    stateRef.current = {
      phase: payload.phase || "setup",
      timer: Number(payload.timer ?? 3),
      aiCard: payload.aiCard ?? null,
      players: Array.isArray(payload.players) ? payload.players : initialPlayers,
      outcome: payload.outcome || "",
      winnerIds: Array.isArray(payload.winnerIds) ? payload.winnerIds : [],
      tick: Number(payload.tick || 0),
    };

    syncUiFromState();
  }

  function setAndBroadcast(nextState) {
    stateRef.current = {
      ...stateRef.current,
      ...nextState,
    };

    syncUiFromState();
    setTimeout(() => broadcastState(nextState), 0);
  }

  function startGame() {
    if (!isHost) return;

    announcedRef.current = false;

    setAndBroadcast({
      phase: "countdown",
      timer: 3,
      aiCard: null,
      players: initialPlayers.map((p) => ({
        ...p,
        value: 1,
        locked: false,
        distance: null,
      })),
      outcome: "",
      winnerIds: [],
      tick: 0,
    });
  }

  function resolveHand(sourceState = stateRef.current) {
    const ai = sourceState.aiCard ?? Math.floor(Math.random() * 13) + 1;

    let smallestDiff = Infinity;
    let winners = [];

    const resolvedPlayers = sourceState.players.map((player) => {
      const diff = Math.abs(Number(player.value) - ai);

      if (diff < smallestDiff) {
        smallestDiff = diff;
        winners = [player.id];
      } else if (diff === smallestDiff) {
        winners.push(player.id);
      }

      return {
        ...player,
        locked: true,
        distance: diff,
      };
    });

    let outcome = "";

    if (winners.length === 1) {
      const winner = resolvedPlayers.find((p) => p.id === winners[0]);
      outcome = `${winner?.name || "Player"} wins the hand`;
    } else {
      const names = winners
        .map((id) => resolvedPlayers.find((p) => p.id === id)?.name)
        .filter(Boolean);

      outcome = `Split hand: ${names.join(", ")}`;
    }

    const nextState = {
      phase: "reveal",
      timer: 0,
      aiCard: ai,
      players: resolvedPlayers,
      outcome,
      winnerIds: winners,
      tick: sourceState.tick + 1,
    };

    setAndBroadcast(nextState);

    if (
      !announcedRef.current &&
      typeof onRoundCompleteRef.current === "function"
    ) {
      announcedRef.current = true;

      const ranked = resolvedPlayers
        .map((p) => ({
          playerId: p.id,
          name: p.name,
          score: 13 - Number(p.distance || 0),
          result: winners.includes(p.id) ? "Winner" : `Off by ${p.distance}`,
        }))
        .sort((a, b) => b.score - a.score);

      onRoundCompleteRef.current({
        winnerKey: winners.length === 1 ? winners[0] : null,
        outcome,
        scores: ranked,
      });
    }
  }

  function hostUpdatePlayerValue(playerId, value) {
    if (!isHost) return;

    const s = stateRef.current;
    if (s.phase !== "picking") return;

    setAndBroadcast({
      players: s.players.map((p) =>
        String(p.id) === String(playerId) && !p.locked
          ? { ...p, value: Number(value) }
          : p
      ),
      tick: s.tick + 1,
    });
  }

  function hostLockPlayer(playerId) {
    if (!isHost) return;

    const s = stateRef.current;
    if (s.phase !== "picking") return;

    const nextPlayers = s.players.map((p) =>
      String(p.id) === String(playerId) ? { ...p, locked: true } : p
    );

    const allLocked = nextPlayers.length > 0 && nextPlayers.every((p) => p.locked);

    const nextState = {
      players: nextPlayers,
      tick: s.tick + 1,
    };

    if (allLocked) {
      stateRef.current = {
        ...stateRef.current,
        ...nextState,
      };
      syncUiFromState();
      resolveHand(stateRef.current);
      return;
    }

    setAndBroadcast(nextState);
  }

  function handleReplay() {
    startGame();
  }

  function sendPlayerAction(action, payload = {}) {
    const player = myPlayer;
    if (!player) return;

    if (isHost) {
      if (action === "set_value") hostUpdatePlayerValue(player.id, payload.value);
      if (action === "lock") hostLockPlayer(player.id);
      return;
    }

    wsSend({
      type: "guessing_card_action",
      sessionCode: code,
      payload: {
        playerId: player.id,
        action,
        ...payload,
      },
    });
  }

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

      if (isHost) {
        setTimeout(() => broadcastState(), 150);
      }
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

      if (msg.type === "guessing_card_action" && isHost) {
        const { playerId, action, value } = msg.payload || {};

        if (action === "set_value") {
          hostUpdatePlayerValue(playerId, value);
        }

        if (action === "lock") {
          hostLockPlayer(playerId);
        }

        return;
      }

      if (msg.type === "guessing_card_state") {
        if (isHost) return;

        applyState(msg.payload);

        if (
          msg.payload?.phase === "reveal" &&
          !announcedRef.current &&
          typeof onRoundCompleteRef.current === "function"
        ) {
          announcedRef.current = true;

          const resolvedPlayers = Array.isArray(msg.payload.players)
            ? msg.payload.players
            : [];

          const winners = Array.isArray(msg.payload.winnerIds)
            ? msg.payload.winnerIds
            : [];

          const ranked = resolvedPlayers
            .map((p) => ({
              playerId: p.id,
              name: p.name,
              score: 13 - Number(p.distance || 0),
              result: winners.includes(p.id) ? "Winner" : `Off by ${p.distance}`,
            }))
            .sort((a, b) => b.score - a.score);

          onRoundCompleteRef.current({
            winnerKey: winners.length === 1 ? winners[0] : null,
            outcome: msg.payload.outcome,
            scores: ranked,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, isHost]);

  useEffect(() => {
    if (ui.phase !== "setup") return;

    stateRef.current = {
      ...stateRef.current,
      players: initialPlayers,
    };

    syncUiFromState();
  }, [initialPlayers, ui.phase]);

  useEffect(() => {
    if (!isHost) return;

    const interval = setInterval(() => {
      const s = stateRef.current;

      if (s.phase === "countdown") {
        const nextTimer = s.timer - 1;

        if (nextTimer < 0) {
          setAndBroadcast({
            phase: "picking",
            timer: 20,
            aiCard: Math.floor(Math.random() * 13) + 1,
            tick: s.tick + 1,
          });
          return;
        }

        setAndBroadcast({
          timer: nextTimer,
          tick: s.tick + 1,
        });
        return;
      }

      if (s.phase === "picking") {
        const allLocked = s.players.length > 0 && s.players.every((p) => p.locked);
        const nextTimer = s.timer - 1;

        if (nextTimer <= 0 || allLocked) {
          resolveHand({
            ...s,
            timer: Math.max(nextTimer, 0),
          });
          return;
        }

        setAndBroadcast({
          timer: nextTimer,
          tick: s.tick + 1,
        });
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, code]);

  let heading = "";
  let subheading = "";

  if (ui.phase === "setup") {
    heading = "Ready";
    subheading = "Waiting for the host to deal.";
  } else if (ui.phase === "countdown") {
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
            {isHost ? "Dealer / Host" : myPlayer ? "Player" : "Spectator"}
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

      {ui.phase === "setup" && (
        <div className="gc-finish-panel">
          {isHost ? (
            <button className="gc-replay-btn" onClick={startGame}>
              Start Hand
            </button>
          ) : (
            <p className="gc-waiting">Waiting for dealer…</p>
          )}
        </div>
      )}

      <div className="gc-table-wrap">
        <div className="gc-table-outer-glow" />

        <div className="gc-table">
          <div className="gc-table-wood" />

          <div className="gc-dealer-area">
            <div className="gc-dealer-badge">
              {isHost ? "YOU ARE THE DEALER" : "DEALER"}
            </div>

            <div className="gc-dealer-label">House Card</div>

            <div className="gc-playing-card gc-ai-card">
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
              const isMe = String(player.id) === String(myPlayer?.id);

              return (
                <div
                  key={player.id}
                  className={`gc-seat ${seatClass} ${
                    player.locked ? "is-locked" : ""
                  } ${isWinner ? "is-winner" : ""}`}
                >
                  <div className="gc-seat-name">
                    {player.name}
                    {isMe ? " (You)" : ""}
                  </div>

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
                    {ui.phase === "setup" && "Waiting"}
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
        <div className="gc-controls-title">
          {myPlayer ? "Your card" : "Table controls"}
        </div>

        <div className="gc-controls-sub">
          {myPlayer
            ? "Choose your guess and lock it before time runs out."
            : isHost
            ? "Host can start and replay the hand. Players now choose their own cards."
            : "Spectating the hand."}
        </div>

        <div className="gc-controls-list">
          {myPlayer ? (
            <div className="gc-player-controls">
              <div className="gc-player-name">{myPlayer.name}</div>

              <select
                className="gc-select"
                disabled={ui.phase !== "picking" || myPlayer.locked}
                value={myPlayer.value}
                onChange={(e) =>
                  sendPlayerAction("set_value", { value: e.target.value })
                }
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
                disabled={ui.phase !== "picking" || myPlayer.locked}
                onClick={() => sendPlayerAction("lock")}
              >
                {myPlayer.locked ? "Locked" : "Lock"}
              </button>
            </div>
          ) : (
            ui.players.map((player) => (
              <div key={player.id} className="gc-player-controls">
                <div className="gc-player-name">{player.name}</div>
                <div className="gc-controls-sub">
                  {player.locked ? "Locked" : "Choosing"}
                </div>
              </div>
            ))
          )}
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