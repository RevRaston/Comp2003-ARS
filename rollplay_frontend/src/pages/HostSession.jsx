// src/pages/HostSession.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";

const API_BASE = "http://localhost:3000";

export default function HostSession({ token }) {
  const navigate = useNavigate();
  const { setSessionInfo, setTotalCost, setRule } = useGame();

  const [hostName, setHostName] = useState("");
  const [totalCostInput, setTotalCostInput] = useState(50);
  const [ruleInput, setRuleInput] = useState("winner_free");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createSession() {
    setError("");

    if (!token) {
      setError("You must be signed in.");
      return;
    }

    if (!hostName.trim()) {
      setError("Enter your name.");
      return;
    }

    const numericTotal = Number(totalCostInput) || 0;

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Player-Id": localStorage.getItem("player_id"),
        },
        body: JSON.stringify({
          host_name: hostName,
          total_cost: numericTotal,
          rule: ruleInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create session.");

      // Store in context
      setSessionInfo({
        sessionId: data.session_id,
        sessionCode: data.code,
        isHost: true,
      });

      setTotalCost(numericTotal);
      setRule(ruleInput);

      navigate("/lobby");
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="HostSessionBox">
      <h1>Host a Game</h1>

      <label>Your Name</label>
      <input
        value={hostName}
        onChange={(e) => setHostName(e.target.value)}
        style={{ width: "100%", marginBottom: 12 }}
      />

      <label>Total Cost (£)</label>
      <input
        type="number"
        min="1"
        value={totalCostInput}
        onChange={(e) => setTotalCostInput(e.target.value)}
        style={{ width: "100%", marginBottom: 12 }}
      />

      <label>Rule</label>
      <select
        value={ruleInput}
        onChange={(e) => setRuleInput(e.target.value)}
        style={{ width: "100%", marginBottom: 12 }}
      >
        <option value="winner_free">Winner Drinks Free</option>
        <option value="leaderboard">Leaderboard Decides</option>
        <option value="last_place_tax">Last Place Tax</option>
        <option value="top_half_safe">Top Half Safe</option>
        <option value="random_twist">Random Twist</option>
      </select>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button onClick={createSession} disabled={loading}>
        {loading ? "Creating..." : "Create Session"}
      </button>
    </div>
  );
}
