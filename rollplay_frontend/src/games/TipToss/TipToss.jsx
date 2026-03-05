// src/games/TipToss/TipToss.jsx
import { useEffect, useState, useRef } from "react";

export default function TipToss() {
  const [playerName, setPlayerName] = useState("");
  const [finalName, setFinalName] = useState("");

  const [power, setPower] = useState(0);
  const [increasing, setIncreasing] = useState(true);
  const [running, setRunning] = useState(false);

  const [powerVisible, setPowerVisible] = useState(false);
  const [result, setResult] = useState("");

  const [startEnabled, setStartEnabled] = useState(false);
  const [resetEnabled, setResetEnabled] = useState(false);

  const [startLabel, setStartLabel] = useState("Start");
  const [tossMode, setTossMode] = useState(false);

  const [flipping, setFlipping] = useState(false);

  const coinImg = "/coin.png";

  // audio refs – created once, not every render
  const goodRef = useRef(null);
  const badRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    goodRef.current = new Audio("/good-coin.mp3");
    badRef.current = new Audio("/bad-coin.mp3");
    ringRef.current = new Audio("/coin-ringing.mp3");

    if (goodRef.current) goodRef.current.volume = 1;
    if (badRef.current) badRef.current.volume = 0.7;
    if (ringRef.current) ringRef.current.volume = 0.7;
  }, []);

  // Animate the power bar
  useEffect(() => {
    if (!running) return;

    const id = setInterval(() => {
      setPower((prev) => {
        if (increasing) {
          if (prev >= 100) {
            setIncreasing(false);
            return 100;
          }
          return prev + 2;
        } else {
          if (prev <= 0) {
            setIncreasing(true);
            return 0;
          }
          return prev - 2;
        }
      });
    }, 10);

    return () => clearInterval(id);
  }, [running, increasing]);

  const handleNameSubmit = () => {
    if (playerName.trim() === "") {
      alert("Enter a name first!");
      return;
    }
    setFinalName(playerName + ":");
    setStartEnabled(true);
    setResetEnabled(true);
  };

  // First press = Start (begin power bar + spin + ringing)
  const handleStart = () => {
    setStartLabel("Toss");
    setPowerVisible(true);
    setRunning(true);
    setTossMode(true);
    setFlipping(true);

    if (ringRef.current) {
      ringRef.current.currentTime = 0;
      ringRef.current.play();
    }
  };

  // Second press = Toss (stop bar + decide result + sounds)
  const handleToss = () => {
    setRunning(false);
    setFlipping(false);
    setStartEnabled(false);

    if (ringRef.current) {
      ringRef.current.pause();
      ringRef.current.currentTime = 0;
    }

    if (power < 30) {
      setResult("Weak Toss!");
      if (badRef.current) {
        badRef.current.currentTime = 0;
        badRef.current.play();
      }
    } else if (power < 70) {
      setResult("Nice Toss!");
      if (badRef.current) {
        badRef.current.volume = 0.2;
        badRef.current.currentTime = 0;
      }
      if (goodRef.current) {
        goodRef.current.volume = 0.5;
        goodRef.current.currentTime = 0;
      }
      if (badRef.current) badRef.current.play();
      if (goodRef.current) goodRef.current.play();
    } else {
      setResult("Perfect Toss!");
      if (goodRef.current) {
        goodRef.current.volume = 1;
        goodRef.current.currentTime = 0;
        goodRef.current.play();
      }
    }
  };

  const handleReset = () => {
    window.location.reload();
  };

  return (
    <div
      style={{
        textAlign: "center",
        minHeight: "100vh",
        padding: "20px",
        color: "white",
      }}
    >
      <h1>Tip Toss</h1>

      <div className="myDiv">
        {finalName && <p>{finalName}</p>}

        {!finalName && (
          <>
            <input
              type="text"
              placeholder="Please enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              style={inputStyle}
            />
            <button onClick={handleNameSubmit} style={btnPrimary}>
              Set Name
            </button>
          </>
        )}

        {/* Coin */}
        {powerVisible && (
          <div className={`coin ${flipping ? "flip" : ""}`}>
            <img
              src={coinImg}
              alt="coin"
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        )}

        {/* Buttons */}
        <div style={{ marginTop: "15px" }}>
          <button
            onClick={tossMode ? handleToss : handleStart}
            disabled={!startEnabled}
            style={{ ...btnPrimary, display: "block", margin: "10px auto" }}
          >
            {startLabel}
          </button>

          <button
            onClick={handleReset}
            disabled={!resetEnabled}
            style={{ ...btnSecondary, display: "block", margin: "10px auto" }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* POWER BAR */}
      {powerVisible && (
        <div
          style={{
            width: "60px",
            height: "300px",
            border: "3px solid #333",
            margin: "20px auto",
            borderRadius: "5px",
            overflow: "hidden",
            background: "linear-gradient(to top, red, yellow, green)",
            position: "relative",
          }}
        >
          <div
            style={{
              width: "100%",
              height: `${power}%`,
              background: "rgba(0,0,0,0.4)",
              position: "absolute",
              bottom: 0,
              transition: "height 0.05s",
            }}
          />
        </div>
      )}

      <h2>{result}</h2>

      {/* Coin CSS */}
      <style>{`
        .coin {
          font-size: 60px;
          margin: 20px auto;
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          transform-style: preserve-3d;
        }

        .flip {
          animation: coinFlip 0.4s linear infinite;
        }

        @keyframes coinFlip {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }
      `}</style>
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

const btnPrimary = {
  padding: "8px 14px",
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
