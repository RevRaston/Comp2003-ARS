// src/pages/Arena.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";
import { supabase } from "../supabase";
import AvatarPreview from "../components/AvatarPreview";
import { GAME_CATALOGUE } from "../GameList";

import SumoGame from "../games/Sumo/SumoGame";
import DartsGame from "../games/Darts/DartsGame";
import GuessingCardGame from "../games/GuessingCard/GuessingCardGame";
import MazeGame from "../games/Maze/MazeGame";

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
};

export default function Arena() {
  const navigate = useNavigate();

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
  } = useGame();

  const [enrichedPlayers, setEnrichedPlayers] = useState([]);
  const [roundComplete, setRoundComplete] = useState(false);
  const [advancingRound, setAdvancingRound] = useState(false);
  const [roundActionError, setRoundActionError] = useState("");

  const code = sessionCode || localStorage.getItem("session_code");

  // Always poll session + players so both clients stay in sync
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

        const serverRound = Number(data.session.current_round || 1);

        setPlayers(data.players || []);
        setRound(serverRound);

        // If server round moved on, clear round complete overlay
        if (serverRound !== currentRound) {
          setRoundComplete(false);
          setRoundActionError("");
          setAdvancingRound(false);
        }
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
  }, [code, setPlayers, setRound]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load shared level plan from backend
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
  }, [code, setSelectedLevels]);

  // Enrich players with profile info
  useEffect(() => {
    async function enrich() {
      if (!players || players.length === 0) {
        setEnrichedPlayers([]);
        return;
      }

      const everyoneHasAvatar = players.every(
        (p) => p.avatar_json || p.avatarJson
      );
      if (everyoneHasAvatar) {
        setEnrichedPlayers(players);
        return;
      }

      const ids = players
        .map((p) => p.user_id || p.id)
        .filter(Boolean)
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

      const byId = new Map(profs.map((p) => [p.id, p]));

      const merged = players.map((p) => {
        const prof = byId.get(p.user_id || p.id);
        if (!prof) return p;
        return {
          ...p,
          name: p.name || prof.display_name,
          display_name: prof.display_name,
          avatar_json: prof.avatar_json,
          avatarJson: prof.avatar_json,
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
      const key = p?.user_id ?? p?.userId ?? p?.id;
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
  const currentLevelName = currentLevel?.name || "Sumo (MVP)";

  const CurrentGameComponent = GAME_COMPONENTS[currentLevelId] || SumoGame;

  const hasNextRound =
    currentRound < maxRounds &&
    selectedLevels.some((entry) => entry.round === currentRound + 1);

  function handleRoundComplete() {
    setRoundComplete(true);
    setRoundActionError("");
  }

  async function handleAdvanceRound() {
    if (!isHost || !code || advancingRound) return;

    setRoundActionError("");
    setAdvancingRound(true);

    try {
      if (!hasNextRound) {
        navigate("/results");
        return;
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
      <div style={titleWrap}>
        <h1 style={title}>Arena</h1>
        <p style={subtitle}>
          Everyone sees the same game. Your avatars sit around the arena.
        </p>
        <p style={{ margin: 4, opacity: 0.8, fontSize: 13 }}>
          Round {currentRound}
          {currentLevelName ? ` — ${currentLevelName}` : ""}
        </p>
      </div>

      <div style={arenaShell}>
        <div style={leftCol}>
          <ArenaSlot player={slotPlayers[0]} label="P1" />
          <ArenaSlot player={slotPlayers[2]} label="P3" />
        </div>

        <div style={centerCol}>
          <div style={centerHeader}>
            <h2 style={{ margin: 0 }}>{currentLevelName}</h2>
            <p style={centerHint}>
              This round&apos;s game plays here. Host runs the simulation; other
              players send input.
            </p>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>
              Your dot is <strong>BLUE</strong> on your screen. Opponent is{" "}
              <strong>RED</strong>.
            </p>
            <p
              style={{
                marginTop: 8,
                marginBottom: 0,
                fontSize: 12,
                opacity: 0.7,
              }}
            >
              Tip: click the game canvas before moving (focus).
            </p>
          </div>

          <div style={gameBox}>
            <CurrentGameComponent
              sessionCode={code}
              players={enrichedPlayers}
              isHost={Boolean(isHost)}
              myUserId={myUserId}
              mySeatIndex={mySeatIndex}
              onRoundComplete={handleRoundComplete}
            />
          </div>

          {roundComplete && (
            <div style={roundCompletePanel}>
              <h3 style={{ marginTop: 0 }}>Round complete</h3>

              {isHost ? (
                <>
                  <p style={panelText}>
                    {hasNextRound
                      ? "Start the next round when you're ready."
                      : "No more rounds left. Continue to results."}
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
                      ? "Start Next Round"
                      : "Go To Results"}
                  </button>
                </>
              ) : (
                <p style={panelText}>
                  Waiting for the host to continue…
                </p>
              )}
            </div>
          )}
        </div>

        <div style={rightCol}>
          <ArenaSlot player={slotPlayers[1]} label="P2" />
          <ArenaSlot player={slotPlayers[3]} label="P4" />
        </div>
      </div>
    </div>
  );
}

function ArenaSlot({ player, label }) {
  const name = player?.display_name || player?.name || "Waiting…";
  const avatarJson = player?.avatarJson || player?.avatar_json || null;
  const isEmpty = !player;

  return (
    <div style={slotWrap}>
      <div style={slotCard}>
        {!isEmpty ? (
          <AvatarPreview avatarJson={avatarJson} displayName={name} />
        ) : (
          <div style={emptyInner} />
        )}
      </div>
      <div style={slotFooter}>
        <span style={slotName}>{name}</span>
        <span style={slotLabel}>{label}</span>
      </div>
    </div>
  );
}

/* --- styles --- */

const page = {
  paddingTop: 80,
  minHeight: "100vh",
  color: "white",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const titleWrap = {
  textAlign: "center",
  marginBottom: 16,
};

const title = {
  margin: 0,
  fontSize: 40,
  letterSpacing: 2,
};

const subtitle = {
  margin: 0,
  opacity: 0.7,
  fontSize: 14,
};

const arenaShell = {
  marginTop: 24,
  maxWidth: 980,
  width: "100%",
  display: "grid",
  gridTemplateColumns: "220px minmax(0, 1fr) 220px",
  gap: 24,
  alignItems: "stretch",
};

const leftCol = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: 16,
};

const rightCol = {
  ...leftCol,
};

const centerCol = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const centerHeader = {
  borderRadius: 28,
  padding: "18px 24px",
  background: "rgba(0,0,0,0.45)",
  border: "1px solid rgba(255,255,255,0.18)",
  textAlign: "center",
};

const centerHint = {
  marginTop: 8,
  marginBottom: 8,
  fontSize: 13,
  opacity: 0.8,
};

const gameBox = {
  flex: 1,
  minHeight: 360,
  borderRadius: 28,
  background: "rgba(0,0,0,0.28)",
  border: "1px solid rgba(255,255,255,0.14)",
  padding: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const roundCompletePanel = {
  padding: 18,
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.35)",
  textAlign: "center",
};

const panelText = {
  opacity: 0.85,
  marginBottom: 14,
};

const errorText = {
  color: "#ff9a9a",
  fontWeight: 600,
};

const advanceButton = {
  padding: "12px 18px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.12)",
  color: "white",
  cursor: "pointer",
  fontSize: 15,
};

const slotWrap = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
};

const slotCard = {
  width: "100%",
  aspectRatio: "3 / 4",
  borderRadius: 26,
  padding: 6,
  background:
    "linear-gradient(145deg, rgba(3,3,15,0.9), rgba(40,30,80,0.95))",
  boxShadow: "0 18px 40px rgba(0,0,0,0.55)",
};

const emptyInner = {
  width: "100%",
  height: "100%",
  borderRadius: 20,
  background:
    "radial-gradient(circle at 20% 0%, #1A1035, #04040C 60%, #020208)",
};

const slotFooter = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  fontSize: 11,
  opacity: 0.9,
};

const slotName = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const slotLabel = {
  opacity: 0.6,
};