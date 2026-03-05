// src/pages/Lobby.jsx 
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";
import { supabase } from "../supabase";

// ✅ Use env var in production, fallback to localhost for local dev
const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:3000"
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

  // ------------------------------------------------------------------
  // Helper: fetch Supabase profiles for all players in this lobby
  // and merge display_name + avatar_json into the player objects.
  // IMPORTANT: backend likely exposes `user_id`, not `id`.
  // ------------------------------------------------------------------
  async function attachProfilesToPlayers(rawPlayers) {
    if (!rawPlayers || rawPlayers.length === 0) return [];

    // Use user_id if available, otherwise fall back to id.
    const ids = rawPlayers
      .map((p) => p.user_id || p.id)
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i); // unique

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
        // normalise names
        name: p.name || prof.display_name,
        display_name: prof.display_name,
        // expose avatar for both snake + camel just in case
        avatar_json: prof.avatar_json,
        avatarJson: prof.avatar_json,
      };
    });
  }

  // ------------------------------------------------------------------
  // Restore session info from localStorage if missing
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // Poll backend for lobby state (every 2s)
  // and enrich players with profile data (avatars)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!token) return;

    const code = sessionCode || localStorage.getItem("session_code");
    if (!code) return;

    async function loadLobby() {
      try {
        const res = await fetch(`${API_BASE}/sessions/${code}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load lobby");

        setSession(data.session);

        // Enrich players with avatar_json + display_name from Supabase
        const rawPlayers = data.players || [];
        const playersWithProfiles = await attachProfilesToPlayers(rawPlayers);
        setPlayers(playersWithProfiles);

        const computedIsHost =
          Boolean(
            data.current_user_id &&
              data.session.host_id &&
              data.current_user_id === data.session.host_id
          );

        setSessionInfo({
          sessionId: data.session.id,
          sessionCode: data.session.code,
          isHost: computedIsHost,
        });

        // If host already started the game → move everyone to Choose Game
        if (data.session.status === "in_progress") {
          navigate("/choose-game"); // 👈 match your real URL
        }
      } catch (err) {
        console.error("Lobby error:", err);
        setError(err.message);
      }
    }

    loadLobby();
    const interval = setInterval(loadLobby, 2000);
    return () => clearInterval(interval);
  }, [sessionCode, token, navigate, setSessionInfo, setPlayers]);

  // ------------------------------------------------------------------
  // HOST — Start game
  // ------------------------------------------------------------------
  async function startGame() {
    setError("");

    try {
      const code = sessionCode || localStorage.getItem("session_code");
      if (!code) {
        setError("No session code found.");
        return;
      }

      const res = await fetch(`${API_BASE}/sessions/${code}/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-User-Id": localStorage.getItem("user_id"),
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start game");

      // ✅ Go to Choose Game screen (which is LevelSelect under the hood)
      navigate("/choose-game"); // 👈 match your router
    } catch (err) {
      console.error("Start game error:", err);
      setError(err.message);
    }
  }

  const codeToShow =
    sessionCode || localStorage.getItem("session_code") || "N/A";

  return (
    <div
      className="LobbyBox"
      style={{ paddingTop: 80, maxWidth: 480, margin: "0 auto" }}
    >
      <h1>Lobby</h1>

      <p>
        Session Code: <strong>{codeToShow}</strong>
      </p>

      {session && (
        <p>
          Rule: <strong>{session.rule}</strong> — Total bill:{" "}
          <strong>£{session.total_cost}</strong>
        </p>
      )}

      <h3 style={{ marginTop: 24 }}>Players:</h3>

      {players.length === 0 && <p>No players yet…</p>}

      <ul>
        {players.map((p) => (
          <li key={p.id || p.user_id}>
            {p.display_name || p.name} {p.is_host ? "(Host)" : ""}
          </li>
        ))}
      </ul>

      {error && <p style={{ color: "red", marginTop: 16 }}>{error}</p>}

      {isHost ? (
        <button
          style={{ marginTop: 24, padding: "10px 18px" }}
          onClick={startGame}
        >
          Start Game
        </button>
      ) : (
        <p style={{ marginTop: 16 }}>Waiting for host to start the game…</p>
      )}
    </div>
  );
}