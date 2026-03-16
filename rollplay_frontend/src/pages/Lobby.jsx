// src/pages/Lobby.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";
import { supabase } from "../supabase";

const defaultBase =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://comp2003-ars.onrender.com";

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  defaultBase
).replace(/\/$/, "");

export default function Lobby({ token }) {
  const navigate = useNavigate();

  const {
    sessionId,
    sessionCode,
    isHost,
    setSessionInfo,
    players,
    setPlayers,
  } = useGame();

  const [session, setSession] = useState(null);
  const [error, setError] = useState("");

  async function attachProfilesToPlayers(rawPlayers) {
    if (!rawPlayers || rawPlayers.length === 0) return [];

    const ids = rawPlayers
      .map((p) => p.user_id || p.id)
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);

    if (ids.length === 0) return rawPlayers;

    const { data: profiles, error: profError } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_json")
      .in("id", ids);

    if (profError) {
      console.error("Lobby profiles fetch error:", profError);
      return rawPlayers;
    }

    const byId = new Map(profiles.map((p) => [p.id, p]));

    return rawPlayers.map((p) => {
      const profileId = p.user_id || p.id;
      const prof = byId.get(profileId);
      if (!prof) return p;

      return {
        ...p,
        name: p.name || prof.display_name,
        display_name: prof.display_name,
        avatar_json: prof.avatar_json,
        avatarJson: prof.avatar_json,
      };
    });
  }

  useEffect(() => {
    if (!sessionCode) {
      const storedCode = localStorage.getItem("session_code");
      const storedIsHost = localStorage.getItem("session_is_host");

      if (storedCode) {
        setSessionInfo({
          sessionId: sessionId ?? null,
          sessionCode: storedCode,
          isHost: storedIsHost === "true",
        });
      } else {
        navigate("/join-session");
      }
    }
  }, [sessionCode, sessionId, navigate, setSessionInfo]);

  useEffect(() => {
    const code = sessionCode || localStorage.getItem("session_code");
    if (!code) return;

    let cancelled = false;

    async function loadLobby() {
      try {
        const headers = {};
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const res = await fetch(`${API_BASE}/sessions/${code}`, { headers });

        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "Failed to load lobby");

        if (cancelled) return;

        setSession(data.session);

        const rawPlayers = data.players || [];
        const playersWithProfiles = await attachProfilesToPlayers(rawPlayers);
        if (cancelled) return;
        setPlayers(playersWithProfiles);

        const computedIsHost = Boolean(
          data.current_user_id &&
            data.session.host_id &&
            data.current_user_id === data.session.host_id
        );

        setSessionInfo({
          sessionId: data.session.id,
          sessionCode: data.session.code,
          isHost: computedIsHost,
        });

        const currentRound = Number(data.session.current_round || 0);
        const status = data.session.status || "waiting";

        if (currentRound >= 1) {
          navigate("/arena");
          return;
        }

        if (status === "in_progress") {
          navigate("/choose-game");
          return;
        }
      } catch (err) {
        console.error("Lobby error:", err);
        if (!cancelled) setError(err.message);
      }
    }

    loadLobby();
    const interval = setInterval(loadLobby, 1500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sessionCode, token, navigate, setSessionInfo, setPlayers]);

  async function startGame() {
    setError("");

    try {
      const code = sessionCode || localStorage.getItem("session_code");
      if (!code) {
        setError("No session code found.");
        return;
      }

      const headers = {
        "X-User-Id": localStorage.getItem("user_id") || "",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/sessions/${code}/start`, {
        method: "POST",
        headers,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to start game");

      navigate("/choose-game");
    } catch (err) {
      console.error("Start game error:", err);
      setError(err.message);
    }
  }

  const codeToShow =
    sessionCode || localStorage.getItem("session_code") || "N/A";

  return (
    <div style={page}>
      <div style={glowOne} />
      <div style={glowTwo} />

      <div style={shell}>
        <div style={card}>
          <p style={eyebrow}>Session lobby</p>
          <h1 style={title}>Lobby</h1>
          <p style={subtitle}>
            Everyone joins here before the host starts the session.
          </p>

          <div style={infoCard}>
            <div style={infoRow}>
              <span style={infoLabel}>Session code</span>
              <span style={codeBadge}>{codeToShow}</span>
            </div>

            {session && (
              <>
                <div style={infoRow}>
                  <span style={infoLabel}>Rule</span>
                  <span style={infoValue}>{session.rule || "Not set"}</span>
                </div>

                <div style={infoRow}>
                  <span style={infoLabel}>Total bill</span>
                  <span style={infoValue}>£{session.total_cost}</span>
                </div>
              </>
            )}
          </div>

          <div style={playersSection}>
            <div style={playersHeader}>
              <h3 style={playersTitle}>Players</h3>
              <span style={playersCount}>
                {players.length} {players.length === 1 ? "joined" : "joined"}
              </span>
            </div>

            {players.length === 0 ? (
              <div style={emptyState}>No players yet…</div>
            ) : (
              <ul style={playersList}>
                {players.map((p) => (
                  <li key={p.id || p.user_id} style={playerCard}>
                    <span style={playerName}>
                      {p.display_name || p.name || "Unknown player"}
                    </span>
                    <span
                      style={{
                        ...roleTag,
                        ...(p.is_host ? hostTag : playerTag),
                      }}
                    >
                      {p.is_host ? "Host" : "Player"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <div style={errorBox}>{error}</div>}

          {isHost ? (
            <button style={startButton} onClick={startGame}>
              Start Game
            </button>
          ) : (
            <div style={waitingBox}>Waiting for host to start the game…</div>
          )}
        </div>
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

const glowOne = {
  position: "absolute",
  width: 420,
  height: 420,
  borderRadius: "50%",
  background: "rgba(255, 196, 54, 0.12)",
  filter: "blur(90px)",
  top: -100,
  left: -100,
};

const glowTwo = {
  position: "absolute",
  width: 320,
  height: 320,
  borderRadius: "50%",
  background: "rgba(255, 132, 82, 0.10)",
  filter: "blur(90px)",
  right: -80,
  top: 180,
};

const shell = {
  position: "relative",
  zIndex: 2,
  maxWidth: 620,
  margin: "0 auto",
  padding: "84px 16px 40px",
};

const card = {
  borderRadius: 30,
  padding: "28px 22px",
  background: "rgba(0, 0, 0, 0.40)",
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
  textAlign: "center",
};

const title = {
  margin: 0,
  fontSize: "clamp(2.2rem, 5vw, 3.2rem)",
  lineHeight: 0.95,
  fontWeight: 900,
  textAlign: "center",
};

const subtitle = {
  margin: "12px auto 22px",
  maxWidth: 460,
  textAlign: "center",
  fontSize: 15,
  lineHeight: 1.6,
  opacity: 0.86,
};

const infoCard = {
  borderRadius: 22,
  padding: 16,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const infoRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const infoLabel = {
  fontSize: 13,
  opacity: 0.72,
  textTransform: "uppercase",
  letterSpacing: 1,
};

const infoValue = {
  fontSize: 15,
  fontWeight: 700,
};

const codeBadge = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(244,196,49,0.16)",
  border: "1px solid rgba(244,196,49,0.28)",
  color: "#f6cf64",
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: 1,
};

const playersSection = {
  marginTop: 24,
};

const playersHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
  flexWrap: "wrap",
};

const playersTitle = {
  margin: 0,
  fontSize: 15,
  textTransform: "uppercase",
  letterSpacing: 1.2,
  color: "#f6cf64",
};

const playersCount = {
  fontSize: 13,
  opacity: 0.78,
};

const emptyState = {
  padding: 16,
  borderRadius: 18,
  background: "rgba(255,255,255,0.04)",
  border: "1px dashed rgba(255,255,255,0.14)",
  fontSize: 14,
  opacity: 0.8,
};

const playersList = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gap: 10,
};

const playerCard = {
  padding: "14px 16px",
  borderRadius: 18,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.10)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const playerName = {
  fontSize: 15,
  fontWeight: 600,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const roleTag = {
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  flexShrink: 0,
};

const hostTag = {
  background: "rgba(244,196,49,0.16)",
  border: "1px solid rgba(244,196,49,0.28)",
  color: "#f6cf64",
};

const playerTag = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.10)",
  color: "#fff",
};

const errorBox = {
  marginTop: 18,
  padding: "12px 14px",
  borderRadius: 16,
  background: "rgba(255,99,99,0.12)",
  border: "1px solid rgba(255,99,99,0.28)",
  color: "#ffd1d1",
  fontSize: 14,
  fontWeight: 600,
};

const startButton = {
  marginTop: 24,
  width: "100%",
  padding: "14px 18px",
  border: "none",
  borderRadius: 999,
  background: "linear-gradient(135deg, #f4c431, #ffb347)",
  color: "#1d1d1d",
  fontSize: 16,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 12px 28px rgba(244,196,49,0.22)",
};

const waitingBox = {
  marginTop: 18,
  padding: "14px 16px",
  borderRadius: 16,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  textAlign: "center",
  fontSize: 14,
  opacity: 0.82,
};
