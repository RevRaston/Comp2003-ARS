import { useEffect, useMemo, useRef, useState } from "react";

const defaultWsBase =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "ws://localhost:3000/ws"
    : "wss://comp2003-ars.onrender.com/ws";

const WS_URL = (
  import.meta.env.VITE_WS_URL ||
  import.meta.env.VITE_BACKEND_WS_URL ||
  defaultWsBase
).replace(/\/$/, "");

function getPlayerKey(player, fallback = "") {
  if (!player) return fallback;
  return String(
    player.user_id ??
      player.userId ??
      player.id ??
      player.profile_id ??
      player.profileId ??
      fallback
  );
}

function makeSafePlayers(players) {
  const usable =
    Array.isArray(players) && players.length > 0
      ? players.slice(0, 4)
      : [{ id: "p1", name: "Player 1" }, { id: "p2", name: "Player 2" }];

  return usable.map((p, index) => ({
    id: getPlayerKey(p, `p${index + 1}`),
    name: p.display_name || p.name || `Player ${index + 1}`,
  }));
}

function rand() {
  return Math.floor(Math.random() * 6) + 1;
}

function dieFace(n) {
  return ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][n - 1] || "—";
}

export default function CrapsGame({
  sessionCode,
  players = [],
  isHost = false,
  myUserId = null,
  onRoundComplete,
}) {
  const wsRef = useRef(null);
  const runningRef = useRef(false);
  const onRoundCompleteRef = useRef(onRoundComplete);
  const announcedRef = useRef(false);

  const code = sessionCode || localStorage.getItem("session_code") || "local";
  const localUserId = String(myUserId || localStorage.getItem("user_id") || "");

  const initialPlayers = useMemo(() => makeSafePlayers(players), [players]);

  const [connLine, setConnLine] = useState("disconnected");
  const [screen, setScreen] = useState("setup");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [results, setResults] = useState({});
  const [rankedResults, setRankedResults] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    onRoundCompleteRef.current = onRoundComplete;
  }, [onRoundComplete]);

  const playerList = initialPlayers;
  const currentPlayer = playerList[currentIdx] || null;
  const currentKey = currentPlayer?.id || `p${currentIdx + 1}`;

  const myPlayerIndex = useMemo(() => {
    if (!localUserId) return -1;
    return playerList.findIndex((p) => String(p.id) === String(localUserId));
  }, [playerList, localUserId]);

  const isMyTurn = myPlayerIndex === currentIdx;
  const currentResult = results[currentKey];

  function wsSend(obj) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
  }

  function buildState(overrides = {}) {
    return {
      screen,
      currentIdx,
      rolling,
      results,
      rankedResults,
      message,
      ...overrides,
    };
  }

  function applyState(payload) {
    if (!payload) return;

    setScreen(payload.screen ?? "setup");
    setCurrentIdx(Number(payload.currentIdx || 0));
    setRolling(Boolean(payload.rolling));
    setResults(payload.results || {});
    setRankedResults(Array.isArray(payload.rankedResults) ? payload.rankedResults : []);
    setMessage(payload.message || "");
  }

  function broadcastState(nextState = {}) {
    if (!isHost) return;

    wsSend({
      type: "craps_state",
      sessionCode: code,
      payload: buildState(nextState),
    });
  }

  function setAndBroadcast(nextState) {
    applyState(nextState);
    setTimeout(() => broadcastState(nextState), 0);
  }

  function startGame() {
    if (!isHost) return;

    announcedRef.current = false;

    setAndBroadcast({
      screen: "game",
      currentIdx: 0,
      rolling: false,
      results: {},
      rankedResults: [],
      message: `${playerList[0]?.name || "Player 1"} starts.`,
    });
  }

  function hostRollDice(playerId) {
    if (!isHost) return;
    if (screen !== "game") return;
    if (rolling) return;

    const active = playerList[currentIdx];
    if (!active || String(active.id) !== String(playerId)) return;
    if (results[active.id]) return;

    const rollingState = {
      screen: "game",
      currentIdx,
      rolling: true,
      results,
      rankedResults,
      message: `${active.name} is rolling...`,
    };

    setAndBroadcast(rollingState);

    setTimeout(() => {
      const d1 = rand();
      const d2 = rand();
      const total = d1 + d2;

      const nextResults = {
        ...results,
        [active.id]: {
          playerId: active.id,
          playerName: active.name,
          d1,
          d2,
          total,
        },
      };

      setAndBroadcast({
        screen: "game",
        currentIdx,
        rolling: false,
        results: nextResults,
        rankedResults: [],
        message: `${active.name} rolled ${total}.`,
      });
    }, 700);
  }

  function hostNextTurn() {
    if (!isHost) return;
    if (screen !== "game") return;
    if (rolling) return;

    const active = playerList[currentIdx];
    if (active && !results[active.id]) return;

    if (currentIdx < playerList.length - 1) {
      const nextIdx = currentIdx + 1;
      setAndBroadcast({
        screen: "game",
        currentIdx: nextIdx,
        rolling: false,
        results,
        rankedResults: [],
        message: `${playerList[nextIdx]?.name || "Next player"}'s turn.`,
      });
      return;
    }

    finishGame(results);
  }

  function finishGame(finalResults) {
    if (!isHost) return;

    const ranked = playerList
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        score: finalResults[p.id]?.total || 0,
        d1: finalResults[p.id]?.d1 || null,
        d2: finalResults[p.id]?.d2 || null,
      }))
      .sort((a, b) => b.score - a.score);

    setAndBroadcast({
      screen: "results",
      currentIdx,
      rolling: false,
      results: finalResults,
      rankedResults: ranked,
      message: `${ranked[0]?.name || "Winner"} wins with ${ranked[0]?.score || 0}.`,
    });

    if (!announcedRef.current && typeof onRoundCompleteRef.current === "function") {
      announcedRef.current = true;

      onRoundCompleteRef.current({
        winnerKey: ranked[0]?.playerId || null,
        scores: ranked,
      });
    }
  }

  function sendAction(action) {
    const player = playerList[myPlayerIndex];
    if (!player) return;

    if (isHost) {
      if (action === "roll") hostRollDice(player.id);
      if (action === "next") hostNextTurn();
      return;
    }

    wsSend({
      type: "craps_action",
      sessionCode: code,
      payload: {
        playerId: player.id,
        action,
      },
    });
  }

  useEffect(() => {
    if (runningRef.current) return;
    runningRef.current = true;

    setConnLine("connecting...");
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

      if (msg.type === "craps_action" && isHost) {
        const { playerId, action } = msg.payload || {};

        if (action === "roll") hostRollDice(playerId);
        if (action === "next") hostNextTurn();

        return;
      }

      if (msg.type === "craps_state") {
        if (isHost) return;
        applyState(msg.payload);
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

  const canRoll =
    screen === "game" && isMyTurn && !rolling && !currentResult;

  const canContinue =
    screen === "game" && isMyTurn && !rolling && Boolean(currentResult);

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={topRow}>
          <button
            style={{
              ...startSmallButton,
              opacity: isHost && screen === "setup" ? 1 : 0.45,
              cursor: isHost && screen === "setup" ? "pointer" : "not-allowed",
            }}
            disabled={!isHost || screen !== "setup"}
            onClick={startGame}
          >
            Start
          </button>

          <div>
            <h1 style={title}>🎲 Craps</h1>
            <p style={sub}>Highest roll wins · {connLine}</p>
          </div>

          <div style={hostPill}>{isHost ? "Host" : "Player"}</div>
        </div>

        {screen === "setup" && (
          <div style={setup}>
            <h2 style={setupTitle}>Ready at the table</h2>
            <p style={setupText}>
              Each player rolls once. Highest total wins the round.
            </p>

            <div style={scoreboard}>
              {playerList.map((p, i) => (
                <div key={p.id} style={scoreBox}>
                  <div style={playerName}>P{i + 1}: {p.name}</div>
                  <div style={emptyDice}>— —</div>
                </div>
              ))}
            </div>

            {isHost ? (
              <button style={startButton} onClick={startGame}>
                Start Game
              </button>
            ) : (
              <p style={waitingText}>Waiting for the host to start.</p>
            )}
          </div>
        )}

        {screen === "game" && (
          <>
            <div style={scoreboard}>
              {playerList.map((p, i) => {
                const r = results[p.id];
                const active = i === currentIdx && !r;

                return (
                  <div
                    key={p.id}
                    style={{
                      ...scoreBox,
                      ...(active ? activeScoreBox : null),
                      opacity: r ? 1 : active ? 1 : 0.55,
                    }}
                  >
                    <div style={playerName}>
                      {p.name}
                      {i === myPlayerIndex ? " (You)" : ""}
                    </div>
                    <div style={diceFaces}>
                      {r ? `${dieFace(r.d1)} ${dieFace(r.d2)}` : "— —"}
                    </div>
                    <div style={totalText}>{r ? r.total : ""}</div>
                  </div>
                );
              })}
            </div>

            <section style={turnPanel}>
              <h2 style={turnTitle}>
                {currentPlayer?.name || "Player"}'s turn
                {isMyTurn ? " · YOU" : ""}
              </h2>

              <p style={messageText}>
                {rolling
                  ? "Rolling..."
                  : currentResult
                  ? `${currentPlayer?.name} rolled ${currentResult.total}.`
                  : isMyTurn
                  ? "Roll the dice."
                  : `Waiting for ${currentPlayer?.name}.`}
              </p>

              <button
                style={{
                  ...rollBtn,
                  opacity: canRoll ? 1 : 0.45,
                  cursor: canRoll ? "pointer" : "not-allowed",
                }}
                disabled={!canRoll}
                onClick={() => sendAction("roll")}
              >
                {rolling ? "Rolling..." : "🎲 Roll Dice"}
              </button>

              {currentResult && (
                <button
                  style={{
                    ...nextBtn,
                    opacity: canContinue ? 1 : 0.45,
                    cursor: canContinue ? "pointer" : "not-allowed",
                  }}
                  disabled={!canContinue}
                  onClick={() => sendAction("next")}
                >
                  {currentIdx < playerList.length - 1
                    ? "Next Player →"
                    : "Finish Round"}
                </button>
              )}
            </section>

            {message && <div style={messageBar}>{message}</div>}
          </>
        )}

        {screen === "results" && (
          <div style={resultsPanel}>
            <h2 style={setupTitle}>Results</h2>

            {rankedResults.map((entry, i) => (
              <div key={entry.playerId} style={resultRow}>
                <span>
                  #{i + 1} — {entry.name}
                </span>
                <strong>
                  {entry.d1 && entry.d2
                    ? `${dieFace(entry.d1)} ${dieFace(entry.d2)} = ${entry.score}`
                    : entry.score}
                </strong>
              </div>
            ))}

            {isHost ? (
              <button style={startButton} onClick={startGame}>
                Play Again
              </button>
            ) : (
              <p style={waitingText}>Waiting for the host to continue.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* styles */
const wrap = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
  padding: 20,
  boxSizing: "border-box",
};

const card = {
  width: "100%",
  maxWidth: 520,
  background:
    "radial-gradient(ellipse at 50% 20%, #256b40 0%, #123820 70%, #0b2416 100%)",
  color: "#f0e8d0",
  padding: 20,
  borderRadius: 18,
  textAlign: "center",
  boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const topRow = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: 10,
  marginBottom: 14,
};

const title = {
  fontSize: 28,
  margin: "0 0 4px",
};

const sub = {
  fontSize: 12,
  opacity: 0.8,
  margin: 0,
};

const hostPill = {
  justifySelf: "end",
  padding: "7px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.14)",
  fontSize: 12,
  fontWeight: 800,
};

const startSmallButton = {
  justifySelf: "start",
  padding: "8px 12px",
  borderRadius: 999,
  border: "none",
  background: "#f5d76e",
  color: "#1a1a1a",
  fontWeight: 900,
};

const setup = {
  padding: "14px 0",
};

const setupTitle = {
  fontFamily: "serif",
  color: "#f5d76e",
  margin: "0 0 8px",
};

const setupText = {
  fontSize: 13,
  color: "#a8c8a0",
  margin: "0 0 16px",
};

const scoreboard = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  marginTop: 15,
};

const scoreBox = {
  padding: 12,
  borderRadius: 12,
  background: "rgba(0,0,0,0.22)",
  border: "1px solid rgba(255,255,255,0.1)",
  minHeight: 86,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 6,
};

const activeScoreBox = {
  border: "2px solid #f5d76e",
  background: "rgba(0,0,0,0.34)",
  boxShadow: "0 0 18px rgba(245,215,110,0.16)",
};

const playerName = {
  fontSize: 13,
  fontWeight: 800,
  color: "#f5d76e",
};

const diceFaces = {
  fontSize: 30,
  lineHeight: 1,
};

const emptyDice = {
  fontSize: 22,
  opacity: 0.6,
};

const totalText = {
  fontSize: 20,
  fontWeight: 900,
};

const turnPanel = {
  marginTop: 18,
  padding: 16,
  borderRadius: 14,
  background: "rgba(0,0,0,0.24)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const turnTitle = {
  margin: "0 0 8px",
  fontSize: 22,
};

const messageText = {
  margin: "0 0 14px",
  fontSize: 13,
  color: "#a8c8a0",
};

const rollBtn = {
  marginTop: 4,
  padding: "12px 24px",
  fontSize: 16,
  borderRadius: 999,
  border: "none",
  background: "#f5d76e",
  color: "#1a1a1a",
  fontWeight: 900,
};

const nextBtn = {
  marginTop: 10,
  marginLeft: 8,
  padding: "12px 20px",
  borderRadius: 999,
  border: "none",
  background: "#2ecc71",
  color: "white",
  fontWeight: 900,
};

const messageBar = {
  marginTop: 10,
  padding: 10,
  borderRadius: 10,
  background: "rgba(0,0,0,0.24)",
  color: "#f5d76e",
  fontSize: 13,
};

const resultsPanel = {
  marginTop: 16,
  padding: 16,
  borderRadius: 14,
  background: "rgba(0,0,0,0.24)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const resultRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 0",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  fontSize: 14,
};

const startButton = {
  marginTop: 16,
  background: "#f5d76e",
  color: "#1a1a1a",
  border: "none",
  borderRadius: 999,
  padding: "12px 28px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
};

const waitingText = {
  marginTop: 14,
  color: "#a8c8a0",
  fontSize: 13,
};