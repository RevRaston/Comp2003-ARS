// src/games/Maze/MazeGame.jsx
import React, { useEffect, useRef, useState } from "react";

// ===== CONFIG =====
const GRID_SIZE = 21; // odd number recommended
const CELL_SIZE = 24;
const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];
const MOVE_INTERVAL = 120; // ms between steps when holding key

// Control schemes for up to 4 local players (for preview testing)
const CONTROL_SCHEMES = [
  { up: "w", down: "s", left: "a", right: "d" },
  { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" },
  { up: "i", down: "k", left: "j", right: "l" },
  { up: "t", down: "g", left: "f", right: "h" },
];

// ===== MAZE GENERATION (Recursive Backtracker) =====
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

/**
 * Very simple local-multiplayer Maze.
 * For now this is *host-preview only* — no online sync.
 * We still accept props so we can wire them up later.
 */
export default function MazeGame({
  // currently unused but future-proofed:
  sessionCode,
  players: sessionPlayers,
  isHost,
  myUserId,
  mySeatIndex,
}) {
  const canvasRef = useRef(null);

  // Default to 4 players so 3 & 4 are immediately playable
  const [playersCount, setPlayersCount] = useState(4);
  const [maze, setMaze] = useState(() => generateMaze(GRID_SIZE));
  const [players, setPlayers] = useState([]);
  const [winner, setWinner] = useState(null);

  const mazeRef = useRef(maze);
  const winnerRef = useRef(winner);
  const animationRef = useRef(null);

  const keysHeld = useRef({});
  const lastMoveTime = useRef(0);

  const center = {
    x: Math.floor(GRID_SIZE / 2),
    y: Math.floor(GRID_SIZE / 2),
  };

  // Keep refs synced
  useEffect(() => {
    mazeRef.current = maze;
  }, [maze]);

  useEffect(() => {
    winnerRef.current = winner;
  }, [winner]);

  function resetGame(count = playersCount) {
    const newMaze = generateMaze(GRID_SIZE);
    // make sure center is reachable
    newMaze[center.y][center.x] = 0;

    const spawns = getSpawnPositions(GRID_SIZE);
    const newPlayers = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: spawns[i].x,
      y: spawns[i].y,
    }));

    setMaze(newMaze);
    setPlayers(newPlayers);
    setWinner(null);
  }

  // Initial setup
  useEffect(() => {
    resetGame(playersCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset when player count changes
  useEffect(() => {
    resetGame(playersCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playersCount]);

  // ===== KEY TRACKING =====
  useEffect(() => {
    function down(e) {
      keysHeld.current[e.key] = true;
    }
    function up(e) {
      keysHeld.current[e.key] = false;
    }

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // ===== CONTINUOUS MOVEMENT LOOP =====
  useEffect(() => {
    function loop(time) {
      if (
        winnerRef.current === null &&
        time - lastMoveTime.current > MOVE_INTERVAL
      ) {
        lastMoveTime.current = time;

        setPlayers((prev) => {
          const updated = prev.map((p) => ({ ...p }));
          const maze = mazeRef.current;

          updated.forEach((player, index) => {
            const scheme = CONTROL_SCHEMES[index];
            if (!scheme) return;

            let nx = player.x;
            let ny = player.y;

            if (keysHeld.current[scheme.up]) ny--;
            else if (keysHeld.current[scheme.down]) ny++;
            else if (keysHeld.current[scheme.left]) nx--;
            else if (keysHeld.current[scheme.right]) nx++;

            if (maze[ny]?.[nx] === 0) {
              player.x = nx;
              player.y = ny;
            }

            if (player.x === center.x && player.y === center.y) {
              setWinner(index);
            }
          });

          return updated;
        });
      }

      animationRef.current = requestAnimationFrame(loop);
    }

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // ===== RENDER TO CANVAS =====
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    canvas.width = GRID_SIZE * CELL_SIZE;
    canvas.height = GRID_SIZE * CELL_SIZE;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        ctx.fillStyle = maze[y][x] === 1 ? "#111827" : "#f9fafb";
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }

    // goal tile
    ctx.fillStyle = "#a855f7";
    ctx.fillRect(
      center.x * CELL_SIZE,
      center.y * CELL_SIZE,
      CELL_SIZE,
      CELL_SIZE
    );

    // players
    players.forEach((p, i) => {
      ctx.fillStyle = PLAYER_COLORS[i];
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
  }, [maze, players]);

  return (
    <div
      className="flex flex-col items-center gap-3"
      style={{ width: "100%", color: "white", textAlign: "center" }}
    >
      <h2 className="text-xl font-semibold">Maze (preview only)</h2>

      <p className="text-xs opacity-70 max-w-sm">
        Local preview right now — only the host&apos;s tab is really used.
        Controls: P1 WASD, P2 Arrows, P3 IJKL, P4 TFGH.
      </p>

      <div className="flex gap-3 items-center text-xs">
        <label>Players:</label>
        <select
          value={playersCount}
          onChange={(e) => setPlayersCount(Number(e.target.value))}
          className="text-black px-2 py-1 rounded"
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        <button
          onClick={() => resetGame(playersCount)}
          className="bg-indigo-500 hover:bg-indigo-600 px-3 py-1 rounded text-xs"
        >
          New Maze
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="rounded-2xl shadow-2xl"
        style={{ maxWidth: "100%", height: "auto" }}
      />

      {winner !== null && (
        <div className="bg-green-500 text-black px-4 py-2 rounded-2xl font-semibold text-sm mt-2">
          Player {winner + 1} reached the center and wins!
        </div>
      )}
    </div>
  );
}