import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGame } from "../GameContext";

export default function GameWrapper({ children }) {
  const navigate = useNavigate();
  const { gameId } = useParams();

  const {
    selectedLevels,
    round,
    setRound,
    setResults,
    players,
  } = useGame();

  const [timeLeft, setTimeLeft] = useState(5);

  useEffect(() => {
    if (timeLeft <= 0) {
      advance();
      return;
    }

    const t = setTimeout(() => {
      setTimeLeft((v) => v - 1);
    }, 1000);

    return () => clearTimeout(t);
  }, [timeLeft]);

  function advance() {
    const currentIndex = selectedLevels.findIndex(
      (l) => l.level.id === gameId
    );

    const next = selectedLevels[currentIndex + 1];

    if (next) {
      setRound((r) => r + 1);
      navigate(`/game/${next.level.id}`);
    } else {
      generateMockResults();
      navigate("/results");
    }
  }

  function generateMockResults() {
    const list =
      players.length > 0
        ? players
        : [
            { name: "Alex" },
            { name: "Jordan" },
            { name: "Sam" },
            { name: "Riley" },
          ];

    const shuffled = [...list].sort(() => Math.random() - 0.5);
    const total = 20;
    const each = total / shuffled.length;

    const results = shuffled.map((p, i) => ({
      name: p.name,
      rank: i + 1,
      recommended: each,
    }));

    setResults(results);
  }

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          background: "#222",
          color: "white",
          padding: "10px 16px",
          borderRadius: "10px",
          fontSize: "20px",
          zIndex: 999,
        }}
      >
        ⏱ {timeLeft}
      </div>

      {children}
    </div>
  );
}
