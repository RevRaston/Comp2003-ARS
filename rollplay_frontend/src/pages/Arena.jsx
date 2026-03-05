// src/pages/Arena.jsx
import { useEffect, useMemo, useState } from "react";
import { useGame } from "../GameContext";
import { supabase } from "../supabase";
import AvatarPreview from "../components/AvatarPreview";

import SumoGame from "../games/Sumo/SumoGame";
import DartsGame from "../games/Darts/DartsGame";
import GuessingCardGame from "../games/GuessingCard/GuessingCardGame";
import MazeGame from "../games/Maze/MazeGame"; // 👈 NEW

// Map from level.id (from GAME_LIST) -> React component used in Arena
const GAME_COMPONENTS = {
  sumo: SumoGame,
  darts: DartsGame,
  guessing_card: GuessingCardGame,
  maze: MazeGame, 
};

export default function Arena() {
  const {
    players,
    profile,
    sessionCode,
    isHost,
    selectedLevels = [],
    round = 1,
  } = useGame();

  const [enrichedPlayers, setEnrichedPlayers] = useState([]);

  // Local override so we can force "darts" after sumo ends
  const [overrideGameId, setOverrideGameId] = useState(null);

  // Enrich players with profile info (display_name + avatar_json)
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

  // Compute seat index for this user (0..3, or -1)
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

  // ----------------- Current round + game -----------------
  const currentRound = round || 1;

  const currentLevelEntry =
    selectedLevels.find((entry) => entry.round === currentRound) ||
    selectedLevels[0] ||
    null;

  const currentLevel = currentLevelEntry?.level || null;
  const plannedLevelId = currentLevel?.id || "sumo";
  const currentLevelName = currentLevel?.name || "Sumo (MVP)";

  // If we’ve set an override (e.g. when sumo ends), use it.
  const effectiveGameId = overrideGameId || plannedLevelId;
  const CurrentGameComponent =
    GAME_COMPONENTS[effectiveGameId] || SumoGame;

  // Handler passed into Sumo. Runs on BOTH host & clients.
  function handleSumoRoundComplete(info) {
    // For now: always jump to Darts after Sumo ends.
    // (Later we’ll look at the level plan instead of hardcoding.)
    setOverrideGameId("darts");
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
        {overrideGameId && (
          <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
            Switched to: Darts
          </p>
        )}
      </div>

      <div style={arenaShell}>
        {/* LEFT COLUMN (P1 / P3) */}
        <div style={leftCol}>
          <ArenaSlot player={slotPlayers[0]} label="P1" />
          <ArenaSlot player={slotPlayers[2]} label="P3" />
        </div>

        {/* CENTER GAME PANEL */}
        <div style={centerCol}>
          <div style={centerHeader}>
            <h2 style={{ margin: 0 }}>
              {effectiveGameId === plannedLevelId
                ? currentLevelName
                : "Darts"}
            </h2>
            <p style={centerHint}>
              This round&apos;s game plays here. Host runs the simulation;
              other players send input.
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
              sessionCode={
                sessionCode || localStorage.getItem("session_code")
              }
              players={enrichedPlayers}
              isHost={Boolean(isHost)}
              myUserId={myUserId}
              mySeatIndex={mySeatIndex}
              // Only SumoGame cares about this; Darts will ignore it.
              onRoundComplete={
                effectiveGameId === "sumo"
                  ? handleSumoRoundComplete
                  : undefined
              }
            />
          </div>
        </div>

        {/* RIGHT COLUMN (P2 / P4) */}
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