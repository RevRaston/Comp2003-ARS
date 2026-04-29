import { useEffect, useState } from "react";

export default function StackGame({
  players = [],
  isHost = true,
  onRoundComplete,
}) {
  const [score, setScore] = useState(0);
  const [ended, setEnded] = useState(false);

  // simple tap-to-increase score (placeholder for canvas version)
  function handleTap() {
    if (ended) return;

    const newScore = score + Math.floor(Math.random() * 3 + 1);
    setScore(newScore);

    if (newScore >= 20) {
      finish(newScore);
    }
  }

  function finish(finalScore) {
    setEnded(true);

    if (isHost && onRoundComplete) {
      onRoundComplete({
        winnerKey: players?.[0]?.id || null,
        scores: players.map((p, i) => ({
          playerKey: p.id || i,
          score: finalScore,
        })),
      });
    }
  }

  useEffect(() => {
    setScore(0);
    setEnded(false);
  }, []);

  return (
    <div style={wrap} onClick={handleTap}>
      <div style={card}>
        <h1>▲ STACK ▲</h1>
        <p style={scoreText}>{score} floors</p>

        {!ended ? (
          <p style={hint}>Tap to stack</p>
        ) : (
          <p style={hint}>Round complete</p>
        )}
      </div>
    </div>
  );
}

/* styles */

const wrap = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const card = {
  padding: 20,
  borderRadius: 16,
  background: "rgba(0,0,0,0.4)",
  textAlign: "center",
};

const scoreText = {
  fontSize: 32,
  fontWeight: 800,
  margin: "10px 0",
};

const hint = {
  opacity: 0.7,
};