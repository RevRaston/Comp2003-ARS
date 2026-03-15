// src/games/Darts/DartsGame.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import "./darts.css";

/**
 * Darts — WebSocket host-authoritative turn-based round
 * - Host runs simulation + broadcasts state
 * - Clients render host state
 * - Host controls advancing to next player
 * - After all players have taken a turn, round completes
 */

const defaultWsBase =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "ws://localhost:3000/ws"
    : "wss://comp2003-ars.onrender.com/ws";

const WS_URL = (
  import.meta.env.VITE_WS_URL ||
  import.meta.env.VITE_BACKEND_WS_URL ||
  defaultWsBase
).replace(/\/$/, "");

function getPlayerKey(player) {
  if (!player) return "";
  return String(
    player.user_id ??
      player.userId ??
      player.id ??
      player.profile_id ??
      player.profileId ??
      player.name ??
      ""
  );
}

export default function DartsGame({
  sessionCode,
  isHost,
  players = [],
  onRoundComplete,
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const wsRef = useRef(null);
  const runningRef = useRef(false);
  const onRoundCompleteRef = useRef(onRoundComplete);
  const announcedRef = useRef(false);

  useEffect(() => {
    onRoundCompleteRef.current = onRoundComplete;
  }, [onRoundComplete]);

  const [connLine, setConnLine] = useState("disconnected");
  const [statusMessage, setStatusMessage] = useState("");
  const [dartsLeft, setDartsLeft] = useState(5);
  const [timer, setTimer] = useState(60);
  const [turnFinished, setTurnFinished] = useState(false);
  const [score, setScore] = useState(0);

  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [turnScores, setTurnScores] = useState([]);
  const [roundFinished, setRoundFinished] = useState(false);

  const code = sessionCode || localStorage.getItem("session_code") || "local";

  const orderedPlayers = useMemo(() => {
    return Array.isArray(players) ? players.slice(0, 4) : [];
  }, [players]);

  const playerNames = useMemo(() => {
    return orderedPlayers.map(
      (p, i) => p?.display_name || p?.name || `Player ${i + 1}`
    );
  }, [orderedPlayers]);

  const playerKeys = useMemo(() => {
    return orderedPlayers.map(getPlayerKey);
  }, [orderedPlayers]);

  const activePlayerName =
    playerNames[currentPlayerIndex] || `Player ${currentPlayerIndex + 1}`;

  const stateRef = useRef({
    score: 0,
    dartsLeft: 5,
    timer: 60,
    finished: false,
    roundFinished: false,
    msg: "",
    currentPlayerIndex: 0,
    turnScores: [],
    dart: { x: 200, y: 450, fired: false, speed: 6 },
    target: { x: 200, y: 120, radius: 60, dir: 1, speed: 1.3 },
    particles: [],
    hitFlashTimer: 0,
  });

  useEffect(() => {
    const safeScores = playerNames.map((name, index) => ({
      playerIndex: index,
      playerName: name,
      score: 0,
    }));

    setTurnScores(safeScores);
    stateRef.current.turnScores = safeScores;
  }, [playerNames]);

  function wsSend(obj) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
  }

  function syncUiFromState() {
    const s = stateRef.current;
    setScore(s.score || 0);
    setDartsLeft(s.dartsLeft ?? 5);
    setTimer(s.timer ?? 60);
    setTurnFinished(Boolean(s.finished));
    setStatusMessage(s.msg || "");
    setCurrentPlayerIndex(Number(s.currentPlayerIndex || 0));
    setTurnScores(Array.isArray(s.turnScores) ? [...s.turnScores] : []);
    setRoundFinished(Boolean(s.roundFinished));
  }

  function fireDart() {
    if (!isHost) return;
    const s = stateRef.current;
    if (s.roundFinished) return;
    if (s.finished) return;
    if (s.dart.fired) return;
    if (s.dartsLeft <= 0) return;

    s.dart.fired = true;
    s.dartsLeft -= 1;
    s.msg = `🔥 ${activePlayerName} fires!`;

    syncUiFromState();
  }

  function resetTurnStateForCurrentPlayer() {
    const s = stateRef.current;
    s.score = 0;
    s.dartsLeft = 5;
    s.timer = 60;
    s.finished = false;
    s.msg = `${playerNames[s.currentPlayerIndex] || "Next player"}'s turn`;
    s.dart = { x: 200, y: 450, fired: false, speed: 6 };
    s.target = { x: 200, y: 120, radius: 60, dir: 1, speed: 1.3 };
    s.particles = [];
    s.hitFlashTimer = 0;
    syncUiFromState();
  }

  function handleNextPlayer() {
    if (!isHost) return;

    const s = stateRef.current;
    if (!s.finished || s.roundFinished) return;

    const nextIndex = s.currentPlayerIndex + 1;

    if (nextIndex >= playerNames.length) {
      s.roundFinished = true;
      s.msg = "Round complete! All players have taken a turn.";
      syncUiFromState();

      if (!announcedRef.current && typeof onRoundCompleteRef.current === "function") {
        announcedRef.current = true;
        onRoundCompleteRef.current({
          winnerKey: null,
          scores: s.turnScores,
        });
      }
      return;
    }

    s.currentPlayerIndex = nextIndex;
    resetTurnStateForCurrentPlayer();
  }

  // ---- WS connect + message handling ----
  useEffect(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    announcedRef.current = false;

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

      if (msg.type === "darts_state") {
        if (isHost) return;

        const payload = msg.payload;
        if (!payload) return;

        stateRef.current = {
          ...stateRef.current,
          ...payload,
          dart: payload.dart || stateRef.current.dart,
          target: payload.target || stateRef.current.target,
          particles: payload.particles || stateRef.current.particles,
          hitFlashTimer:
            typeof payload.hitFlashTimer === "number"
              ? payload.hitFlashTimer
              : stateRef.current.hitFlashTimer,
        };

        syncUiFromState();

        if (
          stateRef.current.roundFinished &&
          !announcedRef.current &&
          typeof onRoundCompleteRef.current === "function"
        ) {
          announcedRef.current = true;
          onRoundCompleteRef.current({
            winnerKey: null,
            scores: stateRef.current.turnScores,
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

  // ---- Reset round state when players become available ----
  useEffect(() => {
    if (!playerNames.length) return;

    const s = stateRef.current;
    s.currentPlayerIndex = 0;
    s.turnScores = playerNames.map((name, index) => ({
      playerIndex: index,
      playerName: name,
      score: 0,
    }));
    s.roundFinished = false;
    announcedRef.current = false;

    resetTurnStateForCurrentPlayer();
  }, [playerNames.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Host sim loop ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    canvas.width = 400;
    canvas.height = 500;

    const s = stateRef.current;

    function resetDart() {
      s.dart.x = 200;
      s.dart.y = 450;
      s.dart.fired = false;
    }

    function updateTarget() {
      s.target.x += s.target.dir * s.target.speed;
      if (
        s.target.x + s.target.radius >= canvas.width ||
        s.target.x - s.target.radius <= 0
      ) {
        s.target.dir *= -1;
      }
    }

    function updateDart() {
      if (!s.dart.fired) return;
      s.dart.y -= s.dart.speed;
      if (s.dart.y < 0) resetDart();
    }

    function createHitEffect(x, y) {
      for (let i = 0; i < 25; i++) {
        s.particles.push({
          x,
          y,
          dx: (Math.random() - 0.5) * 4,
          dy: (Math.random() - 0.5) * 4,
          life: 18,
        });
      }
    }

    function checkHit() {
      if (!s.dart.fired) return;

      const dx = s.dart.x - s.target.x;
      const dy = s.dart.y - s.target.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let points = 0;
      if (dist < s.target.radius * 0.3) points = 50;
      else if (dist < s.target.radius * 0.6) points = 25;
      else if (dist < s.target.radius) points = 10;
      else return;

      s.score += points;

      if (Array.isArray(s.turnScores) && s.turnScores[s.currentPlayerIndex]) {
        s.turnScores[s.currentPlayerIndex] = {
          ...s.turnScores[s.currentPlayerIndex],
          score: s.score,
        };
      }

      s.hitFlashTimer = 14;
      createHitEffect(s.target.x, s.target.y);
      resetDart();

      syncUiFromState();
    }

    function drawTarget() {
      const t = s.target;

      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius + 8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
      const ring1 = ctx.createRadialGradient(t.x, t.y, 10, t.x, t.y, t.radius);
      ring1.addColorStop(0, "#ff4d4d");
      ring1.addColorStop(1, "#b30000");
      ctx.fillStyle = ring1;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * 0.6, 0, Math.PI * 2);
      const ring2 = ctx.createRadialGradient(
        t.x,
        t.y,
        5,
        t.x,
        t.y,
        t.radius * 0.6
      );
      ring2.addColorStop(0, "white");
      ring2.addColorStop(1, "#ccc");
      ctx.fillStyle = ring2;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * 0.3, 0, Math.PI * 2);
      const ring3 = ctx.createRadialGradient(
        t.x,
        t.y,
        2,
        t.x,
        t.y,
        t.radius * 0.3
      );
      ring3.addColorStop(0, "#3399ff");
      ring3.addColorStop(1, "#003d66");
      ctx.fillStyle = ring3;
      ctx.fill();
    }

    function drawDart() {
      const d = s.dart;

      ctx.fillStyle = "#f2d16b";
      ctx.fillRect(d.x - 3, d.y - 25, 6, 25);

      ctx.beginPath();
      ctx.moveTo(d.x, d.y - 35);
      ctx.lineTo(d.x - 5, d.y - 25);
      ctx.lineTo(d.x + 5, d.y - 25);
      ctx.fillStyle = "#c0c0c0";
      ctx.fill();

      ctx.fillStyle = "#ff0066";
      ctx.beginPath();
      ctx.moveTo(d.x - 10, d.y - 5);
      ctx.lineTo(d.x, d.y - 20);
      ctx.lineTo(d.x + 10, d.y - 5);
      ctx.closePath();
      ctx.fill();
    }

    function drawUI() {
      ctx.fillStyle = "white";
      ctx.font = "20px Arial";
      ctx.fillText("Score: " + s.score, 20, 30);
      ctx.fillText("Darts: " + s.dartsLeft, 270, 30);
      ctx.fillText("Time: " + s.timer, 160, 55);
    }

    function drawParticles() {
      if (s.hitFlashTimer > 0) {
        ctx.beginPath();
        ctx.arc(
          s.target.x,
          s.target.y,
          s.target.radius + 12,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = `rgba(255,255,255,${s.hitFlashTimer / 14})`;
        ctx.fill();
        s.hitFlashTimer--;
      }

      const parts = s.particles;
      for (let p of parts) {
        ctx.fillStyle = `rgba(255,255,255,${p.life / 18})`;
        ctx.fillRect(p.x, p.y, 4, 4);
        p.x += p.dx;
        p.y += p.dy;
        p.life--;
      }
      s.particles = parts.filter((p) => p.life > 0);
    }

    function drawBackground() {
      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bg.addColorStop(0, "#1a1a1a");
      bg.addColorStop(1, "#333");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    let timerInterval = null;
    if (isHost) {
      timerInterval = setInterval(() => {
        if (s.roundFinished) return;
        if (s.finished) return;
        if (s.timer <= 0) return;

        s.timer -= 1;
        syncUiFromState();
      }, 1000);
    }

    let broadcastInterval = null;
    if (isHost) {
      broadcastInterval = setInterval(() => {
        wsSend({
          type: "darts_state",
          sessionCode: code,
          payload: {
            score: s.score,
            dartsLeft: s.dartsLeft,
            timer: s.timer,
            finished: s.finished,
            roundFinished: s.roundFinished,
            msg: s.msg || "",
            currentPlayerIndex: s.currentPlayerIndex,
            turnScores: s.turnScores,
            dart: s.dart,
            target: s.target,
            particles: s.particles,
            hitFlashTimer: s.hitFlashTimer,
          },
        });
      }, 100);
    }

    function loop() {
      drawBackground();

      if (
        isHost &&
        !s.finished &&
        !s.roundFinished &&
        (s.timer <= 0 || (s.dartsLeft === 0 && !s.dart.fired))
      ) {
        s.finished = true;
        s.msg = `Turn finished! ${playerNames[s.currentPlayerIndex] || "Player"} scored ${s.score}`;
        syncUiFromState();
      }

      drawTarget();
      drawDart();
      drawUI();
      drawParticles();

      if (isHost && !s.finished && !s.roundFinished) {
        updateTarget();
        updateDart();
        checkHit();
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (timerInterval) clearInterval(timerInterval);
      if (broadcastInterval) clearInterval(broadcastInterval);
    };
  }, [code, isHost, playerNames]);

  return (
    <div className="darts-container">
      <h1 className="title">Aim &amp; Fire!</h1>

      <div
        style={{
          color: "white",
          opacity: 0.7,
          fontSize: 12,
          marginBottom: 8,
        }}
      >
        {connLine} {isHost ? "— HOST" : "— CLIENT"} (room: {code})
      </div>

      <div style={{ color: "white", marginBottom: 10, textAlign: "center" }}>
        <div style={{ fontWeight: 700 }}>Current turn: {activePlayerName}</div>
        <div style={{ opacity: 0.8, fontSize: 14 }}>
          Player {currentPlayerIndex + 1} of {Math.max(playerNames.length, 1)}
        </div>
      </div>

      <canvas ref={canvasRef} id="dartsCanvas" width={400} height={500} />

      <button
        onClick={fireDart}
        className="fire-btn"
        disabled={!isHost || turnFinished || roundFinished}
      >
        {isHost ? "FIRE" : "Host is playing…"}
      </button>

      <div className="game-message">{statusMessage}</div>

      <div style={{ marginTop: 10, color: "white", opacity: 0.85 }}>
        <div>Score: {score}</div>
        <div>Darts left: {dartsLeft}</div>
        <div>Time: {timer}</div>
      </div>

      <div
        style={{
          marginTop: 18,
          color: "white",
          width: "100%",
          maxWidth: 420,
          textAlign: "left",
        }}
      >
        <h3 style={{ marginBottom: 8 }}>Turn Order Scores</h3>
        {turnScores.map((entry) => (
          <div
            key={`${entry.playerIndex}-${entry.playerName}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 0",
              opacity: entry.playerIndex === currentPlayerIndex ? 1 : 0.82,
              fontWeight: entry.playerIndex === currentPlayerIndex ? 700 : 400,
            }}
          >
            <span>{entry.playerName}</span>
            <span>{entry.score}</span>
          </div>
        ))}
      </div>

      {turnFinished && !roundFinished && (
        <div className="turn-finished-panel">
          <p>
            Turn finished — {activePlayerName} scored {score}
          </p>
          {isHost ? (
            <button className="next-btn" onClick={handleNextPlayer}>
              {currentPlayerIndex < playerNames.length - 1
                ? "Next Player"
                : "Finish Round"}
            </button>
          ) : (
            <p style={{ opacity: 0.8 }}>Waiting for host…</p>
          )}
        </div>
      )}

      {roundFinished && (
        <div className="turn-finished-panel">
          <p>Round finished — all players have completed their turns.</p>
          {!isHost && <p style={{ opacity: 0.8 }}>Waiting for host…</p>}
        </div>
      )}
    </div>
  );
}