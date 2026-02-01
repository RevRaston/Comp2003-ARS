// src/pages/LevelSelect.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GAME_LIST } from "../GameList";
import { useGame } from "../GameContext";

export default function LevelSelect() {
  const navigate = useNavigate();

  const {
    sessionCode,
    isHost,
    round,
    setRound,
    maxRounds,
    selectedLevels,
    setSelectedLevels,
  } = useGame();

  const [localSelections, setLocalSelections] = useState(selectedLevels || []);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [serverLevels, setServerLevels] = useState([]);

  const MAX_ROUNDS = maxRounds ?? 3;
  const chosenIds = localSelections.map((s) => s.level.id);

  const allRoundsChosen = localSelections.length >= MAX_ROUNDS;

  /* ----------------------------------------------------
     FETCH LEVELS FROM SERVER (for joined players)
  ---------------------------------------------------- */
  async function fetchServerLevels() {
    if (!sessionCode) return;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/sessions/${sessionCode}/levels`
      );

      const data = await res.json();
      if (!data?.levels) return;

      setServerLevels(data.levels);

      // Convert server rows -> frontend selection format
      const converted = data.levels.map((row) => {
        const levelObj = GAME_LIST.find((g) => g.id === row.level_key);
        return {
          round: row.round_number,
          level: levelObj,
        };
      });

      setLocalSelections(converted);
      setSelectedLevels(converted);

      // If host started game → joined player must navigate
      const round1 = converted.find((r) => r.round === 1);
      if (round1) {
        navigate(`/game/${round1.level.id}`);
      }
    } catch (err) {
      console.error("Failed to load levels:", err);
    }
  }

  /* ----------------------------------------------------
     JOINED PLAYER: Poll every 1s for updates
  ---------------------------------------------------- */
  useEffect(() => {
    if (!isHost) {
      fetchServerLevels();
      const poll = setInterval(fetchServerLevels, 1000);
      return () => clearInterval(poll);
    }
  }, [isHost, sessionCode]);

  /* ----------------------------------------------------
     HOST: Save levels to backend
  ---------------------------------------------------- */
  async function saveLevelsToServer(updated) {
    if (!isHost || !sessionCode) return;

    for (const entry of updated) {
      await fetch(
        `${import.meta.env.VITE_API_URL}/sessions/${sessionCode}/levels`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            round_number: entry.round,
            level_key: entry.level.id,
          }),
        }
      );
    }
  }

  /* ----------------------------------------------------
     HOST ONLY — Pick Level
  ---------------------------------------------------- */
  function chooseLevel(level) {
    if (!isHost) return;
    if (isSpinning) return;

    const newSet = [...localSelections];

    const existing = newSet.find((e) => e.round === round);
    if (existing) {
      // replace
      existing.level = level;
    } else {
      newSet.push({ round, level });
    }

    const sorted = newSet.sort((a, b) => a.round - b.round);

    setLocalSelections(sorted);
    setSelectedLevels(sorted);

    saveLevelsToServer(sorted);

    if (round < MAX_ROUNDS) setRound(round + 1);
  }

  /* ----------------------------------------------------
     HOST ONLY — Random spin
  ---------------------------------------------------- */
  function handleRandomSpin() {
    if (!isHost) return;
    if (isSpinning || allRoundsChosen) return;

    const available = GAME_LIST.filter((g) => !chosenIds.includes(g.id));
    if (!available.length) return;

    setIsSpinning(true);

    let i = 0;
    const spinInterval = setInterval(() => {
      setHighlightIndex(i % GAME_LIST.length);
      i++;
    }, 80);

    setTimeout(() => {
      clearInterval(spinInterval);

      const randomLevel =
        available[Math.floor(Math.random() * available.length)];

      const finalIndex = GAME_LIST.findIndex(
        (g) => g.id === randomLevel.id
      );
      setHighlightIndex(finalIndex);

      chooseLevel(randomLevel);
      setIsSpinning(false);
    }, 2000);
  }

  /* ----------------------------------------------------
     HOST ONLY — Start Round 1
  ---------------------------------------------------- */
  function handleStartRoundOne() {
    if (!isHost) return;

    const round1 = localSelections.find((s) => s.round === 1);
    if (!round1) {
      alert("Pick a level for Round 1");
      return;
    }

    setSelectedLevels(localSelections);
    saveLevelsToServer(localSelections);

    navigate(`/game/${round1.level.id}`);
  }

  /* ----------------------------------------------------
     RENDER
  ---------------------------------------------------- */
  return (
    <div className="page level-select-page">
      <h1 className="page-title">Choose Levels</h1>

      <p className="page-subtitle">
        Round {round}/{MAX_ROUNDS}
      </p>

      <div className="level-select-layout">
        {/* ---------------- GRID ---------------- */}
        <div className="level-grid">
          {GAME_LIST.map((game, idx) => {
            const isChosen = localSelections.find(
              (s) => s.level.id === game.id
            );

            const disabled =
              !isHost ||
              isSpinning ||
              isChosen ||
              allRoundsChosen;

            return (
              <button
                key={game.id}
                className={[
                  "level-card",
                  disabled ? "disabled" : "",
                  idx === highlightIndex && isSpinning
                    ? "level-card--highlight"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => chooseLevel(game)}
                disabled={disabled}
              >
                <div className="level-card-title">{game.name}</div>
                <div className="level-card-id">{game.id}</div>

                {isChosen && (
                  <div className="level-card-round-tag">
                    Round {isChosen.round}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* ---------------- SIDEBAR ---------------- */}
        <div className="level-sidebar">
          <h2>Round Plan</h2>
          <ol>
            {Array.from({ length: MAX_ROUNDS }).map((_, i) => {
              const entry = localSelections.find((r) => r.round === i + 1);

              return (
                <li key={i}>
                  <strong>Round {i + 1}:</strong>{" "}
                  {entry ? entry.level.name : "Not chosen"}
                </li>
              );
            })}
          </ol>

          {/* HOST ONLY BUTTONS */}
          {isHost && (
            <>
              <button
                className="primary-btn full-width"
                onClick={handleRandomSpin}
                disabled={isSpinning || allRoundsChosen}
              >
                {isSpinning ? "Spinning..." : "Spin Random"}
              </button>

              {allRoundsChosen && (
                <button
                  className="primary-btn full-width start-btn"
                  onClick={handleStartRoundOne}
                >
                  Start Round 1
                </button>
              )}
            </>
          )}

          {!isHost && (
            <p className="info-text">
              Waiting for host to select levels…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
