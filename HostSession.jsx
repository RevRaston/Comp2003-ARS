import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:3000";

export default function HostSession({ token }) {
  const navigate = useNavigate();

  const [hostName, setHostName] = useState("");
  const [totalCost, setTotalCost] = useState("50");
  const [rule, setRule] = useState("winner_free");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionCode, setSessionCode] = useState(null);

  async function handleCreate() {
    setError("");

    if (!token) {
      setError("You must be signed in to host a session.");
      return;
    }

    const totalNum = Number(totalCost);
    if (!hostName.trim() || Number.isNaN(totalNum) || totalNum <= 0) {
      setError("Please enter a name and a valid total bill.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          host_name: hostName.trim(),
          total_cost: totalNum,
          rule,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create session");
      }

      // store code so Lobby & Join page can use it
      localStorage.setItem("session_code", data.code);
      localStorage.setItem("session_is_host", "true");
      localStorage.setItem("host_name", hostName.trim());

      setSessionCode(data.code);

      // small delay so they can see the code, then go to lobby
      setTimeout(() => navigate("/lobby"), 1200);
    } catch (err) {
      console.error("Error creating session:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="HostSessionBox">
      <h1>Host a Session</h1>
      <p>Create a lobby that others can join with a code.</p>

      <label style={{ display: "block", marginTop: 16 }}>
        Your name
        <input
          style={{ width: "100%", marginTop: 4 }}
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
          placeholder="Ryan"
        />
      </label>

      <label style={{ display: "block", marginTop: 16 }}>
        Total bill (£)
        <input
          style={{ width: "100%", marginTop: 4 }}
          type="number"
          min="0"
          value={totalCost}
          onChange={(e) => setTotalCost(e.target.value)}
        />
      </label>

      <label style={{ display: "block", marginTop: 16 }}>
        Rule
        <select
          style={{ width: "100%", marginTop: 4 }}
          value={rule}
          onChange={(e) => setRule(e.target.value)}
        >
          <option value="winner_free">Winner drinks free 🧊</option>
          <option value="even_split">Even split 💷</option>
        </select>
      </label>

      {error && (
        <p style={{ color: "red", marginTop: 12 }}>{error}</p>
      )}

      <button
        style={{ marginTop: 20, padding: "10px 18px" }}
        onClick={handleCreate}
        disabled={loading}
      >
        {loading ? "Creating Session..." : "Create Session"}
      </button>

      {sessionCode && (
        <p style={{ marginTop: 16 }}>
          Session code: <strong>{sessionCode}</strong>
        </p>
      )}
    </div>
  );
}
