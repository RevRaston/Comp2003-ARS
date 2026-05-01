import { useEffect, useMemo, useRef, useState } from "react";
import "./darts.css";

const defaultWsBase =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "ws://localhost:3000/ws"
    : "wss://comp2003-ars.onrender.com/ws";

const WS_URL = (
  import.meta.env.VITE_WS_URL ||
  import.meta.env.VITE_BACKEND_WS_URL ||
  defaultWsBase
).replace(/\/$/, "");

const HAND_ASSET_BASE = "/darts-assets/hands";
const DART_ASSET_BASE = "/darts-assets/darts";

const BASE_TARGET_SPEED = 1.55;
const TARGET_SPEED_STEP = 0.22;
const MAX_TARGET_SPEED = 3.2;
const CONFETTI_COLOURS = [
  "#f4c431",
  "#ff5c86",
  "#4dd0ff",
  "#20d48a",
  "#ffffff",
  "#ff9d2f",
];

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

function getThrowSet(activePlayer) {
  const avatar = safeParseAvatar(activePlayer);
  const throwStyle = String(avatar?.throwStyle || "strong")
    .trim()
    .toLowerCase();

  if (throwStyle === "robot") {
    return {
      handType: "robot",
      dartType: "robot",
      openSrc: `${HAND_ASSET_BASE}/robot_open.png`,
      closedSrc: `${HAND_ASSET_BASE}/robot_closed.png`,
      dartSrc: `${DART_ASSET_BASE}/robot_dart.png`,
    };
  }

  if (throwStyle === "lion") {
    return {
      handType: "lion",
      dartType: "lion",
      openSrc: `${HAND_ASSET_BASE}/lion_open.png`,
      closedSrc: `${HAND_ASSET_BASE}/lion_closed.png`,
      dartSrc: `${DART_ASSET_BASE}/lion_dart.png`,
    };
  }

  if (throwStyle === "skinny") {
    return {
      handType: "skinny",
      dartType: "classic",
      openSrc: `${HAND_ASSET_BASE}/skinny_open.png`,
      closedSrc: `${HAND_ASSET_BASE}/skinny_closed.png`,
      dartSrc: `${DART_ASSET_BASE}/classic_dart.png`,
    };
  }

  return {
    handType: "strong",
    dartType: "heavy",
    openSrc: `${HAND_ASSET_BASE}/strong_open.png`,
    closedSrc: `${HAND_ASSET_BASE}/strong_closed.png`,
    dartSrc: `${DART_ASSET_BASE}/heavy_dart.png`,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
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

  const handImageCacheRef = useRef({});
  const dartImageCacheRef = useRef({});
  const throwAnimUntilRef = useRef(0);
  const turnTransitionRef = useRef(null);

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

  const [turnChanging, setTurnChanging] = useState(false);
  const [turnChangeCountdown, setTurnChangeCountdown] = useState(3);

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
  const activeThrowSet = getThrowSet(activePlayer);

  const stateRef = useRef({
    score: 0,
    dartsLeft: 5,
    timer: 60,
    finished: false,
    roundFinished: false,
    msg: "",
    currentPlayerIndex: 0,
    turnScores: [],
    dart: {
      x: 220,
      y: 456,
      fired: false,
      speed: 7,
      angle: -Math.PI / 2,
      style: "classic",
    },
    target: { x: 220, y: 128, radius: 68, dir: 1, speed: BASE_TARGET_SPEED },
    particles: [],
    confetti: [],
    hitFlashTimer: 0,
    stuckDarts: [],
  });

  function getImageFromCache(cache, src) {
    if (!src) return null;

    if (!cache[src]) {
      const img = new Image();

      img.onload = () => {
        img.dataset.loaded = "true";
      };

      img.onerror = () => {
        img.dataset.failed = "true";
      };

      img.src = src;
      cache[src] = img;
    }

    return cache[src];
  }

  function preloadNextPlayerAssets(nextIndex) {
    const nextPlayer = orderedPlayers[nextIndex];
    if (!nextPlayer) return;

    const nextThrowSet = getThrowSet(nextPlayer);

    getImageFromCache(handImageCacheRef.current, nextThrowSet.openSrc);
    getImageFromCache(handImageCacheRef.current, nextThrowSet.closedSrc);
    getImageFromCache(dartImageCacheRef.current, nextThrowSet.dartSrc);
  }

  function drawImageCentered(ctx, img, x, y, w, h, rotation = 0, scale = 1) {
    if (!img) return false;
    if (img.dataset?.failed === "true") return false;
    if (!img.complete) return false;
    if (!img.naturalWidth || !img.naturalHeight) return false;

    try {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
      return true;
    } catch {
      return false;
    }
  }

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

    const currentThrowSet = getThrowSet(orderedPlayers[s.currentPlayerIndex]);

    s.dart.fired = true;
    s.dart.style = currentThrowSet.dartType;
    s.dartsLeft -= 1;
    s.msg = `🎯 ${playerNames[s.currentPlayerIndex] || "Player"} fires!`;

    throwAnimUntilRef.current = performance.now() + 170;

    syncUiFromState();
  }

  function fireDart() {
    const s = stateRef.current;

    if (s.roundFinished) return;
    if (s.finished) return;
    if (s.dart.fired) return;
    if (s.dartsLeft <= 0) return;
    if (turnChanging) return;
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
    const currentThrowSet = getThrowSet(orderedPlayers[s.currentPlayerIndex]);

    s.score = 0;
    s.dartsLeft = 5;
    s.timer = 60;
    s.finished = false;
    s.msg = `${playerNames[s.currentPlayerIndex] || "Next player"}'s turn`;
    s.dart = {
      x: 220,
      y: 456,
      fired: false,
      speed: 7,
      angle: -Math.PI / 2,
      style: currentThrowSet.dartType,
    };
    s.target = {
      x: 220,
      y: 128,
      radius: 68,
      dir: 1,
      speed: BASE_TARGET_SPEED,
    };
    s.particles = [];
    s.confetti = [];
    s.hitFlashTimer = 0;
    s.stuckDarts = [];
    syncUiFromState();
  }

  useEffect(() => {
    if (!turnFinished || roundFinished) return;

    const s = stateRef.current;
    if (!s.finished || s.roundFinished) return;

    const nextIndex = s.currentPlayerIndex + 1;

    setTurnChanging(true);
    setTurnChangeCountdown(3);
    preloadNextPlayerAssets(nextIndex);

    if (turnTransitionRef.current) {
      clearInterval(turnTransitionRef.current);
    }

    let count = 3;

    turnTransitionRef.current = setInterval(() => {
      count -= 1;
      setTurnChangeCountdown(count);

      if (count <= 0) {
        clearInterval(turnTransitionRef.current);
        turnTransitionRef.current = null;
        setTurnChanging(false);

        if (isHost) {
          const latest = stateRef.current;

          if (!latest.finished || latest.roundFinished) return;

          const nextPlayerIndex = latest.currentPlayerIndex + 1;

          if (nextPlayerIndex >= playerNames.length) {
            latest.roundFinished = true;
            latest.msg = "Round complete! All players have taken a turn.";
            syncUiFromState();

            if (
              !announcedRef.current &&
              typeof onRoundCompleteRef.current === "function"
            ) {
              announcedRef.current = true;
              onRoundCompleteRef.current({
                winnerKey: null,
                scores: latest.turnScores,
              });
            }

            return;
          }

          latest.currentPlayerIndex = nextPlayerIndex;
          resetTurnStateForCurrentPlayer();
        }
      }
    }, 1000);

    return () => {
      if (turnTransitionRef.current) {
        clearInterval(turnTransitionRef.current);
        turnTransitionRef.current = null;
      }
    };
  }, [turnFinished, roundFinished, isHost, playerNames.length]);

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

        const previousPlayerIndex = stateRef.current.currentPlayerIndex;
        const incomingPlayerIndex = Number(
          payload.currentPlayerIndex ?? previousPlayerIndex
        );

        if (
          payload.finished &&
          !payload.roundFinished &&
          !stateRef.current.finished
        ) {
          setTurnChanging(true);
          setTurnChangeCountdown(3);
          preloadNextPlayerAssets(incomingPlayerIndex + 1);
        }

        if (incomingPlayerIndex !== previousPlayerIndex) {
          setTurnChanging(false);
          setTurnChangeCountdown(3);
        }

        stateRef.current = {
          ...stateRef.current,
          ...payload,
          dart: payload.dart || stateRef.current.dart,
          target: payload.target || stateRef.current.target,
          particles: payload.particles || stateRef.current.particles,
          confetti: payload.confetti || stateRef.current.confetti,
          stuckDarts: payload.stuckDarts || stateRef.current.stuckDarts,
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
  }, [code, isHost, myPlayerIndex, myUserId, playerNames, orderedPlayers]);

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

    function createConfetti(x, y) {
      for (let i = 0; i < 34; i++) {
        s.confetti.push({
          x,
          y,
          dx: (Math.random() - 0.5) * 7,
          dy: -Math.random() * 3.8 - 0.5,
          gravity: 0.12 + Math.random() * 0.06,
          size: 4 + Math.random() * 5,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.28,
          color: randPick(CONFETTI_COLOURS),
          life: 28 + Math.floor(Math.random() * 10),
        });
      }
    }

    function addStuckDart(hitX, hitY, style) {
      const offsetX = hitX - s.target.x;
      const offsetY = hitY - s.target.y;
      const angle = clamp((offsetX / s.target.radius) * 0.75, -0.75, 0.75);

      s.stuckDarts.push({
        offsetX,
        offsetY,
        angle,
        style,
      });
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

      s.target.speed = Math.min(
        MAX_TARGET_SPEED,
        s.target.speed + TARGET_SPEED_STEP
      );

      s.hitFlashTimer = 14;
      createHitEffect(s.target.x, s.target.y);
      createConfetti(s.target.x, s.target.y);
      addStuckDart(s.dart.x, s.dart.y, s.dart.style);
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

      const glow = ctx.createRadialGradient(220, 80, 20, 220, 80, 220);
      glow.addColorStop(0, "rgba(255,208,120,0.20)");
      glow.addColorStop(1, "rgba(255,208,120,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(28, 38, 84, 110);
      ctx.fillRect(330, 52, 74, 96);

      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.fillRect(46, 54, 48, 78);
      ctx.fillRect(346, 66, 42, 64);

      ctx.fillStyle = "rgba(255,255,255,0.035)";
      ctx.fillRect(40, 210, 360, 10);

      ctx.fillStyle = "rgba(255,220,170,0.06)";
      ctx.fillRect(54, 186, 20, 24);
      ctx.fillRect(86, 174, 16, 36);
      ctx.fillRect(118, 182, 22, 28);
      ctx.fillRect(302, 178, 18, 32);
      ctx.fillRect(332, 184, 20, 26);
      ctx.fillRect(364, 172, 16, 38);

      ctx.fillStyle = "rgba(0,0,0,0.14)";
      ctx.fillRect(0, 390, canvas.width, 170);

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
      ctx.ellipse(
        t.x,
        t.y + t.radius + 14,
        t.radius * 0.92,
        14,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    function drawTarget() {
      const t = s.target;

      drawBoardHanger(t);

      ctx.beginPath();
      ctx.arc(t.x + 4, t.y + 6, t.radius + 8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.30)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius + 6, 0, Math.PI * 2);
      ctx.fillStyle = "#d6b689";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#efe7d5";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * 0.82, 0, Math.PI * 2);
      ctx.fillStyle = "#1b1f25";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * 0.68, 0, Math.PI * 2);
      ctx.fillStyle = "#d8d1c4";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * 0.48, 0, Math.PI * 2);
      ctx.fillStyle = "#b11f2e";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * 0.30, 0, Math.PI * 2);
      ctx.fillStyle = "#f0eadc";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = "#3b7c45";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * 0.055, 0, Math.PI * 2);
      ctx.fillStyle = "#c53134";
      ctx.fill();

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

    function drawGuideLine(now) {
      if (s.dart.fired) return;

      const pulse = 0.12 + ((Math.sin(now / 220) + 1) / 2) * 0.1;
      const startX = s.dart.x;
      const startY = s.dart.y - 8;
      const endY = 118;

      ctx.save();
      ctx.strokeStyle = `rgba(255, 237, 198, ${pulse})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 10]);

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(startX, endY);
      ctx.stroke();

      ctx.setLineDash([]);

      ctx.fillStyle = `rgba(255, 237, 198, ${pulse + 0.06})`;
      ctx.beginPath();
      ctx.moveTo(startX, endY - 10);
      ctx.lineTo(startX - 7, endY + 4);
      ctx.lineTo(startX + 7, endY + 4);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    function drawFallbackDart(x, y, rotation = 0, style = "classic") {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);

      let body = "#e3c86d";
      let flights = "#ff5c86";

      if (style === "lion") {
        body = "#c8963e";
        flights = "#c73d1f";
      } else if (style === "robot") {
        body = "#9ed7ff";
        flights = "#4dd0ff";
      } else if (style === "heavy") {
        body = "#b9bfc7";
        flights = "#6f7883";
      }

      ctx.fillStyle = body;
      ctx.fillRect(-3, -28, 6, 28);

      ctx.beginPath();
      ctx.moveTo(0, -40);
      ctx.lineTo(-6, -28);
      ctx.lineTo(6, -28);
      ctx.fillStyle = "#d9dde2";
      ctx.fill();

      ctx.fillStyle = flights;
      ctx.beginPath();
      ctx.moveTo(-11, -8);
      ctx.lineTo(0, -22);
      ctx.lineTo(11, -8);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    function drawFlyingDart() {
      const d = s.dart;
      if (!d.fired) return;

      const dartImg = getImageFromCache(
        dartImageCacheRef.current,
        `${DART_ASSET_BASE}/${d.style}_dart.png`
      );

      const drawn = drawImageCentered(
        ctx,
        dartImg,
        d.x,
        d.y - 14,
        42,
        74,
        d.angle
      );

      if (!drawn) {
        drawFallbackDart(d.x, d.y, d.angle, d.style);
      }
    }

    function drawStuckDarts() {
      for (const dart of s.stuckDarts) {
        const drawX = s.target.x + dart.offsetX;
        const drawY = s.target.y + dart.offsetY + 6;

        const dartImg = getImageFromCache(
          dartImageCacheRef.current,
          `${DART_ASSET_BASE}/${dart.style}_dart.png`
        );

        const drawn = drawImageCentered(
          ctx,
          dartImg,
          drawX,
          drawY,
          34,
          64,
          dart.angle
        );

        if (!drawn) {
          drawFallbackDart(drawX, drawY, dart.angle, dart.style);
        }
      }
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

    function drawConfetti() {
      const pieces = s.confetti;
      for (const piece of pieces) {
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rotation);
        ctx.fillStyle = piece.color;
        ctx.fillRect(
          -piece.size / 2,
          -piece.size / 2,
          piece.size,
          piece.size * 0.7
        );
        ctx.restore();

        piece.x += piece.dx;
        piece.y += piece.dy;
        piece.dy += piece.gravity;
        piece.rotation += piece.rotationSpeed;
        piece.life -= 1;
      }
      s.confetti = pieces.filter((piece) => piece.life > 0);
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
      ctx.fillStyle = "#4b2d20";
      ctx.fillRect(0, 474, canvas.width, 86);

      ctx.fillStyle = "#6a3e2a";
      ctx.fillRect(0, 486, canvas.width, 14);

      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(0, 488, canvas.width, 3);
    }

    function drawHandLauncher(now) {
      const isOpenRelease = now < throwAnimUntilRef.current;
      const handSrc = isOpenRelease
        ? activeThrowSet.openSrc
        : activeThrowSet.closedSrc;

      const img = getImageFromCache(handImageCacheRef.current, handSrc);

      const anticipation = !isOpenRelease && !s.dart.fired;
      const bob = anticipation ? Math.sin(now / 140) * 5 : 0;
      const scale = anticipation ? 0.985 + Math.sin(now / 140) * 0.008 : 1;

      const drawn = drawImageCentered(
        ctx,
        img,
        336,
        468 + bob,
        250,
        206,
        0,
        scale
      );

      if (!drawn) {
        ctx.save();
        ctx.fillStyle = "rgba(255, 80, 80, 0.95)";
        ctx.font = "bold 18px system-ui, sans-serif";
        ctx.fillText(`HAND LOAD FAIL: ${activeThrowSet.handType}`, 120, 520);
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
            confetti: s.confetti,
            stuckDarts: s.stuckDarts,
            hitFlashTimer: s.hitFlashTimer,
          },
        });
      }, 100);
    }

    function loop(now) {
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
      drawStuckDarts();
      drawGuideLine(now);
      drawCanvasHud();
      drawFlyingDart();
      drawParticles();
      drawConfetti();
      drawPubStage();
      drawHandLauncher(now);

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
  }, [
    code,
    isHost,
    playerNames,
    currentPlayerIndex,
    activePlayer,
    activeThrowSet,
    orderedPlayers,
  ]);

  return (
    <div className="darts-shell darts-shell--themed">
      {turnChanging && !roundFinished && (
        <div className="darts-turn-overlay">
          <div className="darts-turn-overlay-card">
            <div className="darts-turn-overlay-label">
              {currentPlayerIndex < playerNames.length - 1
                ? "Next player"
                : "Finishing round"}
            </div>

            <div className="darts-turn-overlay-count">
              {turnChangeCountdown}
            </div>

            <div className="darts-turn-overlay-text">
              {currentPlayerIndex < playerNames.length - 1
                ? `${
                    playerNames[currentPlayerIndex + 1] || "Next player"
                  } getting ready...`
                : "Calculating final scores..."}
            </div>
          </div>
        </div>
      )}

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
            turnFinished ||
            roundFinished ||
            turnChanging ||
            myPlayerIndex !== currentPlayerIndex
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

      {turnFinished && !roundFinished && !turnChanging && (
        <div className="turn-finished-panel">
          <p>
            Turn finished — {activePlayerName} scored {score}
          </p>
          <p className="waiting-text">Changing turn...</p>
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