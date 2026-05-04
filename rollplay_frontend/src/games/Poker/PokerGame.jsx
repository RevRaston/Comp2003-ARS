import { useEffect, useMemo, useRef, useState } from "react";

const defaultWsBase =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "ws://localhost:3000/ws"
    : "wss://comp2003-ars.onrender.com/ws";

const WS_URL = (
  import.meta.env.VITE_WS_URL ||
  import.meta.env.VITE_BACKEND_WS_URL ||
  defaultWsBase
).replace(/\/$/, "");

const SUITS = ["♠", "♥", "♦", "♣"];
const VALS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RED = new Set(["♥", "♦"]);

const VALUE_RANK = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

function getPlayerKey(player, fallback = "") {
  if (!player) return fallback;
  return String(
    player.user_id ??
      player.userId ??
      player.id ??
      player.profile_id ??
      player.profileId ??
      fallback
  );
}

function makeSafePlayers(players) {
  const usable =
    Array.isArray(players) && players.length > 0
      ? players.slice(0, 4)
      : [{ id: "p1", name: "Player 1" }, { id: "p2", name: "Player 2" }];

  return usable.map((p, index) => ({
    id: getPlayerKey(p, `p${index + 1}`),
    name: p.display_name || p.name || `Player ${index + 1}`,
    hand: [],
    selected: [],
    drawn: false,
    result: null,
  }));
}

function buildDeck() {
  const deck = [];

  for (const suit of SUITS) {
    for (const value of VALS) {
      deck.push({ suit, value });
    }
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

function drawOne(deck) {
  if (!deck.length) return { card: null, deck: buildDeck() };
  return {
    card: deck[deck.length - 1],
    deck: deck.slice(0, -1),
  };
}

function evaluateHand(hand = []) {
  const ranks = hand
    .map((card) => VALUE_RANK[card.value])
    .sort((a, b) => b - a);

  const suits = hand.map((card) => card.suit);
  const counts = {};

  for (const rank of ranks) {
    counts[rank] = (counts[rank] || 0) + 1;
  }

  const countValues = Object.values(counts).sort((a, b) => b - a);
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);

  const isFlush = suits.every((suit) => suit === suits[0]);

  let straightRanks = [...uniqueRanks].sort((a, b) => b - a);
  let isStraight = false;
  let straightHigh = straightRanks[0] || 0;

  if (straightRanks.length === 5) {
    isStraight = straightRanks[0] - straightRanks[4] === 4;

    if (!isStraight && straightRanks.join(",") === "14,5,4,3,2") {
      isStraight = true;
      straightHigh = 5;
    }
  }

  const byCountThenRank = Object.entries(counts)
    .map(([rank, count]) => ({ rank: Number(rank), count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  let category = 0;
  let name = "High Card";
  let tiebreak = ranks;

  if (isStraight && isFlush) {
    category = 8;
    name = straightHigh === 14 ? "Royal Flush" : "Straight Flush";
    tiebreak = [straightHigh];
  } else if (countValues[0] === 4) {
    category = 7;
    name = "Four of a Kind";
    tiebreak = byCountThenRank.flatMap((x) => Array(x.count).fill(x.rank));
  } else if (countValues[0] === 3 && countValues[1] === 2) {
    category = 6;
    name = "Full House";
    tiebreak = byCountThenRank.flatMap((x) => Array(x.count).fill(x.rank));
  } else if (isFlush) {
    category = 5;
    name = "Flush";
    tiebreak = ranks;
  } else if (isStraight) {
    category = 4;
    name = "Straight";
    tiebreak = [straightHigh];
  } else if (countValues[0] === 3) {
    category = 3;
    name = "Three of a Kind";
    tiebreak = byCountThenRank.flatMap((x) => Array(x.count).fill(x.rank));
  } else if (countValues[0] === 2 && countValues[1] === 2) {
    category = 2;
    name = "Two Pair";
    tiebreak = byCountThenRank.flatMap((x) => Array(x.count).fill(x.rank));
  } else if (countValues[0] === 2) {
    category = 1;
    name = "Pair";
    tiebreak = byCountThenRank.flatMap((x) => Array(x.count).fill(x.rank));
  }

  const score =
    category * 1_000_000 +
    tiebreak.reduce((sum, rank, index) => sum + rank * Math.pow(15, 4 - index), 0);

  return { name, category, score };
}

export default function PokerGame({
  sessionCode,
  players = [],
  isHost = false,
  myUserId = null,
  onRoundComplete,
}) {
  const wsRef = useRef(null);
  const runningRef = useRef(false);
  const onRoundCompleteRef = useRef(onRoundComplete);
  const announcedRef = useRef(false);

  const code = sessionCode || localStorage.getItem("session_code") || "local";
  const localUserId = String(myUserId || localStorage.getItem("user_id") || "");

  const initialPlayers = useMemo(() => makeSafePlayers(players), [players]);

  const [connLine, setConnLine] = useState("disconnected");
  const [screen, setScreen] = useState("setup");
  const [deck, setDeck] = useState([]);
  const [gamePlayers, setGamePlayers] = useState(initialPlayers);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [rankedResults, setRankedResults] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    onRoundCompleteRef.current = onRoundComplete;
  }, [onRoundComplete]);

  const myPlayerIndex = useMemo(() => {
    if (!localUserId) return -1;
    return gamePlayers.findIndex((p) => String(p.id) === String(localUserId));
  }, [gamePlayers, localUserId]);

  const currentPlayer = gamePlayers[currentIdx] || null;
  const isMyTurn = myPlayerIndex === currentIdx;
  const myPlayer = gamePlayers[myPlayerIndex] || null;

  function wsSend(obj) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
  }

  function buildState(overrides = {}) {
    return {
      screen,
      deck,
      gamePlayers,
      currentIdx,
      rankedResults,
      message,
      ...overrides,
    };
  }

  function applyState(payload) {
    if (!payload) return;

    setScreen(payload.screen ?? "setup");
    setDeck(Array.isArray(payload.deck) ? payload.deck : []);
    setGamePlayers(
      Array.isArray(payload.gamePlayers) ? payload.gamePlayers : initialPlayers
    );
    setCurrentIdx(Number(payload.currentIdx || 0));
    setRankedResults(
      Array.isArray(payload.rankedResults) ? payload.rankedResults : []
    );
    setMessage(payload.message || "");
  }

  function broadcastState(nextState = {}) {
    if (!isHost) return;

    wsSend({
      type: "poker_state",
      sessionCode: code,
      payload: buildState(nextState),
    });
  }

  function setAndBroadcast(nextState) {
    applyState(nextState);
    setTimeout(() => broadcastState(nextState), 0);
  }

  function startGame() {
    if (!isHost) return;

    let d = buildDeck();

    const dealt = initialPlayers.map((player) => {
      const hand = [];

      for (let i = 0; i < 5; i++) {
        const drawn = drawOne(d);
        d = drawn.deck;
        if (drawn.card) hand.push(drawn.card);
      }

      return {
        ...player,
        hand,
        selected: [],
        drawn: false,
        result: null,
      };
    });

    announcedRef.current = false;

    setAndBroadcast({
      screen: "draw",
      deck: d,
      gamePlayers: dealt,
      currentIdx: 0,
      rankedResults: [],
      message: `${dealt[0]?.name || "Player 1"} chooses cards to replace.`,
    });
  }

  function hostToggleCard(playerId, cardIndex) {
    if (!isHost || screen !== "draw") return;

    const active = gamePlayers[currentIdx];
    if (!active || String(active.id) !== String(playerId)) return;
    if (active.drawn) return;

    const nextPlayers = gamePlayers.map((p, index) => {
      if (index !== currentIdx) return p;

      const selected = new Set(p.selected || []);

      if (selected.has(cardIndex)) {
        selected.delete(cardIndex);
      } else if (selected.size < 3) {
        selected.add(cardIndex);
      }

      return {
        ...p,
        selected: [...selected].sort((a, b) => a - b),
      };
    });

    setAndBroadcast({
      gamePlayers: nextPlayers,
      message: `${active.name} selected ${
        nextPlayers[currentIdx].selected.length
      } card(s).`,
    });
  }

  function hostConfirmDraw(playerId) {
    if (!isHost || screen !== "draw") return;

    const active = gamePlayers[currentIdx];
    if (!active || String(active.id) !== String(playerId)) return;
    if (active.drawn) return;

    let d = [...deck];

    const nextPlayers = gamePlayers.map((p, index) => {
      if (index !== currentIdx) return p;

      const selected = new Set(p.selected || []);
      const nextHand = [...p.hand];

      for (const cardIndex of selected) {
        const drawn = drawOne(d);
        d = drawn.deck;
        if (drawn.card) nextHand[cardIndex] = drawn.card;
      }

      return {
        ...p,
        hand: nextHand,
        selected: [],
        drawn: true,
      };
    });

    if (currentIdx < gamePlayers.length - 1) {
      const nextIdx = currentIdx + 1;

      setAndBroadcast({
        deck: d,
        gamePlayers: nextPlayers,
        currentIdx: nextIdx,
        message: `${nextPlayers[nextIdx]?.name || "Next player"} chooses cards to replace.`,
      });
      return;
    }

    finishGame(nextPlayers, d);
  }

  function finishGame(finalPlayers, finalDeck) {
    if (!isHost) return;

    const resolved = finalPlayers.map((p) => ({
      ...p,
      result: evaluateHand(p.hand),
    }));

    const ranked = [...resolved]
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        hand: p.hand,
        result: p.result,
        score: p.result.score,
        label: p.result.name,
      }))
      .sort((a, b) => b.score - a.score);

    setAndBroadcast({
      screen: "results",
      deck: finalDeck,
      gamePlayers: resolved,
      rankedResults: ranked,
      message: `${ranked[0]?.name || "Winner"} wins with ${
        ranked[0]?.label || "best hand"
      }.`,
    });

    if (!announcedRef.current && typeof onRoundCompleteRef.current === "function") {
      announcedRef.current = true;

      onRoundCompleteRef.current({
        winnerKey: ranked[0]?.playerId || null,
        scores: ranked.map((entry) => ({
          playerId: entry.playerId,
          name: entry.name,
          score: entry.score,
          result: entry.label,
        })),
      });
    }
  }

  function sendAction(action, cardIndex = null) {
    const player = gamePlayers[myPlayerIndex];
    if (!player) return;

    if (isHost) {
      if (action === "toggle") hostToggleCard(player.id, cardIndex);
      if (action === "confirm") hostConfirmDraw(player.id);
      return;
    }

    wsSend({
      type: "poker_action",
      sessionCode: code,
      payload: {
        playerId: player.id,
        action,
        cardIndex,
      },
    });
  }

  useEffect(() => {
    if (runningRef.current) return;
    runningRef.current = true;

    setConnLine("connecting...");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnLine("connected");
      wsSend({ type: "join", sessionCode: code });

      if (isHost) {
        setTimeout(() => broadcastState(), 150);
      }
    };

    ws.onclose = () => setConnLine("disconnected");
    ws.onerror = () => setConnLine("error");

    ws.onmessage = (ev) => {
      let msg;

      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }

      if (!msg || msg.sessionCode !== code) return;

      if (msg.type === "poker_action" && isHost) {
        const { playerId, action, cardIndex } = msg.payload || {};

        if (action === "toggle") hostToggleCard(playerId, Number(cardIndex));
        if (action === "confirm") hostConfirmDraw(playerId);

        return;
      }

      if (msg.type === "poker_state") {
        if (isHost) return;
        applyState(msg.payload);
      }
    };

    return () => {
      try {
        wsRef.current?.close();
      } catch {}
      wsRef.current = null;
      runningRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, isHost]);

  useEffect(() => {
    if (screen !== "setup") return;
    setGamePlayers(initialPlayers);
  }, [initialPlayers, screen]);

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={topRow}>
          <button
            style={{
              ...startSmallButton,
              opacity: isHost && screen === "setup" ? 1 : 0.45,
              cursor: isHost && screen === "setup" ? "pointer" : "not-allowed",
            }}
            disabled={!isHost || screen !== "setup"}
            onClick={startGame}
          >
            Start
          </button>

          <div>
            <h1 style={title}>♠ Poker ♠</h1>
            <p style={sub}>5-Card Draw · {connLine}</p>
          </div>

          <div style={hostPill}>{isHost ? "Host" : "Player"}</div>
        </div>

        {screen === "setup" && (
          <section style={setup}>
            <h2 style={setupTitle}>5-Card Draw Poker</h2>
            <p style={setupText}>
              Each player gets five cards, may replace up to three, then best
              hand wins.
            </p>

            <div style={playerGrid}>
              {gamePlayers.map((p, index) => (
                <div key={p.id} style={playerChip}>
                  P{index + 1}: <strong>{p.name}</strong>
                </div>
              ))}
            </div>

            {isHost ? (
              <button style={startButton} onClick={startGame}>
                Start Game
              </button>
            ) : (
              <p style={waitingText}>Waiting for the host to start.</p>
            )}
          </section>
        )}

        {screen === "draw" && (
          <>
            <section style={statusPanel}>
              <h2 style={turnTitle}>
                {currentPlayer?.name || "Player"}'s draw
                {isMyTurn ? " · YOU" : ""}
              </h2>
              <p style={setupText}>
                Select up to 3 cards to replace, then confirm your draw.
              </p>
            </section>

            <section style={playersGrid}>
              {gamePlayers.map((p, index) => {
                const active = index === currentIdx;
                const isMe = index === myPlayerIndex;

                return (
                  <div
                    key={p.id}
                    style={{
                      ...playerBox,
                      ...(active ? activePlayerBox : null),
                      opacity: active || p.drawn || isMe ? 1 : 0.65,
                    }}
                  >
                    <div style={playerNameRow}>
                      <span style={playerName}>
                        {p.name}
                        {isMe ? " (You)" : ""}
                      </span>
                      <span style={playerInfo}>
                        {p.drawn
                          ? "Draw complete"
                          : active
                          ? "Choosing"
                          : "Waiting"}
                      </span>
                    </div>

                    <div style={cardsRow}>
                      {(isMe || screen === "results" ? p.hand : p.hand.map(() => null)).map(
                        (card, cardIndex) =>
                          card ? (
                            <button
                              key={`${card.value}-${card.suit}-${cardIndex}`}
                              style={{
                                ...cardButton,
                                ...(RED.has(card.suit) ? redCard : blackCard),
                                ...(p.selected?.includes(cardIndex)
                                  ? selectedCard
                                  : null),
                                opacity: isMyTurn && active ? 1 : 0.75,
                              }}
                              disabled={!isMyTurn || !active}
                              onClick={() => sendAction("toggle", cardIndex)}
                            >
                              <CardInner card={card} />
                            </button>
                          ) : (
                            <div
                              key={`hidden-${p.id}-${cardIndex}`}
                              style={{ ...cardStyle, ...faceDownCard }}
                            >
                              🂠
                            </div>
                          )
                      )}
                    </div>

                    {isMe && active && (
                      <div style={drawControls}>
                        <span style={selectedText}>
                          Selected {p.selected?.length || 0}/3
                        </span>

                        <button
                          style={confirmButton}
                          onClick={() => sendAction("confirm")}
                        >
                          Confirm Draw
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>

            {message && <div style={messageBar}>{message}</div>}
          </>
        )}

        {screen === "results" && (
          <section style={resultsPanel}>
            <h2 style={setupTitle}>Showdown</h2>

            {rankedResults.map((entry, index) => (
              <div key={entry.playerId} style={resultRow}>
                <div>
                  <strong>
                    #{index + 1} — {entry.name}
                  </strong>
                  <div style={resultLabel}>{entry.label}</div>
                  <div style={miniCards}>
                    {entry.hand.map((card, cardIndex) => (
                      <div
                        key={`${entry.playerId}-${card.value}-${card.suit}-${cardIndex}`}
                        style={{
                          ...miniCard,
                          ...(RED.has(card.suit) ? redCard : blackCard),
                        }}
                      >
                        <CardInner card={card} mini />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {isHost ? (
              <button style={startButton} onClick={startGame}>
                Play Again
              </button>
            ) : (
              <p style={waitingText}>Waiting for the host to continue.</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function CardInner({ card, mini = false }) {
  return (
    <>
      <span style={mini ? miniTop : cardTop}>
        {card.value}
        <br />
        {card.suit}
      </span>
      <span style={mini ? miniSuit : cardSuit}>{card.suit}</span>
      <span style={mini ? miniBottom : cardBottom}>
        {card.value}
        <br />
        {card.suit}
      </span>
    </>
  );
}

const wrap = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
  padding: 20,
  boxSizing: "border-box",
};

const card = {
  width: "100%",
  maxWidth: 680,
  background:
    "radial-gradient(ellipse at 50% 20%, #256b40 0%, #123820 70%, #0b2416 100%)",
  color: "#f0e8d0",
  padding: 20,
  borderRadius: 18,
  textAlign: "center",
  boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const topRow = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: 10,
  marginBottom: 14,
};

const title = {
  fontSize: 28,
  margin: "0 0 4px",
};

const sub = {
  fontSize: 12,
  opacity: 0.8,
  margin: 0,
};

const hostPill = {
  justifySelf: "end",
  padding: "7px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.14)",
  fontSize: 12,
  fontWeight: 800,
};

const startSmallButton = {
  justifySelf: "start",
  padding: "8px 12px",
  borderRadius: 999,
  border: "none",
  background: "#f5d76e",
  color: "#1a1a1a",
  fontWeight: 900,
};

const setup = {
  padding: "14px 0",
};

const setupTitle = {
  fontFamily: "serif",
  color: "#f5d76e",
  margin: "0 0 8px",
};

const setupText = {
  fontSize: 13,
  color: "#a8c8a0",
  margin: "0 0 16px",
  lineHeight: 1.5,
};

const playerGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 8,
  marginBottom: 18,
};

const playerChip = {
  padding: 10,
  borderRadius: 10,
  background: "rgba(0,0,0,0.25)",
  border: "1px solid rgba(255,255,255,0.1)",
  fontSize: 13,
};

const startButton = {
  marginTop: 16,
  background: "#f5d76e",
  color: "#1a1a1a",
  border: "none",
  borderRadius: 999,
  padding: "12px 28px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
};

const waitingText = {
  marginTop: 14,
  color: "#a8c8a0",
  fontSize: 13,
};

const statusPanel = {
  padding: 14,
  borderRadius: 14,
  background: "rgba(0,0,0,0.24)",
  border: "1px solid rgba(255,255,255,0.1)",
  marginBottom: 10,
};

const turnTitle = {
  margin: "0 0 8px",
  fontSize: 22,
  color: "#f5d76e",
};

const playersGrid = {
  display: "grid",
  gap: 10,
};

const playerBox = {
  background: "rgba(0,0,0,0.22)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 14,
  padding: 12,
};

const activePlayerBox = {
  border: "2px solid #f5d76e",
  background: "rgba(0,0,0,0.34)",
  boxShadow: "0 0 18px rgba(245,215,110,0.16)",
};

const playerNameRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "center",
  marginBottom: 8,
};

const playerName = {
  fontSize: 12,
  fontWeight: 900,
  color: "#f5d76e",
  textTransform: "uppercase",
  letterSpacing: 1,
};

const playerInfo = {
  fontSize: 11,
  color: "#a8c8a0",
};

const cardsRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  justifyContent: "center",
  minHeight: 70,
};

const cardStyle = {
  width: 48,
  height: 66,
  background: "#fff",
  borderRadius: 6,
  border: "1px solid #ddd",
  position: "relative",
  boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const cardButton = {
  ...cardStyle,
  cursor: "pointer",
};

const faceDownCard = {
  background:
    "linear-gradient(135deg, #1a3a8c 25%, #1a2d6e 25%, #1a2d6e 50%, #1a3a8c 50%, #1a3a8c 75%, #1a2d6e 75%)",
  backgroundSize: "10px 10px",
  color: "rgba(255,255,255,0.28)",
  fontSize: 28,
};

const redCard = { color: "#c0392b" };
const blackCard = { color: "#1a1a1a" };

const selectedCard = {
  transform: "translateY(-8px)",
  border: "2px solid #f5d76e",
  boxShadow: "0 0 12px rgba(245,215,110,0.5)",
};

const cardTop = {
  position: "absolute",
  top: 3,
  left: 5,
  fontSize: 8,
  lineHeight: 1.1,
  fontWeight: 800,
};

const cardBottom = {
  position: "absolute",
  bottom: 3,
  right: 5,
  fontSize: 8,
  lineHeight: 1.1,
  fontWeight: 800,
  transform: "rotate(180deg)",
};

const cardSuit = {
  fontSize: 20,
  fontWeight: 900,
};

const drawControls = {
  marginTop: 12,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const selectedText = {
  color: "#a8c8a0",
  fontSize: 12,
};

const confirmButton = {
  border: "none",
  borderRadius: 999,
  padding: "10px 18px",
  background: "#2ecc71",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const messageBar = {
  marginTop: 10,
  padding: 10,
  borderRadius: 10,
  background: "rgba(0,0,0,0.24)",
  color: "#f5d76e",
  fontSize: 13,
};

const resultsPanel = {
  marginTop: 16,
  padding: 16,
  borderRadius: 14,
  background: "rgba(0,0,0,0.24)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const resultRow = {
  padding: "12px 0",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const resultLabel = {
  marginTop: 4,
  color: "#a8c8a0",
  fontSize: 13,
};

const miniCards = {
  marginTop: 8,
  display: "flex",
  gap: 6,
  justifyContent: "center",
  flexWrap: "wrap",
};

const miniCard = {
  width: 34,
  height: 48,
  background: "#fff",
  borderRadius: 5,
  border: "1px solid #ddd",
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const miniTop = {
  position: "absolute",
  top: 2,
  left: 4,
  fontSize: 7,
  lineHeight: 1.1,
  fontWeight: 800,
};

const miniBottom = {
  position: "absolute",
  bottom: 2,
  right: 4,
  fontSize: 7,
  lineHeight: 1.1,
  fontWeight: 800,
  transform: "rotate(180deg)",
};

const miniSuit = {
  fontSize: 16,
  fontWeight: 900,
};