// src/games/DiceDuel/DiceDuel.jsx
import { useState, useEffect, useRef } from "react";
import { useGame } from "../../GameContext";

/**
 * Dice Duel
 * - Uses logged-in profile display name (no separate name input)
 * - Auto "wobble" animation while waiting to roll
 * - Plays dice sound on roll
 */

export default function DiceDuel() {
  const { profile } = useGame();
  const playerLabel = profile?.displayName || "Player";

  const [rollNumber, setRollNumber] = useState(1);
  const [rolling, setRolling] = useState(true); // starts in wobble mode
  const [hasRolled, setHasRolled] = useState(false);
  const diceSoundRef = useRef(null);

  // Auto-rolling wobble effect
  useEffect(() => {
    if (!rolling) return;

    const interval = setInterval(() => {
      const tempRoll = Math.floor(Math.random() * 6) + 1;
      setRollNumber(tempRoll);
    }, 100);

    return () => clearInterval(interval);
  }, [rolling]);

  // Dice dot layout
  const getDotVisibility = (face) => {
    const faces = {
      1: [false, false, false, false, true, false, false, false, false],
      2: [false, true, false, false, false, false, false, true, false],
      3: [false, true, false, false, true, false, false, true, false],
      4: [true, false, true, false, false, false, true, false, true],
      5: [true, false, true, false, true, false, true, false, true],
      6: [true, false, true, true, false, true, true, false, true],
    };
    return faces[face] || Array(9).fill(false);
  };

  const handleRoll = () => {
    if (!rolling && hasRolled) return; // extra guard

    setRolling(false);
    setHasRolled(true);

    const finalRoll = Math.floor(Math.random() * 6) + 1;
    setRollNumber(finalRoll);

    if (diceSoundRef.current) {
      diceSoundRef.current.currentTime = 0;
      diceSoundRef.current.play().catch(() => {
        // ignore autoplay issues
      });
    }
  };

  const handleReset = () => {
    setRolling(true);
    setHasRolled(false);
  };

  // --- styles ---

  const containerStyle = {
    height: "100%",
    minHeight: "100vh",
    margin: 0,
    paddingTop: 80,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    color: "white",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  };

  const cardStyle = {
    background: "rgba(0,0,0,0.55)",
    borderRadius: 24,
    padding: "24px 20px 28px",
    maxWidth: 360,
    width: "90%",
    boxShadow: "0 18px 40px rgba(0,0,0,0.55)",
    border: "1px solid rgba(255,255,255,0.1)",
    textAlign: "center",
  };

  const diceStyle = {
    width: 110,
    height: 110,
    background: "white",
    borderRadius: 18,
    margin: "24px auto 10px",
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gridTemplateRows: "repeat(3, 1fr)",
    padding: 18,
    gap: 10,
    boxShadow: "0 12px 28px rgba(0,0,0,0.35)",
    animation: rolling ? "dice-shake 0.4s infinite" : "none",
  };

  const dotStyle = (visible) => ({
    width: 14,
    height: 14,
    background: "black",
    borderRadius: "50%",
    placeSelf: "center",
    display: visible ? "block" : "none",
  });

  const buttonRow = {
    display: "flex",
    justifyContent: "center",
    gap: 10,
    marginTop: 16,
  };

  const primaryBtn = {
    padding: "8px 18px",
    borderRadius: 999,
    border: "none",
    background: "#ffcc33",
    color: "#222",
    fontWeight: 600,
    cursor: "pointer",
    minWidth: 90,
  };

  const secondaryBtn = {
    padding: "8px 16px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.4)",
    background: "transparent",
    color: "white",
    fontSize: 14,
    cursor: "pointer",
    minWidth: 90,
  };

  const keyframes = `
    @keyframes dice-shake {
      0% { transform: rotate(0deg); }
      25% { transform: rotate(5deg); }
      50% { transform: rotate(-5deg); }
      75% { transform: rotate(5deg); }
      100% { transform: rotate(0deg); }
    }
  `;

  return (
    <div style={containerStyle}>
      <style>{keyframes}</style>

      <h1 style={{ marginBottom: 4 }}>Dice Duel</h1>
      <p style={{ opacity: 0.75, marginBottom: 20 }}>
        {playerLabel}, tap <strong>Roll</strong> to lock in your dice.
      </p>

      <div style={cardStyle}>
        <div style={{ fontSize: 14, opacity: 0.85 }}>
          Player: <strong>{playerLabel}</strong>
        </div>

        <div style={diceStyle}>
          {getDotVisibility(rollNumber).map((visible, i) => (
            <span key={i} style={dotStyle(visible)} />
          ))}
        </div>

        <div style={{ fontSize: 18, marginTop: 4 }}>
          Final roll: <strong>{rollNumber}</strong>
        </div>

        <div style={buttonRow}>
          <button
            onClick={handleRoll}
            disabled={!rolling && hasRolled}
            style={{
              ...primaryBtn,
              opacity: !rolling && hasRolled ? 0.5 : 1,
              cursor: !rolling && hasRolled ? "default" : "pointer",
            }}
          >
            {hasRolled ? "Rolled" : "Roll"}
          </button>

          <button onClick={handleReset} style={secondaryBtn}>
            Reset
          </button>
        </div>

        <audio ref={diceSoundRef} src="/sounds/dice-roll.mp3" />
      </div>
    </div>
  );
}
