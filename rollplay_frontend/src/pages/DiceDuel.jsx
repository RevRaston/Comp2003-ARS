import { useState, useEffect } from "react";

export default function DiceDuel() {
  // Global variables to store the dice rolls
  const [rollNumber, setRollNumber] = useState(null); // player score variable
  const [playerName, setPlayerName] = useState(""); // stored player name (set on button click)
  const [inputName, setInputName] = useState(""); // input field value
  const [displayNumber, setDisplayNumber] = useState(0); // rolling dice display
  const [rolling, setRolling] = useState(true); // rolling effect toggle

  // Handle player name input button click
  const handleNameSubmit = () => {
    if (inputName.trim() === "") {
      alert("Enter a name first!");
      return;
    }
    setPlayerName(inputName);
  };

  // Rolling effect for dice
  useEffect(() => {
    if (!rolling) return; // stop rolling when user clicks roll
    const interval = setInterval(() => {
      setDisplayNumber(Math.floor(Math.random() * 6) + 1);
    }, 100); // updates every 0.1s
    return () => clearInterval(interval);
  }, [rolling]);

  // Roll dice for player
  const handleRoll = () => {
    const roll = Math.floor(Math.random() * 6) + 1;
    setRollNumber(roll); // store player score
    setDisplayNumber(roll); // show final roll
    setRolling(false); // stop rolling effect
  };

  // Reset game
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
      <h1>Dice Duel</h1>

      {/* Player Name Input */}
      {playerName === "" ? (
        <>
          <input
            type="text"
            placeholder="Please enter your name"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
          />
          <button onClick={handleNameSubmit}>hello</button>
        </>
      ) : (
        <p>{playerName}:</p>
      )}

      {/* Dice Number Output */}
      <p>{displayNumber}</p>

      <div style={{ margin: "auto", padding: 10 }}>
        <button onClick={handleRoll} disabled={rollNumber !== null}> roll </button>
        <button onClick={handleReset}>reset</button>
      </div>

    </div>
  );
}
