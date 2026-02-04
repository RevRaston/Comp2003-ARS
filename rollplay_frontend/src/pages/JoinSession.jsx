import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";

const API_BASE = "http://localhost:3000";

export default function JoinSession({ token }) {
  const navigate = useNavigate();
  const { setSessionInfo, profile } = useGame();

  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function join() {
    setError("");

    if (!token) {
      setError("You must be signed in.");
      return;
    }

    if (!profile) {
      setError("You need to complete your profile first.");
      return;
    }

    if (!code.trim()) {
      setError("Enter the session code.");
      return;
    }

    const sessionCode = code.trim().toUpperCase();

    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionCode}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Player-Id": localStorage.getItem("player_id"),
        },
        body: JSON.stringify({ name: profile.displayName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSessionInfo({
        sessionId: data.session_id,
        sessionCode,
        isHost: false,
      });

      navigate("/lobby");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="JoinSessionBox">
      <h1>Join a Session</h1>

      <p style={{ marginBottom: 12 }}>
        Signed in as:{" "}
        <strong>{profile ? profile.displayName : "Unknown"}</strong>
      </p>

      <label>Session Code</label>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="ABC123"
        style={{ width: "100%", marginBottom: 12 }}
      />

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button onClick={join}>Join</button>

      <button
        style={{ marginTop: 12 }}
        onClick={() => navigate("/profile")}
        type="button"
      >
        Edit Profile
      </button>
    </div>
  );
}
