// src/pages/ChooseGame.jsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";

// 👉 Later, you can replace this with an import from GameList.js
//    e.g. `import GAMES from "../GameList";`
const ALL_GAMES = [
  {
    id: "sumo",
    name: "Sumo Showdown",
    description: "Push your friends out of the ring. Last one standing wins.",
    minPlayers: 2,
    maxPlayers: 4,
  },
  // Add more games here when ready…
];

export default function ChooseGame() {
  const navigate = useNavigate();
  const { players, isHost, sessionCode, profile } = useGame();

  const [votes, setVotes] = useState({}); // { gameId: numberOfVotes }
  const [queue, setQueue] = useState([]); // [gameId, ...]
  const [isSpinning, setIsSpinning] = useState(false);
  const [highlightedId, setHighlightedId] = useState(null);
  const [error, setError] = useState("");

  const myUserId =
    profile?.id ||
    profile?.user_id ||
    localStorage.getItem("user_id") ||
    null;

  // Just for UI: build a view model with vote counts and "in queue" flags
  const gameOptions = useMemo(() => {
    return ALL_GAMES.map((g) => ({
      ...g,
      votes: votes[g.id] || 0,
      inQueue: queue.includes(g.id),
    })).sort((a, b) => b.votes - a.votes);
  }, [votes, queue]);

  const queueDetails = useMemo(
    () => queue.map((id) => ALL_GAMES.find((g) => g.id === id)).filter(Boolean),
    [queue]
  );

  // ----------------------------------------------------------
  // Voting: very simple client-side draft logic
  // (Later you can sync votes via backend/websockets)
  // ----------------------------------------------------------
  function handleToggleVote(gameId) {
    setVotes((prev) => {
      const current = prev[gameId] || 0;
      // For now, treat clicking as +1/-1 from *this device*
      const next = current === 0 ? 1 : 0;
      return { ...prev, [gameId]: next };
    });
  }

  // ----------------------------------------------------------
  // Host tools: build queue from votes, tweak order, random wheel
  // ----------------------------------------------------------
  function applyVotesToQueue() {
    if (!isHost) return;

    const sortedByVotes = [...ALL_GAMES]
      .filter((g) => (votes[g.id] || 0) > 0)
      .sort((a, b) => (votes[b.id] || 0) - (votes[a.id] || 0));

    if (sortedByVotes.length === 0) {
      setError("No games have any votes yet.");
      return;
    }

    setError("");
    setQueue(sortedByVotes.map((g) => g.id));
  }

  function addGameToQueue(gameId) {
    if (!isHost) return;
    setQueue((prev) => (prev.includes(gameId) ? prev : [...prev, gameId]));
  }

  function removeFromQueue(gameId) {
    if (!isHost) return;
    setQueue((prev) => prev.filter((id) => id !== gameId));
  }

  function moveInQueue(gameId, direction) {
    if (!isHost) return;
    setQueue((prev) => {
      const idx = prev.indexOf(gameId);
      if (idx === -1) return prev;

      const newArr = [...prev];
      const swapWith = direction === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= newArr.length) return prev;

      const tmp = newArr[swapWith];
      newArr[swapWith] = newArr[idx];
      newArr[idx] = tmp;
      return newArr;
    });
  }

  // Quick “spinny wheel” randomiser: visually cycles through games,
  // then lands on one and adds it to the queue.
  function spinWheel() {
    if (!isHost || isSpinning || ALL_GAMES.length === 0) return;

    setError("");
    setIsSpinning(true);

    let ticks = 0;
    let currentIndex = 0;

    const interval = setInterval(() => {
      const game = ALL_GAMES[currentIndex];
      setHighlightedId(game.id);

      currentIndex = (currentIndex + 1) % ALL_GAMES.length;
      ticks += 1;

      // Stop after ~2s (adjust as you like)
      if (ticks > ALL_GAMES.length * 6) {
        clearInterval(interval);
        const chosen = ALL_GAMES[currentIndex];

        setHighlightedId(chosen.id);
        addGameToQueue(chosen.id);
        setIsSpinning(false);
      }
    }, 80);
  }

  // ----------------------------------------------------------
  // Confirm selection + go to Arena
  // (Later: POST queue to backend / session config)
  // ----------------------------------------------------------
  async function handleConfirmAndStart() {
    if (!isHost) return;

    if (queue.length === 0) {
      setError("Add at least one game to the queue first.");
      return;
    }

    try {
      setError("");

      // TODO: If you add a backend endpoint, call it here, e.g.:
      //
      // await fetch(`${API_BASE}/sessions/${sessionCode}/games`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      //   body: JSON.stringify({ queue }),
      // });
      //
      // For now, we just go straight to the Arena.
      navigate("/arena");
    } catch (err) {
      console.error("Error confirming game queue:", err);
      setError("Failed to confirm games. Try again.");
    }
  }

  const codeToShow =
    sessionCode || localStorage.getItem("session_code") || "N/A";

  return (
    <div style={page}>
      <header style={header}>
        <div>
          <h1 style={title}>Choose Games</h1>
          <p style={subtitle}>
            Session <strong>{codeToShow}</strong> •{" "}
            {isHost ? "You are the host" : "Waiting on host to lock in games"}
          </p>
        </div>
      </header>

      <main style={layout}>
        {/* LEFT: Games list + voting */}
        <section style={column}>
          <h2 style={sectionTitle}>Game Pool</h2>
          <p style={sectionHint}>
            Click to vote for games you want to play. The host can build the
            final queue based on votes or use the wheel.
          </p>

          {gameOptions.map((g) => (
            <button
              key={g.id}
              style={{
                ...gameCard,
                ...(highlightedId === g.id ? gameCardHighlighted : {}),
                opacity: g.inQueue ? 0.75 : 1,
              }}
              onClick={() => handleToggleVote(g.id)}
            >
              <div style={gameMain}>
                <div>
                  <h3 style={gameName}>{g.name}</h3>
                  <p style={gameDesc}>{g.description}</p>
                </div>
                <div style={gameMeta}>
                  <span style={voteBadge}>
                    👍 {g.votes}
                  </span>
                  {g.inQueue && (
                    <span style={queueBadge}>
                      In queue
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </section>

        {/* RIGHT: Queue + host controls */}
        <section style={column}>
          <h2 style={sectionTitle}>Game Queue</h2>
          <p style={sectionHint}>
            This is the order games will be played in.
            {isHost
              ? " You can sort by votes, tweak the order, or spin the wheel."
              : " The host controls the final order."}
          </p>

          {queueDetails.length === 0 && (
            <p style={{ opacity: 0.7, fontSize: 14 }}>
              No games in the queue yet.
              {isHost ? " Use votes or the wheel to add some." : ""}
            </p>
          )}

          <ol style={queueList}>
            {queueDetails.map((g) => (
              <li key={g.id} style={queueItem}>
                <span>
                  <strong>{g.name}</strong>
                </span>
                {isHost && (
                  <span style={queueButtons}>
                    <button
                      type="button"
                      style={smallButton}
                      onClick={() => moveInQueue(g.id, "up")}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      style={smallButton}
                      onClick={() => moveInQueue(g.id, "down")}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      style={smallButtonDanger}
                      onClick={() => removeFromQueue(g.id)}
                    >
                      ✕
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ol>

          {isHost && (
            <div style={hostControls}>
              <button type="button" style={primaryButton} onClick={applyVotesToQueue}>
                Build from votes
              </button>
              <button
                type="button"
                style={secondaryButton}
                onClick={spinWheel}
                disabled={isSpinning}
              >
                {isSpinning ? "Spinning…" : "Spin wheel"}
              </button>
            </div>
          )}

          {isHost && (
            <button
              type="button"
              style={{ ...primaryButton, marginTop: 16, width: "100%" }}
              onClick={handleConfirmAndStart}
            >
              Confirm queue & start first game
            </button>
          )}
        </section>
      </main>

      {error && <p style={errorText}>{error}</p>}

      <footer style={footer}>
        <p style={{ fontSize: 12, opacity: 0.7 }}>
          Players in lobby:{" "}
          {players && players.length > 0
            ? players
                .map((p) => p.display_name || p.name || "Unknown")
                .join(", ")
            : "none"}
        </p>
      </footer>
    </div>
  );
}

/* ---- inline styles to match your existing vibe ---- */

const page = {
  paddingTop: 80,
  minHeight: "100vh",
  color: "white",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const header = {
  width: "100%",
  maxWidth: 960,
  padding: "0 16px",
  marginBottom: 16,
};

const title = {
  margin: 0,
  fontSize: 34,
  letterSpacing: 1.5,
};

const subtitle = {
  margin: "4px 0 0",
  fontSize: 13,
  opacity: 0.75,
};

const layout = {
  width: "100%",
  maxWidth: 960,
  padding: "0 16px 32px",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
  gap: 24,
};

const column = {
  borderRadius: 24,
  padding: 18,
  background: "rgba(0,0,0,0.45)",
  border: "1px solid rgba(255,255,255,0.16)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const sectionTitle = {
  margin: 0,
  fontSize: 20,
};

const sectionHint = {
  margin: 0,
  fontSize: 13,
  opacity: 0.8,
};

const gameCard = {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.45)",
  cursor: "pointer",
  marginTop: 8,
};

const gameCardHighlighted = {
  boxShadow: "0 0 0 2px rgba(255,255,255,0.5)",
};

const gameMain = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
};

const gameName = {
  margin: "0 0 4px",
  fontSize: 16,
};

const gameDesc = {
  margin: 0,
  fontSize: 13,
  opacity: 0.8,
};

const gameMeta = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 4,
};

const voteBadge = {
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 12,
  background: "rgba(255,255,255,0.08)",
};

const queueBadge = {
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 11,
  background: "rgba(58,196,125,0.25)",
};

const queueList = {
  listStyle: "decimal",
  paddingLeft: 18,
  margin: "8px 0 0",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const queueItem = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 14,
};

const queueButtons = {
  display: "flex",
  gap: 4,
};

const smallButton = {
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.5)",
  padding: "2px 8px",
  fontSize: 11,
  cursor: "pointer",
};

const smallButtonDanger = {
  ...smallButton,
  borderColor: "rgba(255,80,80,0.7)",
};

const hostControls = {
  display: "flex",
  gap: 8,
  marginTop: 8,
};

const primaryButton = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "none",
  background:
    "linear-gradient(135deg, rgba(114, 179, 255, 0.95), rgba(79, 108, 255, 0.95))",
  color: "white",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButton = {
  ...primaryButton,
  background: "rgba(0,0,0,0.7)",
  border: "1px solid rgba(255,255,255,0.22)",
};

const errorText = {
  marginTop: 8,
  color: "salmon",
  fontSize: 13,
};

const footer = {
  width: "100%",
  maxWidth: 960,
  padding: "0 16px 24px",
};