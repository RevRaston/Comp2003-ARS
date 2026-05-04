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

const WHEEL_COLOURS = ["#ff7070", "#ffb84d", "#f5d76e", "#7bd88f", "#6bbcff", "#c08cff"];

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
      ? players.slice(0, 6)
      : [{ id: "p1", name: "Player 1" }, { id: "p2", name: "Player 2" }];

  return usable.map((p, index) => ({
    id: getPlayerKey(p, `p${index + 1}`),
    name: p.display_name || p.name || `Player ${index + 1}`,
  }));
}

function normalizeAngle(angle) {
  return ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

function getLandedIndex(rotation, count) {
  if (!count) return 0;

  const sliceAngle = (Math.PI * 2) / count;
  const pointerAngle = -Math.PI / 2;

  let relativeAngle = pointerAngle - rotation;
  relativeAngle = normalizeAngle(relativeAngle);

  return Math.floor(relativeAngle / sliceAngle);
}

export default function Roulette({
  sessionCode,
  players = [],
  isHost = false,
  myUserId = null,
  onRoundComplete,
  onComplete,
}) {
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const runningRef = useRef(false);
  const onRoundCompleteRef = useRef(onRoundComplete);
  const announcedRef = useRef(false);
  const animationRef = useRef(0);

  const code = sessionCode || localStorage.getItem("session_code") || "local";
  const localUserId = String(myUserId || localStorage.getItem("user_id") || "");

  const playerList = useMemo(() => makeSafePlayers(players), [players]);

  const [connLine, setConnLine] = useState("disconnected");
  const [screen, setScreen] = useState("setup");
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [loser, setLoser] = useState(null);
  const [rankedResults, setRankedResults] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    onRoundCompleteRef.current = onRoundComplete;
  }, [onRoundComplete]);

  const myPlayerIndex = useMemo(() => {
    if (!localUserId) return -1;
    return playerList.findIndex((p) => String(p.id) === String(localUserId));
  }, [playerList, localUserId]);

  function wsSend(obj) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
  }

  function buildState(overrides = {}) {
    return {
      screen,
      rotation,
      spinning,
      loser,
      rankedResults,
      message,
      ...overrides,
    };
  }

  function applyState(payload) {
    if (!payload) return;

    setScreen(payload.screen ?? "setup");
    setRotation(Number(payload.rotation || 0));
    setSpinning(Boolean(payload.spinning));
    setLoser(payload.loser || null);
    setRankedResults(Array.isArray(payload.rankedResults) ? payload.rankedResults : []);
    setMessage(payload.message || "");
  }

  function broadcastState(nextState = {}) {
    if (!isHost) return;

    wsSend({
      type: "roulette_state",
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
      screen: "ready",
      rotation: 0,
      spinning: false,
      loser: null,
      rankedResults: [],
      message: "Ready to spin. Whoever the arrow lands on pays.",
    });
  }

  function hostSpinWheel() {
    if (!isHost) return;
    if (spinning) return;
    if (screen !== "ready" && screen !== "results") return;
    if (playerList.length === 0) return;

    const startRotation = rotation;
    const spinAmount = Math.random() * 4 + 5;
    const targetRotation = startRotation + spinAmount * Math.PI * 2;
    const duration = 3500;
    const startTime = performance.now();

    announcedRef.current = false;

    setAndBroadcast({
      screen: "spinning",
      spinning: true,
      loser: null,
      rankedResults: [],
      message: "Wheel spinning...",
    });

    function animate(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const nextRotation = startRotation + (targetRotation - startRotation) * easeOut;

      setRotation(nextRotation);

      if (isHost) {
        wsSend({
          type: "roulette_state",
          sessionCode: code,
          payload: buildState({
            screen: "spinning",
            rotation: nextRotation,
            spinning: true,
            loser: null,
            rankedResults: [],
            message: "Wheel spinning...",
          }),
        });
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const finalRotation = targetRotation;
      const landedIndex = getLandedIndex(finalRotation, playerList.length);
      const landedPlayer = playerList[landedIndex] || playerList[0];

      const ranked = playerList
        .map((p) => ({
          playerId: p.id,
          name: p.name,
          score: p.id === landedPlayer.id ? 0 : 1,
          result: p.id === landedPlayer.id ? "Pays" : "Safe",
        }))
        .sort((a, b) => b.score - a.score);

      const finalState = {
        screen: "results",
        rotation: finalRotation,
        spinning: false,
        loser: landedPlayer,
        rankedResults: ranked,
        message: `${landedPlayer.name} pays.`,
      };

      setAndBroadcast(finalState);

      onComplete?.({
        result:
          myPlayerIndex >= 0 && playerList[myPlayerIndex]?.id === landedPlayer.id
            ? "player_lost"
            : "player_safe",
        loser: landedPlayer.name,
      });

      if (!announcedRef.current && typeof onRoundCompleteRef.current === "function") {
        announcedRef.current = true;

        onRoundCompleteRef.current({
          winnerKey: ranked[0]?.playerId || null,
          scores: ranked,
        });
      }
    }

    animationRef.current = requestAnimationFrame(animate);
  }

  function sendAction(action) {
    if (isHost) {
      if (action === "start") startGame();
      if (action === "spin") hostSpinWheel();
      return;
    }

    wsSend({
      type: "roulette_action",
      sessionCode: code,
      payload: { action },
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

      if (msg.type === "roulette_action" && isHost) {
        const { action } = msg.payload || {};

        if (action === "start") startGame();
        if (action === "spin") hostSpinWheel();

        return;
      }

      if (msg.type === "roulette_state") {
        if (isHost) return;
        applyState(msg.payload);
      }
    };

    return () => {
      try {
        wsRef.current?.close();
      } catch {}
      cancelAnimationFrame(animationRef.current);
      wsRef.current = null;
      runningRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, isHost]);

  useEffect(() => {
    drawWheel(canvasRef.current, playerList, rotation);
  }, [playerList, rotation]);

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={topRow}>
          <button
            style={{
              ...smallButton,
              opacity: isHost && screen === "setup" ? 1 : 0.45,
              cursor: isHost && screen === "setup" ? "pointer" : "not-allowed",
            }}
            disabled={!isHost || screen !== "setup"}
            onClick={() => sendAction("start")}
          >
            Start
          </button>

          <div>
            <h1 style={title}>🎡 Roulette</h1>
            <p style={sub}>Payment wheel · {connLine}</p>
          </div>

          <div style={hostPill}>{isHost ? "Host" : "Player"}</div>
        </div>

        {screen === "setup" && (
          <section style={setup}>
            <h2 style={setupTitle}>Roulette table</h2>
            <p style={setupText}>
              The wheel contains everyone in the session. Whoever the arrow lands on pays.
            </p>

            <div style={playerGrid}>
              {playerList.map((p, index) => (
                <div key={p.id} style={playerChip}>
                  P{index + 1}: <strong>{p.name}</strong>
                  {index === myPlayerIndex ? " (You)" : ""}
                </div>
              ))}
            </div>

            {isHost ? (
              <button style={startButton} onClick={() => sendAction("start")}>
                Start Game
              </button>
            ) : (
              <p style={waitingText}>Waiting for the host to start.</p>
            )}
          </section>
        )}

        {(screen === "ready" || screen === "spinning" || screen === "results") && (
          <>
            <section style={wheelPanel}>
              <div style={arrow}>▼</div>
              <canvas ref={canvasRef} width={320} height={320} style={canvasStyle} />
            </section>

            <div style={messageBar}>{message}</div>

            <button
              style={{
                ...spinButton,
                opacity: isHost && !spinning ? 1 : 0.45,
                cursor: isHost && !spinning ? "pointer" : "not-allowed",
              }}
              disabled={!isHost || spinning}
              onClick={() => sendAction("spin")}
            >
              {spinning ? "Spinning..." : screen === "results" ? "Spin Again" : "SPIN"}
            </button>

            <div style={playerGrid}>
              {playerList.map((p, index) => {
                const isLanded = loser?.id === p.id;

                return (
                  <div
                    key={p.id}
                    style={{
                      ...playerChip,
                      ...(isLanded ? loserChip : null),
                    }}
                  >
                    <strong>{p.name}</strong>
                    {index === myPlayerIndex ? " (You)" : ""}
                    <div style={chipSub}>{isLanded ? "Pays" : "Safe"}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {screen === "results" && loser && (
          <section style={resultsPanel}>
            <h2 style={resultTitle}>{loser.name} pays!</h2>
            <p style={setupText}>
              Roulette picked the payment loser. The Arena will handle round progression.
            </p>

            {rankedResults.map((entry, index) => (
              <div key={entry.playerId} style={resultRow}>
                <span>
                  #{index + 1} — {entry.name}
                </span>
                <strong>{entry.result}</strong>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

function drawWheel(canvas, players, rotation) {
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 12;

  ctx.clearRect(0, 0, width, height);

  if (!players.length) {
    ctx.fillStyle = "#f5d76e";
    ctx.font = "bold 18px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("No players", cx, cy);
    return;
  }

  const sliceAngle = (Math.PI * 2) / players.length;

  players.forEach((player, i) => {
    const start = rotation + i * sliceAngle;
    const end = start + sliceAngle;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = WHEEL_COLOURS[i % WHEEL_COLOURS.length];
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + sliceAngle / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#111";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.fillText(player.name, radius - 14, 6);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fillStyle = "#123820";
  ctx.fill();
  ctx.strokeStyle = "#f5d76e";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = "#f5d76e";
  ctx.font = "bold 16px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("RP", cx, cy + 6);
}

const wrap = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
  padding: 20,
  boxSizing: "border-box",
};

const card = {
  width: "100%",
  maxWidth: 620,
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

const smallButton = {
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
  lineHeight: 1.5,
};

const playerGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 8,
  marginTop: 14,
};

const playerChip = {
  padding: 10,
  borderRadius: 10,
  background: "rgba(0,0,0,0.25)",
  border: "1px solid rgba(255,255,255,0.1)",
  fontSize: 13,
};

const loserChip = {
  border: "1px solid rgba(245,215,110,0.75)",
  background: "rgba(245,215,110,0.14)",
  color: "#f5d76e",
};

const chipSub = {
  marginTop: 4,
  fontSize: 11,
  color: "#a8c8a0",
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

const wheelPanel = {
  position: "relative",
  margin: "10px auto 14px",
  width: "min(100%, 340px)",
  display: "flex",
  justifyContent: "center",
};

const arrow = {
  position: "absolute",
  top: -4,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 2,
  color: "#f5d76e",
  fontSize: 30,
  textShadow: "0 4px 10px rgba(0,0,0,0.45)",
};

const canvasStyle = {
  width: "100%",
  maxWidth: 320,
  height: "auto",
  borderRadius: "50%",
  background: "rgba(0,0,0,0.22)",
  border: "6px solid rgba(245,215,110,0.35)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
};

const messageBar = {
  marginTop: 10,
  padding: 10,
  borderRadius: 10,
  background: "rgba(0,0,0,0.24)",
  color: "#f5d76e",
  fontSize: 13,
};

const spinButton = {
  marginTop: 12,
  background: "#f5d76e",
  color: "#1a1a1a",
  border: "none",
  borderRadius: 999,
  padding: "13px 34px",
  fontSize: 16,
  fontWeight: 900,
};

const resultsPanel = {
  marginTop: 16,
  padding: 16,
  borderRadius: 14,
  background: "rgba(0,0,0,0.24)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const resultTitle = {
  color: "#f5d76e",
  margin: "0 0 8px",
};

const resultRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 0",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  fontSize: 14,
};