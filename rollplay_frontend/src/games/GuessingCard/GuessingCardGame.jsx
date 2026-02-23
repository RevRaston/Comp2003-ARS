// src/games/GuessingCard/GuessingCardGame.jsx
import { useEffect, useState } from "react";
import { useGame } from "../../GameContext";
import { supabase } from "../../supabase";
import "./GuessingCard.css";

// Simple helper for card labels
function labelForValue(v) {
  const names = { 1: "A", 11: "J", 12: "Q", 13: "K" };
  return names[v] || String(v);
}

export default function GuessingCardGame() {
  const { isHost, sessionId, players: ctxPlayers = [] } = useGame();

  const [state, setState] = useState({
    type: "guessing_card", // so clients can sanity-check
    phase: "countdown", // "countdown" → "picking" → "reveal"
    timer: 3, // 3-second pre-roll
    aiCard: null,
    players: [], // { id, name, guess, locked, distance }
    outcome: "",
  });

  // -------- Initialise players from session --------
  useEffect(() => {
    if (!ctxPlayers.length) return;

    setState((prev) => {
      // only initialise once
      if (prev.players.length) return prev;

      const mapped = ctxPlayers.slice(0, 4).map((p, idx) => ({
        id: p.id || idx + 1,
        name: p.name || p.display_name || `Player ${idx + 1}`,
        guess: 1,
        locked: false,
        distance: null,
      }));

      return { ...prev, players: mapped };
    });
  }, [ctxPlayers]);

  // -------- Host: countdown phase (3..2..1..Go) --------
  useEffect(() => {
    if (!sessionId || !isHost) return;
    if (!state.players.length) return;
    if (state.phase !== "countdown") return;

    if (state.timer < 0) {
      // Move into picking phase
      setState((prev) => ({
        ...prev,
        phase: "picking",
        timer: 20, // 20s to choose
        aiCard: Math.floor(Math.random() * 13) + 1,
      }));
      return;
    }

    const id = setTimeout(() => {
      setState((prev) => ({ ...prev, timer: prev.timer - 1 }));
    }, 1000);

    return () => clearTimeout(id);
  }, [state.phase, state.timer, state.players.length, isHost, sessionId]);

  // -------- Host: picking phase (players choose; timer ticks) --------
  useEffect(() => {
    if (!sessionId || !isHost) return;
    if (state.phase !== "picking") return;
    if (!state.players.length) return;

    const allLocked = state.players.every((p) => p.locked);

    if (state.timer <= 0 || allLocked) {
      // Time up or everyone locked → score it
      const ai = state.aiCard ?? Math.floor(Math.random() * 13) + 1;

      let bestDist = Infinity;
      let winners = [];

      const playersWithDist = state.players.map((p) => {
        const dist = Math.abs((p.guess || 1) - ai);
        if (dist < bestDist) {
          bestDist = dist;
          winners = [p];
        } else if (dist === bestDist) {
          winners.push(p);
        }
        return { ...p, distance: dist };
      });

      let outcome;
      if (winners.length === 1) {
        outcome = `${winners[0].name} wins 🎉`;
      } else {
        const names = winners.map((w) => w.name).join(", ");
        outcome = `It's a tie between ${names}!`;
      }

      setState((prev) => ({
        ...prev,
        phase: "reveal",
        timer: 0,
        aiCard: ai,
        players: playersWithDist,
        outcome,
      }));
      return;
    }

    const id = setTimeout(() => {
      setState((prev) => ({ ...prev, timer: prev.timer - 1 }));
    }, 1000);

    return () => clearTimeout(id);
  }, [state.phase, state.timer, state.players, state.aiCard, isHost, sessionId]);

  // -------- Host → Supabase sync --------
  useEffect(() => {
    if (!sessionId || !isHost) return;

    async function sync() {
      try {
        await supabase
          .from("session_game_state")
          .update({
            game_state: state,
            updated_at: new Date(),
          })
          .eq("session_id", sessionId);
      } catch (err) {
        console.error("Error syncing guessing card state:", err);
      }
    }

    sync();
  }, [state, isHost, sessionId]);

  // -------- Clients: poll Supabase --------
  useEffect(() => {
    if (!sessionId || isHost) return;

    const id = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from("session_game_state")
          .select("game_state")
          .eq("session_id", sessionId)
          .single();

        if (error) return;
        if (!data?.game_state) return;
        if (data.game_state.type !== "guessing_card") return;

        setState(data.game_state);
      } catch (err) {
        console.error("Error polling guessing card state:", err);
      }
    }, 200);

    return () => clearInterval(id);
  }, [sessionId, isHost]);

  // -------- Host controls: change guess / lock --------
  function handleGuessChange(id, value) {
    if (!isHost) return;
    const num = Number(value) || 1;

    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === id ? { ...p, guess: num } : p
      ),
    }));
  }

  function handleLock(id) {
    if (!isHost) return;

    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === id ? { ...p, locked: true } : p
      ),
    }));
  }

  // -------- UI helpers --------
  let heading;
  if (state.phase === "countdown") {
    heading =
      state.timer > 0 ? `${state.timer}…` : "Go!";
  } else if (state.phase === "picking") {
    heading = `Pick your card (${state.timer}s)`;
  } else {
    heading = "Results";
  }

  if (!sessionId) {
    return (
      <div className="guessing-card-page">
        <h1 className="title">Guessing Card</h1>
        <p style={{ color: "white", marginTop: 40 }}>
          No session active. Go back to the lobby and start a game.
        </p>
      </div>
    );
  }

  return (
    <div className="guessing-card-page">
      <h1 className="title">Guessing Card</h1>
      <h2 className="subtitle">{heading}</h2>

      <div className="card-row">
        {state.players.map((player) => (
          <div className="card" key={player.id}>
            <p>{player.name}</p>
            <div className="card-face">
              {labelForValue(player.guess)}
            </div>
            {state.phase === "reveal" && (
              <p className="distance">Δ {player.distance}</p>
            )}
          </div>
        ))}

        {/* AI card */}
        <div className="card">
          <p>AI Card</p>
          <div className="card-face">
            {state.phase === "reveal" && state.aiCard
              ? labelForValue(state.aiCard)
              : "?"}
          </div>
        </div>
      </div>

      {/* Controls (host only, but everyone can see them) */}
      <div className="controls">
        {state.players.map((player) => (
          <div key={player.id} className="player-controls">
            <span>{player.name}</span>
            <select
              disabled={
                !isHost ||
                player.locked ||
                state.phase !== "picking"
              }
              value={player.guess}
              onChange={(e) =>
                handleGuessChange(player.id, e.target.value)
              }
            >
              {Array.from({ length: 13 }).map((_, i) => {
                const v = i + 1;
                return (
                  <option key={v} value={v}>
                    {labelForValue(v)}
                  </option>
                );
              })}
            </select>
            <button
              disabled={
                !isHost ||
                player.locked ||
                state.phase !== "picking"
              }
              onClick={() => handleLock(player.id)}
            >
              {player.locked ? "Locked" : "Lock"}
            </button>
          </div>
        ))}
      </div>

      {state.outcome && (
        <h2 className="outcome">{state.outcome}</h2>
      )}
    </div>
  );
}