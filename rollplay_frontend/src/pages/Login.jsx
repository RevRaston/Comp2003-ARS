// src/pages/Lobby.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";

const API_BASE = "http://localhost:3000";

export default function Lobby({ token }) {
  const navigate = useNavigate();

  const {
    sessionId,
    sessionCode,
    isHost,
    setSessionInfo,
    players,
    setPlayers,
    setTotalCost,
    setRule,
  } = useGame();

  const [session, setSession] = useState(null);
  const [error, setError] = useState("");

  // Restore session info from localStorage if missing
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

  // Poll backend for lobby state (every 2s)
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
        setPlayers(data.players || []);

        // sync rule + total cost into context (for GameRunner later)
        if (data.session?.total_cost != null) {
          setTotalCost(Number(data.session.total_cost));
        }
        if (data.session?.rule) {
          setRule(data.session.rule);
        }

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

        // If host already started the game → push all players to choose-game
        if (data.session.status === "started") {
          navigate("/choose-game");
        }
      } catch (err) {
        console.error("Lobby error:", err);
        setError(err.message);
      }
    }

    loadLobby();
    const interval = setInterval(loadLobby, 2000);
    return () => clearInterval(interval);
  }, [sessionCode, token, navigate, setSessionInfo, setPlayers, setTotalCost, setRule]);

  // HOST — Start game
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

      navigate("/choose-game");
    } catch (err) {
      console.error("Start game error:", err);
      setError(err.message);
    }
  }

  const codeToShow =
    sessionCode || localStorage.getItem("session_code") || "N/A";

  return (
    <div className="LobbyBox" style={{ paddingTop: 80, maxWidth: 480, margin: "0 auto" }}>
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

      {(!players || players.length === 0) && <p>No players yet…</p>}

      <ul>
        {players?.map((p) => (
          <li key={p.id}>
            {p.name} {p.is_host ? "(Host)" : ""}
          </li>
        ))}
      </ul>

      {error && (
        <p style={{ color: "red", marginTop: 16 }}>{error}</p>
      )}

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
