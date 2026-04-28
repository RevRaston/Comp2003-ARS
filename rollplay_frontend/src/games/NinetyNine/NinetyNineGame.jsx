import { useEffect, useMemo, useState } from "react";

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

export default function NinetyNineGame({
  players = [],
  isHost = false,
  onRoundComplete,
}) {
  const initialPlayers = useMemo(() => {
    const usable = players.length >= 2 ? players.slice(0, 4) : [
      { name: "Player 1" },
      { name: "Player 2" },
    ];

    return usable.map((p, index) => ({
      id: p.user_id || p.userId || p.id || `p${index + 1}`,
      name: p.display_name || p.name || `Player ${index + 1}`,
      hand: [],
    }));
  }, [players]);

  const [screen, setScreen] = useState("setup");
  const [deck, setDeck] = useState([]);
  const [gamePlayers, setGamePlayers] = useState(initialPlayers);
  const [total, setTotal] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedCardIdx, setSelectedCardIdx] = useState(-1);
  const [lastPlayed, setLastPlayed] = useState(null);
  const [winner, setWinner] = useState(null);
  const [passContext, setPassContext] = useState("");

  useEffect(() => {
    setGamePlayers(initialPlayers);
  }, [initialPlayers]);

  function startGame() {
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

    setDeck(freshDeck);
    setGamePlayers(dealtPlayers);
    setTotal(0);
    setCurrentIdx(0);
    setSelectedCardIdx(-1);
    setLastPlayed(null);
    setWinner(null);
    setPassContext("");
    setScreen("game");
  }

  function resetToSetup() {
    setScreen("setup");
    setSelectedCardIdx(-1);
    setWinner(null);
  }

  function revealNextPlayer() {
    setScreen("game");
  }

  function playSelected() {
    if (selectedCardIdx < 0) return;

    const activePlayer = gamePlayers[currentIdx];
    const card = activePlayer.hand[selectedCardIdx];
    const value = cardValue(card);
    const nextTotal = total + value;

    let nextDeck = [...deck];
    const nextPlayers = gamePlayers.map((p, index) => {
      if (index !== currentIdx) return p;

      const nextHand = [...p.hand];
      nextHand.splice(selectedCardIdx, 1);

      const newCard = drawCard(nextDeck);
      if (newCard) {
        nextHand.push(newCard);
        nextDeck = popCard(nextDeck);
      }

      return { ...p, hand: nextHand };
    });

    setDeck(nextDeck);
    setGamePlayers(nextPlayers);
    setTotal(nextTotal);
    setSelectedCardIdx(-1);

    const played = {
      playerName: activePlayer.name,
      playerId: activePlayer.id,
      card,
      value,
      total: nextTotal,
    };

    setLastPlayed(played);

    if (nextTotal >= 99) {
      setWinner(played);
      setScreen("win");

      onRoundComplete?.({
        winnerKey: activePlayer.id,
        scores: nextPlayers.map((p) => ({
          playerId: p.id,
          name: p.name,
          score: p.id === activePlayer.id ? 99 : nextTotal,
        })),
      });

      return;
    }

    const nextIdx = (currentIdx + 1) % gamePlayers.length;
    setCurrentIdx(nextIdx);
    setPassContext(
      `${activePlayer.name} played ${card.value}${card.suit} (+${value}). Total is now ${nextTotal}.`
    );
    setScreen("pass");
  }

  const activePlayer = gamePlayers[currentIdx];
  const selectedCard =
    selectedCardIdx >= 0 ? activePlayer?.hand?.[selectedCardIdx] : null;

  return (
    <div style={wrap}>
      <div style={header}>
        <button style={topButton} onClick={startGame}>
          Start
        </button>

        <div style={{ textAlign: "center" }}>
          <div style={title}>♦ 99 ♦</div>
          <div style={subtitle}>Card Game</div>
        </div>

        <button style={ghostButton} onClick={resetToSetup}>
          Menu
        </button>
      </div>

      {!isHost && (
        <div style={notice}>
          This version is pass-and-play. The host should control the round for the showcase.
        </div>
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

          <button style={startButton} onClick={startGame}>
            Start Game
          </button>
        </div>
      )}

      {screen === "pass" && (
        <div style={passScreen}>
          <div style={passIcon}>🎴</div>
          <h3 style={passTitle}>Hand it to {activePlayer?.name}</h3>
          <p style={muted}>Pass the device before revealing their cards.</p>
          <p style={contextText}>{passContext}</p>

          <button style={startButton} onClick={revealNextPlayer}>
            I'm ready — show my cards
          </button>
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
                  color: total >= 95 ? "#e74c3c" : total >= 88 ? "#e67e22" : "#f5d76e",
                }}
              >
                {total}
              </div>
            </div>

            <div style={turnBadge}>{activePlayer?.name}'s turn</div>

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
                <span>{p.name}{index === currentIdx ? " ★" : ""}</span>
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
              <span>{activePlayer?.name}'s hand</span>
              <span>{activePlayer?.hand?.length || 0} cards</span>
            </div>

            <div style={handCards}>
              {activePlayer?.hand?.map((card, index) => (
                <button
                  key={`${card.value}-${card.suit}-${index}`}
                  style={{
                    ...cardButton,
                    ...(RED.has(card.suit) ? redCard : blackCard),
                    ...(selectedCardIdx === index ? selectedCard : null),
                  }}
                  onClick={() => setSelectedCardIdx(index)}
                >
                  <span style={cardTop}>{card.value}<br />{card.suit}</span>
                  <span style={cardSuit}>{card.suit}</span>
                  <span style={cardBottom}>{card.value}<br />{card.suit}</span>
                  {["J", "Q", "K"].includes(card.value) && (
                    <span style={cardValueSmall}>= 10</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div style={controls}>
            <div style={{ color: "#f5d76e", fontFamily: "serif" }}>
              {selectedCard
                ? `Playing ${selectedCard.value}${selectedCard.suit} (+${cardValue(selectedCard)}) — total will be ${total + cardValue(selectedCard)}`
                : "Select a card to play"}
            </div>

            <button
              style={{
                ...playButton,
                opacity: selectedCardIdx < 0 ? 0.35 : 1,
                cursor: selectedCardIdx < 0 ? "not-allowed" : "pointer",
              }}
              disabled={selectedCardIdx < 0}
              onClick={playSelected}
            >
              Play Card
            </button>
          </div>
        </>
      )}

      {screen === "win" && winner && (
        <div style={winScreen}>
          <div style={passIcon}>🏆</div>
          <h3 style={passTitle}>{winner.playerName} wins!</h3>
          <p style={muted}>Their card pushed the total to</p>
          <div style={winTotal}>{winner.total}</div>
          <p style={contextText}>
            They played {winner.card.value}{winner.card.suit} (+{winner.value})
          </p>

          <div style={winButtons}>
            <button style={startButton} onClick={startGame}>
              Play Again
            </button>
            <button style={ghostButtonLarge} onClick={resetToSetup}>
              Change Players
            </button>
          </div>
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
      <span style={miniTop}>{card.value}<br />{card.suit}</span>
      <span style={miniSuit}>{card.suit}</span>
      <span style={miniBottom}>{card.value}<br />{card.suit}</span>
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
  cursor: "pointer",
};

const ghostButton = {
  justifySelf: "end",
  borderRadius: 8,
  padding: "8px 12px",
  background: "rgba(255,255,255,0.1)",
  color: "#f0e8d0",
  border: "1px solid rgba(255,255,255,0.2)",
  fontWeight: 700,
  cursor: "pointer",
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

const passScreen = {
  textAlign: "center",
  padding: "46px 20px",
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

const winButtons = {
  display: "flex",
  gap: 10,
  justifyContent: "center",
  flexWrap: "wrap",
};

const ghostButtonLarge = {
  ...ghostButton,
  justifySelf: "auto",
  padding: "12px 24px",
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