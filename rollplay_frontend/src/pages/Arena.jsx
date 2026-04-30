// src/pages/Arena.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";
import { supabase } from "../supabase";
import AvatarPreview from "../components/AvatarPreview";
import { GAME_CATALOGUE, PACK_LOOKUP } from "../GameList";

import SumoGame from "../games/Sumo/SumoGame";
import DartsGame from "../games/Darts/DartsGame";
import GuessingCardGame from "../games/GuessingCard/GuessingCardGame";
import MazeGame from "../games/Maze/MazeGame";
import StackGame from "../games/Stack/StackGame";
import PokerGame from "../games/Poker/PokerGame";
import NinetyNineGame from "../games/NinetyNine/NinetyNineGame";
import CrapsGame from "../games/Craps/CrapsGame";
import ButtonMasherGame from "../games/ButtonMasher/ButtonMasherGame";
import BlackjackGame from "../games/Blackjack/BlackjackGame";

const defaultBase =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://comp2003-ars.onrender.com";

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  defaultBase
).replace(/\/$/, "");

const GAME_COMPONENTS = {
  sumo: SumoGame,
  darts: DartsGame,
  guessing_card: GuessingCardGame,
  maze: MazeGame,
  stack: StackGame,
  poker: PokerGame,
  ninety_nine: NinetyNineGame,
  craps: CrapsGame,
  button_masher: ButtonMasherGame,
  blackjack: BlackjackGame,
};

export default function Arena() {
  const navigate = useNavigate();
  const gameAreaRef = useRef(null);

  const {
    players,
    setPlayers,
    profile,
    sessionCode,
    isHost,
    selectedLevels = [],
    setSelectedLevels,
    round = 1,
    setRound,
    maxRounds = 3,
    isGameEnabled,
  } = useGame();

  const [enrichedPlayers, setEnrichedPlayers] = useState([]);
  const [roundComplete, setRoundComplete] = useState(false);
  const [advancingRound, setAdvancingRound] = useState(false);
  const [roundActionError, setRoundActionError] = useState("");
  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  const lastServerRoundRef = useRef(null);
  const code = sessionCode || localStorage.getItem("session_code");

  useEffect(() => {
    function handleResize() {
      setScreenWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isPhone = screenWidth <= 700;
  const isTablet = screenWidth <= 1100;

  useEffect(() => {
    if (!isPhone) return;

    const timeout = setTimeout(() => {
      gameAreaRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 350);

    return () => clearTimeout(timeout);
  }, [isPhone]);

  useEffect(() => {
    if (!code) return;

    let cancelled = false;
    let intervalId = null;

    async function loadArenaSession() {
      try {
        const token = localStorage.getItem("token");
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`${API_BASE}/sessions/${code}`, { headers });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.session) return;
        if (cancelled) return;

        if (data.session.status === "finished") {
          navigate("/results");
          return;
        }

        const serverRound = Number(data.session.current_round || 1);

        setPlayers(data.players || []);
        setRound(serverRound);

        if (
          lastServerRoundRef.current !== null &&
          serverRound > lastServerRoundRef.current
        ) {
          setRoundComplete(false);
          setRoundActionError("");
          setAdvancingRound(false);

          setTimeout(() => {
            gameAreaRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }, 250);
        }

        lastServerRoundRef.current = serverRound;
      } catch (err) {
        console.error("Arena session/player poll failed:", err);
      }
    }

    loadArenaSession();
    intervalId = setInterval(loadArenaSession, 1500);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [code, navigate, setPlayers, setRound]);

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
          setSelectedLevels(mapped);
        }
      } catch (err) {
        console.error("Arena level plan load failed:", err);
      }
    }

    loadLevelPlan();

    return () => {
      cancelled = true;
    };
  }, [code, setSelectedLevels]);

  useEffect(() => {
    async function enrich() {
      if (!players || players.length === 0) {
        setEnrichedPlayers([]);
        return;
      }

      const ids = players
        .map(
          (p) =>
            p.user_id ??
            p.userId ??
            p.profile_id ??
            p.profileId ??
            null
        )
        .filter(Boolean)
        .map(String)
        .filter((v, i, arr) => arr.indexOf(v) === i);

      if (ids.length === 0) {
        setEnrichedPlayers(players);
        return;
      }

      const { data: profs, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_json")
        .in("id", ids);

      if (error) {
        console.error("Arena profile fetch error:", error);
        setEnrichedPlayers(players);
        return;
      }

      const byId = new Map((profs || []).map((p) => [String(p.id), p]));

      const merged = players.map((p) => {
        const key = String(
          p.user_id ??
            p.userId ??
            p.profile_id ??
            p.profileId ??
            ""
        );

        const prof = byId.get(key);

        if (!prof) {
          return {
            ...p,
            avatar_json: p.avatar_json ?? p.avatarJson ?? null,
            avatarJson: p.avatarJson ?? p.avatar_json ?? null,
          };
        }

        return {
          ...p,
          name: p.name || prof.display_name,
          display_name: prof.display_name || p.display_name || p.name,
          avatar_json: prof.avatar_json ?? p.avatar_json ?? p.avatarJson ?? null,
          avatarJson: prof.avatar_json ?? p.avatarJson ?? p.avatar_json ?? null,
        };
      });

      setEnrichedPlayers(merged);
    }

    enrich();
  }, [players]);

  const slotPlayers = [
    enrichedPlayers[0] || null,
    enrichedPlayers[1] || null,
    enrichedPlayers[2] || null,
    enrichedPlayers[3] || null,
  ];

  const myUserId =
    profile?.id ||
    profile?.user_id ||
    localStorage.getItem("user_id") ||
    null;

  const mySeatIndex = useMemo(() => {
    const uid = myUserId ? String(myUserId) : "";
    if (!uid) return -1;

    for (let i = 0; i < slotPlayers.length; i++) {
      const p = slotPlayers[i];
      const key =
        p?.user_id ??
        p?.userId ??
        p?.profile_id ??
        p?.profileId ??
        p?.id;
      if (key && String(key) === uid) return i;
    }

    return -1;
  }, [myUserId, slotPlayers]);

  const currentRound = round || 1;

  const currentLevelEntry =
    selectedLevels.find((entry) => entry.round === currentRound) ||
    selectedLevels[0] ||
    null;

  const currentLevel = currentLevelEntry?.level || null;
  const currentLevelId = currentLevel?.id || "sumo";
  const currentLevelName = currentLevel?.name || "Sumo";

  const currentPackName =
    PACK_LOOKUP?.[currentLevel?.pack]?.name ||
    currentLevel?.pack ||
    "Game Pack";

  const CurrentGameComponent = GAME_COMPONENTS[currentLevelId] || SumoGame;

  useEffect(() => {
    if (!currentLevelId) return;

    const locked = isGameEnabled ? !isGameEnabled(currentLevelId) : false;

    if (locked) {
      alert("This game is currently locked.");
      navigate("/choose-game");
    }
  }, [currentLevelId, isGameEnabled, navigate]);

  const hasNextRound =
    currentRound < maxRounds &&
    selectedLevels.some((entry) => entry.round === currentRound + 1);

  async function handleRoundComplete(payload = {}) {
    setRoundComplete(true);
    setRoundActionError("");

    if (!code) return;

    try {
      const winnerPlayer = enrichedPlayers.find((p) => {
        const key =
          p?.user_id ??
          p?.userId ??
          p?.id ??
          p?.profile_id ??
          p?.profileId ??
          null;

        return String(key || "") === String(payload?.winnerKey || "");
      });

      const roundResult = {
        round: currentRound,
        gameId: currentLevelId,
        winnerKey: payload?.winnerKey === undefined ? null : payload.winnerKey,
        winnerName: winnerPlayer?.display_name || winnerPlayer?.name || null,
        scores: Array.isArray(payload?.scores) ? payload.scores : [],
        createdAt: new Date().toISOString(),
      };

      const res = await fetch(`${API_BASE}/sessions/${code}/round-result`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roundResult }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save round result");
      }
    } catch (err) {
      console.error("Failed to save round result:", err);
    }
  }

  async function handleAdvanceRound() {
    if (!isHost || !code || advancingRound) return;

    setRoundActionError("");
    setAdvancingRound(true);

    try {
      if (!hasNextRound) {
        const finishRes = await fetch(`${API_BASE}/sessions/${code}/finish`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const finishData = await finishRes.json().catch(() => null);

        if (!finishRes.ok) {
          throw new Error(finishData?.error || "Failed to finish session");
        }

        return;
      }

      const nextRoundEntry = selectedLevels.find(
        (entry) => entry.round === currentRound + 1
      );

      if (
        nextRoundEntry &&
        isGameEnabled &&
        !isGameEnabled(nextRoundEntry.level.id)
      ) {
        throw new Error(
          `${nextRoundEntry.level.name} is locked. Choose another game.`
        );
      }

      const res = await fetch(`${API_BASE}/sessions/${code}/advance-round`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to advance round");
      }

      setRoundComplete(false);
    } catch (err) {
      console.error("Advance round failed:", err);
      setRoundActionError(err.message || "Failed to advance round");
    } finally {
      setAdvancingRound(false);
    }
  }

  return (
    <div style={page}>
      <div style={topGlow} />
      <div style={sideGlow} />

      <main
        style={{
          ...shell,
          padding: isPhone ? "22px 12px 34px" : "30px 20px 48px",
        }}
      >
        <section
          style={{
            ...heroCard,
            padding: isPhone ? "18px 16px" : "24px 24px",
            flexDirection: isPhone ? "column" : "row",
            alignItems: isPhone ? "flex-start" : "center",
          }}
        >
          <div style={{ flex: 1 }}>
            <p style={eyebrow}>Live game arena</p>

            <h1
              style={{
                ...title,
                fontSize: isPhone ? 30 : isTablet ? 42 : 52,
              }}
            >
              {currentLevelName}
            </h1>

            <p
              style={{
                ...subtitle,
                fontSize: isPhone ? 14 : 16,
              }}
            >
              Everyone sees the same round. The host runs the simulation and
              players interact inside the shared arena.
            </p>

            <div
              style={{
                ...metaRow,
                flexDirection: isPhone ? "column" : "row",
                alignItems: isPhone ? "flex-start" : "center",
              }}
            >
              <div style={metaPill}>
                Round <strong>{currentRound}</strong> of{" "}
                <strong>{maxRounds}</strong>
              </div>

              <div style={metaPill}>
                Pack <strong>{currentPackName}</strong>
              </div>

              <div style={metaPill}>
                Session <strong>{code || "N/A"}</strong>
              </div>

              <div style={{ ...metaPill, ...(isHost ? hostPill : playerPill) }}>
                {isHost ? "Host controls active" : "Player view"}
              </div>
            </div>
          </div>

          <div
            style={{
              ...legendCard,
              width: isPhone ? "100%" : 320,
            }}
          >
            <div style={legendTitle}>Quick notes</div>
            <div style={legendText}>Your avatar is shown around the arena.</div>
            <div style={legendText}>The host controls round progression.</div>
            <div style={legendText}>Locked games cannot be played.</div>
          </div>
        </section>

        {isTablet && (
          <section style={{ marginTop: 16 }}>
            <div style={mobilePlayersHeader}>Players</div>

            <div
              style={{
                ...mobilePlayersGrid,
                gridTemplateColumns: isPhone
                  ? "repeat(2, minmax(0, 1fr))"
                  : "repeat(4, minmax(0, 1fr))",
              }}
            >
              {slotPlayers.map((player, index) => (
                <ArenaSlot
                  key={index}
                  player={player}
                  label={`P${index + 1}`}
                  compact
                  highlightMe={index === mySeatIndex}
                />
              ))}
            </div>
          </section>
        )}

        <section
          ref={gameAreaRef}
          style={{
            ...arenaShell,
            gridTemplateColumns: isTablet
              ? "1fr"
              : "180px minmax(0, 1fr) 180px",
            gap: isPhone ? 14 : 20,
            marginTop: 18,
            scrollMarginTop: isPhone ? 12 : 24,
          }}
        >
          {!isTablet && (
            <div style={sideColumn}>
              <ArenaSlot
                player={slotPlayers[0]}
                label="P1"
                highlightMe={mySeatIndex === 0}
              />

              <ArenaSlot
                player={slotPlayers[2]}
                label="P3"
                highlightMe={mySeatIndex === 2}
              />
            </div>
          )}

          <div style={centerColumn}>
            <div
              style={{
                ...gameHeader,
                padding: isPhone ? "14px 14px" : "16px 18px",
                flexDirection: isPhone ? "column" : "row",
                alignItems: isPhone ? "flex-start" : "center",
              }}
            >
              <div>
                <div style={gameHeaderTitle}>{currentLevelName}</div>

                <div style={gameHeaderText}>
                  {isHost
                    ? "Run the round, finish the simulation, then move the session on."
                    : "Stay in the arena and wait for the host to continue after the round ends."}
                </div>
              </div>

              <div style={gameHeaderBadge}>
                {roundComplete ? "Round complete" : "Round in progress"}
              </div>
            </div>

            <div style={gameShell}>
              <div
                style={{
                  ...gameFrame,
                  minHeight: isPhone ? 320 : 420,
                  padding: isPhone ? 10 : 14,
                }}
              >
                <div
                  style={{
                    ...gameViewport,
                    minHeight: isPhone ? 300 : 390,
                  }}
                >
                  <CurrentGameComponent
                    sessionCode={code}
                    players={enrichedPlayers}
                    isHost={Boolean(isHost)}
                    myUserId={myUserId}
                    mySeatIndex={mySeatIndex}
                    onRoundComplete={handleRoundComplete}
                  />
                </div>
              </div>

              {roundComplete && (
                <div style={overlayWrap}>
                  <div style={overlayCard}>
                    <h3 style={overlayTitle}>Round complete</h3>

                    {isHost ? (
                      <>
                        <p style={panelText}>
                          {hasNextRound
                            ? "Start the next round when you're ready."
                            : "That was the final round. Continue to results."}
                        </p>

                        {roundActionError && (
                          <p style={errorText}>{roundActionError}</p>
                        )}

                        <button
                          onClick={handleAdvanceRound}
                          disabled={advancingRound}
                          style={advanceButton}
                        >
                          {advancingRound
                            ? "Advancing..."
                            : hasNextRound
                            ? "Start next round"
                            : "Go to results"}
                        </button>
                      </>
                    ) : (
                      <p style={panelText}>Waiting for the host to continue…</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {!isTablet && (
            <div style={sideColumn}>
              <ArenaSlot
                player={slotPlayers[1]}
                label="P2"
                highlightMe={mySeatIndex === 1}
              />

              <ArenaSlot
                player={slotPlayers[3]}
                label="P4"
                highlightMe={mySeatIndex === 3}
              />
            </div>
          )}
        </section>

        {isPhone && (
          <div style={phoneHelpBox}>
            For the best experience on smaller screens, keep your phone in
            landscape if a game feels cramped.
          </div>
        )}
      </main>
    </div>
  );
}

function ArenaSlot({ player, label, compact = false, highlightMe = false }) {
  const name = player?.display_name || player?.name || "Waiting…";
  const avatarJson = player?.avatarJson || player?.avatar_json || null;
  const isEmpty = !player;

  return (
    <div
      style={{
        ...slotWrap,
        ...(compact ? compactSlotWrap : {}),
      }}
    >
      <div
        style={{
          ...slotCard,
          ...(compact ? compactSlotCard : {}),
          ...(highlightMe ? mySlotCard : {}),
        }}
      >
        {!isEmpty ? (
          <div style={avatarCenter}>
            <AvatarPreview avatarJson={avatarJson} displayName={name} />
          </div>
        ) : (
          <div style={emptyInner} />
        )}
      </div>

      <div style={slotFooter}>
        <span style={slotName}>{name}</span>
        <span style={slotLabel}>{highlightMe ? "YOU" : label}</span>
      </div>
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
  maxWidth: 1280,
  margin: "0 auto",
  position: "relative",
  zIndex: 2,
};

const heroCard = {
  display: "flex",
  gap: 20,
  justifyContent: "space-between",
  borderRadius: 30,
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
  lineHeight: 0.96,
  fontWeight: 900,
};

const subtitle = {
  margin: "12px 0 0",
  maxWidth: 760,
  lineHeight: 1.6,
  opacity: 0.88,
};

const metaRow = {
  display: "flex",
  gap: 10,
  marginTop: 18,
  flexWrap: "wrap",
};

const metaPill = {
  padding: "8px 12px",
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

const legendCard = {
  borderRadius: 22,
  padding: 16,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.10)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const legendTitle = {
  fontSize: 14,
  fontWeight: 800,
  color: "#f6cf64",
  textTransform: "uppercase",
  letterSpacing: 1.2,
};

const legendText = {
  fontSize: 14,
  lineHeight: 1.5,
  opacity: 0.86,
};

const mobilePlayersHeader = {
  marginBottom: 10,
  fontSize: 13,
  fontWeight: 800,
  color: "#f6cf64",
  textTransform: "uppercase",
  letterSpacing: 1.2,
};

const mobilePlayersGrid = {
  display: "grid",
  gap: 10,
};

const arenaShell = {
  display: "grid",
  alignItems: "stretch",
};

const sideColumn = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: 14,
};

const centerColumn = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  minWidth: 0,
};

const gameHeader = {
  borderRadius: 22,
  background: "rgba(0,0,0,0.38)",
  border: "1px solid rgba(255,255,255,0.10)",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
};

const gameHeaderTitle = {
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1.1,
  marginBottom: 6,
};

const gameHeaderText = {
  fontSize: 14,
  lineHeight: 1.6,
  opacity: 0.82,
};

const gameHeaderBadge = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const gameShell = {
  position: "relative",
};

const gameFrame = {
  borderRadius: 28,
  background: "rgba(0,0,0,0.28)",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.20)",
};

const gameViewport = {
  width: "100%",
  borderRadius: 20,
  overflow: "hidden",
  background:
    "radial-gradient(circle at top, rgba(255,255,255,0.04), rgba(0,0,0,0.18))",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const overlayWrap = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  background: "rgba(0,0,0,0.38)",
  borderRadius: 28,
};

const overlayCard = {
  width: "100%",
  maxWidth: 360,
  padding: 20,
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(15,15,25,0.92)",
  textAlign: "center",
  boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
};

const overlayTitle = {
  marginTop: 0,
  marginBottom: 10,
  fontSize: 24,
};

const panelText = {
  opacity: 0.85,
  marginBottom: 14,
  lineHeight: 1.5,
};

const errorText = {
  color: "#ff9a9a",
  fontWeight: 600,
};

const advanceButton = {
  padding: "12px 18px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "#f4c431",
  color: "#1d1d1d",
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 800,
  boxShadow: "0 10px 24px rgba(244,196,49,0.22)",
};

const slotWrap = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
};

const compactSlotWrap = {
  alignItems: "stretch",
};

const slotCard = {
  width: "100%",
  aspectRatio: "3 / 4",
  borderRadius: 24,
  padding: 6,
  background:
    "linear-gradient(145deg, rgba(3,3,15,0.9), rgba(40,30,80,0.95))",
  boxShadow: "0 18px 40px rgba(0,0,0,0.55)",
  border: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

const compactSlotCard = {
  aspectRatio: "1 / 1.05",
  borderRadius: 18,
};

const mySlotCard = {
  boxShadow: "0 0 0 2px rgba(122,162,255,0.55), 0 18px 40px rgba(0,0,0,0.55)",
};

const avatarCenter = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  borderRadius: 18,
};

const emptyInner = {
  width: "100%",
  height: "100%",
  borderRadius: 18,
  background:
    "radial-gradient(circle at 20% 0%, #1A1035, #04040C 60%, #020208)",
};

const slotFooter = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  fontSize: 11,
  opacity: 0.92,
};

const slotName = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: 0,
  flex: 1,
};

const slotLabel = {
  opacity: 0.7,
  fontWeight: 800,
  flexShrink: 0,
};

const phoneHelpBox = {
  marginTop: 14,
  borderRadius: 16,
  padding: 14,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  fontSize: 13,
  lineHeight: 1.6,
  opacity: 0.82,
};