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

function makeSafePlayers(players) {
  const usable =
    Array.isArray(players) && players.length > 0
      ? players.slice(0, 4)
      : [{ name: "Player 1" }, { name: "Player 2" }];

  return usable.map((p, index) => ({
    id: getPlayerKey(p) || `p${index + 1}`,
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
}

export default function BlackjackGame({
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
  const [phase, setPhase] = useState("setup");
  const [deck, setDeck] = useState(buildDeck());
  const [dealerHand, setDealerHand] = useState([]);
  const [gamePlayers, setGamePlayers] = useState(initialPlayers);
  const [bettingIdx, setBettingIdx] = useState(0);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [dealerHidden, setDealerHidden] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    onRoundCompleteRef.current = onRoundComplete;
  }, [onRoundComplete]);

  const myPlayerIndex = useMemo(() => {
    if (!localUserId) return -1;
    return gamePlayers.findIndex((p) => String(p.id) === String(localUserId));
  }, [gamePlayers, localUserId]);

  const currentPlayer = gamePlayers[currentPlayerIdx];
  const bettingPlayer = gamePlayers[bettingIdx];
  const isMyBettingTurn = myPlayerIndex === bettingIdx;
  const isMyPlayingTurn = myPlayerIndex === currentPlayerIdx;

  function wsSend(obj) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
  }

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

  function buildState(overrides = {}) {
    return {
      screen,
      phase,
      deck,
      dealerHand,
      gamePlayers,
      bettingIdx,
      currentPlayerIdx,
      dealerHidden,
      message,
      ...overrides,
    };
  }

  function applyState(payload) {
    if (!payload) return;

    setScreen(payload.screen ?? "setup");
    setPhase(payload.phase ?? "setup");
    setDeck(Array.isArray(payload.deck) ? payload.deck : buildDeck());
    setDealerHand(Array.isArray(payload.dealerHand) ? payload.dealerHand : []);
    setGamePlayers(
      Array.isArray(payload.gamePlayers) ? payload.gamePlayers : initialPlayers
    );
    setBettingIdx(Number(payload.bettingIdx || 0));
    setCurrentPlayerIdx(Number(payload.currentPlayerIdx || 0));
    setDealerHidden(payload.dealerHidden !== false);
    setMessage(payload.message || "");
  }

  function broadcastState(nextState = {}) {
    if (!isHost) return;

    wsSend({
      type: "blackjack_state",
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

    const reset = resetRoundPlayers(initialPlayers);

    announcedRef.current = false;

    setAndBroadcast({
      screen: "game",
      phase: "betting",
      deck: buildDeck(),
      dealerHand: [],
      gamePlayers: reset,
      bettingIdx: 0,
      currentPlayerIdx: 0,
      dealerHidden: true,
      message: `${reset[0]?.name || "Player 1"} — set your bet.`,
    });
  }

  function hostUpdateBet(playerId, action, amount = 0) {
    if (!isHost || phase !== "betting") return;

    const targetIdx = gamePlayers.findIndex((p) => String(p.id) === String(playerId));
    if (targetIdx !== bettingIdx) return;

    const updated = gamePlayers.map((p, index) => {
      if (index !== targetIdx) return p;

      if (action === "clear") {
        return { ...p, bet: 0 };
      }

      const nextBet = p.bet + Number(amount || 0);
      if (nextBet > p.balance) return p;

      return { ...p, bet: nextBet };
    });

    setAndBroadcast({
      gamePlayers: updated,
      message:
        updated[targetIdx].bet > updated[targetIdx].balance
          ? "Not enough balance."
          : `${updated[targetIdx].name} — set your bet.`,
    });
  }

  function hostConfirmBet(playerId) {
    if (!isHost || phase !== "betting") return;

    const targetIdx = gamePlayers.findIndex((p) => String(p.id) === String(playerId));
    if (targetIdx !== bettingIdx) return;

    const p = gamePlayers[targetIdx];

    if (!p || p.bet <= 0) {
      setAndBroadcast({ message: "Bet must be more than 0." });
      return;
    }

    if (p.bet > p.balance) {
      setAndBroadcast({ message: "Not enough balance." });
      return;
    }

    const nextPlayers = gamePlayers.map((player, index) =>
      index === targetIdx ? { ...player, betConfirmed: true } : player
    );

    if (targetIdx < gamePlayers.length - 1) {
      setAndBroadcast({
        gamePlayers: nextPlayers,
        bettingIdx: targetIdx + 1,
        message: `${nextPlayers[targetIdx + 1].name} — set your bet.`,
      });
      return;
    }

    dealAll(nextPlayers);
  }

  function dealAll(playersReady) {
    if (!isHost) return;

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

    const nextState = {
      screen: "game",
      phase: "playing",
      deck: d,
      dealerHand: [dealerFirst.card, dealerSecond.card].filter(Boolean),
      gamePlayers: dealtPlayers,
      bettingIdx,
      currentPlayerIdx: 0,
      dealerHidden: true,
      message: `${dealtPlayers[0]?.name || "Player 1"}'s turn.`,
    };

    setAndBroadcast(nextState);

    setTimeout(() => {
      const firstPlayer = dealtPlayers[0];
      if (firstPlayer && score(firstPlayer.hand) === 21 && firstPlayer.hand.length === 2) {
        handleNaturalBlackjack(0, dealtPlayers, nextState.dealerHand, d);
      }
    }, 250);
  }

  function handleNaturalBlackjack(index, sourcePlayers, sourceDealerHand, sourceDeck) {
    if (!isHost) return;

    const p = sourcePlayers[index];
    if (!p) return;

    const updated = sourcePlayers.map((player, i) =>
      i === index ? { ...player, done: true } : player
    );

    const next = index + 1;

    if (next < updated.length) {
      setAndBroadcast({
        phase: "playing",
        deck: sourceDeck,
        dealerHand: sourceDealerHand,
        gamePlayers: updated,
        currentPlayerIdx: next,
        dealerHidden: true,
        message: `${p.name} has Blackjack. ${updated[next].name}'s turn.`,
      });
      return;
    }

    dealerPlay(updated, sourceDealerHand, sourceDeck);
  }

  function hostHit(playerId) {
    if (!isHost || phase !== "playing") return;

    const active = gamePlayers[currentPlayerIdx];
    if (!active || String(active.id) !== String(playerId)) return;

    let d = [...deck];
    const drawn = draw(d);
    d = drawn.deck;

    const updated = gamePlayers.map((p, index) => {
      if (index !== currentPlayerIdx) return p;

      if (p.playingSplit) {
        return {
          ...p,
          splitHand: [...p.splitHand, drawn.card].filter(Boolean),
        };
      }

      return {
        ...p,
        hand: [...p.hand, drawn.card].filter(Boolean),
      };
    });

    const p = updated[currentPlayerIdx];
    const activeScore = p.playingSplit ? score(p.splitHand) : score(p.hand);

    if (activeScore > 21) {
      if (p.splitActive && !p.playingSplit) {
        const splitPlayers = updated.map((player, index) =>
          index === currentPlayerIdx ? { ...player, playingSplit: true } : player
        );

        setAndBroadcast({
          deck: d,
          gamePlayers: splitPlayers,
          message: "Bust. Now playing split hand.",
        });
        return;
      }

      const donePlayers = updated.map((player, index) =>
        index === currentPlayerIdx
          ? { ...player, done: true, playingSplit: false }
          : player
      );

      moveToNextPlayer(donePlayers, d, dealerHand, "Bust.");
      return;
    }

    setAndBroadcast({
      deck: d,
      gamePlayers: updated,
      message: activeScore === 21 ? "21." : `${active.name} hits.`,
    });
  }

  function hostStand(playerId) {
    if (!isHost || phase !== "playing") return;

    const active = gamePlayers[currentPlayerIdx];
    if (!active || String(active.id) !== String(playerId)) return;

    if (active.splitActive && !active.playingSplit) {
      const splitPlayers = gamePlayers.map((p, index) =>
        index === currentPlayerIdx ? { ...p, playingSplit: true } : p
      );

      setAndBroadcast({
        gamePlayers: splitPlayers,
        message: "Now playing split hand.",
      });
      return;
    }

    const updated = gamePlayers.map((p, index) =>
      index === currentPlayerIdx ? { ...p, done: true, playingSplit: false } : p
    );

    moveToNextPlayer(updated, deck, dealerHand, `${active.name} stands.`);
  }

  function hostDouble(playerId) {
    if (!isHost || phase !== "playing") return;

    const active = gamePlayers[currentPlayerIdx];
    if (!active || String(active.id) !== String(playerId)) return;

    const activeHand = active.playingSplit ? active.splitHand : active.hand;
    if (activeHand.length !== 2) return;

    const requiredBet = active.playingSplit ? active.splitBet : active.bet;
    if (active.balance < requiredBet) return;

    let d = [...deck];
    const drawn = draw(d);
    d = drawn.deck;

    const updated = gamePlayers.map((p, index) => {
      if (index !== currentPlayerIdx) return p;

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

    const p = updated[currentPlayerIdx];

    if (p.splitActive && !p.playingSplit) {
      const splitPlayers = updated.map((player, index) =>
        index === currentPlayerIdx ? { ...player, playingSplit: true } : player
      );

      setAndBroadcast({
        deck: d,
        gamePlayers: splitPlayers,
        message: "Double complete. Now playing split hand.",
      });
      return;
    }

    const donePlayers = updated.map((player, index) =>
      index === currentPlayerIdx
        ? { ...player, done: true, playingSplit: false }
        : player
    );

    moveToNextPlayer(donePlayers, d, dealerHand, "Double complete.");
  }

  function hostSplit(playerId) {
    if (!isHost || phase !== "playing") return;

    const active = gamePlayers[currentPlayerIdx];
    if (!active || String(active.id) !== String(playerId)) return;

    if (
      active.splitActive ||
      active.hand.length !== 2 ||
      active.hand[0].value !== active.hand[1].value ||
      active.balance < active.bet
    ) {
      return;
    }

    let d = [...deck];

    const updated = gamePlayers.map((p, index) => {
      if (index !== currentPlayerIdx) return p;

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

    setAndBroadcast({
      deck: d,
      gamePlayers: updated,
      message: "Split created. Playing first hand.",
    });
  }

  function moveToNextPlayer(sourcePlayers, sourceDeck, sourceDealerHand, msg = "") {
    let next = currentPlayerIdx + 1;

    while (next < sourcePlayers.length && sourcePlayers[next].done) {
      next += 1;
    }

    if (next < sourcePlayers.length) {
      const nextPlayer = sourcePlayers[next];

      if (score(nextPlayer.hand) === 21 && nextPlayer.hand.length === 2) {
        handleNaturalBlackjack(next, sourcePlayers, sourceDealerHand, sourceDeck);
        return;
      }

      setAndBroadcast({
        phase: "playing",
        deck: sourceDeck,
        dealerHand: sourceDealerHand,
        gamePlayers: sourcePlayers,
        currentPlayerIdx: next,
        dealerHidden: true,
        message: `${msg} ${nextPlayer.name}'s turn.`,
      });
      return;
    }

    dealerPlay(sourcePlayers, sourceDealerHand, sourceDeck);
  }

  function dealerPlay(sourcePlayers, sourceDealerHand = dealerHand, sourceDeck = deck) {
    if (!isHost) return;

    let d = [...sourceDeck];
    let dealer = [...sourceDealerHand];

    while (score(dealer) < 17 || isSoft17(dealer)) {
      const drawn = draw(d);
      d = drawn.deck;
      if (drawn.card) dealer.push(drawn.card);
    }

    setAndBroadcast({
      phase: "dealer",
      deck: d,
      dealerHand: dealer,
      gamePlayers: sourcePlayers,
      dealerHidden: false,
      message: "Dealer's turn.",
    });

    setTimeout(() => resolveAll(sourcePlayers, dealer, d), 800);
  }

  function resolveAll(sourcePlayers, dealer, sourceDeck) {
    if (!isHost) return;

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

    const ranked = [...resolved].sort((a, b) => b.net - a.net);
    const winnerPlayer = ranked[0];

    setAndBroadcast({
      phase: "results",
      deck: sourceDeck,
      dealerHand: dealer,
      gamePlayers: resolved,
      dealerHidden: false,
      message: "Round over.",
    });

    if (!announcedRef.current && typeof onRoundCompleteRef.current === "function") {
      announcedRef.current = true;

      onRoundCompleteRef.current({
        winnerKey: winnerPlayer?.id || null,
        scores: ranked.map((p) => ({
          playerId: p.id,
          name: p.name,
          score: p.net,
          result: p.result,
        })),
      });
    }
  }

  function hostNextRound() {
    if (!isHost || phase !== "results") return;

    const reset = resetRoundPlayers(gamePlayers);

    announcedRef.current = false;

    setAndBroadcast({
      screen: "game",
      phase: "betting",
      deck: buildDeck(),
      dealerHand: [],
      gamePlayers: reset,
      bettingIdx: 0,
      currentPlayerIdx: 0,
      dealerHidden: true,
      message: `${reset[0]?.name || "Player 1"} — set your bet.`,
    });
  }

  function sendAction(action, amount = 0) {
    const player = gamePlayers[myPlayerIndex];
    if (!player) return;

    if (isHost) {
      if (action === "bet_add") hostUpdateBet(player.id, "add", amount);
      if (action === "bet_clear") hostUpdateBet(player.id, "clear");
      if (action === "bet_confirm") hostConfirmBet(player.id);
      if (action === "hit") hostHit(player.id);
      if (action === "stand") hostStand(player.id);
      if (action === "double") hostDouble(player.id);
      if (action === "split") hostSplit(player.id);
      return;
    }

    wsSend({
      type: "blackjack_action",
      sessionCode: code,
      payload: {
        playerId: player.id,
        action,
        amount,
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

      if (msg.type === "blackjack_action" && isHost) {
        const { playerId, action, amount } = msg.payload || {};

        if (action === "bet_add") hostUpdateBet(playerId, "add", amount);
        if (action === "bet_clear") hostUpdateBet(playerId, "clear");
        if (action === "bet_confirm") hostConfirmBet(playerId);
        if (action === "hit") hostHit(playerId);
        if (action === "stand") hostStand(playerId);
        if (action === "double") hostDouble(playerId);
        if (action === "split") hostSplit(playerId);

        return;
      }

      if (msg.type === "blackjack_state") {
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

  const activeHand = currentPlayer?.playingSplit
    ? currentPlayer?.splitHand || []
    : currentPlayer?.hand || [];

  const canDouble =
    phase === "playing" &&
    isMyPlayingTurn &&
    activeHand.length === 2 &&
    currentPlayer?.balance >=
      (currentPlayer?.playingSplit ? currentPlayer?.splitBet : currentPlayer?.bet);

  const canSplit =
    phase === "playing" &&
    isMyPlayingTurn &&
    !currentPlayer?.splitActive &&
    currentPlayer?.hand?.length === 2 &&
    currentPlayer?.hand?.[0]?.value === currentPlayer?.hand?.[1]?.value &&
    currentPlayer?.balance >= currentPlayer?.bet;

  return (
    <div style={wrap}>
      <div style={header}>
        <div style={headerSide}>
          {phase === "setup" ? (
            <button
              style={{
                ...dealButton,
                opacity: isHost ? 1 : 0.45,
                cursor: isHost ? "pointer" : "not-allowed",
              }}
              disabled={!isHost}
              onClick={startGame}
            >
              Start
            </button>
          ) : phase === "betting" ? (
            <button
              style={{
                ...dealButton,
                opacity: isMyBettingTurn ? 1 : 0.45,
                cursor: isMyBettingTurn ? "pointer" : "not-allowed",
              }}
              disabled={!isMyBettingTurn}
              onClick={() => sendAction("bet_confirm")}
            >
              {bettingIdx === gamePlayers.length - 1 ? "Deal All" : "Confirm Bet"}
            </button>
          ) : phase === "results" ? (
            <button
              style={{
                ...dealButton,
                opacity: isHost ? 1 : 0.45,
                cursor: isHost ? "pointer" : "not-allowed",
              }}
              disabled={!isHost}
              onClick={hostNextRound}
            >
              Next Round
            </button>
          ) : (
            <button
              style={{
                ...hitButton,
                opacity: isMyPlayingTurn && phase === "playing" ? 1 : 0.45,
                cursor:
                  isMyPlayingTurn && phase === "playing" ? "pointer" : "not-allowed",
              }}
              disabled={!isMyPlayingTurn || phase !== "playing"}
              onClick={() => sendAction("hit")}
            >
              Hit
            </button>
          )}
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={title}>♠ BJ ♠</div>
          <div style={subtitle}>Blackjack · {connLine}</div>
        </div>

        <div style={headerSideRight}>
          <button
            style={{
              ...standButton,
              opacity: isMyPlayingTurn && phase === "playing" ? 1 : 0.45,
              cursor:
                isMyPlayingTurn && phase === "playing" ? "pointer" : "not-allowed",
            }}
            disabled={!isMyPlayingTurn || phase !== "playing"}
            onClick={() => sendAction("stand")}
          >
            Stand
          </button>
          <button
            style={{
              ...doubleButton,
              opacity: canDouble ? 1 : 0.45,
              cursor: canDouble ? "pointer" : "not-allowed",
            }}
            disabled={!canDouble}
            onClick={() => sendAction("double")}
          >
            Double
          </button>
          <button
            style={{
              ...splitButton,
              opacity: canSplit ? 1 : 0.45,
              cursor: canSplit ? "pointer" : "not-allowed",
            }}
            disabled={!canSplit}
            onClick={() => sendAction("split")}
          >
            Split
          </button>
        </div>
      </div>

      {!isHost && screen === "setup" && (
        <div style={notice}>Waiting for the host to start Blackjack.</div>
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

          {isHost ? (
            <button style={startButton} onClick={startGame}>
              Start Game
            </button>
          ) : (
            <p style={setupText}>The host controls the table from the Arena.</p>
          )}
        </div>
      )}

      {screen === "game" && (
        <>
          <section style={dealerArea}>
            <div style={areaLabel}>
              <span>Dealer</span>
              <span style={scoreBadge}>
                {dealerHidden && dealerHand.length
                  ? cardVal(dealerHand[0])
                  : score(dealerHand) || "?"}
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
              const betting = phase === "betting" && index === bettingIdx;
              const winner = phase === "results" && p.net > 0;
              const loser = phase === "results" && p.net < 0;

              return (
                <div
                  key={p.id}
                  style={{
                    ...playerBox,
                    ...(active || betting ? activePlayerBox : null),
                    ...(winner ? winnerBox : null),
                    ...(loser || bust ? bustBox : null),
                  }}
                >
                  <div style={playerNameRow}>
                    <span style={playerName}>
                      {p.name}
                      {index === myPlayerIndex ? " (You)" : ""}
                    </span>
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
                    style={{
                      ...chipButton,
                      opacity: isMyBettingTurn ? 1 : 0.45,
                      cursor: isMyBettingTurn ? "pointer" : "not-allowed",
                    }}
                    disabled={!isMyBettingTurn}
                    onClick={() => sendAction("bet_add", amount)}
                  >
                    +${amount}
                  </button>
                ))}
                <button
                  style={{
                    ...chipButton,
                    opacity: isMyBettingTurn ? 1 : 0.45,
                    cursor: isMyBettingTurn ? "pointer" : "not-allowed",
                  }}
                  disabled={!isMyBettingTurn}
                  onClick={() => sendAction("bet_clear")}
                >
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