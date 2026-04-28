import { useEffect, useMemo, useState } from "react";

const SUITS = ["♠", "♥", "♦", "♣"];
const VALS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RED = new Set(["♥", "♦"]);

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

function cardVal(card) {
  if (!card) return 0;
  if (["J", "Q", "K"].includes(card.value)) return 10;
  if (card.value === "A") return 11;
  return Number(card.value);
}

function score(hand = []) {
  let total = hand.reduce((sum, card) => sum + cardVal(card), 0);
  let aces = hand.filter((card) => card.value === "A").length;

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function isSoft17(hand = []) {
  let total = hand.reduce((sum, card) => sum + cardVal(card), 0);
  let aces = hand.filter((card) => card.value === "A").length;

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total === 17 && hand.some((card) => card.value === "A") && aces > 0;
}

function draw(deck) {
  if (!deck.length) return { card: null, deck: buildDeck() };
  return {
    card: deck[deck.length - 1],
    deck: deck.slice(0, -1),
  };
}

export default function BlackjackGame({
  players = [],
  isHost = false,
  onRoundComplete,
}) {
  const initialPlayers = useMemo(() => {
    const usable =
      players.length > 0
        ? players.slice(0, 4)
        : [{ name: "Player 1" }, { name: "Player 2" }];

    return usable.map((p, index) => ({
      id: p.user_id || p.userId || p.id || `p${index + 1}`,
      name: p.display_name || p.name || `Player ${index + 1}`,
      balance: 1000,
      bet: 50,
      betConfirmed: false,
      hand: [],
      splitHand: [],
      splitBet: 0,
      splitActive: false,
      playingSplit: false,
      done: false,
      result: null,
      net: 0,
    }));
  }, [players]);

  const [screen, setScreen] = useState("setup");
  const [phase, setPhase] = useState("setup");
  const [deck, setDeck] = useState(buildDeck());
  const [dealerHand, setDealerHand] = useState([]);
  const [gamePlayers, setGamePlayers] = useState(initialPlayers);
  const [bettingIdx, setBettingIdx] = useState(0);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [dealerHidden, setDealerHidden] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setGamePlayers(initialPlayers);
  }, [initialPlayers]);

  const currentPlayer = gamePlayers[currentPlayerIdx];
  const bettingPlayer = gamePlayers[bettingIdx];

  function resetRoundPlayers(basePlayers) {
    return basePlayers.map((p) => ({
      ...p,
      bet: Math.min(50, p.balance || 1000),
      betConfirmed: false,
      hand: [],
      splitHand: [],
      splitBet: 0,
      splitActive: false,
      playingSplit: false,
      done: false,
      result: null,
      net: 0,
    }));
  }

  function startGame() {
    const reset = resetRoundPlayers(initialPlayers);
    setGamePlayers(reset);
    setDeck(buildDeck());
    setDealerHand([]);
    setScreen("game");
    setPhase("betting");
    setBettingIdx(0);
    setCurrentPlayerIdx(0);
    setDealerHidden(true);
    setMessage(`${reset[0]?.name || "Player 1"} — set your bet.`);
  }

  function goMenu() {
    setScreen("setup");
    setPhase("setup");
    setDealerHand([]);
    setDealerHidden(true);
    setMessage("");
  }

  function updatePlayer(index, updater) {
    setGamePlayers((prev) =>
      prev.map((p, i) => (i === index ? updater(p) : p))
    );
  }

  function addBet(amount) {
    if (phase !== "betting") return;

    updatePlayer(bettingIdx, (p) => {
      if (p.bet + amount > p.balance) {
        setMessage("Not enough balance.");
        return p;
      }

      return { ...p, bet: p.bet + amount };
    });
  }

  function clearBet() {
    if (phase !== "betting") return;
    updatePlayer(bettingIdx, (p) => ({ ...p, bet: 0 }));
  }

  function handleDealButton() {
    if (phase !== "betting") return;

    const p = gamePlayers[bettingIdx];
    if (!p || p.bet <= 0) {
      setMessage("Bet must be more than 0.");
      return;
    }

    if (p.bet > p.balance) {
      setMessage("Not enough balance.");
      return;
    }

    const nextPlayers = gamePlayers.map((player, index) =>
      index === bettingIdx ? { ...player, betConfirmed: true } : player
    );

    if (bettingIdx < gamePlayers.length - 1) {
      setGamePlayers(nextPlayers);
      setBettingIdx((v) => v + 1);
      setMessage(`${nextPlayers[bettingIdx + 1].name} — set your bet.`);
      return;
    }

    dealAll(nextPlayers);
  }

  function dealAll(playersReady) {
    let d = [...deck];

    const dealtPlayers = playersReady.map((p) => {
      const first = draw(d);
      d = first.deck;
      const second = draw(d);
      d = second.deck;

      return {
        ...p,
        balance: p.balance - p.bet,
        hand: [first.card, second.card].filter(Boolean),
        done: false,
        result: null,
        net: 0,
      };
    });

    const dealerFirst = draw(d);
    d = dealerFirst.deck;
    const dealerSecond = draw(d);
    d = dealerSecond.deck;

    setDeck(d);
    setGamePlayers(dealtPlayers);
    setDealerHand([dealerFirst.card, dealerSecond.card].filter(Boolean));
    setDealerHidden(true);
    setPhase("playing");
    setCurrentPlayerIdx(0);
    setMessage("");

    setTimeout(() => startPlayerTurn(0, dealtPlayers), 100);
  }

  function startPlayerTurn(index, sourcePlayers = gamePlayers) {
    const p = sourcePlayers[index];
    if (!p) return;

    setCurrentPlayerIdx(index);

    if (score(p.hand) === 21 && p.hand.length === 2) {
      setMessage(`${p.name} has Blackjack.`);
      const updated = sourcePlayers.map((player, i) =>
        i === index ? { ...player, done: true } : player
      );
      setGamePlayers(updated);
      setTimeout(() => nextPlayer(updated), 600);
      return;
    }

    setMessage(`${p.name}'s turn.`);
  }

  function hit() {
    if (phase !== "playing") return;

    let d = [...deck];
    const drawn = draw(d);
    d = drawn.deck;
    const card = drawn.card;

    const updated = gamePlayers.map((p, index) => {
      if (index !== currentPlayerIdx) return p;

      if (p.playingSplit) {
        const splitHand = [...p.splitHand, card].filter(Boolean);
        return { ...p, splitHand };
      }

      const hand = [...p.hand, card].filter(Boolean);
      return { ...p, hand };
    });

    setDeck(d);
    setGamePlayers(updated);

    const p = updated[currentPlayerIdx];
    const activeScore = p.playingSplit ? score(p.splitHand) : score(p.hand);

    if (activeScore > 21) {
      if (p.splitActive && !p.playingSplit) {
        setMessage("Bust. Now play split hand.");
        setTimeout(() => switchToSplit(updated), 600);
      } else {
        setMessage("Bust.");
        const donePlayers = updated.map((player, index) =>
          index === currentPlayerIdx
            ? { ...player, done: true, playingSplit: false }
            : player
        );
        setGamePlayers(donePlayers);
        setTimeout(() => nextPlayer(donePlayers), 600);
      }
    } else if (activeScore === 21) {
      setMessage("21.");
    }
  }

  function stand() {
    if (phase !== "playing") return;
    const p = gamePlayers[currentPlayerIdx];

    if (p?.splitActive && !p.playingSplit) {
      switchToSplit(gamePlayers);
      return;
    }

    const updated = gamePlayers.map((player, index) =>
      index === currentPlayerIdx
        ? { ...player, done: true, playingSplit: false }
        : player
    );

    setGamePlayers(updated);
    nextPlayer(updated);
  }

  function doubleDown() {
    if (phase !== "playing") return;

    let d = [...deck];
    const drawn = draw(d);
    d = drawn.deck;

    const updated = gamePlayers.map((p, index) => {
      if (index !== currentPlayerIdx) return p;

      const activeHand = p.playingSplit ? p.splitHand : p.hand;
      if (activeHand.length !== 2 || p.balance < p.bet) return p;

      if (p.playingSplit) {
        return {
          ...p,
          balance: p.balance - p.splitBet,
          splitBet: p.splitBet * 2,
          splitHand: [...p.splitHand, drawn.card].filter(Boolean),
        };
      }

      return {
        ...p,
        balance: p.balance - p.bet,
        bet: p.bet * 2,
        hand: [...p.hand, drawn.card].filter(Boolean),
      };
    });

    setDeck(d);
    setGamePlayers(updated);

    const p = updated[currentPlayerIdx];

    setTimeout(() => {
      if (p.splitActive && !p.playingSplit) {
        switchToSplit(updated);
      } else {
        const donePlayers = updated.map((player, index) =>
          index === currentPlayerIdx
            ? { ...player, done: true, playingSplit: false }
            : player
        );
        setGamePlayers(donePlayers);
        nextPlayer(donePlayers);
      }
    }, 600);
  }

  function splitHand() {
    if (phase !== "playing") return;

    let d = [...deck];

    const updated = gamePlayers.map((p, index) => {
      if (index !== currentPlayerIdx) return p;
      if (
        p.splitActive ||
        p.hand.length !== 2 ||
        p.hand[0].value !== p.hand[1].value ||
        p.balance < p.bet
      ) {
        return p;
      }

      const splitCard = p.hand[1];
      const firstHand = [p.hand[0]];
      const firstDraw = draw(d);
      d = firstDraw.deck;
      const secondDraw = draw(d);
      d = secondDraw.deck;

      return {
        ...p,
        balance: p.balance - p.bet,
        splitBet: p.bet,
        splitActive: true,
        hand: [...firstHand, firstDraw.card].filter(Boolean),
        splitHand: [splitCard, secondDraw.card].filter(Boolean),
      };
    });

    setDeck(d);
    setGamePlayers(updated);
    setMessage("Split created. Playing first hand.");
  }

  function switchToSplit(sourcePlayers) {
    const updated = sourcePlayers.map((p, index) =>
      index === currentPlayerIdx ? { ...p, playingSplit: true } : p
    );
    setGamePlayers(updated);
    setMessage("Now playing split hand.");
  }

  function nextPlayer(sourcePlayers) {
    let next = currentPlayerIdx + 1;

    while (next < sourcePlayers.length && sourcePlayers[next].done) {
      next += 1;
    }

    if (next < sourcePlayers.length) {
      startPlayerTurn(next, sourcePlayers);
      return;
    }

    dealerPlay(sourcePlayers);
  }

  function dealerPlay(sourcePlayers) {
    setPhase("dealer");
    setDealerHidden(false);
    setMessage("Dealer's turn.");

    let d = [...deck];
    let dealer = [...dealerHand];

    while (score(dealer) < 17 || isSoft17(dealer)) {
      const drawn = draw(d);
      d = drawn.deck;
      if (drawn.card) dealer.push(drawn.card);
    }

    setDeck(d);
    setDealerHand(dealer);

    setTimeout(() => resolveAll(sourcePlayers, dealer), 800);
  }

  function resolveAll(sourcePlayers, dealer) {
    const dealerScore = score(dealer);
    const dealerBust = dealerScore > 21;
    const dealerBlackjack = dealer.length === 2 && dealerScore === 21;

    const resolved = sourcePlayers.map((p) => {
      const playerScore = score(p.hand);
      const playerBust = playerScore > 21;
      const playerBlackjack =
        !p.splitActive && p.hand.length === 2 && playerScore === 21;

      let gain = 0;
      let result = "";

      if (playerBust) {
        result = "Bust";
      } else if (playerBlackjack && !dealerBlackjack) {
        gain = Math.floor(p.bet * 2.5);
        result = "Blackjack";
      } else if (dealerBust || playerScore > dealerScore) {
        gain = p.bet * 2;
        result = "Win";
      } else if (playerScore === dealerScore) {
        gain = p.bet;
        result = "Push";
      } else {
        result = "Lose";
      }

      if (p.splitActive) {
        const splitScore = score(p.splitHand);
        const splitBust = splitScore > 21;

        if (splitBust) {
          result += " / Split Bust";
        } else if (dealerBust || splitScore > dealerScore) {
          gain += p.splitBet * 2;
          result += " / Split Win";
        } else if (splitScore === dealerScore) {
          gain += p.splitBet;
          result += " / Split Push";
        } else {
          result += " / Split Lose";
        }
      }

      const totalBet = p.bet + (p.splitActive ? p.splitBet : 0);
      const net = gain - totalBet;

      return {
        ...p,
        balance: p.balance + gain,
        result,
        net,
        done: true,
      };
    });

    setGamePlayers(resolved);
    setPhase("results");
    setMessage("Round over.");

    const ranked = [...resolved].sort((a, b) => b.net - a.net);
    const winnerPlayer = ranked[0];

    onRoundComplete?.({
      winnerKey: winnerPlayer?.id || null,
      scores: ranked.map((p) => ({
        playerId: p.id,
        name: p.name,
        score: p.net,
        result: p.result,
      })),
    });
  }

  function nextRound() {
    const reset = resetRoundPlayers(gamePlayers);
    setGamePlayers(reset);
    setDealerHand([]);
    setDealerHidden(true);
    setPhase("betting");
    setBettingIdx(0);
    setCurrentPlayerIdx(0);
    setMessage(`${reset[0]?.name || "Player 1"} — set your bet.`);
  }

  const activeHand = currentPlayer?.playingSplit
    ? currentPlayer?.splitHand || []
    : currentPlayer?.hand || [];

  const canDouble =
    phase === "playing" &&
    activeHand.length === 2 &&
    currentPlayer?.balance >= currentPlayer?.bet;

  const canSplit =
    phase === "playing" &&
    !currentPlayer?.splitActive &&
    currentPlayer?.hand?.length === 2 &&
    currentPlayer?.hand?.[0]?.value === currentPlayer?.hand?.[1]?.value &&
    currentPlayer?.balance >= currentPlayer?.bet;

  return (
    <div style={wrap}>
      <div style={header}>
        <div style={headerSide}>
          {phase === "betting" ? (
            <button style={dealButton} onClick={handleDealButton}>
              {bettingIdx === gamePlayers.length - 1 ? "Deal All" : "Next Bettor"}
            </button>
          ) : phase === "results" ? (
            <button style={dealButton} onClick={nextRound}>
              Next Round
            </button>
          ) : (
            <button style={hitButton} disabled={phase !== "playing"} onClick={hit}>
              Hit
            </button>
          )}

          <button style={menuButton} onClick={goMenu}>
            Menu
          </button>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={title}>♠ BJ ♠</div>
          <div style={subtitle}>Blackjack</div>
        </div>

        <div style={headerSideRight}>
          <button style={standButton} disabled={phase !== "playing"} onClick={stand}>
            Stand
          </button>
          <button style={doubleButton} disabled={!canDouble} onClick={doubleDown}>
            Double
          </button>
          <button style={splitButton} disabled={!canSplit} onClick={splitHand}>
            Split
          </button>
        </div>
      </div>

      {!isHost && (
        <div style={notice}>
          This version is host-led/pass-and-play for the showcase.
        </div>
      )}

      {screen === "setup" && (
        <div style={setup}>
          <h3 style={setupTitle}>Blackjack table</h3>
          <p style={setupText}>
            Players start with demo chips. Highest net result wins the round.
          </p>

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

      {screen === "game" && (
        <>
          <section style={dealerArea}>
            <div style={areaLabel}>
              <span>Dealer</span>
              <span style={scoreBadge}>
                {dealerHidden && dealerHand.length ? cardVal(dealerHand[0]) : score(dealerHand) || "?"}
              </span>
            </div>

            <div style={cardsRow}>
              {dealerHand.map((card, index) => (
                <Card
                  key={`${card.value}-${card.suit}-${index}`}
                  card={card}
                  faceDown={dealerHidden && index === 1}
                />
              ))}
            </div>
          </section>

          <section
            style={{
              ...playersGrid,
              gridTemplateColumns:
                gamePlayers.length === 1
                  ? "1fr"
                  : gamePlayers.length === 2
                  ? "1fr 1fr"
                  : gamePlayers.length === 3
                  ? "repeat(3, 1fr)"
                  : "1fr 1fr",
            }}
          >
            {gamePlayers.map((p, index) => {
              const s = score(p.hand);
              const bust = s > 21;
              const active = phase === "playing" && index === currentPlayerIdx;
              const winner = phase === "results" && p.net > 0;
              const loser = phase === "results" && p.net < 0;

              return (
                <div
                  key={p.id}
                  style={{
                    ...playerBox,
                    ...(active ? activePlayerBox : null),
                    ...(winner ? winnerBox : null),
                    ...(loser || bust ? bustBox : null),
                  }}
                >
                  <div style={playerNameRow}>
                    <span style={playerName}>{p.name}</span>
                    <span style={playerInfo}>
                      ${p.balance}
                      {phase !== "betting" ? ` | Bet: $${p.bet}` : ""}
                    </span>
                  </div>

                  <div style={areaLabel}>
                    <span>Hand</span>
                    <span style={scoreBadge}>{s || "-"}</span>
                  </div>

                  <div style={cardsRow}>
                    {p.hand.map((card, cardIndex) => (
                      <Card
                        key={`${card.value}-${card.suit}-${cardIndex}`}
                        card={card}
                      />
                    ))}
                  </div>

                  {p.splitActive && (
                    <>
                      <div style={{ ...areaLabel, marginTop: 6 }}>
                        <span>Split</span>
                        <span style={scoreBadge}>{score(p.splitHand) || "-"}</span>
                      </div>
                      <div style={cardsRow}>
                        {p.splitHand.map((card, cardIndex) => (
                          <Card
                            key={`split-${card.value}-${card.suit}-${cardIndex}`}
                            card={card}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {phase === "results" && (
                    <div style={resultText}>
                      {p.result} ({p.net >= 0 ? "+" : "-"}${Math.abs(p.net)})
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          <section style={infoBar}>
            <div>
              {phase === "betting" && gamePlayers.length > 1 && (
                <div style={betProgress}>
                  {gamePlayers.map((p, index) => (
                    <span
                      key={p.id}
                      style={{
                        ...betDot,
                        ...(p.betConfirmed ? betDotSet : null),
                        ...(index === bettingIdx ? betDotCurrent : null),
                      }}
                    />
                  ))}
                </div>
              )}

              <div style={turnText}>
                {phase === "betting"
                  ? `${bettingPlayer?.name || "Player"} — set your bet`
                  : phase === "playing"
                  ? currentPlayer?.playingSplit
                    ? `${currentPlayer?.name}'s split hand`
                    : `${currentPlayer?.name}'s turn`
                  : phase === "dealer"
                  ? "Dealer's turn"
                  : "Round over"}
              </div>
            </div>

            {phase === "betting" && (
              <div style={betControls}>
                <span style={betLabel}>Bet:</span>
                <span style={betDisplay}>${bettingPlayer?.bet || 0}</span>
                {[5, 25, 50, 100].map((amount) => (
                  <button
                    key={amount}
                    style={chipButton}
                    onClick={() => addBet(amount)}
                  >
                    +${amount}
                  </button>
                ))}
                <button style={chipButton} onClick={clearBet}>
                  Clear
                </button>
              </div>
            )}
          </section>

          <div style={messageBar}>{message}</div>
        </>
      )}
    </div>
  );
}

function Card({ card, faceDown = false }) {
  if (faceDown) {
    return <div style={{ ...cardStyle, ...faceDownCard }}>🂠</div>;
  }

  const isRed = RED.has(card.suit);

  return (
    <div style={{ ...cardStyle, color: isRed ? "#c0392b" : "#1a1a1a" }}>
      <span style={cardTop}>{card.value}<br />{card.suit}</span>
      <span style={cardSuit}>{card.suit}</span>
      <span style={cardBottom}>{card.value}<br />{card.suit}</span>
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

const headerSide = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const headerSideRight = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  alignItems: "flex-end",
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

const baseButton = {
  border: "none",
  borderRadius: 8,
  padding: "8px 12px",
  fontWeight: 800,
  cursor: "pointer",
};

const dealButton = {
  ...baseButton,
  background: "#f5d76e",
  color: "#1a1a1a",
};

const hitButton = {
  ...baseButton,
  background: "#2ecc71",
  color: "#fff",
};

const standButton = {
  ...baseButton,
  background: "#e74c3c",
  color: "#fff",
};

const doubleButton = {
  ...baseButton,
  background: "#3498db",
  color: "#fff",
};

const splitButton = {
  ...baseButton,
  background: "#9b59b6",
  color: "#fff",
};

const menuButton = {
  ...baseButton,
  background: "rgba(255,255,255,0.1)",
  color: "#f0e8d0",
  border: "1px solid rgba(255,255,255,0.2)",
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
  margin: "0 0 10px",
};

const setupText = {
  color: "#a8c8a0",
  fontSize: 13,
  marginBottom: 16,
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

const dealerArea = {
  background: "rgba(0,0,0,0.25)",
  borderRadius: 10,
  padding: "10px 12px",
  marginBottom: 8,
  border: "1px solid rgba(255,255,255,0.08)",
};

const areaLabel = {
  fontSize: 10,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "#a8c8a0",
  marginBottom: 6,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const scoreBadge = {
  background: "rgba(245,215,110,0.15)",
  color: "#f5d76e",
  border: "1px solid rgba(245,215,110,0.3)",
  borderRadius: 5,
  padding: "2px 8px",
  fontSize: 10,
  fontWeight: 700,
};

const cardsRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  minHeight: 62,
  alignItems: "flex-start",
};

const cardStyle = {
  width: 42,
  height: 58,
  background: "#fff",
  borderRadius: 5,
  border: "1px solid #ddd",
  position: "relative",
  boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const faceDownCard = {
  background:
    "linear-gradient(135deg, #1a3a8c 25%, #1a2d6e 25%, #1a2d6e 50%, #1a3a8c 50%, #1a3a8c 75%, #1a2d6e 75%)",
  backgroundSize: "10px 10px",
  color: "rgba(255,255,255,0.28)",
  fontSize: 28,
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

const playersGrid = {
  display: "grid",
  gap: 8,
  marginBottom: 8,
};

const playerBox = {
  background: "rgba(0,0,0,0.2)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  padding: "8px 10px",
};

const activePlayerBox = {
  border: "1.5px solid rgba(245,215,110,0.65)",
  background: "rgba(0,0,0,0.35)",
};

const winnerBox = {
  borderColor: "rgba(46,204,113,0.55)",
};

const bustBox = {
  borderColor: "rgba(231,76,60,0.55)",
};

const playerNameRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "center",
  marginBottom: 5,
};

const playerName = {
  fontSize: 10,
  fontWeight: 800,
  color: "#f5d76e",
  letterSpacing: 1,
  textTransform: "uppercase",
};

const playerInfo = {
  fontSize: 10,
  color: "#a8c8a0",
};

const resultText = {
  marginTop: 6,
  fontSize: 11,
  color: "#f5d76e",
  fontWeight: 800,
};

const infoBar = {
  background: "rgba(0,0,0,0.25)",
  borderRadius: 9,
  padding: "9px 12px",
  border: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 8,
};

const turnText = {
  fontFamily: "serif",
  fontSize: 15,
  color: "#f5d76e",
};

const betControls = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
};

const betLabel = {
  fontSize: 10,
  color: "#a8c8a0",
  letterSpacing: 1,
};

const betDisplay = {
  background: "rgba(0,0,0,0.3)",
  border: "1px solid rgba(245,215,110,0.3)",
  borderRadius: 6,
  padding: "4px 10px",
  color: "#f5d76e",
  fontSize: 13,
  fontWeight: 800,
};

const chipButton = {
  background: "rgba(255,255,255,0.09)",
  color: "#f0e8d0",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  padding: "5px 8px",
};

const betProgress = {
  display: "flex",
  gap: 5,
  marginBottom: 6,
};

const betDot = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.2)",
  display: "inline-block",
};

const betDotSet = {
  background: "#2ecc71",
};

const betDotCurrent = {
  background: "#f5d76e",
};

const messageBar = {
  textAlign: "center",
  fontSize: 12,
  color: "#f0e8d0",
  minHeight: 18,
  marginTop: 6,
};