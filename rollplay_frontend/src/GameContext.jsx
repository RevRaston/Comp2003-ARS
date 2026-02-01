// src/GameContext.jsx
import { createContext, useContext, useState, useEffect } from "react";

const GameContext = createContext(null);

export function GameProvider({ children }) {
  // Bill / rules / results
  const [players, setPlayers] = useState([]);
  const [totalCost, setTotalCost] = useState(0);
  const [rule, setRule] = useState("winner_free"); // default rule
  const [results, setResults] = useState(null);

  // Session info
  const [sessionId, setSessionId] = useState(null);
  const [sessionCode, setSessionCode] = useState(null);
  const [isHost, setIsHost] = useState(false);

  // Rounds / levels
  const [round, setRound] = useState(1);
  const [maxRounds] = useState(3);
  const [selectedLevels, setSelectedLevels] = useState([]);

  // Restore session from localStorage on app load
  useEffect(() => {
    const storedCode = localStorage.getItem("session_code");
    const storedId = localStorage.getItem("session_id");
    const storedIsHost = localStorage.getItem("session_is_host");

    if (storedCode) setSessionCode(storedCode);
    if (storedId) setSessionId(storedId);
    if (storedIsHost !== null) setIsHost(storedIsHost === "true");
  }, []);

  // Store any new session info
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
    // money + rules
    players,
    setPlayers,
    totalCost,
    setTotalCost,
    rule,
    setRule,
    results,
    setResults,

    // sessions
    sessionId,
    sessionCode,
    isHost,
    setSessionInfo,

    // rounds / levels
    round,
    maxRounds,
    setRound,
    selectedLevels,
    setSelectedLevels,
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
