// src/pages/Results.jsx
import { useGame } from "../GameContext";
import { useNavigate } from "react-router-dom";

export default function Results() {
  const navigate = useNavigate();
  const { results } = useGame();

  if (!results || results.length === 0) {
    return (
      <div style={{ paddingTop: 80, textAlign: "center" }}>
        <h2>No results to show yet.</h2>
        <button onClick={() => navigate("/lobby")}>Back to Lobby</button>
      </div>
    );
  }

  const winner = results[0];

  return (
    <div style={{ paddingTop: 80, textAlign: "center" }}>
      <h1 style={{ fontSize: "32px", marginBottom: "10px" }}>
        Game Results
      </h1>

      {/* Winner Highlight */}
      <div
        style={{
          padding: "15px",
          borderRadius: "10px",
          background: "#222",
          color: "white",
          marginBottom: "30px",
          display: "inline-block",
        }}
      >
        <h2 style={{ margin: 0 }}>🏆 Winner</h2>
        <h1 style={{ margin: "10px 0", fontSize: "40px" }}>
          {winner.name}
        </h1>
        <p style={{ margin: 0, fontSize: "20px" }}>
          Pays: £{winner.recommended.toFixed(2)}
        </p>
      </div>

      <h2>Full Rankings</h2>

      <table
        style={{
          margin: "0 auto",
          borderCollapse: "collapse",
          width: "80%",
          maxWidth: "500px",
        }}
      >
        <thead>
          <tr>
            <th style={th}>Rank</th>
            <th style={th}>Name</th>
            <th style={th}>Pays</th>
          </tr>
        </thead>
        <tbody>
          {results.map((p) => (
            <tr key={p.name}>
              <td style={td}>{p.rank}</td>
              <td style={td}>{p.name}</td>
              <td style={td}>
                £{p.recommended.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        onClick={() => navigate("/lobby")}
        style={{
          marginTop: 30,
          padding: "10px 20px",
          fontSize: "18px",
        }}
      >
        Back to Lobby
      </button>
    </div>
  );
}

/* Inline table styling */
const th = {
  borderBottom: "2px solid #ccc",
  padding: "10px",
};

const td = {
  borderBottom: "1px solid #ddd",
  padding: "10px",
  fontSize: "18px",
  textAlign: "center",
};

