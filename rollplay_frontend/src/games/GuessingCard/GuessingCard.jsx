// src/games/GuessingCard/GuessingCard.jsx
import { useEffect, useState, useRef } from "react";
import { useGame } from "../../GameContext";
import { supabase } from "../../supabase";
import "./GuessingCard.css";

/**
 * Guessing Card (host-driven MVP)
 *
 * - Uses real session players from GameContext (up to 4).
 * - Host controls the countdown and guesses; other clients just spectate.
 * - Host writes state into session_game_state; others poll and mirror it.
 */
export default function GuessingCard() {
  const { isHost, sessionId, players: sessionPlayers } = useGame();

  const [timer, setTimer] = useState(3);
  const [gameStarted, setGameStarted] = useState(false);
  const [rollNumber, setRollNumber] = useState(
    () => Math.floor(Math.random() * 13) + 1
  );

  const [players, setPlayers] = useState([]);
  const [aiPreview, setAiPreview] = useState("");
  const [outcome, setOutcome] = useState("");

  // simple audio hooks – we only play these on the host
  const beepRef = useRef(null);
  const goRef = useRef(null);

  useEffect(() => {
    beepRef.current = new Audio("/beep.mp3");
    goRef.current = new Audio("/go.mp3");
  }, []);

  // ---------- Helpers for card image paths ----------

  const getCardName = (value) => {
    const names = { 1: "ace", 11: "jack", 12: "queen", 13: "king" };
    return names[value] || value;
  };

  const cardSpades = (value) =>
    `/PNG-cards-1.3/${getCardName(value)}_of_spades.png`;
  const cardClubs = (value) =>
    `/PNG-cards-1.3/${getCardName(value)}_of_clubs.png`;
  const cardDiamonds = (value) =>
    `/PNG-cards-1.3/${getCardName(value)}_of_diamonds.png`;
  const cardHearts = (value) =>
    `/PNG-cards-1.3/${getCardName(value)}_of_hearts.png`;

  const suitFunctions = [cardClubs, cardDiamonds, cardHearts, cardSpades];

  // ---------- Initialise player list from sessionPlayers (HOST) ----------

  useEffect(() => {
    if (!isHost) return;
    if (!sessionPlayers || sessionPlayers.length === 0) return;

    // Use up to 4 players that are in the session
    const mapped = sessionPlayers.slice(0, 4).map((p, index) => ({
      id: p.id ?? index + 1,
      username:
        p.display_name || p.name || p.username || `Player ${index + 1}`,
      value: "1",
      locked: false,
    }));

    setPlayers(mapped);
  }, [isHost, sessionPlayers]);

  // ---------- AI rolling preview (HOST only) ----------

  useEffect(() => {
    if (!isHost) return;
    if (gameStarted) return;

    const rolling = setInterval(() => {
      const randomNum = Math.floor(Math.random() * 13) + 1;
      setAiPreview(cardSpades(randomNum));
    }, 100);

    return () => clearInterval(rolling);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, gameStarted]);

  // ---------- Countdown (HOST only) ----------

  useEffect(() => {
    if (!isHost) return;

    if (timer < 0) {
      if (!gameStarted) {
        setGameStarted(true);
        setAiPreview("");
        goRef.current?.play();
      }
      return;
    }

    // beep each second
    beepRef.current && (beepRef.current.currentTime = 0);
    beepRef.current?.play();

    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timer, isHost, gameStarted]);

  // ---------- Lock / update helpers (HOST only) ----------

  const lockPlayer = (id) => {
    if (!isHost) return;
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, locked: true } : p))
    );
  };

  const updatePlayerValue = (id, value) => {
    if (!isHost) return;
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, value } : p))
    );
  };

  // ---------- Host computes winner once all locked ----------

  useEffect(() => {
    if (!isHost) return;
    if (!players.length) return;
    if (!gameStarted) return;

    const allLocked = players.every((p) => p.locked);
    if (!allLocked) return;

    const ai = rollNumber;
    let smallestDiff = Infinity;
    let winners = [];

    players.forEach((player) => {
      const diff = Math.abs(Number(player.value) - ai);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        winners = [player.id];
      } else if (diff === smallestDiff) {
        winners.push(player.id);
      }
    });

    if (winners.length === 1) {
      const winner = players.find((p) => p.id === winners[0]);
      setOutcome(`${winner?.username || "Someone"} wins 🎉`);
    } else {
      const winnerNames = winners
        .map((id) => players.find((p) => p.id === id)?.username || "Player")
        .join(", ");
      setOutcome(`It's a tie between ${winnerNames}!`);
    }
  }, [players, rollNumber, isHost, gameStarted]);

  // ---------- HOST: sync state to Supabase ----------

  useEffect(() => {
    if (!sessionId || !isHost) return;

    const syncState = async () => {
      try {
        await supabase
          .from("session_game_state")
          .update({
            game_state: {
              game: "guessing_card",
              timer,
              gameStarted,
              rollNumber,
              players,
              aiPreview,
              outcome,
            },
            updated_at: new Date(),
          })
          .eq("session_id", sessionId);
      } catch (err) {
        console.error("Error syncing GuessingCard state:", err);
      }
    };

    syncState();
  }, [
    sessionId,
    isHost,
    timer,
    gameStarted,
    rollNumber,
    players,
    aiPreview,
    outcome,
  ]);

  // ---------- NON-HOSTS: poll state & mirror host ----------

  useEffect(() => {
    if (!sessionId || isHost) return;

    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from("session_game_state")
          .select("game_state")
          .eq("session_id", sessionId)
          .single();

        if (error) return;
        if (!data?.game_state) return;
        const s = data.game_state;
        if (s.game !== "guessing_card") return;

        setTimer(s.timer ?? 3);
        setGameStarted(Boolean(s.gameStarted));
        setRollNumber(s.rollNumber ?? 1);
        setPlayers(s.players || []);
        setAiPreview(s.aiPreview || "");
        setOutcome(s.outcome || "");
      } catch (err) {
        console.error("Error polling GuessingCard state:", err);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [sessionId, isHost]);

  // ---------- Render ----------

  const allLocked = players.length > 0 && players.every((p) => p.locked);

  return (
    <div className="guessing-card-page">
      <h1 className="title">Guessing Card</h1>

      <div>
        {timer >= 0 ? (
          <h2>{timer === 0 ? "Go!" : `${timer} Seconds`}</h2>
        ) : (
          <h2>Choose your cards!</h2>
        )}
      </div>

      <div className="card-row">
        {players.map((player, index) => {
          const suitFn = suitFunctions[index % suitFunctions.length];
          return (
            <div className="card" key={player.id}>
              <p>{player.username}</p>
              <img
                src={suitFn(player.value)}
                alt={player.username}
                className="card-img"
              />
            </div>
          );
        })}

        {/* AI Card */}
        <div className="card">
          <p>AI Card</p>
          {!gameStarted ? (
            aiPreview ? (
              <img src={aiPreview} alt="AI preview" className="card-img" />
            ) : (
              <div className="card-placeholder" />
            )
          ) : allLocked ? (
            <img
              src={cardSpades(rollNumber)}
              alt="AI final"
              className="card-img"
            />
          ) : (
            <div className="card-placeholder" />
          )}
        </div>
      </div>

      {/* Controls (host only; disabled on others) */}
      {players.map((player) => (
        <div key={player.id} style={{ marginTop: 20 }}>
          <p>{player.username}</p>
          <div className="player-controls">
            <select
              disabled={!isHost || !gameStarted || player.locked}
              value={player.value}
              onChange={(e) => updatePlayerValue(player.id, e.target.value)}
            >
              {[...Array(13)].map((_, i) => {
                const v = i + 1;
                const label =
                  v === 1 ? "A" : v === 11 ? "J" : v === 12 ? "Q" : v === 13 ? "K" : v;
                return (
                  <option key={v} value={v}>
                    {label}
                  </option>
                );
              })}
            </select>
            <button
              disabled={!isHost || !gameStarted || player.locked}
              onClick={() => lockPlayer(player.id)}
            >
              Lock {player.username}
            </button>
          </div>
        </div>
      ))}

      <h2 style={{ marginTop: 30 }}>{outcome}</h2>
      {!isHost && (
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          Host is choosing cards for everyone – you&apos;re spectating this MVP
          version.
        </p>
      )}
    </div>
  );
}