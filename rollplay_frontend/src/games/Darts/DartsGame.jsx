import { useEffect, useMemo, useRef, useState } from "react";
import "./darts.css";

/**
 * Darts — WebSocket host-authoritative turn-based round
 * Visual overhaul:
 * - pub-style responsive background
 * - cutout / collage inspired target presentation
 * - avatar-influenced throwing hand + sleeve
 * - clearer dartboard and stronger visual identity
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

function safeParseAvatar(player) {
  if (!player) return null;

  const raw = player.avatar_json ?? player.avatarJson ?? null;
  if (!raw) return null;

  try {
    if (typeof raw === "string") return JSON.parse(raw);
    if (typeof raw === "object") return raw;
  } catch {
    return null;
  }

  return null;
}

function getHandVisual(activePlayer) {
  const avatar = safeParseAvatar(activePlayer);

  const skin = avatar?.skin || "#F2C7A5";
  const sleeve = avatar?.outfitColor || "#7C5CFF";
  const accessory = avatar?.accessory || "none";
  const outfit = avatar?.outfit || "hoodie";

  let variant = "normal";

  if (outfit === "armor") variant = "gauntlet";
  else if (accessory === "cap") variant = "cartoon";
  else if (accessory === "earring") variant = "ringed";
  else if (accessory === "glasses") variant = "cuffed";

  return {
    skin,
    sleeve,
    variant,
  };
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
  const myUserId = String(localStorage.getItem("user_id") || "");

  const orderedPlayers = useMemo(() => {
    return Array.isArray(players) ? players.slice(0, 4) : [];
  }, [players]);

  const playerNames = useMemo(() => {
    return orderedPlayers.map(
      (p, i) => p?.display_name || p?.name || `Player ${i + 1}`
    );
  }, [orderedPlayers]);

  const myPlayerIndex = useMemo(() => {
    if (!myUserId) return -1;
    return orderedPlayers.findIndex((p) => getPlayerKey(p) === myUserId);
  }, [orderedPlayers, myUserId]);

  const activePlayerName =
    playerNames[currentPlayerIndex] || `Player ${currentPlayerIndex + 1}`;

  const myRoleLabel =
    myPlayerIndex === -1 ? "Spectating" : `You are P${myPlayerIndex + 1}`;

  const activePlayer = orderedPlayers[currentPlayerIndex] || null;

  const stateRef = useRef({
    score: 0,
    dartsLeft: 5,
    timer: 60,
    finished: false,
    roundFinished: false,
    msg: "",
    currentPlayerIndex: 0,
    turnScores: [],
    dart: { x: 220, y: 456, fired: false, speed: 6.8 },
    target: { x: 220, y: 128, radius: 68, dir: 1, speed: 1.55 },
    particles: [],
    hitFlashTimer: 0,
  });

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

  function applyHostFire() {
    const s = stateRef.current;

    if (s.roundFinished) return;
    if (s.finished) return;
    if (s.dart.fired) return;
    if (s.dartsLeft <= 0) return;

    s.dart.fired = true;
    s.dartsLeft -= 1;
    s.msg = `🎯 ${playerNames[s.currentPlayerIndex] || "Player"} fires!`;

    syncUiFromState();
  }

  function fireDart() {
    const s = stateRef.current;

    if (s.roundFinished) return;
    if (s.finished) return;
    if (s.dart.fired) return;
    if (s.dartsLeft <= 0) return;
    if (myPlayerIndex !== s.currentPlayerIndex) return;

    if (isHost) {
      applyHostFire();
      return;
    }

    wsSend({
      type: "darts_fire",
      sessionCode: code,
      payload: {
        playerIndex: myPlayerIndex,
        userId: myUserId,
      },
    });
  }

  function resetTurnStateForCurrentPlayer() {
    const s = stateRef.current;
    s.score = 0;
    s.dartsLeft = 5;
    s.timer = 60;
    s.finished = false;
    s.msg = `${playerNames[s.currentPlayerIndex] || "Next player"}'s turn`;
    s.dart = { x: 220, y: 456, fired: false, speed: 6.8 };
    s.target = { x: 220, y: 128, radius: 68, dir: 1, speed: 1.55 };
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

      if (
        !announcedRef.current &&
        typeof onRoundCompleteRef.current === "function"
      ) {
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

      if (msg.type === "darts_fire" && isHost) {
        const requestedIndex = Number(msg.payload?.playerIndex);
        const s = stateRef.current;

        if (
          requestedIndex === s.currentPlayerIndex &&
          !s.finished &&
          !s.roundFinished &&
          !s.dart.fired &&
          s.dartsLeft > 0
        ) {
          applyHostFire();
        }
        return;
      }

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
  }, [code, isHost, myPlayerIndex, myUserId, playerNames]);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    canvas.width = 440;
    canvas.height = 560;

    const s = stateRef.current;

    function resetDart() {
      s.dart.x = 220;
      s.dart.y = 456;
      s.dart.fired = false;
    }

    function updateTarget() {
      s.target.x += s.target.dir * s.target.speed;
      if (
        s.target.x + s.target.radius >= canvas.width - 18 ||
        s.target.x - s.target.radius <= 18
      ) {
        s.target.dir *= -1;
      }
    }

    function updateDart() {
      if (!s.dart.fired) return;
      s.dart.y -= s.dart.speed;
      if (s.dart.y < -40) resetDart();
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
      if (dist < s.target.radius * 0.22) points = 50;
      else if (dist < s.target.radius * 0.48) points = 25;
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

    function drawBackground() {
      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bg.addColorStop(0, "#2c1d17");
      bg.addColorStop(0.45, "#211610");
      bg.addColorStop(1, "#120d0a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // warm lamp glow
      const glow = ctx.createRadialGradient(220, 80, 20, 220, 80, 220);
      glow.addColorStop(0, "rgba(255,208,120,0.20)");
      glow.addColorStop(1, "rgba(255,208,120,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // framed poster blocks / shelf silhouettes
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(28, 38, 84, 110);
      ctx.fillRect(330, 52, 74, 96);

      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.fillRect(46, 54, 48, 78);
      ctx.fillRect(346, 66, 42, 64);

      // subtle shelf shapes
      ctx.fillStyle = "rgba(255,255,255,0.035)";
      ctx.fillRect(40, 210, 360, 10);

      ctx.fillStyle = "rgba(255,220,170,0.06)";
      ctx.fillRect(54, 186, 20, 24);
      ctx.fillRect(86, 174, 16, 36);
      ctx.fillRect(118, 182, 22, 28);
      ctx.fillRect(302, 178, 18, 32);
      ctx.fillRect(332, 184, 20, 26);
      ctx.fillRect(364, 172, 16, 38);

      // lower wall to table / crowd line vibe
      ctx.fillStyle = "rgba(0,0,0,0.14)";
      ctx.fillRect(0, 390, canvas.width, 170);

      // paper-cutout vignette
      const vignette = ctx.createLinearGradient(0, 0, 0, canvas.height);
      vignette.addColorStop(0, "rgba(0,0,0,0.10)");
      vignette.addColorStop(0.7, "rgba(0,0,0,0.04)");
      vignette.addColorStop(1, "rgba(0,0,0,0.28)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function drawBoardHanger(t) {
      ctx.strokeStyle = "rgba(255,224,180,0.45)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(t.x, 22);
      ctx.lineTo(t.x, t.y - t.radius - 8);
      ctx.stroke();

      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(t.x, t.y + t.radius + 14, t.radius * 0.92, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawTarget() {
      const t = s.target;

      drawBoardHanger(t);

      // outer cutout shadow
      ctx.beginPath();
      ctx.arc(t.x + 4, t.y + 6, t.radius + 8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.30)";
      ctx.fill();

      // board rim
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius + 6, 0, Math.PI * 2);
      ctx.fillStyle = "#d6b689";
      ctx.fill();

      // outer board
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#efe7d5";
      ctx.fill();

      // ring 1
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * 0.82, 0, Math.PI * 2);
      ctx.fillStyle = "#1b1f25";
      ctx.fill();

      // ring 2
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * 0.68, 0, Math.PI * 2);
      ctx.fillStyle = "#d8d1c4";
      ctx.fill();

      // ring 3
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * 0.48, 0, Math.PI * 2);
      ctx.fillStyle = "#b11f2e";
      ctx.fill();

      // ring 4
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * 0.30, 0, Math.PI * 2);
      ctx.fillStyle = "#f0eadc";
      ctx.fill();

      // bull
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = "#3b7c45";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * 0.055, 0, Math.PI * 2);
      ctx.fillStyle = "#c53134";
      ctx.fill();

      // cut lines
      ctx.strokeStyle = "rgba(50,35,25,0.25)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const ang = (Math.PI * 2 * i) / 8;
        const x1 = t.x + Math.cos(ang) * (t.radius * 0.14);
        const y1 = t.y + Math.sin(ang) * (t.radius * 0.14);
        const x2 = t.x + Math.cos(ang) * (t.radius * 0.98);
        const y2 = t.y + Math.sin(ang) * (t.radius * 0.98);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    function drawDart() {
      const d = s.dart;

      // shaft
      ctx.fillStyle = "#e3c86d";
      ctx.fillRect(d.x - 3, d.y - 28, 6, 28);

      // tip
      ctx.beginPath();
      ctx.moveTo(d.x, d.y - 40);
      ctx.lineTo(d.x - 6, d.y - 28);
      ctx.lineTo(d.x + 6, d.y - 28);
      ctx.fillStyle = "#d5d7db";
      ctx.fill();

      // flights
      ctx.fillStyle = "#ff5c86";
      ctx.beginPath();
      ctx.moveTo(d.x - 11, d.y - 8);
      ctx.lineTo(d.x, d.y - 22);
      ctx.lineTo(d.x + 11, d.y - 8);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    function drawParticles() {
      if (s.hitFlashTimer > 0) {
        ctx.beginPath();
        ctx.arc(
          s.target.x,
          s.target.y,
          s.target.radius + 16,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = `rgba(255,255,255,${s.hitFlashTimer / 14})`;
        ctx.fill();
        s.hitFlashTimer--;
      }

      const parts = s.particles;
      for (let p of parts) {
        ctx.fillStyle = `rgba(255,240,200,${p.life / 18})`;
        ctx.fillRect(p.x, p.y, 4, 4);
        p.x += p.dx;
        p.y += p.dy;
        p.life--;
      }
      s.particles = parts.filter((p) => p.life > 0);
    }

    function drawCanvasHud() {
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(18, 18, 126, 40);

      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "bold 17px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText(`Score ${s.score}`, 30, 44);

      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(300, 18, 122, 40);

      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(`Darts ${s.dartsLeft}`, 312, 44);

      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(163, 18, 114, 40);

      ctx.fillStyle = "rgba(255,240,190,0.96)";
      ctx.textAlign = "center";
      ctx.fillText(`${s.timer}s`, 220, 44);
      ctx.textAlign = "left";
    }

    function drawPubStage() {
      // bottom cutout "stage"
      ctx.fillStyle = "#4b2d20";
      ctx.fillRect(0, 474, canvas.width, 86);

      ctx.fillStyle = "#6a3e2a";
      ctx.fillRect(0, 486, canvas.width, 14);

      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(0, 488, canvas.width, 3);
    }

    function drawHandLauncher() {
      const visual = getHandVisual(activePlayer);
      const handX = 220;
      const handY = 486;

      // sleeve shadow
      ctx.beginPath();
      ctx.ellipse(handX + 10, handY + 18, 94, 34, -0.12, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fill();

      // sleeve / arm
      ctx.save();
      ctx.translate(handX - 46, handY - 8);
      ctx.rotate(-0.1);

      ctx.fillStyle = visual.sleeve;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(78, -12);
      ctx.lineTo(102, 32);
      ctx.lineTo(18, 44);
      ctx.closePath();
      ctx.fill();

      // cuff
      if (visual.variant === "cuffed") {
        ctx.fillStyle = "#f2ede1";
        ctx.fillRect(68, -6, 18, 38);
      }

      if (visual.variant === "gauntlet") {
        ctx.fillStyle = "#9ea4ac";
        ctx.fillRect(54, -8, 34, 42);
        ctx.strokeStyle = "rgba(40,40,40,0.35)";
        ctx.lineWidth = 2;
        ctx.strokeRect(54, -8, 34, 42);
      }

      ctx.restore();

      // hand / fingers
      if (visual.variant === "cartoon") {
        ctx.fillStyle = "#f2f2ed";
      } else if (visual.variant === "gauntlet") {
        ctx.fillStyle = "#b2b8bf";
      } else {
        ctx.fillStyle = visual.skin;
      }

      // palm
      ctx.beginPath();
      ctx.ellipse(handX, handY, 34, 22, -0.15, 0, Math.PI * 2);
      ctx.fill();

      // thumb
      ctx.beginPath();
      ctx.ellipse(handX - 20, handY + 8, 14, 9, 0.5, 0, Math.PI * 2);
      ctx.fill();

      // fingers
      const fingerOffsets = [-18, -5, 8, 20];
      fingerOffsets.forEach((offset, i) => {
        ctx.beginPath();
        ctx.ellipse(handX + offset, handY - 18 - i * 1.5, 8, 18, -0.06, 0, Math.PI * 2);
        ctx.fill();
      });

      if (visual.variant === "ringed") {
        ctx.strokeStyle = "#f4c431";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(handX + 8, handY - 12, 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // hand outline for cutout feel
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(handX, handY, 34, 22, -0.15, 0, Math.PI * 2);
      ctx.stroke();

      // small held dart accent when not fired
      if (!s.dart.fired) {
        ctx.save();
        ctx.translate(236, 446);
        ctx.rotate(-0.22);

        ctx.fillStyle = "#d9c56a";
        ctx.fillRect(-2, -18, 4, 18);

        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.lineTo(-4, -18);
        ctx.lineTo(4, -18);
        ctx.fillStyle = "#d9dde2";
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-7, -2);
        ctx.lineTo(0, -12);
        ctx.lineTo(7, -2);
        ctx.closePath();
        ctx.fillStyle = "#ff5c86";
        ctx.fill();

        ctx.restore();
      }
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
        s.msg = `Turn finished! ${
          playerNames[s.currentPlayerIndex] || "Player"
        } scored ${s.score}`;
        syncUiFromState();
      }

      drawTarget();
      drawCanvasHud();
      drawDart();
      drawParticles();
      drawPubStage();
      drawHandLauncher();

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
  }, [code, isHost, playerNames, currentPlayerIndex, activePlayer]);

  return (
    <div className="darts-shell darts-shell--themed">
      <div className="darts-top-info">
        <div className="darts-info-block">
          <div className="darts-info-label">Game</div>
          <div className="darts-info-value">Darts Challenge</div>
        </div>

        <div className="darts-info-block">
          <div className="darts-info-label">Role</div>
          <div className="darts-info-value">{myRoleLabel}</div>
        </div>

        <div className="darts-info-block">
          <div className="darts-info-label">Connection</div>
          <div className="darts-info-value">{connLine}</div>
        </div>
      </div>

      <h1 className="darts-title">Aim &amp; Fire</h1>

      <p className="darts-instruction">
        A pub-wall target swings above the bar. Wait for your moment and throw
        for the highest score.
      </p>

      <div className="darts-turn-card">
        <div className="darts-turn-main">Current turn: {activePlayerName}</div>
        <div className="darts-turn-sub">
          Player {currentPlayerIndex + 1} of {Math.max(playerNames.length, 1)}
        </div>
      </div>

      <div className="darts-canvas-wrap">
        <canvas ref={canvasRef} id="dartsCanvas" width={440} height={560} />
      </div>

      <div className="darts-action-wrap">
        <button
          onClick={fireDart}
          className="fire-btn"
          disabled={
            turnFinished || roundFinished || myPlayerIndex !== currentPlayerIndex
          }
        >
          {myPlayerIndex === currentPlayerIndex ? "Throw Dart" : "Not your turn"}
        </button>
      </div>

      <div className="game-message">{statusMessage}</div>

      <div className="darts-stats-grid">
        <div className="darts-stat-card">
          <span className="darts-stat-label">Score</span>
          <span className="darts-stat-value">{score}</span>
        </div>
        <div className="darts-stat-card">
          <span className="darts-stat-label">Darts Left</span>
          <span className="darts-stat-value">{dartsLeft}</span>
        </div>
        <div className="darts-stat-card">
          <span className="darts-stat-label">Time</span>
          <span className="darts-stat-value">{timer}</span>
        </div>
      </div>

      <div className="darts-scoreboard">
        <h3 className="darts-scoreboard-title">Turn Order Scores</h3>

        <div className="darts-score-list">
          {turnScores.map((entry) => (
            <div
              key={`${entry.playerIndex}-${entry.playerName}`}
              className={`darts-score-row ${
                entry.playerIndex === currentPlayerIndex ? "is-active" : ""
              }`}
            >
              <span>{entry.playerName}</span>
              <span>{entry.score}</span>
            </div>
          ))}
        </div>
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
            <p className="waiting-text">Waiting for host…</p>
          )}
        </div>
      )}

      {roundFinished && (
        <div className="turn-finished-panel">
          <p>Round finished — all players have completed their turns.</p>
          {!isHost && <p className="waiting-text">Waiting for host…</p>}
        </div>
      )}
    </div>
  );
}