// src/games/TopRace/TopRace.jsx
import { useState, useRef, useEffect } from "react";

export default function TopRace() {
  const [playerName, setPlayerName] = useState("");
  const [finalName, setFinalName] = useState("");

  const [counter, setCounter] = useState(0);
  const [time, setTime] = useState("");

  const [tapEnabled, setTapEnabled] = useState(false);
  const [resetEnabled, setResetEnabled] = useState(false);
  const [buttonPressed, setButtonPressed] = useState(false);

  const beepRef = useRef(null);
  const goRef = useRef(null);
  const firstIntervalRef = useRef(null);
  const secondIntervalRef = useRef(null);

  // create audio objects once
  useEffect(() => {
    beepRef.current = new Audio("/beep.mp3");
    goRef.current = new Audio("/go.mp3");

    if (beepRef.current) beepRef.current.volume = 0.6;
  }, []);

  // clear intervals on unmount just in case
  useEffect(() => {
    return () => {
      if (firstIntervalRef.current) clearInterval(firstIntervalRef.current);
      if (secondIntervalRef.current) clearInterval(secondIntervalRef.current);
    };
  }, []);

  function playBeep() {
    if (!beepRef.current) return;
    beepRef.current.currentTime = 0;
    beepRef.current.play();
  }

  function playGo() {
    if (!goRef.current) return;
    goRef.current.currentTime = 0;
    goRef.current.play();
  }

  // First countdown: “3 2 1 Go!”
  const startFirstCountdown = () => {
    let timeLeft = 4;
    setTime(`${timeLeft} Seconds`);

    firstIntervalRef.current = setInterval(() => {
      timeLeft--;

      playBeep();

      if (timeLeft <= -1) {
        clearInterval(firstIntervalRef.current);
        firstIntervalRef.current = null;

        setTime("Go!");
        setTapEnabled(true);
        setResetEnabled(true);
        startSecondCountdown();
      } else {
        setTime(`${timeLeft} Seconds`);
      }
    }, 1000);
  };

  // Second countdown – actual game timer
  const startSecondCountdown = () => {
    let timeLeft = 11;

    playGo(); // “start” sound once at beginning

    secondIntervalRef.current = setInterval(() => {
      timeLeft--;

      if (timeLeft <= -1) {
        clearInterval(secondIntervalRef.current);
        secondIntervalRef.current = null;

        setTapEnabled(false);
        setTime("");
        playGo(); // end sound
      } else {
        setTime(`You have ${timeLeft} Seconds`);
      }

      playBeep();
    }, 1000);
  };

  const handleSubmitName = () => {
    if (playerName.trim() === "") {
      alert("Enter a name first!");
      return;
    }
    setFinalName(playerName + ":");
    startFirstCountdown();
  };

  const resetGame = () => {
    window.location.reload();
  };

  const handleTap = () => {
    if (!tapEnabled) return;
    setCounter((c) => c + 1);

    setButtonPressed(true);
    setTimeout(() => setButtonPressed(false), 100);
  };

  return (
    <div
      style={{
        textAlign: "center",
        padding: "20px",
        minHeight: "100vh",
        color: "white",
      }}
    >
      <h1>TopRace</h1>
      <p>Mash the button as quickly as you can!</p>

      {!finalName && (
        <>
          <input
            type="text"
            placeholder="Please enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            style={inputStyle}
          />
          <button onClick={handleSubmitName} style={btnPrimary}>
            Set Name
          </button>
        </>
      )}

      {finalName && <p>{finalName}</p>}

      <p style={{ fontSize: 32, fontWeight: 700 }}>{counter}</p>

      <div className="myDiv">
        <button
          disabled={!tapEnabled}
          onClick={handleTap}
          style={{
            ...btnPrimary,
            transform: buttonPressed ? "scale(1.2)" : "scale(1)",
            backgroundColor: buttonPressed ? "rgb(243, 17, 17)" : "#ffcc33",
            transition: "transform 0.1s, background-color 0.1s",
            marginRight: 12,
          }}
        >
          Tap
        </button>

        <button
          disabled={!resetEnabled}
          onClick={resetGame}
          style={btnSecondary}
        >
          Reset
        </button>
      </div>

      <p>{time}</p>
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
  marginRight: 8,
};

const btnPrimary = {
  padding: "8px 16px",
  borderRadius: 999,
  border: "none",
  background: "#ffcc33",
  color: "#222",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
};

const btnSecondary = {
  ...btnPrimary,
  background: "#222",
  color: "white",
  border: "1px solid #999",
};
