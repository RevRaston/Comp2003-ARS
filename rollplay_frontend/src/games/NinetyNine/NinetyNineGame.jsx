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

function cardValue(card) {
  if (card.value === "A") return 1;
  if (["J", "Q", "K"].includes(card.value)) return 10;
  return Number(card.value);
}

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALS) deck.push({ suit, value });
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

function drawCard(deck) {
  if (deck.length === 0) return null;
  return deck[deck.length - 1];
}

function popCard(deck) {
  return deck.slice(0, -1);
}

function getPlayerKey(player) {
  if (!player) return "";
  return String(
    player.user_id ??
      player.userId ??
      player.id ??
      player.profile_id ??
      player.profileId ??
      player.name ??
      ""
  );
}

function makeSafePlayers(players) {
  const usable =
    Array.isArray(players) && players.length >= 2
      ? players.slice(0, 4)
      : [{ name: "Player 1" }, { name: "Player 2" }];

  return usable.map((p, index) => ({
    id: getPlayerKey(p) || `p${index + 1}`,
    name: p.display_name || p.name || `Player ${index + 1}`,
    hand: [],
  }));
}

export default function NinetyNineGame({
  sessionCode,
  players = [],
  isHost = false,
  myUserId,
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
  const [total, setTotal] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedCardIdx, setSelectedCardIdx] = useState(-1);
  const [lastPlayed, setLastPlayed] = useState(null);
  const [winner, setWinner] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    onRoundCompleteRef.current = onRoundComplete;
  }, [onRoundComplete]);

  const myPlayerIndex = useMemo(() => {
    if (!localUserId) return -1;
    return gamePlayers.findIndex((p) => String(p.id) === String(localUserId));
  }, [gamePlayers, localUserId]);

  const activePlayer = gamePlayers[currentIdx];
  const activePlayerName = activePlayer?.name || `Player ${currentIdx + 1}`;
  const isMyTurn = myPlayerIndex === currentIdx;
  const selectedCard =
    selectedCardIdx >= 0 ? gamePlayers?.[myPlayerIndex]?.hand?.[selectedCardIdx] : null;

  function wsSend(obj) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
  }

  function buildPublicState(overrides = {}) {
    return {
      screen,
      deck,
      gamePlayers,
      total,
      currentIdx,
      lastPlayed,
      winner,
      statusMessage,
      ...overrides,
    };
  }

  function broadcastState(nextState = {}) {
    if (!isHost) return;

    wsSend({
      type: "ninety_nine_state",
      sessionCode: code,
      payload: buildPublicState(nextState),
    });
  }

  function applyState(payload) {
    if (!payload) return;

    setScreen(payload.screen ?? "setup");
    setDeck(Array.isArray(payload.deck) ? payload.deck : []);
    setGamePlayers(Array.isArray(payload.gamePlayers) ? payload.gamePlayers : initialPlayers);
    setTotal(Number(payload.total || 0));
    setCurrentIdx(Number(payload.currentIdx || 0));
    setSelectedCardIdx(-1);
    setLastPlayed(payload.lastPlayed || null);
    setWinner(payload.winner || null);
    setStatusMessage(payload.statusMessage || "");
  }

  function startGame() {
    if (!isHost) return;

    let freshDeck = buildDeck();

    const dealtPlayers = initialPlayers.map((p) => {
      const hand = [];

      for (let i = 0; i < 4; i++) {
        const card = drawCard(freshDeck);
        if (card) {
          hand.push(card);
          freshDeck = popCard(freshDeck);
        }
      }

      return { ...p, hand };
    });

    const nextState = {
      screen: "game",
      deck: freshDeck,
      gamePlayers: dealtPlayers,
      total: 0,
      currentIdx: 0,
      lastPlayed: null,
      winner: null,
      statusMessage: `${dealtPlayers[0]?.name || "Player 1"} starts.`,
    };

    announcedRef.current = false;
    applyState(nextState);
    setTimeout(() => broadcastState(nextState), 0);
  }

  function finishRound(played, nextPlayers, nextTotal) {
    const nextState = {
      screen: "win",
      deck,
      gamePlayers: nextPlayers,
      total: nextTotal,
      currentIdx,
      lastPlayed: played,
      winner: played,
      statusMessage: `${played.playerName} reached 99 and wins.`,
    };

    applyState(nextState);
    setTimeout(() => broadcastState(nextState), 0);

    if (!announcedRef.current && typeof onRoundCompleteRef.current === "function") {
      announcedRef.current = true;

      onRoundCompleteRef.current({
        winnerKey: played.playerId,
        scores: nextPlayers.map((p) => ({
          playerId: p.id,
          name: p.name,
          score: p.id === played.playerId ? 99 : nextTotal,
        })),
      });
    }
  }

  function hostPlayCard(playerId, cardIndex) {
    if (!isHost) return;

    const active = gamePlayers[currentIdx];
    if (!active) return;
    if (String(active.id) !== String(playerId)) return;
    if (screen !== "game") return;

    const card = active.hand[cardIndex];
    if (!card) return;

    const value = cardValue(card);
    const nextTotal = total + value;

    let nextDeck = [...deck];
    const nextPlayers = gamePlayers.map((p, index) => {
      if (index !== currentIdx) return p;

      const nextHand = [...p.hand];
      nextHand.splice(cardIndex, 1);

      const newCard = drawCard(nextDeck);
      if (newCard) {
        nextHand.push(newCard);
        nextDeck = popCard(nextDeck);
      }

      return { ...p, hand: nextHand };
    });

    const played = {
      playerName: active.name,
      playerId: active.id,
      card,
      value,
      total: nextTotal,
    };

    if (nextTotal >= 99) {
      setDeck(nextDeck);
      finishRound(played, nextPlayers, nextTotal);
      return;
    }

    const nextIdx = (currentIdx + 1) % gamePlayers.length;

    const nextState = {
      screen: "game",
      deck: nextDeck,
      gamePlayers: nextPlayers,
      total: nextTotal,
      currentIdx: nextIdx,
      lastPlayed: played,
      winner: null,
      statusMessage: `${active.name} played ${card.value}${card.suit}. ${
        nextPlayers[nextIdx]?.name || "Next player"
      }'s turn.`,
    };

    applyState(nextState);
    setTimeout(() => broadcastState(nextState), 0);
  }

  function playSelected() {
    if (selectedCardIdx < 0) return;

    const player = gamePlayers[myPlayerIndex];
    if (!player) return;
    if (!isMyTurn) return;

    if (isHost) {
      hostPlayCard(player.id, selectedCardIdx);
      return;
    }

    wsSend({
      type: "ninety_nine_play_card",
      sessionCode: code,
      payload: {
        playerId: player.id,
        cardIndex: selectedCardIdx,
      },
    });

    setSelectedCardIdx(-1);
    setStatusMessage("Card played. Waiting for host sync...");
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

      if (msg.type === "ninety_nine_play_card" && isHost) {
        const playerId = msg.payload?.playerId;
        const cardIndex = Number(msg.payload?.cardIndex);
        hostPlayCard(playerId, cardIndex);
        return;
      }

      if (msg.type === "ninety_nine_state") {
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

  const visibleHand =
    isHost && myPlayerIndex === -1
      ? activePlayer?.hand || []
      : gamePlayers?.[myPlayerIndex]?.hand || [];

  const visibleHandTitle =
    isHost && myPlayerIndex === -1
      ? `${activePlayerName}'s hand`
      : myPlayerIndex >= 0
      ? "Your hand"
      : "Spectator view";

  return (
    <div style={wrap}>
      <div style={header}>
        <button
          style={{
            ...topButton,
            opacity: isHost && screen === "setup" ? 1 : 0.45,
            cursor: isHost && screen === "setup" ? "pointer" : "not-allowed",
          }}
          disabled={!isHost || screen !== "setup"}
          onClick={startGame}
        >
          Start
        </button>

        <div style={{ textAlign: "center" }}>
          <div style={title}>♦ 99 ♦</div>
          <div style={subtitle}>Card Game</div>
        </div>

        <div style={connPill}>{connLine}</div>
      </div>

      {!isHost && screen === "setup" && (
        <div style={notice}>Waiting for the host to start 99.</div>
      )}

      {screen === "setup" && (
        <div style={setup}>
          <h3 style={setupTitle}>Reach 99 to win</h3>

          <div style={legend}>
            <span>A = 1</span>
            <span>2–10 = face value</span>
            <span>J/Q/K = 10</span>
          </div>

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
            <p style={muted}>The host controls the round from the Arena.</p>
          )}
        </div>
      )}

      {screen === "game" && (
        <>
          <div style={totalBar}>
            <div>
              <div style={label}>Running Total</div>
              <div
                style={{
                  ...totalValue,
                  color:
                    total >= 95 ? "#e74c3c" : total >= 88 ? "#e67e22" : "#f5d76e",
                }}
              >
                {total}
              </div>
            </div>

            <div style={turnBadge}>
              {activePlayerName}'s turn
              {isMyTurn ? " · YOU" : ""}
            </div>

            <div>
              <div style={label}>Deck Left</div>
              <div style={{ ...totalValue, fontSize: 28 }}>{deck.length}</div>
            </div>
          </div>

          <div
            style={{
              ...summaryGrid,
              gridTemplateColumns:
                gamePlayers.length === 2 ? "1fr 1fr" : "repeat(2, 1fr)",
            }}
          >
            {gamePlayers.map((p, index) => (
              <div
                key={p.id}
                style={{
                  ...summaryChip,
                  ...(index === currentIdx ? activeChip : null),
                }}
              >
                <span>
                  {p.name}
                  {index === currentIdx ? " ★" : ""}
                  {index === myPlayerIndex ? " (You)" : ""}
                </span>
                <span>{p.hand.length} cards</span>
              </div>
            ))}
          </div>

          {lastPlayed && (
            <div style={lastPlayedArea}>
              <span style={label}>Last played</span>
              <MiniCard card={lastPlayed.card} />
              <div>
                <div style={muted}>{lastPlayed.playerName} played</div>
                <strong style={{ color: "#f5d76e" }}>
                  +{lastPlayed.value} → total {lastPlayed.total}
                </strong>
              </div>
            </div>
          )}

          <div style={handArea}>
            <div style={handLabel}>
              <span>{visibleHandTitle}</span>
              <span>{visibleHand.length} cards</span>
            </div>

            {myPlayerIndex === -1 && !isHost ? (
              <div style={spectatorBox}>Spectating — player hands are hidden.</div>
            ) : (
              <div style={handCards}>
                {visibleHand.map((card, index) => (
                  <button
                    key={`${card.value}-${card.suit}-${index}`}
                    style={{
                      ...cardButton,
                      ...(RED.has(card.suit) ? redCard : blackCard),
                      ...(selectedCardIdx === index ? selectedCardStyle : null),
                      opacity: isMyTurn || (isHost && myPlayerIndex === -1) ? 1 : 0.55,
                    }}
                    disabled={!isMyTurn && !(isHost && myPlayerIndex === -1)}
                    onClick={() => setSelectedCardIdx(index)}
                  >
                    <span style={cardTop}>
                      {card.value}
                      <br />
                      {card.suit}
                    </span>
                    <span style={cardSuit}>{card.suit}</span>
                    <span style={cardBottom}>
                      {card.value}
                      <br />
                      {card.suit}
                    </span>
                    {["J", "Q", "K"].includes(card.value) && (
                      <span style={cardValueSmall}>= 10</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={controls}>
            <div style={{ color: "#f5d76e", fontFamily: "serif" }}>
              {selectedCard
                ? `Playing ${selectedCard.value}${selectedCard.suit} (+${cardValue(
                    selectedCard
                  )}) — total will be ${total + cardValue(selectedCard)}`
                : isMyTurn
                ? "Select a card to play"
                : `Waiting for ${activePlayerName}`}
            </div>

            <button
              style={{
                ...playButton,
                opacity: selectedCardIdx < 0 || !isMyTurn ? 0.35 : 1,
                cursor:
                  selectedCardIdx < 0 || !isMyTurn ? "not-allowed" : "pointer",
              }}
              disabled={selectedCardIdx < 0 || !isMyTurn}
              onClick={playSelected}
            >
              Play Card
            </button>
          </div>

          {statusMessage && <div style={statusBox}>{statusMessage}</div>}
        </>
      )}

      {screen === "win" && winner && (
        <div style={winScreen}>
          <div style={passIcon}>🏆</div>
          <h3 style={passTitle}>{winner.playerName} wins!</h3>
          <p style={muted}>Their card pushed the total to</p>
          <div style={winTotal}>{winner.total}</div>
          <p style={contextText}>
            They played {winner.card.value}
            {winner.card.suit} (+{winner.value})
          </p>

          {isHost ? (
            <button style={startButton} onClick={startGame}>
              Play Again
            </button>
          ) : (
            <p style={muted}>Waiting for the host to continue...</p>
          )}
        </div>
      )}
    </div>
  );
}

function MiniCard({ card }) {
  return (
    <div
      style={{
        ...miniCard,
        ...(RED.has(card.suit) ? redCard : blackCard),
      }}
    >
      <span style={miniTop}>
        {card.value}
        <br />
        {card.suit}
      </span>
      <span style={miniSuit}>{card.suit}</span>
      <span style={miniBottom}>
        {card.value}
        <br />
        {card.suit}
      </span>
    </div>
  );
}

const wrap = {
  width: "100%",
  maxWidth: 680,
  margin: "0 auto",
  background:
    "radial-gradient(ellipse at 50% 30%, #256b40 0%, #0e2d1c 100%)",
  color: "#f0e8d0",
  padding: 16,
  borderRadius: 16,
  fontFamily: "system-ui, sans-serif",
  boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
};

const header = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: 8,
  marginBottom: 12,
};

const title = {
  fontFamily: "serif",
  fontSize: 22,
  letterSpacing: 3,
  color: "#f5d76e",
  fontWeight: 800,
};

const subtitle = {
  fontSize: 10,
  color: "#a8c8a0",
  letterSpacing: 2,
  textTransform: "uppercase",
};

const topButton = {
  border: "none",
  borderRadius: 8,
  padding: "8px 12px",
  background: "#f5d76e",
  color: "#1a1a1a",
  fontWeight: 800,
};

const connPill = {
  justifySelf: "end",
  borderRadius: 999,
  padding: "8px 12px",
  background: "rgba(255,255,255,0.1)",
  color: "#f0e8d0",
  border: "1px solid rgba(255,255,255,0.2)",
  fontWeight: 700,
  fontSize: 12,
};

const notice = {
  marginBottom: 12,
  padding: 10,
  borderRadius: 10,
  background: "rgba(0,0,0,0.25)",
  border: "1px solid rgba(245,215,110,0.25)",
  fontSize: 12,
  color: "#f5d76e",
};

const setup = {
  textAlign: "center",
  padding: "18px 0",
};

const setupTitle = {
  fontFamily: "serif",
  color: "#f5d76e",
  fontSize: 22,
  margin: "0 0 14px",
};

const legend = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: 8,
  marginBottom: 16,
  fontSize: 12,
  color: "#a8c8a0",
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
  background: "#f5d76e",
  color: "#1a1a1a",
  border: "none",
  borderRadius: 10,
  padding: "12px 28px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
};

const passIcon = {
  fontSize: 52,
  marginBottom: 12,
};

const passTitle = {
  fontFamily: "serif",
  fontSize: 26,
  color: "#f5d76e",
  margin: "0 0 8px",
};

const muted = {
  fontSize: 13,
  color: "#a8c8a0",
  margin: "0 0 8px",
};

const contextText = {
  fontSize: 12,
  color: "rgba(245,215,110,0.8)",
  margin: "0 0 24px",
};

const totalBar = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 18,
  background: "rgba(0,0,0,0.3)",
  borderRadius: 10,
  padding: "10px 14px",
  marginBottom: 10,
  border: "1px solid rgba(245,215,110,0.25)",
};

const label = {
  fontSize: 10,
  color: "#a8c8a0",
  letterSpacing: 1.5,
  textTransform: "uppercase",
};

const totalValue = {
  fontFamily: "serif",
  fontSize: 42,
  color: "#f5d76e",
  lineHeight: 1,
  textAlign: "center",
};

const turnBadge = {
  background: "rgba(245,215,110,0.15)",
  color: "#f5d76e",
  border: "1px solid rgba(245,215,110,0.3)",
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 12,
  textAlign: "center",
};

const summaryGrid = {
  display: "grid",
  gap: 6,
  marginBottom: 10,
};

const summaryChip = {
  background: "rgba(0,0,0,0.2)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 11,
  display: "flex",
  justifyContent: "space-between",
};

const activeChip = {
  borderColor: "rgba(245,215,110,0.6)",
  background: "rgba(0,0,0,0.35)",
  color: "#f5d76e",
};

const lastPlayedArea = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 10,
  padding: "8px 12px",
  background: "rgba(0,0,0,0.2)",
  borderRadius: 8,
};

const handArea = {
  background: "rgba(0,0,0,0.25)",
  border: "1.5px solid rgba(245,215,110,0.35)",
  borderRadius: 10,
  padding: 12,
  marginBottom: 10,
};

const handLabel = {
  fontSize: 10,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "#a8c8a0",
  marginBottom: 8,
  display: "flex",
  justifyContent: "space-between",
};

const handCards = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  minHeight: 70,
};

const spectatorBox = {
  minHeight: 70,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#a8c8a0",
  fontSize: 13,
};

const cardButton = {
  width: 48,
  height: 66,
  background: "#fff",
  borderRadius: 6,
  border: "1px solid #ddd",
  position: "relative",
  cursor: "pointer",
  boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
};

const redCard = { color: "#c0392b" };
const blackCard = { color: "#1a1a1a" };

const selectedCardStyle = {
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

const cardValueSmall = {
  position: "absolute",
  bottom: 4,
  left: 0,
  right: 0,
  textAlign: "center",
  fontSize: 8,
  color: "#888",
};

const controls = {
  background: "rgba(0,0,0,0.25)",
  borderRadius: 9,
  padding: "10px 12px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const playButton = {
  border: "none",
  borderRadius: 8,
  padding: "9px 18px",
  background: "#2ecc71",
  color: "#fff",
  fontWeight: 800,
};

const statusBox = {
  marginTop: 10,
  padding: 10,
  borderRadius: 10,
  background: "rgba(0,0,0,0.25)",
  color: "#f5d76e",
  fontSize: 12,
};

const winScreen = {
  textAlign: "center",
  padding: "40px 20px",
};

const winTotal = {
  fontFamily: "serif",
  fontSize: 56,
  color: "#f5d76e",
  margin: "12px 0",
};

const miniCard = {
  width: 36,
  height: 50,
  background: "#fff",
  borderRadius: 5,
  border: "1px solid #ddd",
  position: "relative",
  flexShrink: 0,
};

const miniTop = {
  position: "absolute",
  top: 2,
  left: 4,
  fontSize: 7,
  fontWeight: 800,
};

const miniBottom = {
  position: "absolute",
  bottom: 2,
  right: 4,
  fontSize: 7,
  fontWeight: 800,
  transform: "rotate(180deg)",
};

const miniSuit = {
  fontSize: 16,
  fontWeight: 900,
};