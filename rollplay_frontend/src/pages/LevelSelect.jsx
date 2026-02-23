// src/pages/LevelSelect.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GAME_LIST } from "../GameList";
import { useGame } from "../GameContext";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:3000"
).replace(/\/$/, "");

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

  const MAX_ROUNDS = maxRounds ?? 3;
  const chosenIds = localSelections.map((s) => s.level.id);
  const allRoundsChosen = localSelections.length >= MAX_ROUNDS;

  // --------------------------------------------------------
  // JOINED PLAYERS: Poll backend session to know when
  // host has started Round 1, then go to /arena.
  // --------------------------------------------------------
  useEffect(() => {
    if (isHost) return; // host navigates directly on click

    const code = sessionCode || localStorage.getItem("session_code");
    if (!code) {
      console.warn("[JOIN POLL] No sessionCode found, not polling.");
      return;
    }

    let cancelled = false;

    async function poll() {
      const token = localStorage.getItem("access_token");
      const headers = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      try {
        const res = await fetch(`${API_BASE}/sessions/${code}`, { headers });
        const data = await res.json();

        if (!res.ok) {
          console.warn(
            "LevelSelect session poll error:",
            res.status,
            data.error
          );
        } else if (data.session) {
          console.log("[JOIN POLL] session:", data.session);
          const currentRound = data.session.current_round ?? null;
          console.log("[JOIN POLL] current_round:", currentRound);

          if (currentRound === 1) {
            console.log(
              "[JOIN POLL] Round 1 started → navigate('/arena')"
            );
            navigate("/arena");
            return;
          }
        }
      } catch (err) {
        console.error("LevelSelect session poll failed:", err);
      }

      if (!cancelled) {
        setTimeout(poll, 2000);
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [isHost, sessionCode, navigate]);

  // --------------------------------------------------------
  // HOST ONLY — Pick Level
  // --------------------------------------------------------
  function chooseLevel(level) {
    if (!isHost) return;
    if (isSpinning) return;

    const newSet = [...localSelections];

    const existing = newSet.find((e) => e.round === round);
    if (existing) {
      existing.level = level;
    } else {
      newSet.push({ round, level });
    }

    const sorted = newSet.sort((a, b) => a.round - b.round);

    setLocalSelections(sorted);
    setSelectedLevels(sorted);

    if (round < MAX_ROUNDS) setRound(round + 1);
  }

  // --------------------------------------------------------
  // HOST ONLY — Random spin
  // --------------------------------------------------------
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

  // --------------------------------------------------------
  // HOST ONLY — Start Round 1
  // --------------------------------------------------------
  async function handleStartRoundOne() {
    if (!isHost) return;

    const round1 = localSelections.find((s) => s.round === 1);
    if (!round1) {
      alert("Pick a level for Round 1");
      return;
    }

    setSelectedLevels(localSelections);
    setRound(1);

    const code = sessionCode || localStorage.getItem("session_code");

    if (code) {
      try {
        const token = localStorage.getItem("access_token");
        const headers = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const res = await fetch(
          `${API_BASE}/sessions/${code}/start-round`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ round_number: 1 }),
          }
        );

        const data = await res.json();
        if (!res.ok) {
          console.error(
            "[HOST] Failed to mark round start:",
            res.status,
            data.error
          );
        } else {
          console.log("[HOST] Round 1 started on backend:", data);
        }
      } catch (err) {
        console.error("Error calling /start-round:", err);
      }
    }

    // Host jumps to Arena immediately
    navigate("/arena");
  }

  // --------------------------------------------------------
  // RENDER
  // --------------------------------------------------------
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
              !isHost || // joined players are spectators
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
              const entry = localSelections.find(
                (r) => r.round === i + 1
              );

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
              Host is choosing levels… you&apos;ll play them in this order.
              When Round 1 starts, you&apos;ll be taken into the Arena.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}