// src/games/QuickDraw/QuickDraw.jsx
import { useState, useEffect, useRef } from "react";

export default function QuickDraw() {
  // Player name inputs
  const [player1Name, setPlayer1Name] = useState("");
  const [player2Name, setPlayer2Name] = useState("");

  // Confirmed names
  const [confirmedP1, setConfirmedP1] = useState(false);
  const [confirmedP2, setConfirmedP2] = useState(false);

  // Countdown (start at 4 → 3,2,1,0, then Go)
  const [counter, setCounter] = useState(4);
  const [gameActive, setGameActive] = useState(false);

  // Winner message
  const [winner, setWinner] = useState("");

  // Audio refs (so we don’t new Audio() on every render)
  const beepRef = useRef(null);
  const goRef = useRef(null);
  const gunshotRef = useRef(null);

  // Load sounds once
  useEffect(() => {
    beepRef.current = new Audio("/beep.mp3");
    goRef.current = new Audio("/go.mp3");
    gunshotRef.current = new Audio("/gun.mp3");
    if (gunshotRef.current) {
      gunshotRef.current.volume = 0.8;
    }
  }, []);

  // --------------------------------------------------
  // Countdown: only starts once BOTH names confirmed
  // --------------------------------------------------
  useEffect(() => {
    // don’t start until both names are confirmed
    if (!confirmedP1 || !confirmedP2) return;

    // countdown finished already
    if (counter < 0 || gameActive) return;

    // play beep / go sound for this tick
    if (counter > 0) {
      if (beepRef.current) {
        beepRef.current.currentTime = 0;
        beepRef.current.play();
      }
    } else if (counter === 0) {
      if (goRef.current) {
        goRef.current.currentTime = 0;
        goRef.current.play();
      }
    }

    const timeout = setTimeout(() => {
      if (counter === 0) {
        // after “0” we move to Go!, enable draw buttons
        setGameActive(true);
        setCounter(-1); // stop countdown
      } else {
        setCounter((prev) => prev - 1);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [counter, confirmedP1, confirmedP2, gameActive]);

  // --------------------------------------------------
  // Confirm name buttons
  // --------------------------------------------------
  const confirmPlayer1 = () => {
    if (!player1Name.trim()) {
      alert("Enter a name for Player 1!");
      return;
    }
    setConfirmedP1(true);
  };

  const confirmPlayer2 = () => {
    if (!player2Name.trim()) {
      alert("Enter a name for Player 2!");
      return;
    }
    setConfirmedP2(true);
  };

  // --------------------------------------------------
  // Winner handlers
  // --------------------------------------------------
  const player1Win = () => {
    if (gunshotRef.current) {
      gunshotRef.current.currentTime = 0;
      gunshotRef.current.play();
    }
    setWinner(`${player1Name} wins!`);
    setGameActive(false);
  };

  const player2Win = () => {
    if (gunshotRef.current) {
      gunshotRef.current.currentTime = 0;
      gunshotRef.current.play();
    }
    setWinner(`${player2Name} wins!`);
    setGameActive(false);
  };

  // --------------------------------------------------
  // Reset page
  // --------------------------------------------------
  const handleReset = () => {
    // soft reset instead of full reload would be nicer, but this matches
    // the original behaviour.
    window.location.reload();
  };

  return (
    <div
      style={{
        height: "100%",
        textAlign: "center",
        paddingTop: 40,
        color: "white",
      }}
    >
      <h1>Quick Draw</h1>

      {/* Countdown (only visible after both names confirmed) */}
      {confirmedP1 && confirmedP2 && (
        <div style={{ marginBottom: 20, fontSize: 24 }}>
          {counter >= 0 ? (
            <span>{counter === 0 ? "0" : counter} Seconds</span>
          ) : (
            <span>GO!</span>
          )}
        </div>
      )}

      {/* ---------------- Player 1 ---------------- */}
      {!confirmedP1 ? (
        <div style={{ marginBottom: 16 }}>
          <p>Player 1:</p>
          <input
            type="text"
            placeholder="Enter Player 1 name"
            value={player1Name}
            onChange={(e) => setPlayer1Name(e.target.value)}
            style={inputStyle}
          />
          <button style={btnStyle} onClick={confirmPlayer1}>
            Set Name
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 18 }}>
          <strong>{player1Name}:</strong>
        </p>
      )}

      {/* ---------------- Player 2 ---------------- */}
      {!confirmedP2 ? (
        <div style={{ marginBottom: 16 }}>
          <p>Player 2:</p>
          <input
            type="text"
            placeholder="Enter Player 2 name"
            value={player2Name}
            onChange={(e) => setPlayer2Name(e.target.value)}
            style={inputStyle}
          />
          <button style={btnStyle} onClick={confirmPlayer2}>
            Set Name
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 18 }}>
          <strong>{player2Name}:</strong>
        </p>
      )}

      {/* Buttons */}
      <div style={{ padding: 20, display: "flex", gap: 8, justifyContent: "center" }}>
        <button onClick={player1Win} disabled={!gameActive} style={btnStyle}>
          Draw 1
        </button>

        <button onClick={player2Win} disabled={!gameActive} style={btnStyle}>
          Draw 2
        </button>

        <button onClick={handleReset} style={btnSecondary}>
          Reset
        </button>
      </div>

      {/* Winner message */}
      <p style={{ fontSize: 24, fontWeight: "bold", marginTop: 10 }}>{winner}</p>
    </div>
  );
}

const inputStyle = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #666",
  background: "#111",
  color: "white",
  fontSize: 14,
};

const btnStyle = {
  marginLeft: 8,
  padding: "6px 12px",
  borderRadius: 999,
  border: "none",
  background: "#ffcc33",
  color: "#222",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
};

const btnSecondary = {
  ...btnStyle,
  background: "#222",
  color: "white",
  border: "1px solid #999",
};
