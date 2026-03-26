import { useEffect, useMemo, useRef, useState } from "react";

const WS_URL =
  (import.meta.env.VITE_WS_URL &&
    import.meta.env.VITE_WS_URL.replace(/\/$/, "")) ||
  "ws://localhost:3000/ws";

const GRID_SIZE = 21;
const CELL_SIZE = 24;
const MOVE_INTERVAL = 120;

const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];

// Host-only controls for MVP
const HOST_CONTROLS = {
  up: "w",
  down: "s",
  left: "a",
  right: "d",
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
  const k = p.user_id ?? p.userId ?? p.id;
  return k ? String(k) : "";
}

export default function MazeGame({
  sessionCode,
  players = [],
  isHost = false,
}) {
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const runningRef = useRef(false);
  const rafRef = useRef(0);

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
    }));
  }, [players]);

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
  const lastMoveTimeRef = useRef(0);

  const stateRef = useRef({
    phase: "playing", // playing | ended
    maze: generateMaze(GRID_SIZE),
    players: [],
    winnerId: null,
    tick: 0,
  });

  const [ui, setUi] = useState({
    phase: "playing",
    maze: generateMaze(GRID_SIZE),
    players: [],
    winnerId: null,
  });

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

  // initialise host state once players exist
  useEffect(() => {
    if (!isHost) return;
    if (!playerList.length) return;

    const s = stateRef.current;
    if (s.players.length) return;

    const maze = generateMaze(GRID_SIZE);
    maze[center.y][center.x] = 0;

    const spawns = getSpawnPositions(GRID_SIZE);

    s.maze = maze;
    s.players = playerList.map((p, i) => ({
      id: p.id,
      name: p.name,
      x: spawns[i]?.x ?? 1,
      y: spawns[i]?.y ?? 1,
    }));
    s.phase = "playing";
    s.winnerId = null;
    s.tick = 0;

    syncUiFromState();
  }, [isHost, playerList, center.x, center.y]);

  // WS connection
  useEffect(() => {
    if (runningRef.current) return;
    runningRef.current = true;

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

      if (msg.type === "maze_state") {
        if (isHost) return;

        const payload = msg.payload;
        if (!payload) return;

        stateRef.current = {
          ...stateRef.current,
          ...payload,
          maze: payload.maze || stateRef.current.maze,
          players: payload.players || stateRef.current.players,
        };

        syncUiFromState();
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

  // Host-only keyboard controls
  useEffect(() => {
    if (!isHost) return;

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
  }, [isHost]);

  // Host sim + broadcast
  useEffect(() => {
    if (!isHost) return;

    const interval = setInterval(() => {
      const s = stateRef.current;
      if (s.phase !== "playing") return;
      if (!s.players.length) return;

      const now = performance.now();
      if (now - lastMoveTimeRef.current < MOVE_INTERVAL) return;

      let nx = s.players[0].x;
      let ny = s.players[0].y;

      const upPressed =
        keysHeldRef.current[HOST_CONTROLS.up] ||
        keysHeldRef.current["ArrowUp"] ||
        mobileInputRef.current.up;

      const downPressed =
        keysHeldRef.current[HOST_CONTROLS.down] ||
        keysHeldRef.current["ArrowDown"] ||
        mobileInputRef.current.down;

      const leftPressed =
        keysHeldRef.current[HOST_CONTROLS.left] ||
        keysHeldRef.current["ArrowLeft"] ||
        mobileInputRef.current.left;

      const rightPressed =
        keysHeldRef.current[HOST_CONTROLS.right] ||
        keysHeldRef.current["ArrowRight"] ||
        mobileInputRef.current.right;

      if (upPressed) ny--;
      else if (downPressed) ny++;
      else if (leftPressed) nx--;
      else if (rightPressed) nx++;

      const maze = s.maze;
      const p = s.players[0]; // host controls player 1 only for MVP
      if (!p) return;

      if (maze[ny]?.[nx] === 0) {
        p.x = nx;
        p.y = ny;
        lastMoveTimeRef.current = now;
      }

      if (p.x === center.x && p.y === center.y) {
        s.phase = "ended";
        s.winnerId = p.id;
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
        },
      });
    }, 40);

    return () => clearInterval(interval);
  }, [isHost, code, center.x, center.y]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    canvas.width = GRID_SIZE * CELL_SIZE;
    canvas.height = GRID_SIZE * CELL_SIZE;

    function draw() {
      const s = stateRef.current;
      const maze = s.maze || ui.maze;
      const playersToDraw = s.players || ui.players;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bg.addColorStop(0, "#151925");
      bg.addColorStop(1, "#0c1018");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          if (maze?.[y]?.[x] === 1) {
            ctx.fillStyle = "#111827";
            ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);

            ctx.strokeStyle = "rgba(255,255,255,0.04)";
            ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          } else {
            ctx.fillStyle = "#f8fafc";
            ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          }
        }
      }

      // center goal
      ctx.fillStyle = "#a855f7";
      ctx.fillRect(
        center.x * CELL_SIZE,
        center.y * CELL_SIZE,
        CELL_SIZE,
        CELL_SIZE
      );

      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        center.x * CELL_SIZE + 2,
        center.y * CELL_SIZE + 2,
        CELL_SIZE - 4,
        CELL_SIZE - 4
      );

      playersToDraw.forEach((p, i) => {
        ctx.fillStyle = PLAYER_COLORS[i % PLAYER_COLORS.length];
        ctx.beginPath();
        ctx.arc(
          p.x * CELL_SIZE + CELL_SIZE / 2,
          p.y * CELL_SIZE + CELL_SIZE / 2,
          CELL_SIZE / 3,
          0,
          Math.PI * 2
        );
        ctx.fill();

        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ui.maze, ui.players, center.x, center.y]);

  const winnerName = ui.winnerId
    ? ui.players.find((p) => p.id === ui.winnerId)?.name || "Player 1"
    : null;

  return (
    <div style={shell}>
      <div style={topInfoCard}>
        <div style={infoBlock}>
          <div style={infoLabel}>Game</div>
          <div style={infoValue}>Maze Escape</div>
        </div>

        <div style={infoBlock}>
          <div style={infoLabel}>Role</div>
          <div style={infoValue}>{isHost ? "You are P1" : "Spectating"}</div>
        </div>

        <div style={infoBlock}>
          <div style={infoLabel}>Connection</div>
          <div style={infoValue}>{connLine}</div>
        </div>
      </div>

      <h1 style={title}>Maze</h1>

      <p style={instructionText}>
        Navigate through the maze and reach the purple centre tile first.
      </p>

      <div style={statusCard}>
        <div style={statusMain}>
          {ui.phase === "playing"
            ? "Reach the centre to win"
            : `${winnerName} reached the centre`}
        </div>
        <div style={statusSub}>
          {isHost
            ? isPhoneLike
              ? "Use the touch controls below or WASD / Arrow Keys."
              : "Use WASD / Arrow Keys to guide Player 1."
            : "Watching synced maze state."}
        </div>
      </div>

      <div style={canvasWrap}>
        <canvas
          ref={canvasRef}
          style={canvasStyle}
        />
      </div>

      {isPhoneLike && isHost && ui.phase === "playing" && (
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
            Hold a direction to move through the maze.
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
                    background: PLAYER_COLORS[i % PLAYER_COLORS.length],
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

/* ---------- shared style direction for future games ---------- */

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