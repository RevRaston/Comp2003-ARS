import { useEffect, useRef, useState } from "react";
import { useGame } from "../../GameContext";
import { supabase } from "../../supabase";
import "./darts.css";

/**
 * Host-only Darts mini-game.
 * - Only host can press FIRE.
 * - Everyone can open /game/darts to watch the canvas.
 * - When darts/time run out, we show "Turn finished".
 */
export default function DartsGame() {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  const { isHost, sessionId } = useGame();

  const [dartsLeft, setDartsLeft] = useState(5);
  const [timer, setTimer] = useState(60);
  const [statusMessage, setStatusMessage] = useState("");
  const [turnFinished, setTurnFinished] = useState(false);

  // Authoritative game values
  const scoreRef = useRef(0);
  const dartsLeftRef = useRef(5);
  const timerRef = useRef(60);
  const finishedRef = useRef(false);

  const game = useRef({
    dart: { x: 200, y: 450, fired: false, speed: 6 },
    target: { x: 200, y: 120, radius: 60, dir: 1, speed: 1.3 },
    particles: [],
    hitFlashTimer: 0,
  });

  // Small flavour-only message
  async function gameMessage() {
    return "🔥 The dart rockets forward!";
  }

  function fireDart() {
    const g = game.current;
    if (!isHost) return;
    if (finishedRef.current) return;
    if (g.dart.fired || dartsLeftRef.current <= 0) return;

    g.dart.fired = true;
    dartsLeftRef.current -= 1;
    setDartsLeft(dartsLeftRef.current);

    gameMessage().then((msg) => setStatusMessage(msg));
  }

  // If we somehow land here without a session, show a safe fallback.
  if (!sessionId) {
    return (
      <div className="darts-container">
        <h1 className="title">Aim &amp; Fire!</h1>
        <p style={{ color: "white", marginTop: 40 }}>
          No session active. Go back to the lobby and start a game.
        </p>
      </div>
    );
  }

  // 1-second timer (host drives the timer)
  useEffect(() => {
    if (!isHost) return;

    const interval = setInterval(() => {
      if (finishedRef.current) return;
      if (timerRef.current <= 0) return;

      timerRef.current -= 1;
      setTimer(timerRef.current);
    }, 1000);

    return () => clearInterval(interval);
  }, [isHost]);

  // HOST: sync state to Supabase whenever key values change
  useEffect(() => {
    if (!sessionId || !isHost) return;

    const g = game.current;

    const syncState = async () => {
      try {
        await supabase
          .from("session_game_state")
          .update({
            game_state: {
              dart: g.dart,
              target: g.target,
              score: scoreRef.current,
              dartsLeft: dartsLeftRef.current,
              timer: timerRef.current,
            },
            updated_at: new Date(),
          })
          .eq("session_id", sessionId);
      } catch (err) {
        console.error("Error syncing darts state:", err);
      }
    };

    syncState();
  }, [dartsLeft, timer, sessionId, isHost]);

  // NON-HOSTS: poll state and mirror host every 200ms
  useEffect(() => {
    if (!sessionId || isHost) return;

    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from("session_game_state")
          .select("game_state")
          .eq("session_id", sessionId)
          .single();

        if (error) return;
        if (!data?.game_state) return;

        const s = data.game_state;
        game.current.dart = s.dart;
        game.current.target = s.target;

        scoreRef.current = s.score ?? 0;
        dartsLeftRef.current = s.dartsLeft ?? 5;
        timerRef.current = s.timer ?? 60;

        setDartsLeft(dartsLeftRef.current);
        setTimer(timerRef.current);
      } catch (err) {
        console.error("Error polling darts state:", err);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [sessionId, isHost]);

  // Canvas + game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const g = game.current;

    function resetDart() {
      g.dart.x = 200;
      g.dart.y = 450;
      g.dart.fired = false;
    }

    function updateTarget() {
      g.target.x += g.target.dir * g.target.speed;
      if (
        g.target.x + g.target.radius >= canvas.width ||
        g.target.x - g.target.radius <= 0
      ) {
        g.target.dir *= -1;
      }
    }

    function updateDart() {
      if (!g.dart.fired) return;
      g.dart.y -= g.dart.speed;
      if (g.dart.y < 0) resetDart();
    }

    function createHitEffect(x, y) {
      for (let i = 0; i < 25; i++) {
        g.particles.push({
          x,
          y,
          dx: (Math.random() - 0.5) * 4,
          dy: (Math.random() - 0.5) * 4,
          life: 18,
        });
      }
    }

    function checkHit() {
      if (!g.dart.fired) return;

      const dx = g.dart.x - g.target.x;
      const dy = g.dart.y - g.target.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let points = 0;
      if (dist < g.target.radius * 0.3) points = 50;
      else if (dist < g.target.radius * 0.6) points = 25;
      else if (dist < g.target.radius) points = 10;
      else return;

      scoreRef.current += points;
      g.hitFlashTimer = 14;
      createHitEffect(g.target.x, g.target.y);
      resetDart();
    }

    function drawTarget() {
      const t = g.target;

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
      const d = g.dart;

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
      ctx.fillText("Score: " + scoreRef.current, 20, 30);
      ctx.fillText("Darts: " + dartsLeftRef.current, 300, 30);
      ctx.fillText("Time: " + timerRef.current, 170, 30);
    }

    function drawParticles() {
      if (g.hitFlashTimer > 0) {
        ctx.beginPath();
        ctx.arc(
          g.target.x,
          g.target.y,
          g.target.radius + 12,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = `rgba(255,255,255,${g.hitFlashTimer / 14})`;
        ctx.fill();
        g.hitFlashTimer--;
      }

      const parts = g.particles;
      for (let p of parts) {
        ctx.fillStyle = `rgba(255,255,255,${p.life / 18})`;
        ctx.fillRect(p.x, p.y, 4, 4);
        p.x += p.dx;
        p.y += p.dy;
        p.life--;
      }

      g.particles = parts.filter((p) => p.life > 0);
    }

    function drawBackground() {
      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bg.addColorStop(0, "#1a1a1a");
      bg.addColorStop(1, "#333");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function loop() {
      drawBackground();

      if (
        !finishedRef.current &&
        (timerRef.current <= 0 ||
          (dartsLeftRef.current === 0 && !g.dart.fired))
      ) {
        finishedRef.current = true;
        setTurnFinished(true);
        setStatusMessage("Turn finished! Hand over to the next player.");
      }

      drawTarget();
      drawDart();
      drawUI();
      drawParticles();

      if (!finishedRef.current) {
        updateTarget();
        updateDart();
        checkHit();
      }

      animationRef.current = requestAnimationFrame(loop);
    }

    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  function handleNextPlayer() {
    // For now just reset the same player's turn.
    scoreRef.current = 0;
    dartsLeftRef.current = 5;
    timerRef.current = 60;

    setDartsLeft(5);
    setTimer(60);
    setTurnFinished(false);
    finishedRef.current = false;
    setStatusMessage("");

    game.current.dart = { x: 200, y: 450, fired: false, speed: 6 };
    game.current.target = {
      x: 200,
      y: 120,
      radius: 60,
      dir: 1,
      speed: 1.3,
    };
    game.current.particles = [];
    game.current.hitFlashTimer = 0;
  }

  return (
    <div className="darts-container">
      <h1 className="title">Aim &amp; Fire!</h1>

      <canvas
        ref={canvasRef}
        id="dartsCanvas"
        width={400}
        height={500}
      />

      <button
        onClick={fireDart}
        className="fire-btn"
        disabled={!isHost || turnFinished}
      >
        {isHost ? "FIRE" : "Host is playing…"}
      </button>

      <div className="game-message">{statusMessage}</div>

      {turnFinished && (
        <div className="turn-finished-panel">
          <p>Turn finished – score: {scoreRef.current}</p>
          <button className="next-btn" onClick={handleNextPlayer}>
            Next player / replay
          </button>
        </div>
      )}
    </div>
  );
}



