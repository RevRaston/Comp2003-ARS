// src/pages/LevelSelect.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GAME_CATALOGUE, GAME_PACKS } from "../GameList";
import { useGame } from "../GameContext";

const defaultBase =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://comp2003-ars.onrender.com";

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  defaultBase
).replace(/\/$/, "");

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
    players,
  } = useGame();

  const MAX_ROUNDS = maxRounds ?? 3;

  const [activePack, setActivePack] = useState(GAME_PACKS[0]?.id || "bar");
  const [localSelections, setLocalSelections] = useState(selectedLevels || []);
  const [isSpinning, setIsSpinning] = useState(false);
  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  const code = sessionCode || localStorage.getItem("session_code");

  useEffect(() => {
    function handleResize() {
      setScreenWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isPhone = screenWidth <= 720;
  const isTablet = screenWidth <= 1100;

  const chosenIds = useMemo(
    () => localSelections.map((s) => s.level.id),
    [localSelections]
  );

  const allRoundsChosen = localSelections.length >= MAX_ROUNDS;

  useEffect(() => {
    if (!code) return;

    let cancelled = false;

    async function loadLevelPlan() {
      try {
        const res = await fetch(`${API_BASE}/sessions/${code}/levels`);
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.levels) return;
        if (cancelled) return;

        const mapped = data.levels
          .map((entry) => {
            const level = GAME_CATALOGUE.find((g) => g.id === entry.level_key);
            if (!level) return null;

            return {
              round: entry.round_number,
              level,
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.round - b.round);

        if (mapped.length > 0) {
          setLocalSelections(mapped);
          setSelectedLevels(mapped);
        }
      } catch (err) {
        console.error("Failed to load level plan:", err);
      }
    }

    loadLevelPlan();

    return () => {
      cancelled = true;
    };
  }, [code, setSelectedLevels]);

  useEffect(() => {
    if (isHost) return;
    if (!code) return;

    let cancelled = false;
    let timeoutId = null;

    async function poll() {
      try {
        const res = await fetch(`${API_BASE}/sessions/${code}`);
        const data = await res.json().catch(() => null);

        if (res.ok && data?.session) {
          const currentRound = Number(data.session.current_round || 0);

          if (currentRound >= 1) {
            navigate("/arena");
            return;
          }
        }
      } catch (err) {
        console.error("LevelSelect session poll failed:", err);
      }

      if (!cancelled) {
        timeoutId = setTimeout(poll, 1500);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isHost, code, navigate]);

  async function saveLevelToBackend(roundNumber, levelId) {
    if (!code) return;

    try {
      const res = await fetch(`${API_BASE}/sessions/${code}/levels`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          round_number: roundNumber,
          level_key: levelId,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("Failed to save level plan:", data?.error || data);
      }
    } catch (err) {
      console.error("saveLevelToBackend failed:", err);
    }
  }

  async function chooseLevel(level) {
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

    await saveLevelToBackend(round, level.id);

    if (round < MAX_ROUNDS) setRound(round + 1);
  }

  function handleRandomSpin() {
    if (!isHost) return;
    if (isSpinning || allRoundsChosen) return;

    const packGames = GAME_CATALOGUE.filter((g) => g.pack === activePack);
    const available = packGames.filter((g) => !chosenIds.includes(g.id));
    if (!available.length) return;

    setIsSpinning(true);

    setTimeout(async () => {
      const randomLevel =
        available[Math.floor(Math.random() * available.length)];
      await chooseLevel(randomLevel);
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

    if (code) {
      try {
        const res = await fetch(`${API_BASE}/sessions/${code}/start-round`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ round_number: 1 }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          console.error(
            "[HOST] Failed to mark round start:",
            res.status,
            data?.error || data
          );
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

  const selectedForCurrentRound = localSelections.find((s) => s.round === round);

  return (
    <div style={page}>
      <div style={topGlow} />
      <div style={sideGlow} />

      <main
        style={{
          ...shell,
          padding: isPhone ? "28px 14px 40px" : "36px 20px 56px",
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
              Choose game order
            </h1>
            <p
              style={{
                ...subtitle,
                fontSize: isPhone ? 15 : 17,
              }}
            >
              The host chooses which mini-games will be played and in what
              order. Once round one is locked in, everyone moves into the arena.
            </p>

            <div
              style={{
                ...heroMetaRow,
                flexDirection: isPhone ? "column" : "row",
                alignItems: isPhone ? "flex-start" : "center",
              }}
            >
              <div style={heroMetaPill}>
                Session <strong>{code || "N/A"}</strong>
              </div>
              <div
                style={{
                  ...heroMetaPill,
                  ...(isHost ? hostPill : playerPill),
                }}
              >
                {isHost ? "Host controls active" : "Player view only"}
              </div>
              <div style={heroMetaPill}>
                Round <strong>{Math.min(round, MAX_ROUNDS)}</strong> of{" "}
                <strong>{MAX_ROUNDS}</strong>
              </div>
            </div>
          </div>

          <div
            style={{
              ...sessionCard,
              width: isPhone ? "100%" : 320,
            }}
          >
            <div style={sessionRow}>
              <span style={sessionLabel}>Players in lobby</span>
              <span style={sessionValue}>{players?.length || 0}</span>
            </div>
            <div style={sessionRow}>
              <span style={sessionLabel}>Chosen rounds</span>
              <span style={sessionValue}>
                {localSelections.length}/{MAX_ROUNDS}
              </span>
            </div>
            <div style={sessionRow}>
              <span style={sessionLabel}>Current pack</span>
              <span style={sessionValue}>
                {GAME_PACKS.find((p) => p.id === activePack)?.name || activePack}
              </span>
            </div>
            <div style={sessionRow}>
              <span style={sessionLabel}>Current round slot</span>
              <span style={sessionValue}>
                {selectedForCurrentRound
                  ? selectedForCurrentRound.level.name
                  : `Round ${Math.min(round, MAX_ROUNDS)} waiting`}
              </span>
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
            <strong>
              {isHost ? "Pick the line-up." : "Waiting for the host."}
            </strong>{" "}
            {isHost
              ? "Choose a game card to assign it to the current round, or use the random picker for the active pack."
              : "You’ll be moved automatically once the host starts round one."}
          </div>

          <div style={statusPill}>
            Active pack:{" "}
            <strong>
              {GAME_PACKS.find((p) => p.id === activePack)?.name || activePack}
            </strong>
          </div>
        </section>

        <section
          style={{
            ...packsSection,
            padding: isPhone ? "18px 16px" : "20px 20px",
          }}
        >
          <div style={packsHeader}>
            <div>
              <p style={panelEyebrow}>Game packs</p>
              <h2 style={packsTitle}>Choose a pack</h2>
            </div>
            <div style={miniStat}>
              {GAME_PACKS.length} packs available
            </div>
          </div>

          <div
            style={{
              ...packsRow,
              gridTemplateColumns: isPhone
                ? "1fr"
                : "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            {GAME_PACKS.map((pack) => (
              <button
                key={pack.id}
                onClick={() => setActivePack(pack.id)}
                style={{
                  ...packButton,
                  ...(activePack === pack.id ? packButtonActive : null),
                }}
              >
                <div style={packName}>{pack.name}</div>
                <div style={packDesc}>{pack.description}</div>
              </button>
            ))}
          </div>
        </section>

        <section
          style={{
            ...layout,
            gridTemplateColumns: isPhone
              ? "1fr"
              : isTablet
              ? "1fr"
              : "minmax(0, 1.45fr) minmax(320px, 0.95fr)",
          }}
        >
          <div style={panel}>
            <div style={panelHeader}>
              <div>
                <p style={panelEyebrow}>Catalogue</p>
                <h2 style={panelTitle}>Games in this pack</h2>
              </div>
              <div style={miniStat}>
                {visibleGames.length} in pack
              </div>
            </div>

            <p style={panelHint}>
              {isHost
                ? "Select a game to assign it to the current round slot."
                : "Browse the games the host is choosing from."}
            </p>

            <div
              style={{
                ...catalogueGrid,
                gridTemplateColumns: isPhone
                  ? "1fr"
                  : "repeat(auto-fill, minmax(240px, 1fr))",
              }}
            >
              {visibleGames.map((game) => {
                const chosenEntry = localSelections.find(
                  (s) => s.level.id === game.id
                );

                const disabled =
                  !isHost || isSpinning || Boolean(chosenEntry) || allRoundsChosen;

                return (
                  <button
                    key={game.id}
                    onClick={() => chooseLevel(game)}
                    disabled={disabled}
                    style={{
                      ...gameCard,
                      ...(chosenEntry ? chosenCard : {}),
                      opacity: disabled && !chosenEntry ? 0.72 : 1,
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
                        <div>
                          <h3 style={gameTitle}>{game.name}</h3>
                          <span style={gameId}>{game.id}</span>
                        </div>

                        {chosenEntry ? (
                          <span style={roundBadge}>Round {chosenEntry.round}</span>
                        ) : (
                          <span style={selectHint}>
                            {isHost && !allRoundsChosen ? "Select" : "Locked"}
                          </span>
                        )}
                      </div>

                      <p style={cardDesc}>{game.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <aside style={sidebar}>
            <div style={sidebarHeader}>
              <p style={panelEyebrow}>Round plan</p>
              <h2 style={sidebarTitle}>Tonight’s order</h2>
            </div>

            <div style={roundsList}>
              {Array.from({ length: MAX_ROUNDS }).map((_, i) => {
                const entry = localSelections.find((r) => r.round === i + 1);
                const isCurrentRound = round === i + 1 && !entry;

                return (
                  <div
                    key={i}
                    style={{
                      ...roundItem,
                      ...(entry ? roundItemFilled : {}),
                      ...(isCurrentRound ? roundItemActive : {}),
                    }}
                  >
                    <div style={roundNumber}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={roundName}>
                        {entry ? entry.level.name : "Not chosen yet"}
                      </div>
                      <div style={roundMeta}>
                        {entry
                          ? `${entry.level.pack || "Game pack"} selected`
                          : isCurrentRound
                          ? "Current round being chosen"
                          : "Waiting for selection"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {isHost ? (
              <>
                <div style={sidebarActions}>
                  <button
                    onClick={handleRandomSpin}
                    disabled={isSpinning || allRoundsChosen}
                    style={{
                      ...actionButton,
                      ...secondaryButton,
                      width: "100%",
                      opacity: isSpinning || allRoundsChosen ? 0.7 : 1,
                    }}
                  >
                    {isSpinning ? "Choosing..." : "Random from this pack"}
                  </button>

                  {allRoundsChosen && (
                    <button
                      onClick={handleStartRoundOne}
                      style={{
                        ...actionButton,
                        ...primaryButton,
                        width: "100%",
                        marginTop: 10,
                      }}
                    >
                      Start Round 1
                    </button>
                  )}
                </div>

                {!allRoundsChosen && (
                  <div style={helperBox}>
                    Pick all {MAX_ROUNDS} rounds to unlock the start button.
                  </div>
                )}
              </>
            ) : (
              <div style={helperBox}>
                Waiting for the host to choose the game order and start the
                first round.
              </div>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}

/* styles */

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

const heroMetaRow = {
  display: "flex",
  gap: 10,
  marginTop: 18,
  flexWrap: "wrap",
};

const heroMetaPill = {
  padding: "9px 12px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
  fontSize: 13,
};

const hostPill = {
  color: "#f6cf64",
  border: "1px solid rgba(244,196,49,0.26)",
  background: "rgba(244,196,49,0.10)",
};

const playerPill = {
  color: "#fff",
};

const sessionCard = {
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
  textAlign: "right",
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

const packsSection = {
  borderRadius: 28,
  background: "rgba(0, 0, 0, 0.30)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
  marginBottom: 20,
};

const packsHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  marginBottom: 16,
  flexWrap: "wrap",
};

const packsTitle = {
  margin: "6px 0 0",
  fontSize: 28,
  lineHeight: 1.05,
};

const packsRow = {
  display: "grid",
  gap: 12,
};

const packButton = {
  textAlign: "left",
  padding: 16,
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "white",
  cursor: "pointer",
};

const packButtonActive = {
  background:
    "linear-gradient(180deg, rgba(244,196,49,0.16), rgba(255,255,255,0.05))",
  border: "1px solid rgba(244,196,49,0.28)",
  boxShadow: "0 0 0 1px rgba(244,196,49,0.12)",
};

const packName = {
  fontWeight: 800,
  fontSize: 20,
  marginBottom: 6,
};

const packDesc = {
  fontSize: 14,
  opacity: 0.8,
  lineHeight: 1.5,
};

const layout = {
  display: "grid",
  gap: 22,
  alignItems: "start",
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

const catalogueGrid = {
  display: "grid",
  gap: 14,
};

const gameCard = {
  padding: 0,
  overflow: "hidden",
  textAlign: "left",
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "white",
  transition: "0.2s ease",
};

const chosenCard = {
  border: "1px solid rgba(244,196,49,0.28)",
  boxShadow: "0 0 0 1px rgba(244,196,49,0.12)",
};

const thumb = {
  height: 150,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  borderBottom: "1px solid rgba(255,255,255,0.10)",
  backgroundColor: "rgba(255,255,255,0.06)",
};

const cardBody = {
  padding: 16,
};

const cardTopRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const gameTitle = {
  margin: "0 0 6px",
  fontSize: 20,
  lineHeight: 1.1,
};

const gameId = {
  fontSize: 12,
  opacity: 0.6,
  textTransform: "uppercase",
  letterSpacing: 0.8,
};

const cardDesc = {
  fontSize: 14,
  lineHeight: 1.6,
  opacity: 0.82,
  margin: "12px 0 0",
};

const roundBadge = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(244,196,49,0.16)",
  border: "1px solid rgba(244,196,49,0.28)",
  fontSize: 12,
  fontWeight: 700,
  color: "#f6cf64",
  whiteSpace: "nowrap",
};

const selectHint = {
  fontSize: 12,
  fontWeight: 700,
  opacity: 0.75,
  whiteSpace: "nowrap",
};

const sidebar = {
  borderRadius: 28,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.38)",
  padding: 20,
  boxShadow: "0 18px 40px rgba(0,0,0,0.20)",
};

const sidebarHeader = {
  marginBottom: 14,
};

const sidebarTitle = {
  margin: "6px 0 0",
  fontSize: 28,
  lineHeight: 1.05,
};

const roundsList = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const roundItem = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  padding: 14,
  borderRadius: 18,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const roundItemFilled = {
  background: "rgba(255,255,255,0.06)",
};

const roundItemActive = {
  border: "1px solid rgba(244,196,49,0.26)",
  boxShadow: "0 0 0 1px rgba(244,196,49,0.10)",
};

const roundNumber = {
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

const roundName = {
  fontSize: 15,
  fontWeight: 800,
  marginBottom: 4,
};

const roundMeta = {
  fontSize: 12,
  opacity: 0.72,
  lineHeight: 1.4,
};

const sidebarActions = {
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

const helperBox = {
  marginTop: 14,
  borderRadius: 16,
  padding: 14,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  fontSize: 14,
  lineHeight: 1.6,
  opacity: 0.82,
};