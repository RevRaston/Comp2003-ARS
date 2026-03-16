// src/pages/ChooseGame.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";

const ALL_GAMES = [
  {
    id: "sumo",
    name: "Sumo Showdown",
    description: "Push your friends out of the ring. Last one standing wins.",
    minPlayers: 2,
    maxPlayers: 4,
    category: "Bar Game",
  },
  {
    id: "darts",
    name: "Darts Duel",
    description: "Aim carefully and rack up the highest score across quick rounds.",
    minPlayers: 2,
    maxPlayers: 6,
    category: "Pub Classic",
  },
  {
    id: "guess-card",
    name: "Guessing Card",
    description: "Read the room, bluff well, and outguess everyone else.",
    minPlayers: 2,
    maxPlayers: 8,
    category: "Table Game",
  },
];

export default function ChooseGame() {
  const navigate = useNavigate();
  const { players, isHost, sessionCode, profile } = useGame();

  const [votes, setVotes] = useState({});
  const [queue, setQueue] = useState([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [highlightedId, setHighlightedId] = useState(null);
  const [error, setError] = useState("");

  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  useEffect(() => {
    function handleResize() {
      setScreenWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isPhone = screenWidth <= 720;
  const isTablet = screenWidth <= 1100;

  const myUserId =
    profile?.id ||
    profile?.user_id ||
    localStorage.getItem("user_id") ||
    null;

  const codeToShow =
    sessionCode || localStorage.getItem("session_code") || "N/A";

  const gameOptions = useMemo(() => {
    return ALL_GAMES.map((g) => ({
      ...g,
      votes: votes[g.id] || 0,
      inQueue: queue.includes(g.id),
      votedByMe: (votes[g.id] || 0) > 0,
    })).sort((a, b) => b.votes - a.votes);
  }, [votes, queue]);

  const queueDetails = useMemo(
    () => queue.map((id) => ALL_GAMES.find((g) => g.id === id)).filter(Boolean),
    [queue]
  );

  function handleToggleVote(gameId) {
    setVotes((prev) => {
      const current = prev[gameId] || 0;
      const next = current === 0 ? 1 : 0;
      return { ...prev, [gameId]: next };
    });
  }

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

      const next = [...prev];
      const swapWith = direction === "up" ? idx - 1 : idx + 1;

      if (swapWith < 0 || swapWith >= next.length) return prev;

      const temp = next[swapWith];
      next[swapWith] = next[idx];
      next[idx] = temp;
      return next;
    });
  }

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

      if (ticks > ALL_GAMES.length * 6) {
        clearInterval(interval);
        const chosen = ALL_GAMES[currentIndex];

        setHighlightedId(chosen.id);
        addGameToQueue(chosen.id);
        setIsSpinning(false);
      }
    }, 80);
  }

  async function handleConfirmAndStart() {
    if (!isHost) return;

    if (queue.length === 0) {
      setError("Add at least one game to the queue first.");
      return;
    }

    try {
      setError("");
      navigate("/arena");
    } catch (err) {
      console.error("Error confirming game queue:", err);
      setError("Failed to confirm games. Try again.");
    }
  }

  const totalVotes = Object.values(votes).reduce((sum, value) => sum + value, 0);

  return (
    <div style={page}>
      <div style={topGlow} />
      <div style={sideGlow} />

      <main
        style={{
          ...shell,
          padding: isPhone ? "28px 14px 40px" : "40px 20px 56px",
        }}
      >
        <section
          style={{
            ...heroCard,
            padding: isPhone ? "22px 18px" : "28px 28px",
            flexDirection: isPhone ? "column" : "row",
            alignItems: isPhone ? "flex-start" : "center",
          }}
        >
          <div style={{ flex: 1 }}>
            <p style={eyebrow}>Session setup</p>
            <h1
              style={{
                ...title,
                fontSize: isPhone ? 34 : isTablet ? 44 : 56,
              }}
            >
              Choose the games for tonight
            </h1>
            <p
              style={{
                ...subtitle,
                fontSize: isPhone ? 15 : 17,
              }}
            >
              Vote on the best mini-games, let the host build the round order,
              then lock in the queue and head to the arena.
            </p>
          </div>

          <div
            style={{
              ...sessionInfoCard,
              width: isPhone ? "100%" : 320,
            }}
          >
            <div style={sessionRow}>
              <span style={sessionLabel}>Session code</span>
              <span style={sessionValue}>{codeToShow}</span>
            </div>
            <div style={sessionRow}>
              <span style={sessionLabel}>Role</span>
              <span
                style={{
                  ...roleBadge,
                  ...(isHost ? roleBadgeHost : roleBadgePlayer),
                }}
              >
                {isHost ? "Host" : "Player"}
              </span>
            </div>
            <div style={sessionRow}>
              <span style={sessionLabel}>Players</span>
              <span style={sessionValue}>{players?.length || 0}</span>
            </div>
            <div style={sessionRow}>
              <span style={sessionLabel}>Votes cast</span>
              <span style={sessionValue}>{totalVotes}</span>
            </div>
          </div>
        </section>

        <section
          style={{
            ...statusBanner,
            padding: isPhone ? "14px 16px" : "16px 18px",
            flexDirection: isPhone ? "column" : "row",
            alignItems: isPhone ? "flex-start" : "center",
          }}
        >
          <div>
            <strong>{isHost ? "Host tools unlocked." : "Voting is open."}</strong>{" "}
            {isHost
              ? "Build the queue from votes, tweak the order, or use the random selector."
              : "Vote for the games you want to play and wait for the host to lock the round plan."}
          </div>
          {highlightedId && (
            <div style={statusPill}>
              Highlighted:{" "}
              <strong>
                {ALL_GAMES.find((g) => g.id === highlightedId)?.name || highlightedId}
              </strong>
            </div>
          )}
        </section>

        <section
          style={{
            ...layout,
            gridTemplateColumns: isPhone
              ? "1fr"
              : isTablet
              ? "minmax(0, 1fr)"
              : "minmax(0, 1.45fr) minmax(360px, 0.95fr)",
          }}
        >
          <div style={panel}>
            <div style={panelHeader}>
              <div>
                <p style={panelEyebrow}>Game pool</p>
                <h2 style={panelTitle}>Vote on what gets played</h2>
              </div>
              <div style={miniStat}>
                {gameOptions.length} {gameOptions.length === 1 ? "game" : "games"}
              </div>
            </div>

            <p style={panelHint}>
              Click a card to vote or remove your vote. Hosts can also add games
              directly to the queue.
            </p>

            <div style={gameGrid}>
              {gameOptions.map((g) => (
                <div
                  key={g.id}
                  style={{
                    ...gameCard,
                    ...(g.votedByMe ? gameCardActive : {}),
                    ...(g.inQueue ? gameCardQueued : {}),
                    ...(highlightedId === g.id ? gameCardHighlighted : {}),
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleVote(g.id)}
                    style={cardHitArea}
                  >
                    <div style={gameTopRow}>
                      <span style={categoryBadge}>{g.category}</span>
                      {g.inQueue && <span style={queueBadge}>In queue</span>}
                    </div>

                    <h3 style={gameName}>{g.name}</h3>
                    <p style={gameDesc}>{g.description}</p>

                    <div style={gameFooter}>
                      <div style={metaPills}>
                        <span style={metaPill}>
                          {g.minPlayers}-{g.maxPlayers} players
                        </span>
                        <span style={metaPill}>👍 {g.votes} vote{g.votes === 1 ? "" : "s"}</span>
                      </div>

                      <span style={voteActionText}>
                        {g.votedByMe ? "Remove vote" : "Vote"}
                      </span>
                    </div>
                  </button>

                  {isHost && !g.inQueue && (
                    <button
                      type="button"
                      style={ghostActionButton}
                      onClick={() => addGameToQueue(g.id)}
                    >
                      Add to queue
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={panel}>
            <div style={panelHeader}>
              <div>
                <p style={panelEyebrow}>Round plan</p>
                <h2 style={panelTitle}>Game queue</h2>
              </div>
              <div style={miniStat}>{queueDetails.length} queued</div>
            </div>

            <p style={panelHint}>
              {isHost
                ? "Arrange the order the group will play through."
                : "This is the order the host has prepared for the session."}
            </p>

            {queueDetails.length === 0 ? (
              <div style={emptyState}>
                <div style={emptyIcon}>🎲</div>
                <h3 style={emptyTitle}>No rounds added yet</h3>
                <p style={emptyText}>
                  {isHost
                    ? "Use votes, add games manually, or spin the selector to build tonight’s line-up."
                    : "Waiting for the host to build and confirm the queue."}
                </p>
              </div>
            ) : (
              <ol style={queueList}>
                {queueDetails.map((g, index) => (
                  <li key={g.id} style={queueItem}>
                    <div style={queueItemLeft}>
                      <div style={queueNumber}>{index + 1}</div>
                      <div>
                        <div style={queueGameName}>{g.name}</div>
                        <div style={queueGameMeta}>
                          {g.category} • {g.minPlayers}-{g.maxPlayers} players
                        </div>
                      </div>
                    </div>

                    {isHost && (
                      <div style={queueButtons}>
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
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {isHost && (
              <>
                <div
                  style={{
                    ...hostControls,
                    flexDirection: isPhone ? "column" : "row",
                  }}
                >
                  <button
                    type="button"
                    style={{ ...actionButton, ...primaryButton }}
                    onClick={applyVotesToQueue}
                  >
                    Build from votes
                  </button>

                  <button
                    type="button"
                    style={{ ...actionButton, ...secondaryButton }}
                    onClick={spinWheel}
                    disabled={isSpinning}
                  >
                    {isSpinning ? "Spinning…" : "Random pick"}
                  </button>
                </div>

                <button
                  type="button"
                  style={{
                    ...actionButton,
                    ...startButton,
                    marginTop: 14,
                    width: "100%",
                  }}
                  onClick={handleConfirmAndStart}
                >
                  Confirm queue & start first game
                </button>
              </>
            )}

            {!isHost && (
              <div style={waitingBox}>
                <strong>Waiting for host confirmation.</strong>
                <p style={waitingText}>
                  Players can vote, but only the host can lock the final order
                  and start the session.
                </p>
              </div>
            )}
          </div>
        </section>

        {error && <div style={errorBox}>{error}</div>}

        <footer
          style={{
            ...footer,
            padding: isPhone ? "18px 16px" : "20px 22px",
          }}
        >
          <div style={footerHeader}>Lobby players</div>
          <p style={footerText}>
            {players && players.length > 0
              ? players.map((p) => p.display_name || p.name || "Unknown").join(" • ")
              : "No players joined yet."}
          </p>
        </footer>
      </main>
    </div>
  );
}

/* ---------------- styles ---------------- */

const page = {
  minHeight: "100vh",
  color: "#fff",
  position: "relative",
  overflow: "hidden",
  background:
    "radial-gradient(circle at top, rgba(255,210,90,0.10), transparent 18%), linear-gradient(180deg, #0d1118 0%, #151b26 35%, #1b2130 100%)",
};

const topGlow = {
  position: "absolute",
  width: 520,
  height: 520,
  borderRadius: "50%",
  background: "rgba(255, 196, 54, 0.14)",
  filter: "blur(90px)",
  top: -120,
  left: -120,
};

const sideGlow = {
  position: "absolute",
  width: 420,
  height: 420,
  borderRadius: "50%",
  background: "rgba(255, 132, 82, 0.10)",
  filter: "blur(90px)",
  right: -80,
  top: 180,
};

const shell = {
  width: "100%",
  maxWidth: 1240,
  margin: "0 auto",
  position: "relative",
  zIndex: 2,
};

const heroCard = {
  display: "flex",
  gap: 22,
  justifyContent: "space-between",
  borderRadius: 32,
  background: "rgba(0, 0, 0, 0.38)",
  border: "1px solid rgba(255,255,255,0.10)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
};

const eyebrow = {
  margin: "0 0 10px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 1.6,
  color: "#f6cf64",
  fontSize: 13,
};

const title = {
  margin: 0,
  lineHeight: 0.95,
  fontWeight: 900,
};

const subtitle = {
  margin: "14px 0 0",
  maxWidth: 760,
  lineHeight: 1.6,
  opacity: 0.88,
};

const sessionInfoCard = {
  borderRadius: 24,
  padding: 18,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.10)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const sessionRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
};

const sessionLabel = {
  fontSize: 13,
  opacity: 0.72,
};

const sessionValue = {
  fontSize: 14,
  fontWeight: 700,
};

const roleBadge = {
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
};

const roleBadgeHost = {
  background: "rgba(244,196,49,0.18)",
  border: "1px solid rgba(244,196,49,0.32)",
  color: "#f6cf64",
};

const roleBadgePlayer = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.14)",
  color: "#fff",
};

const statusBanner = {
  marginTop: 18,
  marginBottom: 20,
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  borderRadius: 22,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const statusPill = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(244,196,49,0.16)",
  border: "1px solid rgba(244,196,49,0.24)",
  whiteSpace: "nowrap",
  fontSize: 13,
};

const layout = {
  display: "grid",
  gap: 22,
};

const panel = {
  borderRadius: 28,
  padding: 22,
  background: "rgba(0,0,0,0.38)",
  border: "1px solid rgba(255,255,255,0.10)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.20)",
};

const panelHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  marginBottom: 8,
};

const panelEyebrow = {
  margin: 0,
  color: "#f6cf64",
  textTransform: "uppercase",
  letterSpacing: 1.4,
  fontSize: 12,
  fontWeight: 700,
};

const panelTitle = {
  margin: "6px 0 0",
  fontSize: 28,
  lineHeight: 1.05,
};

const panelHint = {
  margin: "0 0 18px",
  fontSize: 14,
  lineHeight: 1.6,
  opacity: 0.82,
};

const miniStat = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
  fontSize: 12,
  whiteSpace: "nowrap",
};

const gameGrid = {
  display: "grid",
  gap: 14,
};

const gameCard = {
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  overflow: "hidden",
  transition: "0.2s ease",
};

const gameCardActive = {
  border: "1px solid rgba(244,196,49,0.34)",
  boxShadow: "0 0 0 1px rgba(244,196,49,0.18)",
};

const gameCardQueued = {
  background: "rgba(255,255,255,0.06)",
};

const gameCardHighlighted = {
  boxShadow: "0 0 0 2px rgba(255,255,255,0.35)",
};

const cardHitArea = {
  width: "100%",
  textAlign: "left",
  border: "none",
  background: "transparent",
  color: "white",
  cursor: "pointer",
  padding: 18,
};

const gameTopRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 12,
  flexWrap: "wrap",
};

const categoryBadge = {
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.10)",
};

const queueBadge = {
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  background: "rgba(58,196,125,0.18)",
  border: "1px solid rgba(58,196,125,0.32)",
  color: "#bdf5d0",
};

const gameName = {
  margin: "0 0 8px",
  fontSize: 22,
  lineHeight: 1.1,
};

const gameDesc = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.6,
  opacity: 0.82,
};

const gameFooter = {
  marginTop: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const metaPills = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const metaPill = {
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 12,
  background: "rgba(0,0,0,0.24)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const voteActionText = {
  fontSize: 13,
  fontWeight: 700,
  color: "#f6cf64",
};

const ghostActionButton = {
  width: "100%",
  border: "none",
  borderTop: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  color: "#fff",
  cursor: "pointer",
  padding: "13px 16px",
  fontSize: 14,
  fontWeight: 700,
};

const emptyState = {
  borderRadius: 22,
  padding: "24px 18px",
  background: "rgba(255,255,255,0.04)",
  border: "1px dashed rgba(255,255,255,0.16)",
  textAlign: "center",
};

const emptyIcon = {
  fontSize: 28,
  marginBottom: 10,
};

const emptyTitle = {
  margin: "0 0 8px",
  fontSize: 20,
};

const emptyText = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.6,
  opacity: 0.8,
};

const queueList = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const queueItem = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  padding: 14,
  borderRadius: 18,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const queueItemLeft = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minWidth: 0,
};

const queueNumber = {
  width: 34,
  height: 34,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f4c431",
  color: "#171717",
  fontWeight: 800,
  flexShrink: 0,
};

const queueGameName = {
  fontSize: 16,
  fontWeight: 800,
  marginBottom: 4,
};

const queueGameMeta = {
  fontSize: 12,
  opacity: 0.72,
};

const queueButtons = {
  display: "flex",
  gap: 6,
  flexShrink: 0,
};

const smallButton = {
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.42)",
  color: "white",
  padding: "7px 10px",
  fontSize: 12,
  cursor: "pointer",
};

const smallButtonDanger = {
  ...smallButton,
  borderColor: "rgba(255,90,90,0.5)",
};

const hostControls = {
  display: "flex",
  gap: 10,
  marginTop: 16,
};

const actionButton = {
  border: "none",
  borderRadius: 999,
  padding: "13px 16px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const primaryButton = {
  background: "#f4c431",
  color: "#1d1d1d",
  boxShadow: "0 10px 24px rgba(244,196,49,0.22)",
};

const secondaryButton = {
  background: "#2d3442",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.14)",
};

const startButton = {
  background: "linear-gradient(135deg, #f4c431, #ffae42)",
  color: "#1b1b1b",
  boxShadow: "0 12px 28px rgba(244,196,49,0.20)",
};

const waitingBox = {
  marginTop: 16,
  borderRadius: 18,
  padding: 16,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const waitingText = {
  margin: "8px 0 0",
  fontSize: 14,
  lineHeight: 1.6,
  opacity: 0.8,
};

const errorBox = {
  marginTop: 18,
  borderRadius: 18,
  padding: "14px 16px",
  background: "rgba(255, 99, 99, 0.12)",
  border: "1px solid rgba(255, 99, 99, 0.28)",
  color: "#ffd4d4",
  fontSize: 14,
  fontWeight: 600,
};

const footer = {
  marginTop: 22,
  borderRadius: 22,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const footerHeader = {
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 1.2,
  color: "#f6cf64",
  marginBottom: 8,
};

const footerText = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.6,
  opacity: 0.82,
};