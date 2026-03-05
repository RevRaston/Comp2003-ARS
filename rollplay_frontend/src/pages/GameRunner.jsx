// src/pages/GameRunner.jsx
import { useParams, useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";

/* Games */
import DartsGame from "../games/Darts/DartsGame";
import StackAttack from "../games/StackAttack/StackAttack";
import Roulette from "../games/Roulette/Roulette";
import DiceDuel from "../games/DiceDuel/DiceDuel";
import QuickDraw from "../games/QuickDraw/QuickDraw";
import TipToss from "../games/TipToss/TipToss";   // 👈 NEW
import TopRace from "../games/TopRace/TopRace";

import GameWrapper from "../components/GameWrapper";

const GAME_COMPONENTS = {
  darts: DartsGame,
  stack_attack: StackAttack,
  roulette: Roulette,
  dice_duel: DiceDuel,
  quick_draw: QuickDraw,
  tip_toss: TipToss,
  top_race: TopRace,          // 👈 NEW
};



// helper: clamp weird / missing totals
function normaliseBill(totalCost, playerCount) {
  const n = playerCount || 1;
  const bill = Number(totalCost);

  if (!bill || bill <= 0) {
    // fallback: £5 per person
    return n * 5;
  }
  return bill;
}

function computeSharesForRule(rule, bill, n) {
  const shares = new Array(n).fill(0);

  // random twist → pick a real rule and recurse once
  if (rule === "random_twist") {
    const options = ["winner_free", "leaderboard", "last_place_tax", "top_half_safe"];
    const actualRule = options[Math.floor(Math.random() * options.length)];
    return computeSharesForRule(actualRule, bill, n);
  }

  if (n === 1) {
    // single player edge case: just pay everything
    shares[0] = bill;
    return shares;
  }

  switch (rule) {
    case "winner_free": {
      // rank 1 pays 0, others split total
      const per = bill / (n - 1);
      shares[0] = 0;
      for (let i = 1; i < n; i++) shares[i] = per;
      break;
    }

    case "leaderboard": {
      // weight by rank: 1..n (1st cheapest, last most)
      const weights = [];
      for (let i = 0; i < n; i++) weights.push(i + 1);
      const sumW = weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < n; i++) {
        shares[i] = (bill * weights[i]) / sumW;
      }
      break;
    }

    case "last_place_tax": {
      // base split, last place pays +25%, others reduced equally
      const base = bill / n;
      const extra = base * 0.25; // 25% more
      const lastPay = base + extra;
      const remaining = bill - lastPay;
      const per = remaining / (n - 1);

      for (let i = 0; i < n - 1; i++) shares[i] = per;
      shares[n - 1] = lastPay;
      break;
    }

    case "top_half_safe": {
      // top half pay £0, bottom half split full bill
      const payers = Math.ceil(n / 2); // bottom half count
      const safeCount = n - payers;
      const per = bill / payers;

      for (let i = 0; i < n; i++) {
        if (i < safeCount) {
          shares[i] = 0;
        } else {
          shares[i] = per;
        }
      }
      break;
    }

    default: {
      // fallback: simple even split
      const per = bill / n;
      for (let i = 0; i < n; i++) shares[i] = per;
    }
  }

  return shares;
}

function generateResultsFromPlayers(players, rule, totalCost) {
  if (!players || players.length === 0) return [];

  // randomise order → this is the leaderboard
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const n = shuffled.length;
  const bill = normaliseBill(totalCost, n);

  const shares = computeSharesForRule(rule, bill, n);

  return shuffled.map((p, index) => ({
    name: p.name || p.username || `Player ${index + 1}`,
    rank: index + 1,
    recommended: shares[index],
  }));
}

export default function GameRunner() {
  const { gameId } = useParams();
  const navigate = useNavigate();

  const {
    selectedLevels,
    round,
    setRound,
    players,
    setResults,
    totalCost,
    rule,
  } = useGame();

  const GameComponent = GAME_COMPONENTS[gameId];

  if (!GameComponent) {
    return (
      <div style={{ paddingTop: 80, textAlign: "center" }}>
        <h2>Game not found.</h2>
        <p>
          Invalid game id: <code>{gameId}</code>
        </p>
      </div>
    );
  }

  function handleGameComplete() {
    const nextRound = round + 1;
    const next = selectedLevels.find((r) => r.round === nextRound);

    if (next) {
      setRound(nextRound);
      navigate(`/game/${next.level.id}`);
    } else {
      // FINAL ROUND — GENERATE RESULTS from rule + totalCost + players
      const finalResults = generateResultsFromPlayers(players, rule, totalCost);
      setResults(finalResults);
      navigate("/results");
    }
  }

  return (
    <GameWrapper
      key={gameId}        // forces timer reset per game
      duration={5}        // 5 second MVP timer
      onComplete={handleGameComplete}
    >
      <GameComponent />
    </GameWrapper>
  );
}
