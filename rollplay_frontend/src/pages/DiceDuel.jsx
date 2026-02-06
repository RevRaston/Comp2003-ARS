import { useState, useEffect, useRef } from "react";

const DiceDuel = () => {
  const [playerName, setPlayerName] = useState("");
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [rollNumber, setRollNumber] = useState(1);
  const [rolling, setRolling] = useState(true);
  const diceSoundRef = useRef(null);

  // Auto rolling effect
  useEffect(() => {
    if (!rolling) return;

    const interval = setInterval(() => {
      const tempRoll = Math.floor(Math.random() * 6) + 1;
      setRollNumber(tempRoll);
    }, 100);

    return () => clearInterval(interval);
  }, [rolling]);

  const handleNameConfirm = () => {
    if (playerName.trim() === "") {
      alert("Enter a name first!");
      return;
    }
    setNameConfirmed(true);
  };

  const handleRoll = () => {
    setRolling(false);
    const finalRoll = Math.floor(Math.random() * 6) + 1;
    setRollNumber(finalRoll);
        // Play dice sound
    if (diceSoundRef.current) {
        diceSoundRef.current.currentTime = 0; // rewind
        diceSoundRef.current.play();
      }
    console.log("Dice rolled!");

  };

  const handleReset = () => {
    window.location.reload();
  };

  // Dice dot display based on face number
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

  const diceStyle = {
    width: "110px",
    height: "110px",
    background: "white",
    borderRadius: "18px",
    margin: "30px auto",
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gridTemplateRows: "repeat(3, 1fr)",
    padding: "20px",
    gap: "12px",
    boxShadow: "0 12px 28px rgba(0,0,0,0.25)",
    animation: rolling ? "shake 0.4s infinite" : "none",
  };

  const dotStyle = (visible) => ({
    width: "14px",
    height: "14px",
    background: "black",
    borderRadius: "50%",
    placeSelf: "center",
    display: visible ? "block" : "none",
  });

  const containerStyle = {
    height: "100%",
    margin: 0,
    padding: 0,
    backgroundRepeat: "no-repeat",
    backgroundAttachment: "fixed",
    fontFamily: "sans-serif",
  };

  const centerStyle = {
    margin: "auto",
    textAlign: "center",
    padding: "10px",
  };

  const keyframes = `
    @keyframes shake {
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
      <h1 style={{ textAlign: "center" }}>Dice Duel</h1>

      {!nameConfirmed ? (
        <div style={centerStyle}>
          <input
            type="text"
            placeholder="Please enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
          <button onClick={handleNameConfirm}>hello</button>
        </div>
      ) : (
        <p style={centerStyle}>{playerName}:</p>
      )}

      <div style={diceStyle}>
        {getDotVisibility(rollNumber).map((visible, i) => (
          <span style={dotStyle(visible)} key={i}></span>
        ))}
      </div>

      <div style={centerStyle}>
        <button onClick={handleRoll} disabled={!rolling}>
          roll1
        </button>

        <audio ref={diceSoundRef} src="/dice-roll.mp3" />
        <button onClick={handleReset}>reset</button>
      </div>

      <p id="results" style={centerStyle}></p>
    </div>
  );
};

export default DiceDuel;
