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