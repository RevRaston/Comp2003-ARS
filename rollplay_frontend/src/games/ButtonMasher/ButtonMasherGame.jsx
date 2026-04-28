import { useEffect, useMemo, useRef, useState } from "react";

export default function ButtonMasherGame({
  players = [],
  myUserId = null,
  isHost = false,
  onRoundComplete,
}) {
  const [screen, setScreen] = useState("intro");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(10);
  const [scores, setScores] = useState({});
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const finishedRef = useRef(false);

  const playerList = useMemo(() => {
    return players.length > 0
      ? players.slice(0, 4)
      : [{ id: "p1", name: "Player 1" }];
  }, [players]);

  const currentPlayerKey =
    myUserId ||
    playerList[0]?.user_id ||
    playerList[0]?.userId ||
    playerList[0]?.id ||
    "p1";

  const currentPlayerName =
    playerList.find((p) => {
      const key = p.user_id || p.userId || p.id;
      return String(key) === String(currentPlayerKey);
    })?.display_name ||
    playerList.find((p) => {
      const key = p.user_id || p.userId || p.id;
      return String(key) === String(currentPlayerKey);
    })?.name ||
    "Player";

  const myScore = scores[currentPlayerKey] || 0;

  useEffect(() => {
    const introTimer = setTimeout(() => {
      setScreen("countdown");
      setCountdown(3);
    }, 2500);

    return () => clearTimeout(introTimer);
  }, []);

  useEffect(() => {
    if (screen !== "countdown") return;

    if (countdown <= 0) {
      setScreen("game");
      setTimeLeft(10);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((v) => v - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [screen, countdown]);

  useEffect(() => {
    if (screen !== "game") return;

    if (timeLeft <= 0) {
      finishRound();
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft((v) => v - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [screen, timeLeft]);

  function handleMash() {
    if (screen !== "game" || hasSubmitted) return;

    setScores((prev) => ({
      ...prev,
      [currentPlayerKey]: (prev[currentPlayerKey] || 0) + 1,
    }));
  }

  function finishRound() {
    if (finishedRef.current) return;
    finishedRef.current = true;

    setScreen("results");
    setHasSubmitted(true);

    const finalScores = {
      ...scores,
      [currentPlayerKey]: scores[currentPlayerKey] || 0,
    };

    const ranked = playerList
      .map((p, index) => {
        const key = p.user_id || p.userId || p.id || `p${index + 1}`;
        return {
          playerId: key,
          name: p.display_name || p.name || `Player ${index + 1}`,
          score: finalScores[key] || 0,
        };
      })
      .sort((a, b) => b.score - a.score);

    onRoundComplete?.({
      winnerKey: ranked[0]?.playerId || currentPlayerKey,
      scores: ranked,
    });
  }

  function restartLocalPreview() {
    finishedRef.current = false;
    setScores({});
    setHasSubmitted(false);
    setCountdown(3);
    setTimeLeft(10);
    setScreen("intro");
  }

  return (
    <div style={wrap}>
      {screen === "intro" && (
        <div style={card}>
          <h1 style={title}>Button Masher</h1>
          <p style={text}>Press as fast as you can before the timer ends.</p>
          <div style={playerBadge}>Playing as {currentPlayerName}</div>
        </div>
      )}

      {screen === "countdown" && (
        <div style={card}>
          <div style={countdownStyle}>{countdown}</div>
          <p style={text}>Get ready...</p>
        </div>
      )}

      {screen === "game" && (
        <div style={card}>
          <div style={timer}>Time Left: {timeLeft}</div>
          <div style={score}>Score: {myScore}</div>

          <button style={mashButton} onClick={handleMash}>
            MASH!
          </button>
        </div>
      )}

      {screen === "results" && (
        <div style={card}>
          <h1 style={title}>Nice!</h1>
          <p style={text}>
            {currentPlayerName} scored <strong>{myScore}</strong>.
          </p>

          {isHost && (
            <button style={secondaryButton} onClick={restartLocalPreview}>
              Replay Preview
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const wrap = {
  width: "100%",
  minHeight: 360,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 18,
  background:
    "radial-gradient(circle at top, rgba(255,90,90,0.18), transparent 32%), linear-gradient(180deg, #20242f, #11141b)",
  borderRadius: 18,
};

const card = {
  width: "100%",
  maxWidth: 420,
  textAlign: "center",
  background: "rgba(255,255,255,0.95)",
  color: "#191919",
  padding: 30,
  borderRadius: 18,
  boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
};

const title = {
  margin: "0 0 12px",
  fontSize: 38,
  fontWeight: 900,
};

const text = {
  margin: "0 0 18px",
  fontSize: 18,
  lineHeight: 1.5,
};

const playerBadge = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: 999,
  background: "#f1f1f1",
  fontSize: 14,
  fontWeight: 800,
};

const countdownStyle = {
  fontSize: 96,
  fontWeight: 900,
  lineHeight: 1,
};

const timer = {
  fontSize: 26,
  fontWeight: 800,
  marginBottom: 10,
};

const score = {
  fontSize: 32,
  fontWeight: 900,
  marginBottom: 20,
};

const mashButton = {
  fontSize: 32,
  padding: "24px 54px",
  background: "#ff4747",
  color: "white",
  border: "none",
  borderRadius: 14,
  cursor: "pointer",
  fontWeight: 900,
  boxShadow: "0 12px 26px rgba(255,71,71,0.28)",
};

const secondaryButton = {
  padding: "12px 18px",
  borderRadius: 999,
  border: "none",
  background: "#20242f",
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
};