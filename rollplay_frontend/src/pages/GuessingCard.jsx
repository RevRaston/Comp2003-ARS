import React, { useEffect, useState } from "react";
import yaml from 'js-yaml';
import playersYAML from './players.yml?raw';
import "./GuessingCard.css";

export default function GuessingCard() {
  const [timer, setTimer] = useState(3);
  const [gameStarted, setGameStarted] = useState(false);
  const [rollNumber, setRollNumber] = useState(Math.floor(Math.random() * 13) + 1);

  const [players, setPlayers] = useState([]);
  const [aiPreview, setAiPreview] = useState("");
  const [outcome, setOutcome] = useState("");

  const beepSound = new Audio("/beep.mp3");
  const goSound = new Audio("/go.mp3");

  // Load players from YAML, fallback to default two players
  useEffect(() => {
    try {
      const doc = yaml.load(playersYAML);
      if (doc && doc.players && doc.players.length > 0) {
        setPlayers(doc.players.map(p => ({
          id: p.id,
          username: p.username && p.username.trim() ? p.username : "Username",
          value: "1",
          locked: false
        })));
      } else {
        // Fallback to default two players
        setPlayers([
          { id: 1, username: "Player1", value: "1", locked: false },
          { id: 2, username: "Player2", value: "1", locked: false }
        ]);
      }
    } catch (e) {
      console.error("Failed to load YAML", e);
      // Fallback to default two players
      setPlayers([
        { id: 1, username: "Player1", value: "1", locked: false },
        { id: 2, username: "Player2", value: "1", locked: false }
      ]);
    }
  }, []);

  // Card helpers
  const getCardName = (value) => {
    const names = { 1: "ace", 11: "jack", 12: "queen", 13: "king" };
    return names[value] || value;
  };

  const cardSpades = (value) => `PNG-cards-1.3/${getCardName(value)}_of_spades.png`;
  const cardClubs = (value) => `PNG-cards-1.3/${getCardName(value)}_of_clubs.png`;
  const cardDiamonds = (value) => `PNG-cards-1.3/${getCardName(value)}_of_diamonds.png`;
  const cardHearts = (value) => `PNG-cards-1.3/${getCardName(value)}_of_hearts.png`;

  const suitFunctions = [cardClubs, cardDiamonds, cardHearts, cardSpades];

  // AI Rolling Preview
  useEffect(() => {
    if (gameStarted) return;
    const rolling = setInterval(() => {
      const randomNum = Math.floor(Math.random() * 13) + 1;
      setAiPreview(cardSpades(randomNum));
    }, 100);
    return () => clearInterval(rolling);
  }, [gameStarted]);

  // Countdown
  useEffect(() => {
    if (timer < 0) {
      setGameStarted(true);
      setAiPreview("");
      goSound.play();
      return;
    }
    beepSound.currentTime = 0;
    beepSound.play();
    const interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Lock player
  const lockPlayer = (id) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, locked: true } : p));
  };

  // Update player value
  const updatePlayerValue = (id, value) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, value } : p));
  };

  // Check Winner
  useEffect(() => {
    if (!players.length) return;
    const allLocked = players.every(p => p.locked);
    if (!allLocked) return;

    const ai = rollNumber;
    let smallestDiff = Infinity;
    let winners = [];

    players.forEach(player => {
      const diff = Math.abs(Number(player.value) - ai);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        winners = [player.id];
      } else if (diff === smallestDiff) {
        winners.push(player.id);
      }
    });

    if (winners.length === 1) {
      const winner = players.find(p => p.id === winners[0]);
      setOutcome(`${winner.username} wins 🎉`);
    } else {
      const winnerNames = winners.map(id => players.find(p => p.id === id).username);
      setOutcome(`It's a tie between ${winnerNames.join(", ")}!`);
    }
  }, [players, rollNumber]);

  return (
    <div className="guessing-card-page">
      <h1 className="title">Guessing Card</h1>

      <div>{timer >= 0 ? <h2>{timer === 0 ? "Go!" : `${timer} Seconds`}</h2> : <h2>Choose your cards!</h2>}</div>

      <div className="card-row">
        {players.map((player, index) => (
          <div className="card" key={player.id}>
            <p>{player.username}</p>
            <img src={suitFunctions[index](player.value)} alt={player.username} />
          </div>
        ))}

        {/* AI Card */}
        <div className="card">
          <p>AI Card</p>
          {!gameStarted ? <img src={aiPreview} alt="AI preview" /> : players.every(p => p.locked) ? <img src={cardSpades(rollNumber)} alt="AI final" /> : <img src="" alt="AI hidden" />}
        </div>
      </div>

      {/* Controls */}
      {players.map(player => (
        <div key={player.id} style={{ marginTop: 20 }}>
          <p>{player.username}</p>
          <div className="player-controls">
            <select disabled={!gameStarted || player.locked} value={player.value} onChange={e => updatePlayerValue(player.id, e.target.value)}>
              {[...Array(13)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1 === 1 ? "A" : i + 1 === 11 ? "J" : i + 1 === 12 ? "Q" : i + 1 === 13 ? "K" : i + 1}
                </option>
              ))}
            </select>
            <button disabled={!gameStarted || player.locked} onClick={() => lockPlayer(player.id)}>
              Lock {player.username}
            </button>
          </div>
        </div>
      ))}

      <h2 style={{ marginTop: 30 }}>{outcome}</h2>
    </div>
  );
}