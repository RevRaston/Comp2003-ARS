import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Suds Maze — host authoritative multiplayer maze race
 * - Host simulates all players
 * - Clients send directional input
 * - All players race to the centre
 * - Visual style matches the pub / bar theme and Sumo tokens
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

const GRID_SIZE = 21;
const CELL_SIZE = 24;
const MOVE_INTERVAL = 120;

const PLAYER_RING_COLORS = [
  "rgba(255,92,134,0.95)",
  "rgba(77,208,255,0.95)",
  "rgba(120,255,170,0.95)",
  "rgba(255,220,110,0.95)",
];

const DEFAULT_AVATAR = {
  displayName: "Player",
  bodyShape: "round",
  skin: "#F2C7A5",
  hairStyle: "short",
  hair: "#2C1E1A",
  eyeStyle: "dots",
  eye: "#1A2433",
  mouthStyle: "smile",
  accessory: "none",
  outfit: "hoodie",
  outfitColor: "#7C5CFF",
  bg: "nebula",
  tilt: 0,
};

function generateMaze(size) {
  const maze = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 1)
  );

  const dirs = [
    [0, -2],
    [2, 0],
    [0, 2],
    [-2, 0],
  ];

  function shuffle(arr) {
    return arr.sort(() => Math.random() - 0.5);
  }

  function carve(x, y) {
    maze[y][x] = 0;
    shuffle(dirs).forEach(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;

      if (
        nx > 0 &&
        nx < size - 1 &&
        ny > 0 &&
        ny < size - 1 &&
        maze[ny][nx] === 1
      ) {
        maze[y + dy / 2][x + dx / 2] = 0;
        carve(nx, ny);
      }
    });
  }

  carve(1, 1);
  return maze;
}

function getSpawnPositions(size) {
  return [
    { x: 1, y: 1 },
    { x: size - 2, y: 1 },
    { x: 1, y: size - 2 },
    { x: size - 2, y: size - 2 },
  ];
}

function getUserKey(p) {
  if (!p) return "";
  const k =
    p.user_id ??
    p.userId ??
    p.auth_user_id ??
    p.profile_id ??
    p.profileId ??
    p.owner_id ??
    p.ownerId ??
    p.id;
  return k ? String(k) : "";
}

function parseAvatarModel(player) {
  const raw = player?.avatar_json ?? player?.avatarJson ?? null;
  let merged = { ...DEFAULT_AVATAR };

  if (raw) {
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : { ...raw };
      merged = { ...DEFAULT_AVATAR, ...parsed };
    } catch {
      // ignore parse error
    }
  }

  if (player?.display_name || player?.name) {
    merged.displayName = player.display_name || player.name;
  }

  return merged;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeBubbleParticles(x, y, count) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    parts.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 1.1,
      vy: -0.15 - Math.random() * 1.3,
      life: 18 + Math.floor(Math.random() * 12),
      size: 2 + Math.random() * 4,
      alpha: 0.14 + Math.random() * 0.34,
    });
  }
  return parts;
}

function makeAmbientBubble(width, height) {
  return {
    x: 20 + Math.random() * (width - 40),
    y: height + 10 + Math.random() * 50,
    vx: (Math.random() - 0.5) * 0.2,
    vy: -0.25 - Math.random() * 0.5,
    life: 120 + Math.floor(Math.random() * 60),
    size: 2 + Math.random() * 3,
    alpha: 0.06 + Math.random() * 0.12,
    ambient: true,
  };
}

export default function MazeGame({
  sessionCode,
  players = [],
  isHost = false,
  myUserId,
  mySeatIndex,
  onRoundComplete,
}) {
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const runningRef = useRef(false);
  const rafRef = useRef(0);
  const announcedRef = useRef(false);
  const onRoundCompleteRef = useRef(onRoundComplete);

  const [connLine, setConnLine] = useState("disconnected");
  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );
  const [mobilePress, setMobilePress] = useState({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  const code = sessionCode || localStorage.getItem("session_code") || "local";

  const playerList = useMemo(() => {
    return (players || []).slice(0, 4).map((p, idx) => ({
      id: getUserKey(p) || String(idx + 1),
      name: p.display_name || p.name || `Player ${idx + 1}`,
      avatar: parseAvatarModel(p),
    }));
  }, [players]);

  const myId = myUserId ? String(myUserId) : "";

  const myPlayerIndex = useMemo(() => {
    if (!playerList.length) return -1;

    if (myId) {
      const byId = playerList.findIndex((p) => String(p.id) === myId);
      if (byId !== -1) return byId;
    }

    if (typeof mySeatIndex === "number" && mySeatIndex >= 0 && mySeatIndex < 4) {
      return mySeatIndex;
    }

    return -1;
  }, [playerList, myId, mySeatIndex]);

  const center = {
    x: Math.floor(GRID_SIZE / 2),
    y: Math.floor(GRID_SIZE / 2),
  };

  const keysHeldRef = useRef({});
  const mobileInputRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const inputByKeyRef = useRef(new Map());
  const lastMoveTimeRef = useRef(0);
  const lastStateAtRef = useRef(0);

  const stateRef = useRef({
    phase: "playing",
    maze: generateMaze(GRID_SIZE),
    players: [],
    winnerId: null,
    tick: 0,
    bubbles: [],
    goalPulse: 0,
  });

  const [ui, setUi] = useState({
    phase: "playing",
    maze: generateMaze(GRID_SIZE),
    players: [],
    winnerId: null,
  });

  useEffect(() => {
    onRoundCompleteRef.current = onRoundComplete;
  }, [onRoundComplete]);

  useEffect(() => {
    function handleResize() {
      setScreenWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isPhoneLike =
    typeof window !== "undefined" &&
    screenWidth <= 820 &&
    (navigator.maxTouchPoints > 0 || "ontouchstart" in window);

  function syncUiFromState() {
    const s = stateRef.current;
    setUi({
      phase: s.phase,
      maze: s.maze,
      players: s.players,
      winnerId: s.winnerId,
    });
  }

  function wsSend(obj) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
  }

  function setTouchDir(dir, pressed) {
    mobileInputRef.current = {
      ...mobileInputRef.current,
      [dir]: pressed,
    };

    setMobilePress((prev) => ({
      ...prev,
      [dir]: pressed,
    }));
  }

  function clearTouchDirs() {
    mobileInputRef.current = {
      up: false,
      down: false,
      left: false,
      right: false,
    };

    setMobilePress({
      up: false,
      down: false,
      left: false,
      right: false,
    });
  }

  function bindTouchButton(dir) {
    return {
      onTouchStart: (e) => {
        e.preventDefault();
        setTouchDir(dir, true);
      },
      onTouchEnd: (e) => {
        e.preventDefault();
        setTouchDir(dir, false);
      },
      onTouchCancel: (e) => {
        e.preventDefault();
        setTouchDir(dir, false);
      },
      onMouseDown: (e) => {
        e.preventDefault();
        setTouchDir(dir, true);
      },
      onMouseUp: (e) => {
        e.preventDefault();
        setTouchDir(dir, false);
      },
      onMouseLeave: () => {
        setTouchDir(dir, false);
      },
    };
  }

  useEffect(() => {
    function handleGlobalRelease() {
      clearTouchDirs();
    }

    window.addEventListener("mouseup", handleGlobalRelease);
    window.addEventListener("touchend", handleGlobalRelease);
    window.addEventListener("touchcancel", handleGlobalRelease);
    window.addEventListener("blur", handleGlobalRelease);

    return () => {
      window.removeEventListener("mouseup", handleGlobalRelease);
      window.removeEventListener("touchend", handleGlobalRelease);
      window.removeEventListener("touchcancel", handleGlobalRelease);
      window.removeEventListener("blur", handleGlobalRelease);
    };
  }, []);

  function computeLocalDirection() {
    let dx = 0;
    let dy = 0;

    if (keysHeldRef.current["w"] || keysHeldRef.current["W"] || keysHeldRef.current["ArrowUp"] || mobileInputRef.current.up) {
      dy = -1;
    } else if (keysHeldRef.current["s"] || keysHeldRef.current["S"] || keysHeldRef.current["ArrowDown"] || mobileInputRef.current.down) {
      dy = 1;
    } else if (keysHeldRef.current["a"] || keysHeldRef.current["A"] || keysHeldRef.current["ArrowLeft"] || mobileInputRef.current.left) {
      dx = -1;
    } else if (keysHeldRef.current["d"] || keysHeldRef.current["D"] || keysHeldRef.current["ArrowRight"] || mobileInputRef.current.right) {
      dx = 1;
    }

    return { dx, dy };
  }

  useEffect(() => {
    if (!playerList.length) return;

    const s = stateRef.current;
    const shouldRebuild =
      s.players.length !== playerList.length ||
      s.players.some((p, i) => p.id !== playerList[i]?.id);

    if (!shouldRebuild && s.players.length > 0) {
      s.players = s.players.map((existing, i) => ({
        ...existing,
        name: playerList[i]?.name || existing.name,
        avatar: playerList[i]?.avatar || existing.avatar,
      }));
      syncUiFromState();
      return;
    }

    if (!isHost) return;

    const maze = generateMaze(GRID_SIZE);
    maze[center.y][center.x] = 0;

    const spawns = getSpawnPositions(GRID_SIZE);

    s.maze = maze;
    s.players = playerList.map((p, i) => ({
      id: p.id,
      name: p.name,
      x: spawns[i]?.x ?? 1,
      y: spawns[i]?.y ?? 1,
      avatar: p.avatar,
      wobble: Math.random() * Math.PI * 2,
      squash: 0,
    }));
    s.phase = "playing";
    s.winnerId = null;
    s.tick = 0;
    s.bubbles = [];
    s.goalPulse = 0;
    announcedRef.current = false;
    inputByKeyRef.current = new Map();

    syncUiFromState();
  }, [isHost, playerList, center.x, center.y]);

  useEffect(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    announcedRef.current = false;

    setConnLine("connecting…");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnLine("connected");
      wsSend({
        type: "join",
        sessionCode: code,
        userId: myId || null,
      });
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

      if (msg.type === "maze_input" && isHost) {
        const payload = msg.payload || {};
        const key = payload.key ? String(payload.key) : "";
        if (!key) return;

        inputByKeyRef.current.set(key, {
          dx: Number(payload.dx) || 0,
          dy: Number(payload.dy) || 0,
          t: Number(payload.t) || 0,
        });
        return;
      }

      if (msg.type === "maze_state") {
        if (isHost) return;

        const payload = msg.payload;
        if (!payload) return;

        stateRef.current = {
          ...stateRef.current,
          ...payload,
          maze: payload.maze || stateRef.current.maze,
          players: payload.players || stateRef.current.players,
          bubbles: payload.bubbles || stateRef.current.bubbles,
          goalPulse:
            typeof payload.goalPulse === "number"
              ? payload.goalPulse
              : stateRef.current.goalPulse,
        };

        lastStateAtRef.current = performance.now();
        syncUiFromState();

        if (
          payload.phase === "ended" &&
          !announcedRef.current &&
          typeof onRoundCompleteRef.current === "function"
        ) {
          announcedRef.current = true;
          onRoundCompleteRef.current({
            winnerKey: payload.winnerId || null,
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
  }, [code, isHost, myId]);

  useEffect(() => {
    function down(e) {
      keysHeldRef.current[e.key] = true;
    }

    function up(e) {
      keysHeldRef.current[e.key] = false;
    }

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const INPUT_MS = 1000 / 20;
    let intervalId = null;

    if (!isHost && myPlayerIndex !== -1) {
      intervalId = setInterval(() => {
        const me = playerList[myPlayerIndex];
        if (!me) return;

        const { dx, dy } = computeLocalDirection();
        wsSend({
          type: "maze_input",
          sessionCode: code,
          payload: {
            key: String(me.id),
            dx,
            dy,
            t: performance.now(),
          },
        });
      }, INPUT_MS);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isHost, myPlayerIndex, playerList, code]);

  useEffect(() => {
    if (!isHost) return;

    const width = GRID_SIZE * CELL_SIZE;
    const height = GRID_SIZE * CELL_SIZE;

    const interval = setInterval(() => {
      const s = stateRef.current;
      if (!s.players.length) return;

      s.goalPulse += 0.12;

      s.players.forEach((p) => {
        p.wobble += 0.14;
        p.squash *= 0.82;
      });

      s.bubbles = s.bubbles
        .map((b) => ({
          ...b,
          x: b.x + b.vx,
          y: b.y + b.vy,
          life: b.life - 1,
        }))
        .filter((b) => b.life > 0);

      if (Math.random() < 0.18 && s.bubbles.length < 80) {
        s.bubbles.push(makeAmbientBubble(width, height));
      }

      if (s.phase !== "playing") {
        wsSend({
          type: "maze_state",
          sessionCode: code,
          payload: {
            phase: s.phase,
            maze: s.maze,
            players: s.players,
            winnerId: s.winnerId,
            tick: s.tick,
            bubbles: s.bubbles,
            goalPulse: s.goalPulse,
          },
        });
        return;
      }

      const now = performance.now();
      if (now - lastMoveTimeRef.current < MOVE_INTERVAL) return;

      const maze = s.maze;
      let anyMoved = false;

      for (let i = 0; i < s.players.length; i++) {
        const p = s.players[i];
        if (!p) continue;

        let dx = 0;
        let dy = 0;

        if (i === myPlayerIndex) {
          const local = computeLocalDirection();
          dx = local.dx;
          dy = local.dy;
        } else {
          const inp = inputByKeyRef.current.get(String(p.id)) || { dx: 0, dy: 0 };
          dx = inp.dx;
          dy = inp.dy;
        }

        if (dx === 0 && dy === 0) continue;

        const nx = p.x + dx;
        const ny = p.y + dy;

        if (maze[ny]?.[nx] === 0) {
          p.x = nx;
          p.y = ny;
          p.squash = 1;
          anyMoved = true;

          s.bubbles.push(
            ...makeBubbleParticles(
              p.x * CELL_SIZE + CELL_SIZE / 2,
              p.y * CELL_SIZE + CELL_SIZE / 2,
              6
            )
          );

          if (p.x === center.x && p.y === center.y && s.phase === "playing") {
            s.phase = "ended";
            s.winnerId = p.id;
            s.bubbles.push(
              ...makeBubbleParticles(
                center.x * CELL_SIZE + CELL_SIZE / 2,
                center.y * CELL_SIZE + CELL_SIZE / 2,
                22
              )
            );
          }
        }
      }

      if (anyMoved) {
        lastMoveTimeRef.current = now;
      }

      s.tick += 1;
      syncUiFromState();

      wsSend({
        type: "maze_state",
        sessionCode: code,
        payload: {
          phase: s.phase,
          maze: s.maze,
          players: s.players,
          winnerId: s.winnerId,
          tick: s.tick,
          bubbles: s.bubbles,
          goalPulse: s.goalPulse,
        },
      });

      if (
        s.phase === "ended" &&
        !announcedRef.current &&
        typeof onRoundCompleteRef.current === "function"
      ) {
        announcedRef.current = true;
        onRoundCompleteRef.current({
          winnerKey: s.winnerId || null,
        });
      }
    }, 40);

    return () => clearInterval(interval);
  }, [isHost, code, center.x, center.y, myPlayerIndex]);

  useEffect(() => {
    if (!isHost) return;

    if (stateRef.current.phase === "ended" && !announcedRef.current) {
      announcedRef.current = true;
      onRoundCompleteRef.current?.({
        winnerKey: stateRef.current.winnerId || null,
      });
    }
  }, [isHost, ui.phase]);

  useEffect(() => {
    if (isHost) return;

    const stalled = performance.now() - lastStateAtRef.current > 1500;
    if (stalled && ui.players.length > 0) {
      setConnLine((prev) => (prev === "connected" ? "waiting for host state…" : prev));
    }
  }, [ui.players.length, isHost]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = GRID_SIZE * CELL_SIZE;
    canvas.height = GRID_SIZE * CELL_SIZE;

    function drawPubBackground() {
      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bg.addColorStop(0, "#2f1f18");
      bg.addColorStop(0.48, "#1f1611");
      bg.addColorStop(1, "#140f0c");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const warmGlow = ctx.createRadialGradient(
        canvas.width / 2,
        70,
        10,
        canvas.width / 2,
        70,
        220
      );
      warmGlow.addColorStop(0, "rgba(255,190,120,0.14)");
      warmGlow.addColorStop(1, "rgba(255,190,120,0)");
      ctx.fillStyle = warmGlow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#5a3a28";
      ctx.fillRect(0, 0, canvas.width, 24);
      ctx.fillStyle = "#7a5236";
      ctx.fillRect(0, 16, canvas.width, 8);

      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.beginPath();
      ctx.arc(46, 52, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(canvas.width - 46, 52, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(48, canvas.height - 48, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(canvas.width - 48, canvas.height - 48, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255,220,170,0.028)";
      ctx.beginPath();
      ctx.ellipse(90, 90, 24, 12, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(
        canvas.width - 92,
        canvas.height - 96,
        26,
        14,
        -0.16,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    function drawSudsWall(cellX, cellY) {
      const px = cellX * CELL_SIZE;
      const py = cellY * CELL_SIZE;

      const foamBase = ctx.createLinearGradient(px, py, px, py + CELL_SIZE);
      foamBase.addColorStop(0, "rgba(250,245,236,0.96)");
      foamBase.addColorStop(1, "rgba(234,226,212,0.94)");
      ctx.fillStyle = foamBase;
      ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);

      ctx.fillStyle = "rgba(255,255,255,0.60)";
      ctx.beginPath();
      ctx.arc(px + 5, py + 6, 4, 0, Math.PI * 2);
      ctx.arc(px + 11, py + 7, 5, 0, Math.PI * 2);
      ctx.arc(px + 17, py + 6, 4.4, 0, Math.PI * 2);
      ctx.arc(px + 8, py + 14, 5, 0, Math.PI * 2);
      ctx.arc(px + 18, py + 16, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(243,235,221,0.78)";
      ctx.beginPath();
      ctx.arc(px + 4, py + 18, 3.8, 0, Math.PI * 2);
      ctx.arc(px + 14, py + 18, 4.2, 0, Math.PI * 2);
      ctx.arc(px + 20, py + 11, 3.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(120,80,55,0.10)";
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, CELL_SIZE - 1, CELL_SIZE - 1);
    }

    function drawPath(cellX, cellY) {
      const px = cellX * CELL_SIZE;
      const py = cellY * CELL_SIZE;

      const floor = ctx.createLinearGradient(px, py, px, py + CELL_SIZE);
      floor.addColorStop(0, "#70472d");
      floor.addColorStop(1, "#5a3925");
      ctx.fillStyle = floor;
      ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);

      ctx.fillStyle = "rgba(255,220,170,0.035)";
      ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE / 2);

      ctx.strokeStyle = "rgba(255,255,255,0.02)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 0.5, py + CELL_SIZE - 0.5);
      ctx.lineTo(px + CELL_SIZE - 0.5, py + CELL_SIZE - 0.5);
      ctx.stroke();
    }

    function drawGoal(goalPulse) {
      const px = center.x * CELL_SIZE;
      const py = center.y * CELL_SIZE;
      const pulse = 0.5 + Math.sin(goalPulse) * 0.5;

      ctx.save();

      ctx.beginPath();
      ctx.arc(
        px + CELL_SIZE / 2,
        py + CELL_SIZE / 2,
        10 + pulse * 3,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = `rgba(177,105,255,${0.10 + pulse * 0.10})`;
      ctx.fill();

      ctx.fillStyle = "#8b5cf6";
      ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);

      ctx.fillStyle = `rgba(255,255,255,${0.18 + pulse * 0.18})`;
      ctx.fillRect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4);

      ctx.strokeStyle = "rgba(255,255,255,0.72)";
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4);

      ctx.beginPath();
      ctx.arc(
        px + CELL_SIZE / 2,
        py + CELL_SIZE / 2,
        4.5 + pulse * 2.5,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = `rgba(255,255,255,${0.24 + pulse * 0.20})`;
      ctx.fill();

      ctx.restore();
    }

    function drawHairPatch(avatar) {
      if (avatar.hairStyle === "none") return;

      ctx.beginPath();

      if (avatar.hairStyle === "puff") {
        ctx.arc(-5, -3, 4.5, 0, Math.PI * 2);
        ctx.arc(0, -5.5, 5, 0, Math.PI * 2);
        ctx.arc(5, -3, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = avatar.hair;
        ctx.fill();
        return;
      }

      if (avatar.hairStyle === "long") {
        ctx.ellipse(0, -3.5, 10, 7, 0, Math.PI, Math.PI * 2);
        ctx.fillStyle = avatar.hair;
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(-7, 2.5, 2.5, 6, 0.3, 0, Math.PI * 2);
        ctx.ellipse(7, 2.5, 2.5, 6, -0.3, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      ctx.ellipse(0, -5.5, 9, 6, 0, Math.PI, Math.PI * 2);
      ctx.fillStyle = avatar.hair;
      ctx.fill();
    }

    function drawEyes(avatar) {
      ctx.strokeStyle = "#0B1020";
      ctx.fillStyle = avatar.eye;
      ctx.lineWidth = 1.4;

      if (avatar.eyeStyle === "happy") {
        ctx.beginPath();
        ctx.arc(-4.5, -0.5, 2.2, Math.PI * 0.1, Math.PI * 0.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(4.5, -0.5, 2.2, Math.PI * 0.1, Math.PI * 0.9);
        ctx.stroke();
        return;
      }

      if (avatar.eyeStyle === "sleepy") {
        ctx.beginPath();
        ctx.moveTo(-6, -0.5);
        ctx.lineTo(-2.2, 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(2.2, 0.6);
        ctx.lineTo(6, -0.5);
        ctx.stroke();
        return;
      }

      ctx.beginPath();
      ctx.arc(-4.5, 0, 1.8, 0, Math.PI * 2);
      ctx.arc(4.5, 0, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawMouth(avatar) {
      ctx.strokeStyle = "#0B1020";
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";

      if (avatar.mouthStyle === "neutral") {
        ctx.beginPath();
        ctx.moveTo(-3.2, 4.5);
        ctx.lineTo(3.2, 4.5);
        ctx.stroke();
        return;
      }

      if (avatar.mouthStyle === "open") {
        ctx.beginPath();
        ctx.ellipse(0, 5, 2.7, 3.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#0B1020";
        ctx.fill();
        return;
      }

      ctx.beginPath();
      ctx.arc(0, 4.2, 3.8, 0.1, Math.PI - 0.1);
      ctx.stroke();
    }

    function drawAccessory(avatar) {
      if (avatar.accessory === "cap") {
        ctx.fillStyle = "#111827";
        ctx.beginPath();
        ctx.ellipse(0, -8, 8.5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(3.5, -8, 5.5, 2);
      }

      if (avatar.accessory === "glasses") {
        ctx.strokeStyle = "#0B1020";
        ctx.lineWidth = 1.1;
        ctx.strokeRect(-6.8, -1.8, 4.8, 3.2);
        ctx.strokeRect(2, -1.8, 4.8, 3.2);
        ctx.beginPath();
        ctx.moveTo(-2, -0.2);
        ctx.lineTo(2, -0.2);
        ctx.stroke();
      }

      if (avatar.accessory === "earring") {
        ctx.strokeStyle = "#FFD166";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(-9, 5, 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    function drawWrestlerToken(player, index) {
      const avatar = player.avatar || DEFAULT_AVATAR;
      const cx = player.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = player.y * CELL_SIZE + CELL_SIZE / 2;
      const ringColor = PLAYER_RING_COLORS[index % PLAYER_RING_COLORS.length];
      const wobble = Math.sin(player.wobble || 0) * 0.05;
      const squashValue = clamp(player.squash || 0, 0, 1);
      const squash = 1 + squashValue * 0.08;
      const stretch = 1 - squashValue * 0.08;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(wobble);

      ctx.beginPath();
      ctx.ellipse(0, 10, 12, 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fill();

      ctx.save();
      ctx.scale(squash, stretch);

      ctx.beginPath();
      ctx.ellipse(0, 1, 11.5, 9.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = avatar.skin || DEFAULT_AVATAR.skin;
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(0, 4.2, 10, 5.8, 0, 0, Math.PI * 2);
      ctx.fillStyle = avatar.outfitColor || DEFAULT_AVATAR.outfitColor;
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(-3.5, 3.8, 3.4, 2.5, -0.18, 0, Math.PI * 2);
      ctx.ellipse(3.5, 3.8, 3.4, 2.5, 0.18, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(-9.5, 1, 2.7, 5.2, -0.4, 0, Math.PI * 2);
      ctx.ellipse(9.5, 1, 2.7, 5.2, 0.4, 0, Math.PI * 2);
      ctx.fillStyle = avatar.skin || DEFAULT_AVATAR.skin;
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(-4, 10, 2.8, 2, 0.1, 0, Math.PI * 2);
      ctx.ellipse(4, 10, 2.8, 2, -0.1, 0, Math.PI * 2);
      ctx.fillStyle = "#2c1f1a";
      ctx.fill();

      ctx.restore();

      ctx.save();
      ctx.translate(0, -6.6);

      ctx.beginPath();
      ctx.arc(0, 0, 6.4, 0, Math.PI * 2);
      ctx.fillStyle = avatar.skin || DEFAULT_AVATAR.skin;
      ctx.fill();

      drawHairPatch(avatar);
      drawEyes(avatar);
      drawMouth(avatar);
      drawAccessory(avatar);

      ctx.restore();

      ctx.beginPath();
      ctx.arc(0, 0.5, 13.5, 0, Math.PI * 2);
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
    }

    function drawBubbles(bubbles) {
      for (const b of bubbles) {
        const alpha = b.alpha * clamp(b.life / (b.ambient ? 150 : 24), 0, 1);

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(
          b.x - b.size * 0.28,
          b.y - b.size * 0.28,
          b.size * 0.28,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.9})`;
        ctx.fill();
      }
    }

    function draw() {
      const s = stateRef.current;
      const maze = s.maze || ui.maze;
      const playersToDraw = s.players || ui.players;
      const bubbles = s.bubbles || [];
      const goalPulse = s.goalPulse || 0;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawPubBackground();

      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          if (maze?.[y]?.[x] === 1) {
            drawSudsWall(x, y);
          } else {
            drawPath(x, y);
          }
        }
      }

      drawGoal(goalPulse);

      playersToDraw.forEach((p, i) => {
        drawWrestlerToken(p, i);
      });

      drawBubbles(bubbles);

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ui.maze, ui.players, center.x, center.y]);

  const winnerName = ui.winnerId
    ? ui.players.find((p) => p.id === ui.winnerId)?.name || "Player 1"
    : null;

  const myRoleLabel =
    myPlayerIndex === -1 ? "Spectating" : `You are P${myPlayerIndex + 1}`;

  return (
    <div style={shell}>
      <div style={topInfoCard}>
        <div style={infoBlock}>
          <div style={infoLabel}>Game</div>
          <div style={infoValue}>Suds Maze</div>
        </div>

        <div style={infoBlock}>
          <div style={infoLabel}>Role</div>
          <div style={infoValue}>{myRoleLabel}</div>
        </div>

        <div style={infoBlock}>
          <div style={infoLabel}>Connection</div>
          <div style={infoValue}>{connLine}</div>
        </div>
      </div>

      <h1 style={title}>Suds Maze</h1>

      <p style={instructionText}>
        Stumble through the frothy maze and reach the glowing centre first.
      </p>

      <div style={statusCard}>
        <div style={statusMain}>
          {ui.phase === "playing"
            ? "Push through the suds to the centre"
            : `${winnerName} reached the centre`}
        </div>
        <div style={statusSub}>
          {myPlayerIndex !== -1
            ? isPhoneLike
              ? "Use touch controls below or WASD / Arrow Keys."
              : "Use WASD / Arrow Keys to move."
            : "Watching synced maze state."}
        </div>
      </div>

      <div style={canvasWrap}>
        <canvas ref={canvasRef} style={canvasStyle} />
      </div>

      {isPhoneLike && myPlayerIndex !== -1 && ui.phase === "playing" && (
        <div style={mobileControlsWrap}>
          <div style={mobileHint}>Touch controls</div>

          <button
            type="button"
            style={{
              ...mobileButton,
              ...(mobilePress.up ? mobileButtonActive : {}),
            }}
            {...bindTouchButton("up")}
          >
            ↑
          </button>

          <div style={mobileMiddleRow}>
            <button
              type="button"
              style={{
                ...mobileButton,
                ...(mobilePress.left ? mobileButtonActive : {}),
              }}
              {...bindTouchButton("left")}
            >
              ←
            </button>

            <button
              type="button"
              style={{
                ...mobileButton,
                ...(mobilePress.down ? mobileButtonActive : {}),
              }}
              {...bindTouchButton("down")}
            >
              ↓
            </button>

            <button
              type="button"
              style={{
                ...mobileButton,
                ...(mobilePress.right ? mobileButtonActive : {}),
              }}
              {...bindTouchButton("right")}
            >
              →
            </button>
          </div>

          <div style={mobileHelpText}>
            Hold a direction to move through the suds.
          </div>
        </div>
      )}

      <div style={playersCard}>
        <div style={playersTitle}>Players in maze</div>

        <div style={playersList}>
          {ui.players.map((p, i) => (
            <div key={p.id} style={playerRow}>
              <div style={playerLeft}>
                <span
                  style={{
                    ...playerDot,
                    background: PLAYER_RING_COLORS[i % PLAYER_RING_COLORS.length],
                  }}
                />
                <span>{p.name}</span>
              </div>
              <span style={playerCoords}>
                ({p.x}, {p.y})
              </span>
            </div>
          ))}
        </div>
      </div>

      {ui.phase === "ended" && (
        <div style={winnerCard}>
          <div style={winnerTitle}>Round Complete</div>
          <div style={winnerText}>{winnerName} reached the centre and wins!</div>
        </div>
      )}
    </div>
  );
}

/* ---------- styles ---------- */

const shell = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  color: "white",
};

const topInfoCard = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  padding: "12px 14px",
  borderRadius: 18,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const infoBlock = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minWidth: 100,
};

const infoLabel = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 1,
  opacity: 0.7,
};

const infoValue = {
  fontSize: 14,
  fontWeight: 700,
};

const title = {
  margin: 0,
  textAlign: "center",
  fontSize: "clamp(2rem, 5vw, 2.8rem)",
  lineHeight: 1,
  fontWeight: 900,
};

const instructionText = {
  margin: "0 auto",
  maxWidth: 640,
  textAlign: "center",
  fontSize: 14,
  lineHeight: 1.6,
  opacity: 0.9,
};

const statusCard = {
  padding: "14px 16px",
  borderRadius: 18,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  textAlign: "center",
};

const statusMain = {
  fontSize: 16,
  fontWeight: 800,
};

const statusSub = {
  marginTop: 4,
  fontSize: 13,
  opacity: 0.78,
};

const canvasWrap = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
};

const canvasStyle = {
  borderRadius: 20,
  maxWidth: "100%",
  boxShadow: "0 16px 40px rgba(0,0,0,0.24)",
  background: "#0f172a",
  border: "1px solid rgba(255,255,255,0.14)",
};

const mobileControlsWrap = {
  marginTop: 6,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
};

const mobileHint = {
  fontSize: 12,
  opacity: 0.78,
  textTransform: "uppercase",
  letterSpacing: 1,
};

const mobileMiddleRow = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  justifyContent: "center",
};

const mobileButton = {
  width: 66,
  height: 66,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.14)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
  color: "#fff",
  fontSize: 28,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  userSelect: "none",
  WebkitUserSelect: "none",
  touchAction: "none",
  WebkitTapHighlightColor: "transparent",
  boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
};

const mobileButtonActive = {
  background: "rgba(244,196,49,0.22)",
  border: "1px solid rgba(244,196,49,0.36)",
  transform: "scale(0.98)",
};

const mobileHelpText = {
  fontSize: 12,
  opacity: 0.74,
};

const playersCard = {
  padding: "14px 16px",
  borderRadius: 18,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const playersTitle = {
  marginBottom: 10,
  fontSize: 15,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: "#f6cf64",
  fontWeight: 800,
};

const playersList = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const playerRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 0",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const playerLeft = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const playerDot = {
  width: 12,
  height: 12,
  borderRadius: "50%",
  flexShrink: 0,
};

const playerCoords = {
  opacity: 0.74,
  fontSize: 13,
};

const winnerCard = {
  padding: "16px",
  borderRadius: 18,
  textAlign: "center",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const winnerTitle = {
  fontSize: 18,
  fontWeight: 900,
  marginBottom: 6,
};

const winnerText = {
  fontSize: 14,
  lineHeight: 1.6,
  opacity: 0.9,
};