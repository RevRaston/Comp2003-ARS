// src/games/Maze/MazeGame.jsx
import { useEffect, useMemo, useRef, useState } from "react";

const WS_URL =
  (import.meta.env.VITE_WS_URL && import.meta.env.VITE_WS_URL.replace(/\/$/, "")) ||
  "ws://localhost:3000/ws";

const GRID_SIZE = 21;
const CELL_SIZE = 24;
const MOVE_INTERVAL = 120;

const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];

// Host-only controls for now
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

      lastMoveTimeRef.current = now;

      const maze = s.maze;
      const p = s.players[0]; // host controls player 1 only for MVP
      if (!p) return;

      let nx = p.x;
      let ny = p.y;

      if (keysHeldRef.current[HOST_CONTROLS.up] || keysHeldRef.current["ArrowUp"]) ny--;
      else if (keysHeldRef.current[HOST_CONTROLS.down] || keysHeldRef.current["ArrowDown"]) ny++;
      else if (keysHeldRef.current[HOST_CONTROLS.left] || keysHeldRef.current["ArrowLeft"]) nx--;
      else if (keysHeldRef.current[HOST_CONTROLS.right] || keysHeldRef.current["ArrowRight"]) nx++;

      if (maze[ny]?.[nx] === 0) {
        p.x = nx;
        p.y = ny;
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

      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          ctx.fillStyle = maze?.[y]?.[x] === 1 ? "#111827" : "#f9fafb";
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }

      // center goal
      ctx.fillStyle = "#a855f7";
      ctx.fillRect(center.x * CELL_SIZE, center.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);

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
      });

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ui.maze, ui.players, center.x, center.y]);

  const winnerName =
    ui.winnerId
      ? ui.players.find((p) => p.id === ui.winnerId)?.name || "Player 1"
      : null;

  return (
    <div style={{ width: "100%", color: "white", textAlign: "center" }}>
      <h1 style={{ marginBottom: 8 }}>Maze</h1>

      <div style={{ color: "white", opacity: 0.7, fontSize: 12, marginBottom: 8 }}>
        {connLine} {isHost ? "— HOST" : "— CLIENT"} (room: {code})
      </div>

      <canvas
        ref={canvasRef}
        style={{
          borderRadius: 18,
          maxWidth: "100%",
          boxShadow: "0 14px 30px rgba(0,0,0,0.35)",
          background: "#0f172a",
        }}
      />

      <div style={{ marginTop: 12, fontSize: 13, opacity: 0.82 }}>
        {isHost
          ? "Host controls Player 1 with WASD / Arrow Keys for MVP."
          : "Watching synced maze state."}
      </div>

      {ui.phase === "ended" && (
        <div style={{ marginTop: 16, fontSize: 18 }}>
          {winnerName} reached the center and wins!
        </div>
      )}
    </div>
  );
}