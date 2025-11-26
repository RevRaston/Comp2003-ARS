import { createContext, useContext, useState } from "react";

const GameContext = createContext(null);

export function GameProvider({ children }) {
  // Local game state
  const [players, setPlayers] = useState([]);
  const [totalCost, setTotalCost] = useState(0);
  const [rule, setRule] = useState("winner_free");
  const [results, setResults] = useState(null);

  // Lobby session state
  const [sessionId, setSessionId] = useState(null);
  const [sessionCode, setSessionCode] = useState(null);
  const [isHost, setIsHost] = useState(false);

  function setupGame({ players, totalCost, rule }) {
    setPlayers(players);
    setTotalCost(totalCost);
    setRule(rule);
    setResults(null);
  }

  function setSessionInfo({ sessionId, sessionCode, isHost }) {
    setSessionId(sessionId ?? null);
    setSessionCode(sessionCode ?? null);
    setIsHost(!!isHost);
  }

  const value = {
    players,
    totalCost,
    rule,
    results,
    setupGame,
    setResults,
    sessionId,
    sessionCode,
    isHost,
    setSessionInfo,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGame must be used inside a GameProvider");
  }
  return ctx;
}
