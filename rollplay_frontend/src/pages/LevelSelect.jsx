// src/pages/LevelSelect.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GAME_CATALOGUE, GAME_PACKS } from "../GameList";
import { useGame } from "../GameContext";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

export default function LevelSelect() {
  const navigate = useNavigate();

  const {
    sessionCode,
    isHost,
    round,
    setRound,
    maxRounds,
    selectedLevels,
    setSelectedLevels,
  } = useGame();

  const MAX_ROUNDS = maxRounds ?? 3;

  const [activePack, setActivePack] = useState(GAME_PACKS[0]?.id || "bar");
  const [localSelections, setLocalSelections] = useState(selectedLevels || []);
  const [isSpinning, setIsSpinning] = useState(false);

  const chosenIds = useMemo(
    () => localSelections.map((s) => s.level.id),
    [localSelections]
  );

  const allRoundsChosen = localSelections.length >= MAX_ROUNDS;

  // Joined players: follow host into arena when round 1 starts
  useEffect(() => {
    if (isHost) return;

    const code = sessionCode || localStorage.getItem("session_code");
    if (!code) return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`${API_BASE}/sessions/${code}`);
        const data = await res.json();

        if (res.ok && data?.session) {
          const currentRound = data.session.current_round ?? null;
          if (currentRound === 1) {
            navigate("/arena");
            return;
          }
        }
      } catch (err) {
        console.error("LevelSelect session poll failed:", err);
      }

      if (!cancelled) setTimeout(poll, 2000);
    }

    poll();

    return () => {
      cancelled = true;
    };
  }, [isHost, sessionCode, navigate]);

  function chooseLevel(level) {
    if (!isHost) return;
    if (isSpinning) return;

    const newSet = [...localSelections];
    const existing = newSet.find((e) => e.round === round);

    if (existing) {
      existing.level = level;
    } else {
      newSet.push({ round, level });
    }

    const sorted = newSet.sort((a, b) => a.round - b.round);

    setLocalSelections(sorted);
    setSelectedLevels(sorted);

    if (round < MAX_ROUNDS) setRound(round + 1);
  }

  function handleRandomSpin() {
    if (!isHost) return;
    if (isSpinning || allRoundsChosen) return;

    const packGames = GAME_CATALOGUE.filter((g) => g.pack === activePack);
    const available = packGames.filter((g) => !chosenIds.includes(g.id));
    if (!available.length) return;

    setIsSpinning(true);

    setTimeout(() => {
      const randomLevel =
        available[Math.floor(Math.random() * available.length)];
      chooseLevel(randomLevel);
      setIsSpinning(false);
    }, 900);
  }

  async function handleStartRoundOne() {
    if (!isHost) return;

    const round1 = localSelections.find((s) => s.round === 1);
    if (!round1) {
      alert("Pick a game for Round 1");
      return;
    }

    setSelectedLevels(localSelections);
    setRound(1);

    const code = sessionCode || localStorage.getItem("session_code");
    if (code) {
      try {
        const res = await fetch(`${API_BASE}/sessions/${code}/start-round`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ round_number: 1 }),
        });

        const data = await res.json();
        if (!res.ok) {
          console.error("[HOST] Failed to mark round start:", res.status, data?.error || data);
        }
      } catch (err) {
        console.error("Error calling /start-round:", err);
      }
    }

    navigate("/arena");
  }

  const visibleGames = useMemo(() => {
    return GAME_CATALOGUE.filter((g) => g.pack === activePack);
  }, [activePack]);

  return (
    <div style={page}>
      <div style={hero}>
        <h1 style={title}>Choose Game Order</h1>
        <p style={subtitle}>
          Host picks the order of games. Players will follow into the Arena.
        </p>
        <p style={roundText}>
          Round {round}/{MAX_ROUNDS}
        </p>
      </div>

      {/* Pack tabs */}
      <div style={packsRow}>
        {GAME_PACKS.map((pack) => (
          <button
            key={pack.id}
            onClick={() => setActivePack(pack.id)}
            style={{
              ...packButton,
              ...(activePack === pack.id ? packButtonActive : null),
            }}
          >
            <div style={{ fontWeight: 700 }}>{pack.name}</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>{pack.description}</div>
          </button>
        ))}
      </div>

      <div style={layout}>
        {/* Catalogue */}
        <div style={catalogueGrid}>
          {visibleGames.map((game) => {
            const chosenEntry = localSelections.find((s) => s.level.id === game.id);
            const disabled =
              !isHost || isSpinning || Boolean(chosenEntry) || allRoundsChosen;

            return (
              <button
                key={game.id}
                onClick={() => chooseLevel(game)}
                disabled={disabled}
                style={{
                  ...gameCard,
                  opacity: disabled ? 0.72 : 1,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                <div
                  style={{
                    ...thumb,
                    backgroundImage: `url(${game.thumb})`,
                  }}
                />

                <div style={cardBody}>
                  <div style={cardTopRow}>
                    <strong>{game.name}</strong>
                    <span style={gameId}>{game.id}</span>
                  </div>

                  <p style={cardDesc}>{game.description}</p>

                  {chosenEntry && (
                    <div style={roundBadge}>Round {chosenEntry.round}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Sidebar */}
        <div style={sidebar}>
          <h2 style={{ marginTop: 0 }}>Round Plan</h2>

          <ol style={{ paddingLeft: 18 }}>
            {Array.from({ length: MAX_ROUNDS }).map((_, i) => {
              const entry = localSelections.find((r) => r.round === i + 1);

              return (
                <li key={i} style={{ marginBottom: 10 }}>
                  <strong>Round {i + 1}:</strong>{" "}
                  <span style={{ opacity: entry ? 1 : 0.7 }}>
                    {entry ? entry.level.name : "Not chosen"}
                  </span>
                </li>
              );
            })}
          </ol>

          {isHost ? (
            <>
              <button
                onClick={handleRandomSpin}
                disabled={isSpinning || allRoundsChosen}
                style={sidebarButton}
              >
                {isSpinning ? "Choosing..." : "Random from this pack"}
              </button>

              {allRoundsChosen && (
                <button
                  onClick={handleStartRoundOne}
                  style={{ ...sidebarButton, marginTop: 10 }}
                >
                  Start Round 1
                </button>
              )}
            </>
          ) : (
            <p style={{ opacity: 0.8 }}>
              Waiting for host to choose the game order…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* styles */

const page = {
  paddingTop: 80,
  minHeight: "100vh",
  color: "white",
};

const hero = {
  textAlign: "center",
  marginBottom: 18,
};

const title = {
  margin: 0,
  fontSize: 38,
};

const subtitle = {
  marginTop: 8,
  marginBottom: 6,
  opacity: 0.75,
};

const roundText = {
  margin: 0,
  fontSize: 14,
  opacity: 0.85,
};

const packsRow = {
  maxWidth: 1100,
  margin: "0 auto 18px auto",
  paddingInline: 16,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const packButton = {
  textAlign: "left",
  padding: 14,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.18)",
  color: "white",
  cursor: "pointer",
};

const packButtonActive = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.28)",
};

const layout = {
  maxWidth: 1100,
  margin: "0 auto",
  paddingInline: 16,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 320px",
  gap: 18,
  alignItems: "start",
};

const catalogueGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
  gap: 14,
};

const gameCard = {
  padding: 0,
  overflow: "hidden",
  textAlign: "left",
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.28)",
  color: "white",
};

const thumb = {
  height: 130,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  borderBottom: "1px solid rgba(255,255,255,0.12)",
  backgroundColor: "rgba(255,255,255,0.06)",
};

const cardBody = {
  padding: 12,
};

const cardTopRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
};

const gameId = {
  fontSize: 11,
  opacity: 0.6,
};

const cardDesc = {
  fontSize: 13,
  opacity: 0.78,
  marginBottom: 0,
};

const roundBadge = {
  display: "inline-block",
  marginTop: 10,
  padding: "4px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.14)",
  fontSize: 12,
};

const sidebar = {
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.28)",
  padding: 16,
};

const sidebarButton = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.12)",
  color: "white",
  cursor: "pointer",
};