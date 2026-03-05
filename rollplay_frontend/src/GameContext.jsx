// src/GameContext.jsx
import { createContext, useContext, useState, useEffect } from "react";

const GameContext = createContext(null);

export function GameProvider({ children }) {
  // Bill / randomizer stuff
  const [players, setPlayers] = useState([]);
  const [totalCost, setTotalCost] = useState(0);
  const [rule, setRule] = useState("winner_free");
  const [results, setResults] = useState(null);

  // Session info
  const [sessionId, setSessionId] = useState(null);
  const [sessionCode, setSessionCode] = useState(null);
  const [isHost, setIsHost] = useState(false);

  // Rounds / levels
  const [round, setRound] = useState(1);
  const [maxRounds] = useState(3);
  const [selectedLevels, setSelectedLevels] = useState([]);

  // User profile (auth)
  const [profile, setProfile] = useState(null);

  // Restore session from localStorage
  useEffect(() => {
    const storedCode = localStorage.getItem("session_code");
    const storedId = localStorage.getItem("session_id");
    const storedIsHost = localStorage.getItem("session_is_host");

    if (storedCode) setSessionCode(storedCode);
    if (storedId) setSessionId(storedId);
    if (storedIsHost !== null) setIsHost(storedIsHost === "true");
  }, []);

  function setSessionInfo({ sessionId, sessionCode, isHost }) {
    if (sessionId !== undefined) {
      setSessionId(sessionId);
      localStorage.setItem("session_id", sessionId);
    }
    if (sessionCode !== undefined) {
      setSessionCode(sessionCode);
      localStorage.setItem("session_code", sessionCode);
    }
    if (isHost !== undefined) {
      setIsHost(!!isHost);
      localStorage.setItem("session_is_host", isHost ? "true" : "false");
    }
  }

  const value = {
    players,
    setPlayers,
    totalCost,
    setTotalCost,
    rule,
    setRule,
    results,
    setResults,

    sessionId,
    sessionCode,
    isHost,
    setSessionInfo,

    round,
    maxRounds,
    setRound,

    selectedLevels,
    setSelectedLevels,

    profile,
    setProfile,

    // handy flag for UI:
    canHost: profile?.canHost ?? false,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}
