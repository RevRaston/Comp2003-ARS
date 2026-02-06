import { useState, useEffect } from "react";

export default function QuickDraw() {
  // Player name inputs
  const [player1Name, setPlayer1Name] = useState("");
  const [player2Name, setPlayer2Name] = useState("");

  // Confirmed names
  const [confirmedP1, setConfirmedP1] = useState(false);
  const [confirmedP2, setConfirmedP2] = useState(false);

  // Countdown
  const [counter, setCounter] = useState(4);
  const [gameActive, setGameActive] = useState(false);

  // Winner message
  const [winner, setWinner] = useState("");

  const beepSound = new Audio("/beep.mp3");
  const goSound = new Audio("/go.mp3");
  const gunshotSound = new Audio("/gun.mp3");
  gunshotSound.volume = 0.8;


  // --------------------------------------------------
  // Countdown only begins when BOTH names confirmed
  // --------------------------------------------------
  useEffect(() => {
    if (!confirmedP1 || !confirmedP2) return; // Wait until both names are set

    if (counter < 0) {
      setGameActive(true); // enable draw buttons
      goSound.play();
      return;
    }

    beepSound.currentTime = 0;
    beepSound.play(); // play beep each second 

    const t = setInterval(() => setCounter((prev) => prev - 1), 1000);
    return () => clearInterval(t);
  }, [counter, confirmedP1, confirmedP2]);

  // --------------------------------------------------
  // Confirm name buttons
  // --------------------------------------------------
  const confirmPlayer1 = () => {
    if (player1Name.trim() === "") {
      alert("Enter a name for Player 1!");
      return;
    }
    setConfirmedP1(true);
  };

  const confirmPlayer2 = () => {
    if (player2Name.trim() === "") {
      alert("Enter a name for Player 2!");
      return;
    }
    setConfirmedP2(true);
  };

  // --------------------------------------------------
  // Winner handlers
  // --------------------------------------------------
  const player1Win = () => {
    gunshotSound.currentTime = 0;
    gunshotSound.play();
    setWinner(`${player1Name} wins!`);
    setGameActive(false);
  };

  const player2Win = () => {
    gunshotSound.currentTime = 0;
    gunshotSound.play();
    setWinner(`${player2Name} wins!`);
    setGameActive(false);
  };

  // --------------------------------------------------
  // Reset page
  // --------------------------------------------------
  const handleReset = () => {
    window.location.reload();
  };

  return (
    <div
      style={{
        height: "100%",
        textAlign: "center",
        paddingTop: 40,
      }}
    >
      <h1>Quick Draw</h1>

      {/* Countdown (only visible after names confirmed) */}
      {confirmedP1 && confirmedP2 && (
        <div style={{ marginBottom: 20 }}>
          {counter >= 0 ? <span>{counter} Seconds</span> : <span>Go!</span>}
        </div>
      )}

      {/* ---------------- Player 1 ---------------- */}
      {!confirmedP1 ? (
        <div>
          <p>Player 1:</p>
          <input
            type="text"
            placeholder="Enter Player 1 name"
            value={player1Name}
            onChange={(e) => setPlayer1Name(e.target.value)}
          />
          <button onClick={confirmPlayer1}>Set Name</button>
        </div>
      ) : (
        <p><strong>{player1Name}:</strong></p>
      )}

      {/* ---------------- Player 2 ---------------- */}
      {!confirmedP2 ? (
        <div>
          <p>Player 2:</p>
          <input
            type="text"
            placeholder="Enter Player 2 name"
            value={player2Name}
            onChange={(e) => setPlayer2Name(e.target.value)}
          />
          <button onClick={confirmPlayer2}>Set Name</button>
        </div>
      ) : (
        <p><strong>{player2Name}:</strong></p>
      )}

      {/* Buttons */}
      <div style={{ padding: 20 }}>
        <button
          onClick={player1Win}
          disabled={!gameActive}
        >
          Draw1
        </button>

        <button
          onClick={player2Win}
          disabled={!gameActive}
        >
          Draw2
        </button>

        <button onClick={handleReset}>Reset</button>
      </div>

      {/* Winner message */}
      <p style={{ fontSize: 24, fontWeight: "bold" }}>{winner}</p>
    </div>
  );
}
