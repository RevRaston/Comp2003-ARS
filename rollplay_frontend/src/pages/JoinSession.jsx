// src/pages/JoinSession.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";

// ✅ Use env var in production (Netlify), fallback to localhost for local dev
const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);

export default function JoinSession({ token }) {
  const navigate = useNavigate();
  const { setSessionInfo, profile } = useGame();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin() {
    setError("");

    if (!code.trim()) {
      setError("Please enter a code.");
      return;
    }

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/sessions/${code.trim()}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: name.trim(),
        }),
      });

      let data = null;
      const text = await res.text();
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        const msg =
          data?.error ||
          data?.message ||
          `Failed to join session (HTTP ${res.status})`;
        throw new Error(msg);
      }

      // store session + player info in context
      setSessionInfo({
        sessionId: data.session_id,
        sessionCode: code.trim(),
        isHost: false,
        playerId: data.player_id,
        playerName: data.name,
      });

      navigate("/lobby");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to join session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="JoinSessionBox">
      <h1>Join a Game</h1>

      <label>Code</label>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        style={{ width: "100%", marginBottom: 12 }}
      />

      <label>Your Name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ width: "100%", marginBottom: 12 }}
      />

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button onClick={handleJoin} disabled={loading}>
        {loading ? "Joining..." : "Join Session"}
      </button>
    </div>
  );
}