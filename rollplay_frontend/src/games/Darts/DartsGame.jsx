// src/games/Darts/DartsGame.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import "./darts.css";

/**
 * Darts — WebSocket host-authoritative
 * - Host runs simulation + broadcasts state
 * - Clients just render state
 * - Host-only FIRE (for now)
 *
 * Transport: WebSocket (ws://localhost:3000/ws) or VITE_WS_URL
 */

const WS_URL =
  (import.meta.env.VITE_WS_URL && import.meta.env.VITE_WS_URL.replace(/\/$/, "")) ||
  "ws://localhost:3000/ws";

export default function DartsGame({ sessionCode, isHost }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);

  const [connLine, setConnLine] = useState("disconnected");
  const [statusMessage, setStatusMessage] = useState("");

  // Rendered UI values (synced from authoritative refs)
  const [dartsLeft, setDartsLeft] = useState(5);
  const [timer, setTimer] = useState(60);
  const [turnFinished, setTurnFinished] = useState(false);
  const [score, setScore] = useState(0);

  const wsRef = useRef(null);
  const runningRef = useRef(false);

  const code = sessionCode || localStorage.getItem("session_code") || "local";

  // Authoritative state lives in refs (host mutates, clients overwrite from network)
  const stateRef = useRef({
    score: 0,
    dartsLeft: 5,
    timer: 60,
    finished: false,
    msg: "",
    dart: { x: 200, y: 450, fired: false, speed: 6 },
    target: { x: 200, y: 120, radius: 60, dir: 1, speed: 1.3 },
    particles: [],
    hitFlashTimer: 0,
  });

  function wsSend(obj) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
  }

  // Only host can fire (for now)
  function fireDart() {
    if (!isHost) return;
    const s = stateRef.current;
    if (s.finished) return;
    if (s.dart.fired) return;
    if (s.dartsLeft <= 0) return;

    s.dart.fired = true;
    s.dartsLeft -= 1;

    s.msg = "🔥 The dart rockets forward!";
    setStatusMessage(s.msg);

    // push UI updates immediately (host)
    setDartsLeft(s.dartsLeft);
  }

  // ---- WS connect + message handling ----
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

      // Host can ignore its own state packets; clients apply them
      if (msg.type === "darts_state") {
        if (isHost) return;

        const payload = msg.payload;
        if (!payload) return;

        // overwrite local refs from host snapshot
        stateRef.current = {
          ...stateRef.current,
          ...payload,
          // ensure nested objects exist
          dart: payload.dart || stateRef.current.dart,
          target: payload.target || stateRef.current.target,
          particles: payload.particles || stateRef.current.particles,
          hitFlashTimer:
            typeof payload.hitFlashTimer === "number"
              ? payload.hitFlashTimer
              : stateRef.current.hitFlashTimer,
        };

        const s = stateRef.current;

        setScore(s.score || 0);
        setDartsLeft(s.dartsLeft ?? 5);
        setTimer(s.timer ?? 60);
        setTurnFinished(Boolean(s.finished));
        setStatusMessage(s.msg || "");
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
      s.hitFlashTimer = 14;
      createHitEffect(s.target.x, s.target.y);
      resetDart();

      // UI update for host
      setScore(s.score);
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

    // host timer (1s)
    let timerInterval = null;
    if (isHost) {
      timerInterval = setInterval(() => {
        if (s.finished) return;
        if (s.timer <= 0) return;
        s.timer -= 1;
        setTimer(s.timer);
      }, 1000);
    }

    // host broadcaster (~10hz)
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
            msg: s.msg || "",
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

      // finish logic (host decides)
      if (
        isHost &&
        !s.finished &&
        (s.timer <= 0 || (s.dartsLeft === 0 && !s.dart.fired))
      ) {
        s.finished = true;
        s.msg = `Turn finished! Score: ${s.score}`;
        setTurnFinished(true);
        setStatusMessage(s.msg);
      }

      drawTarget();
      drawDart();
      drawUI();
      drawParticles();

      if (isHost && !s.finished) {
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
  }, [code, isHost]);

  // Host-only reset (for now)
  function handleReplay() {
    if (!isHost) return;
    const s = stateRef.current;

    s.score = 0;
    s.dartsLeft = 5;
    s.timer = 60;
    s.finished = false;
    s.msg = "";

    s.dart = { x: 200, y: 450, fired: false, speed: 6 };
    s.target = { x: 200, y: 120, radius: 60, dir: 1, speed: 1.3 };
    s.particles = [];
    s.hitFlashTimer = 0;

    setScore(0);
    setDartsLeft(5);
    setTimer(60);
    setTurnFinished(false);
    setStatusMessage("");
  }

  return (
    <div className="darts-container">
      <h1 className="title">Aim &amp; Fire!</h1>

      <div style={{ color: "white", opacity: 0.7, fontSize: 12, marginBottom: 8 }}>
        {connLine} {isHost ? "— HOST" : "— CLIENT"} (room: {code})
      </div>

      <canvas ref={canvasRef} id="dartsCanvas" width={400} height={500} />

      <button onClick={fireDart} className="fire-btn" disabled={!isHost || turnFinished}>
        {isHost ? "FIRE" : "Host is playing…"}
      </button>

      <div className="game-message">{statusMessage}</div>

      <div style={{ marginTop: 10, color: "white", opacity: 0.85 }}>
        <div>Score: {score}</div>
        <div>Darts left: {dartsLeft}</div>
        <div>Time: {timer}</div>
      </div>

      {turnFinished && (
        <div className="turn-finished-panel">
          <p>Turn finished – score: {score}</p>
          {isHost ? (
            <button className="next-btn" onClick={handleReplay}>
              Replay (host)
            </button>
          ) : (
            <p style={{ opacity: 0.8 }}>Waiting for host…</p>
          )}
        </div>
      )}
    </div>
  );
}