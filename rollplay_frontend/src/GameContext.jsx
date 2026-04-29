// src/GameContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import { GAME_CATALOGUE } from "./GameList";

const GameContext = createContext(null);

const defaultBase =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://comp2003-ars.onrender.com";

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  defaultBase
).replace(/\/$/, "");

/* -----------------------------
   GAME LOCKS
----------------------------- */

function buildDefaultGameLocks() {
  return Object.fromEntries(
    GAME_CATALOGUE.map((game) => [game.id, game.defaultEnabled !== false])
  );
}

/* -----------------------------
   PROVIDER
----------------------------- */

export function GameProvider({ children }) {
  const [players, setPlayers] = useState([]);
  const [totalCost, setTotalCost] = useState(0);
  const [rule, setRule] = useState("winner_free");
  const [results, setResults] = useState(null);

  const [sessionId, setSessionId] = useState(null);
  const [sessionCode, setSessionCode] = useState(null);
  const [isHost, setIsHost] = useState(false);

  const [round, setRound] = useState(1);
  const [maxRounds] = useState(3);
  const [selectedLevels, setSelectedLevels] = useState([]);

  const [profile, setProfile] = useState(null);

  /* -----------------------------
     💰 CREDITS SYSTEM
  ----------------------------- */

  const creditsBalance =
    Number(profile?.creditsBalance ?? profile?.credits_balance ?? 0) || 0;

  function updateCredits(newAmount) {
    setProfile((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        creditsBalance: newAmount,
        credits_balance: newAmount,
      };
    });
  }

  function adjustCredits(delta) {
    setProfile((prev) => {
      if (!prev) return prev;

      const next = Number(prev.creditsBalance ?? prev.credits_balance ?? 0) + delta;

      return {
        ...prev,
        creditsBalance: next,
        credits_balance: next,
      };
    });
  }

  /* -----------------------------
     SPLIT SYSTEM
  ----------------------------- */

  const [splitMode, setSplitMode] = useState("items");
  const [sessionPot, setSessionPot] = useState(0);
  const [sessionItems, setSessionItems] = useState([]);
  const [paymentRequired, setPaymentRequired] = useState(true);

  const [confirmedSplit, setConfirmedSplit] = useState(null);

  /* -----------------------------
     GAME LOCKS
  ----------------------------- */

  const [gameLocks, setGameLocks] = useState(buildDefaultGameLocks());
  const [gameLocksLoading, setGameLocksLoading] = useState(false);

  const loadGameLocks = useCallback(async () => {
    setGameLocksLoading(true);

    try {
      const { data, error } = await supabase
        .from("game_locks")
        .select("game_id, enabled");

      if (error) throw error;

      const nextLocks = buildDefaultGameLocks();

      for (const row of data || []) {
        nextLocks[row.game_id] = Boolean(row.enabled);
      }

      setGameLocks(nextLocks);
    } catch (err) {
      console.error("Failed to load game locks:", err);
      setGameLocks(buildDefaultGameLocks());
    } finally {
      setGameLocksLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGameLocks();
  }, [loadGameLocks]);

  async function toggleGameEnabled(gameId) {
    if (!profile?.isAdmin) {
      throw new Error("Only admins can update game availability.");
    }

    const current = gameLocks[gameId] !== false;
    const nextEnabled = !current;

    setGameLocks((prev) => ({
      ...prev,
      [gameId]: nextEnabled,
    }));

    const { error } = await supabase.from("game_locks").upsert({
      game_id: gameId,
      enabled: nextEnabled,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setGameLocks((prev) => ({
        ...prev,
        [gameId]: current,
      }));
      throw error;
    }

    return nextEnabled;
  }

  function isGameEnabled(gameId) {
    return gameLocks[gameId] !== false;
  }

  /* -----------------------------
     LOCAL STORAGE RESTORE
  ----------------------------- */

  useEffect(() => {
    const storedCode = localStorage.getItem("session_code");
    const storedId = localStorage.getItem("session_id");
    const storedIsHost = localStorage.getItem("session_is_host");

    const storedSplitMode = localStorage.getItem("split_mode");
    const storedSessionPot = localStorage.getItem("session_pot");
    const storedSessionItems = localStorage.getItem("session_items");
    const storedPaymentRequired = localStorage.getItem("payment_required");
    const storedConfirmedSplit = localStorage.getItem("confirmed_split");

    if (storedCode) setSessionCode(storedCode);
    if (storedId) setSessionId(storedId);
    if (storedIsHost !== null) setIsHost(storedIsHost === "true");

    if (storedSplitMode) setSplitMode(storedSplitMode);

    if (storedSessionPot !== null && storedSessionPot !== "") {
      setSessionPot(Number(storedSessionPot) || 0);
    }

    if (storedSessionItems) {
      try {
        setSessionItems(JSON.parse(storedSessionItems));
      } catch {
        setSessionItems([]);
      }
    }

    if (storedPaymentRequired !== null) {
      setPaymentRequired(storedPaymentRequired === "true");
    }

    if (storedConfirmedSplit) {
      try {
        setConfirmedSplit(JSON.parse(storedConfirmedSplit));
      } catch {
        setConfirmedSplit(null);
      }
    }
  }, []);

  /* -----------------------------
     BACKEND SYNC
  ----------------------------- */

  useEffect(() => {
    async function loadConfirmedSplitFromBackend() {
      const code = sessionCode || localStorage.getItem("session_code");
      if (!code) return;

      try {
        const res = await fetch(`${API_BASE}/sessions/${code}/confirmed-split`);
        const data = await res.json().catch(() => null);

        if (!res.ok) return;
        if (!data?.confirmedSplit) return;

        setConfirmedSplit(data.confirmedSplit);
        localStorage.setItem(
          "confirmed_split",
          JSON.stringify(data.confirmedSplit)
        );
      } catch (err) {
        console.error("Failed to load confirmed split:", err);
      }
    }

    loadConfirmedSplitFromBackend();
  }, [sessionCode]);

  /* -----------------------------
     SESSION CONTROL
  ----------------------------- */

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

  function clearSessionInfo() {
    setSessionId(null);
    setSessionCode(null);
    setIsHost(false);

    localStorage.removeItem("session_id");
    localStorage.removeItem("session_code");
    localStorage.removeItem("session_is_host");
  }

  /* -----------------------------
     SPLIT CONTROL
  ----------------------------- */

  function setSplitSetup({
    splitMode,
    sessionPot,
    sessionItems,
    paymentRequired,
  }) {
    if (splitMode !== undefined) {
      setSplitMode(splitMode);
      localStorage.setItem("split_mode", splitMode);
    }

    if (sessionPot !== undefined) {
      const pot = Number(sessionPot) || 0;
      setSessionPot(pot);
      localStorage.setItem("session_pot", String(pot));
    }

    if (sessionItems !== undefined) {
      setSessionItems(sessionItems);
      localStorage.setItem("session_items", JSON.stringify(sessionItems));
    }

    if (paymentRequired !== undefined) {
      setPaymentRequired(!!paymentRequired);
      localStorage.setItem(
        "payment_required",
        paymentRequired ? "true" : "false"
      );
    }
  }

  function clearSplitSetup() {
    setSplitMode("items");
    setSessionPot(0);
    setSessionItems([]);
    setPaymentRequired(true);

    localStorage.removeItem("split_mode");
    localStorage.removeItem("session_pot");
    localStorage.removeItem("session_items");
    localStorage.removeItem("payment_required");
  }

  function saveConfirmedSplit(split) {
    setConfirmedSplit(split);
    localStorage.setItem("confirmed_split", JSON.stringify(split));
  }

  function clearConfirmedSplit() {
    setConfirmedSplit(null);
    localStorage.removeItem("confirmed_split");
  }

  /* -----------------------------
     FINAL VALUE
  ----------------------------- */

  const games = GAME_CATALOGUE.map((game) => ({
    ...game,
    enabled: gameLocks[game.id] !== false,
  }));

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
    clearSessionInfo,

    round,
    maxRounds,
    setRound,

    selectedLevels,
    setSelectedLevels,

    profile,
    setProfile,

    /* 💰 credits */
    creditsBalance,
    updateCredits,
    adjustCredits,

    splitMode,
    setSplitMode,
    sessionPot,
    setSessionPot,
    sessionItems,
    setSessionItems,
    paymentRequired,
    setPaymentRequired,
    setSplitSetup,
    clearSplitSetup,

    confirmedSplit,
    saveConfirmedSplit,
    clearConfirmedSplit,

    games,
    gameLocks,
    gameLocksLoading,
    loadGameLocks,
    toggleGameEnabled,
    isGameEnabled,

    canHost: profile?.canHost ?? false,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}