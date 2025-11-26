import { useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";

export default function Results() {
  const navigate = useNavigate();
  const { results, totalCost, rule } = useGame();

  if (!results || results.length === 0) {
    return (
      <div style={{ paddingTop: 80, textAlign: "center" }}>
        <h1>No results yet</h1>
        <button onClick={() => navigate("/host")}>Back to Host</button>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 80, maxWidth: 500, margin: "0 auto" }}>
      <h1>What a match!</h1>
      <p style={{ marginTop: 8 }}>
        Total: £{totalCost.toFixed(2)} • Rule:{" "}
        {rule === "winner_free" ? "Winner drinks free 🍻" : "Even split 💳"}
      </p>

      <ul style={{ listStyle: "none", marginTop: 24, padding: 0 }}>
        {results.map((p) => (
          <li
            key={p.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 0",
              borderBottom: "1px solid #ccc",
            }}
          >
            <span>
              {p.rank}{" "}
              {p.rank === 1
                ? "🥇"
                : p.rank === 2
                ? "🥈"
                : p.rank === 3
                ? "🥉"
                : ""}
              {"  "}
              {p.name}
            </span>
            <span>£{p.recommended.toFixed(2)}</span>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 24, display: "flex", gap: 8 }}>
        <button onClick={() => navigate("/host")}>Play Again</button>
        <button onClick={() => navigate("/home")}>Back to Home</button>
      </div>
    </div>
  );
}
