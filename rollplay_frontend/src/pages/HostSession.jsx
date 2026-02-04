import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";

const API_BASE = "http://localhost:3000";

export default function HostSession({ token }) {
  const navigate = useNavigate();
  const { setSessionInfo, profile } = useGame();

  const [totalCost, setTotalCost] = useState(50);
  const [rule, setRule] = useState("winner_free");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createSession() {
    setError("");

    if (!token) {
      setError("You must be signed in.");
      return;
    }

    if (!profile) {
      setError("You need to complete your profile first.");
      return;
    }

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
          host_name: profile.displayName,
          total_cost: Number(totalCost),
          rule,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create session");

      setSessionInfo({
        sessionId: data.session_id,
        sessionCode: data.code,
        isHost: true,
      });

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

      <p style={{ marginBottom: 12 }}>
        Signed in as:{" "}
        <strong>{profile ? profile.displayName : "Unknown"}</strong>
      </p>

      <label>Total Cost (£)</label>
      <input
        type="number"
        min="1"
        value={totalCost}
        onChange={(e) => setTotalCost(e.target.value)}
        style={{ width: "100%", marginBottom: 12 }}
      />

      <label>Rule</label>
      <select
        value={rule}
        onChange={(e) => setRule(e.target.value)}
        style={{ width: "100%", marginBottom: 12 }}
      >
        <option value="winner_free">Winner Drinks Free</option>
        <option value="leaderboard_weighted">
          Leaderboard Weighted Split
        </option>
        <option value="loser_pays_most">Loser Pays Most</option>
        <option value="roulette_payer">Random Roulette Payer</option>
        <option value="even_split">Even Split</option>
      </select>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button onClick={createSession} disabled={loading}>
        {loading ? "Creating..." : "Create Session"}
      </button>

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
