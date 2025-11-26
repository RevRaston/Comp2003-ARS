import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";

export default function Randomizer() {
  const navigate = useNavigate();
  const { players, totalCost, rule, setResults } = useGame();

  useEffect(() => {
    if (!players || players.length < 2) {
      navigate("/host");
      return;
    }

    // Shuffle players
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const n = shuffled.length;

    let results;
    if (rule === "even_split") {
      const share = totalCost / n;
      results = shuffled.map((name, index) => ({
        name,
        rank: index + 1,
        recommended: Number(share.toFixed(2)),
      }));
    } else {
      // winner_free
      const losersCount = Math.max(n - 1, 1);
      const loserShare = totalCost / losersCount;
      results = shuffled.map((name, index) => ({
        name,
        rank: index + 1,
        recommended:
          index === 0 ? 0 : Number(loserShare.toFixed(2)), // winner pays 0
      }));
    }

    setResults(results);

    const timer = setTimeout(() => {
      navigate("/results");
    }, 1500);

    return () => clearTimeout(timer);
  }, [players, totalCost, rule, setResults, navigate]);

  return (
    <div style={{ paddingTop: 80, textAlign: "center" }}>
      <h1>Shuffling players...</h1>
      <p>Rolling the dice to see who pays what 👀</p>
    </div>
  );
}
