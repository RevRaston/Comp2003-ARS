import { useState } from "react";
import { GAME_LIST } from "../GameList";
import { useNavigate } from "react-router-dom";

export default function RandomWheel() {
  const navigate = useNavigate();

  const [spinning, setSpinning] = useState(false);
  const [selected, setSelected] = useState(null);
  const [highlight, setHighlight] = useState(0);

  function startSpin() {
    if (spinning) return;

    setSpinning(true);
    setSelected(null);

    let i = 0;
    const spinInt = setInterval(() => {
      setHighlight(i % GAME_LIST.length);
      i++;
    }, 80);

    setTimeout(() => {
      clearInterval(spinInt);

      const chosen =
        GAME_LIST[Math.floor(Math.random() * GAME_LIST.length)];

      setSelected(chosen);
      setHighlight(GAME_LIST.findIndex((g) => g.id === chosen.id));
      setSpinning(false);
    }, 2500);
  }

  return (
    <div style={{ paddingTop: 80, textAlign: "center", color: "white" }}>
      <h1>🎡 Random Level Wheel</h1>

      <div style={{
        margin: "30px auto",
        width: 300,
        padding: 20,
        borderRadius: 12,
        background: "#333",
      }}>
        {GAME_LIST.map((g, idx) => (
          <div
            key={g.id}
            style={{
              padding: "10px 0",
              borderRadius: 6,
              marginBottom: 6,
              background: idx === highlight ? "#4caf50" : "#222",
              color: idx === highlight ? "black" : "white",
              fontWeight: idx === highlight ? "bold" : "normal",
              transition: "0.1s",
            }}
          >
            {g.name}
          </div>
        ))}
      </div>

      <button
        style={{
          padding: "12px 30px",
          fontSize: 20,
          borderRadius: 10,
          border: "none",
          cursor: "pointer",
          background: spinning ? "#666" : "#ffcc00",
        }}
        onClick={startSpin}
        disabled={spinning}
      >
        {spinning ? "Spinning..." : "Spin Wheel"}
      </button>

      {selected && (
        <div style={{ marginTop: 20, fontSize: 24 }}>
          Selected: <strong>{selected.name}</strong>
        </div>
      )}

      {selected && (
        <button
          style={{
            marginTop: 20,
            padding: "10px 20px",
            borderRadius: 10,
            fontSize: 20,
            border: "none",
            cursor: "pointer",
            background: "#4caf50",
            color: "black",
          }}
          onClick={() => navigate(`/game/${selected.id}`)}
        >
          Play Level
        </button>
      )}
    </div>
  );
}
