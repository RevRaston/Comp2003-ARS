import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:3000";

export default function Lobby({ token }) {
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [players, setPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState("");

  const code = localStorage.getItem("session_code") || "";

  useEffect(() => {
    if (!code) {
      // No session code stored – shove them to join screen
      navigate("/join-session");
      return;
    }

    if (!token) {
      setError("You must be signed in to view the lobby.");
      return;
    }

    let cancelled = false;

    async function fetchLobby() {
      try {
        const res = await fetch(`${API_BASE}/sessions/${code}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load lobby");
        }

        if (cancelled) return;

        setSession(data.session);
        setPlayers(data.players || []);

        if (data.current_user_id && data.session?.host_id) {
          setIsHost(data.current_user_id === data.session.host_id);
        } else {
          setIsHost(false);
        }

        if (data.session.status === "in_progress") {
          // later you might send to /countdown first
          navigate("/randomizer");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Lobby fetch error:", err);
          setError(err.message);
        }
      }
    }

    // initial load
    fetchLobby();
    // poll every 2 seconds
    const interval = setInterval(fetchLobby, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [code, token, navigate]);

  async function handleStartGame() {
    setError("");

    try {
      const res = await fetch(`${API_BASE}/sessions/${code}/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start game");
      }

      // The lobby polling will notice status=in_progress and navigate,
      // but we can also push immediately:
      navigate("/randomizer");
    } catch (err) {
      console.error("Start game error:", err);
      setError(err.message);
    }
  }

  return (
    <div style={{ paddingTop: 80, maxWidth: 480, margin: "0 auto" }}>
      <h1>Lobby</h1>
      <p>
        Session code: <strong>{code || "N/A"}</strong>
      </p>

      {session && (
        <p>
          Rule: <strong>{session.rule}</strong> — Total bill:{" "}
          <strong>£{session.total_cost}</strong>
        </p>
      )}

      <h3 style={{ marginTop: 24 }}>Players</h3>
      {players.length === 0 && <p>No players yet…</p>}

      <ul>
        {players.map((p) => (
          <li key={p.id}>
            {p.name}
            {p.is_host ? " (Host)" : ""}
          </li>
        ))}
      </ul>

      {error && (
        <p style={{ color: "red", marginTop: 16 }}>{error}</p>
      )}

      {isHost && (
        <button
          style={{ marginTop: 24, padding: "10px 18px" }}
          onClick={handleStartGame}
        >
          Start Game
        </button>
      )}
    </div>
  );
}

