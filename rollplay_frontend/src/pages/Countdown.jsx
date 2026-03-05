import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";

export default function Countdown() {
  const navigate = useNavigate();
  const { players } = useGame();
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (!players || players.length < 1) {
      // If someone refreshed or entered URL manually, go back
      navigate("/level-select");
      return;
    }

    const timer = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate("/choose-game");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [players, navigate]);

  return (
    <div style={{ paddingTop: 80, textAlign: "center" }}>
      <h1>Game starting in...</h1>
      <p style={{ fontSize: 64, marginTop: 16 }}>{count}</p>
    </div>
  );
}

