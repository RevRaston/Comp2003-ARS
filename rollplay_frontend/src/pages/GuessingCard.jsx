import React, { useEffect, useState } from "react";
import "./GuessingCard.css"; // import CSS here

export default function GuessingCard() {
  const [timer, setTimer] = useState(3);
  const [gameStarted, setGameStarted] = useState(false);
  const [rollNumber, setRollNumber] = useState(
    Math.floor(Math.random() * 13) + 1
  );

  const [player1Value, setPlayer1Value] = useState("1");
  const [player2Value, setPlayer2Value] = useState("1");

  const [aiPreview, setAiPreview] = useState("");
  const [player1Locked, setPlayer1Locked] = useState(false);
  const [player2Locked, setPlayer2Locked] = useState(false);

  const [outcome, setOutcome] = useState("");

  const beepSound = new Audio("/beep.mp3");
  const goSound = new Audio("/go.mp3");

  // Card Images
  function cardSpades(value) {
    const names = { 1: "ace", 11: "jack", 12: "queen", 13: "king" };
    const name = names[value] || value;
    return `PNG-cards-1.3/${name}_of_spades.png`;
  }

  function cardClubs(value) {
    const names = { 1: "ace", 11: "jack", 12: "queen", 13: "king" };
    const name = names[value] || value;
    return `PNG-cards-1.3/${name}_of_clubs.png`;
  }

  function cardDiamonds(value) {
    const names = { 1: "ace", 11: "jack", 12: "queen", 13: "king" };
    const name = names[value] || value;
    return `PNG-cards-1.3/${name}_of_diamonds.png`;
  }

  // AI Preview Animation
  useEffect(() => {
    if (gameStarted) return;

    const rolling = setInterval(() => {
      const randomNum = Math.floor(Math.random() * 13) + 1;
      setAiPreview(cardSpades(randomNum));
    }, 100);

    return () => clearInterval(rolling);
  }, [gameStarted]);

    // Countdown Timer
    useEffect(() => {
    if (timer < 0) {
        setGameStarted(true);
        setAiPreview(""); // <-- Hide AI preview when countdown ends
        goSound.play();
        return;
    }

    beepSound.currentTime = 0;
    beepSound.play(); // play beep each second 


    const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
    }, [timer]);


  // Check Winner
  function checkClosest() {
    const p1 = Number(player1Value);
    const p2 = Number(player2Value);
    const ai = rollNumber;

    const diff1 = Math.abs(p1 - ai);
    const diff2 = Math.abs(p2 - ai);

    if (diff1 < diff2) setOutcome("Player 1 wins 🎉");
    else if (diff2 < diff1) setOutcome("Player 2 wins 🎉");
    else setOutcome("It's a tie!");
  }

  useEffect(() => {
    if (player1Locked && player2Locked) checkClosest();
  }, [player1Locked, player2Locked]);

  return (
    <div>
      <h1 className="title">Guessing Card</h1>

      <div>
        {timer >= 0 ? (
          <h2>{timer === 0 ? "Go!" : `${timer} Seconds`}</h2>
        ) : (
          <h2>Choose your cards!</h2>
        )}
      </div>

      <div className="card-row">
        <div className="card">
          <p>Player 1 Card</p>
          <img src={cardClubs(player1Value)} alt="Player1" />
        </div>

        <div className="card">
            <p>AI Card</p>
            {!gameStarted ? (
                // During countdown, show rolling AI preview
                <img src={aiPreview} alt="AI preview" />
            ) : player1Locked && player2Locked ? (
                // Once both players have locked, show final AI card
                <img src={cardSpades(rollNumber)} alt="AI final" />
            ) : (
                // Otherwise, hide AI card
                <img src="" alt="AI hidden" />
            )}
        </div>


        <div className="card">
          <p>Player 2 Card</p>
          <img src={cardDiamonds(player2Value)} alt="Player2" />
        </div>
      </div>

      <div>
        <select
          disabled={!gameStarted || player1Locked}
          value={player1Value}
          onChange={(e) => setPlayer1Value(e.target.value)}
        >
          {[...Array(13)].map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1 === 1
                ? "A"
                : i + 1 === 11
                ? "J"
                : i + 1 === 12
                ? "Q"
                : i + 1 === 13
                ? "K"
                : i + 1}
            </option>
          ))}
        </select>

        <button
          disabled={!gameStarted || player1Locked}
          onClick={() => setPlayer1Locked(true)}
        >
          Lock Player 1
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        <select
          disabled={!gameStarted || player2Locked}
          value={player2Value}
          onChange={(e) => setPlayer2Value(e.target.value)}
        >
          {[...Array(13)].map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1 === 1
                ? "A"
                : i + 1 === 11
                ? "J"
                : i + 1 === 12
                ? "Q"
                : i + 1 === 13
                ? "K"
                : i + 1}
            </option>
          ))}
        </select>

        <button
          disabled={!gameStarted || player2Locked}
          onClick={() => setPlayer2Locked(true)}
        >
          Lock Player 2
        </button>
      </div>

      <h2 style={{ marginTop: 30 }}>{outcome}</h2>
    </div>
  );
}
