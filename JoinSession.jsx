import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:3000";

export default function JoinSession({ token }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  async function handleJoin() {
    setError("");

    if (!token) {
      setError("You must be signed in to join a session.");
      return;
    }

    if (!name.trim() || !code.trim()) {
      setError("Please enter your name and the session code.");
      return;
    }

    const trimmedCode = code.trim().toUpperCase();

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sessions/${trimmedCode}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to join session");
      }

      localStorage.setItem("session_code", trimmedCode);
      localStorage.setItem("session_is_host", "false");
      localStorage.setItem("player_name", name.trim());

      navigate("/lobby");
    } catch (err) {
      console.error("Join error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="JoinSessionBox" >
      <h1>Join Game Session</h1>

      <label style={{ display: "block", marginTop: 16 }}>
        Your Name
        <input
          style={{ width: "100%", marginTop: 4 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label style={{ display: "block", marginTop: 16 }}>
        Session Code
        <input
          style={{ width: "100%", marginTop: 4 }}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ABC123"
        />
      </label>


      {error && (
        <p style={{ color: "red", marginTop: 12 }}>{error}</p>
      )}

      <button
        style={{ marginTop: 20, padding: "10px 18px" }}
        onClick={handleJoin}
        disabled={loading}
      >
        {loading ? "Joining..." : "Join"}
      </button>
    </div>
  );
}
