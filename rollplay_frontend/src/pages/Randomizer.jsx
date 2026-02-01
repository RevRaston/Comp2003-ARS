import { useEffect, useState } from "react";
import { useGame } from "../GameContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function Randomizer() {
  const navigate = useNavigate();
  const { sessionId, setResults } = useGame();

  const [rolling, setRolling] = useState("...");
  const [winner, setWinner] = useState(null);

  useEffect(() => {
    if (!sessionId) {
      navigate("/join-session");
      return;
    }

    async function run() {
      const { data: players } = await supabase
        .from("session_players")
        .select("*")
        .eq("session_id", sessionId);

      if (!players || players.length < 2) {
        navigate("/lobby");
        return;
      }

      const shuffled = [...players].sort(() => Math.random() - 0.5);

      let i = 0;
      const interval = setInterval(() => {
        setRolling(shuffled[i % shuffled.length].name);
        i++;
      }, 120);

      setTimeout(() => {
        clearInterval(interval);

        const winPlayer = shuffled[0];
        setWinner(winPlayer.name);

        const rule = winPlayer.rule ?? "winner_free";
        const total = winPlayer.total_cost ?? 50;

        let results;

        if (rule === "even_split") {
          const share = total / players.length;
          results = shuffled.map((p, idx) => ({
            name: p.name,
            rank: idx + 1,
            recommended: Number(share.toFixed(2)),
          }));
        } else {
          const losers = shuffled.slice(1);
          const share = total / losers.length;

          results = shuffled.map((p, idx) => ({
            name: p.name,
            rank: idx + 1,
            recommended: idx === 0 ? 0 : Number(share.toFixed(2)),
          }));
        }

        setResults(results);

        setTimeout(() => navigate("/results"), 1500);
      }, 3000);
    }

    run();
  }, [sessionId, setResults, navigate]);

  return (
    <div style={{ paddingTop: 80, textAlign: "center" }}>
      {!winner ? (
        <>
          <h1>🎲 Rolling...</h1>
          <h2 style={{ fontSize: 40 }}>{rolling}</h2>
        </>
      ) : (
        <>
          <h1>Winner!</h1>
          <h2 style={{ fontSize: 48 }}>{winner}</h2>
        </>
      )}
    </div>
  );
}
