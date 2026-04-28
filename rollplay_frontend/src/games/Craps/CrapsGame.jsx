import { useEffect, useMemo, useRef, useState } from "react";

export default function CrapsGame({
  players = [],
  myUserId = null,
  onRoundComplete,
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [results, setResults] = useState({});
  const finishedRef = useRef(false);

  const playerList = useMemo(() => {
    return players.length > 0
      ? players.slice(0, 4)
      : [{ id: "p1", name: "Player 1" }];
  }, [players]);

  const currentPlayer = playerList[currentIdx];

  const currentKey =
    currentPlayer?.user_id ||
    currentPlayer?.userId ||
    currentPlayer?.id ||
    `p${currentIdx}`;

  function rand() {
    return Math.floor(Math.random() * 6) + 1;
  }

  function rollDice() {
    if (rolling) return;
    setRolling(true);

    setTimeout(() => {
      const d1 = rand();
      const d2 = rand();
      const total = d1 + d2;

      setResults((prev) => ({
        ...prev,
        [currentKey]: { d1, d2, total },
      }));

      setRolling(false);
    }, 600);
  }

  function nextTurn() {
    if (currentIdx < playerList.length - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      finishGame();
    }
  }

  function finishGame() {
    if (finishedRef.current) return;
    finishedRef.current = true;

    const ranked = playerList
      .map((p, index) => {
        const key = p.user_id || p.userId || p.id || `p${index}`;
        return {
          playerId: key,
          name: p.display_name || p.name || `Player ${index + 1}`,
          score: results[key]?.total || 0,
        };
      })
      .sort((a, b) => b.score - a.score);

    onRoundComplete?.({
      winnerKey: ranked[0]?.playerId,
      scores: ranked,
    });
  }

  function dieFace(n) {
    return ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][n - 1];
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <h1 style={title}>🎲 Craps</h1>
        <p style={sub}>Highest roll wins</p>

        {/* SCOREBOARD */}
        <div style={scoreboard}>
          {playerList.map((p, i) => {
            const key =
              p.user_id || p.userId || p.id || `p${i}`;

            const r = results[key];

            return (
              <div
                key={key}
                style={{
                  ...scoreBox,
                  border:
                    i === currentIdx && !r
                      ? "2px solid #f5d76e"
                      : "1px solid rgba(255,255,255,0.1)",
                  opacity: r ? 1 : i === currentIdx ? 1 : 0.5,
                }}
              >
                <div>{p.name}</div>
                <div style={{ fontSize: 22 }}>
                  {r ? `${dieFace(r.d1)} ${dieFace(r.d2)}` : "— —"}
                </div>
                <div style={{ fontSize: 18 }}>
                  {r ? r.total : ""}
                </div>
              </div>
            );
          })}
        </div>

        {/* CURRENT PLAYER */}
        {!finishedRef.current && (
          <>
            <h2 style={{ marginTop: 20 }}>
              {currentPlayer?.name}'s turn
            </h2>

            <button
              style={rollBtn}
              onClick={rollDice}
              disabled={rolling || results[currentKey]}
            >
              {rolling
                ? "Rolling..."
                : results[currentKey]
                ? "Next Player →"
                : "🎲 Roll Dice"}
            </button>

            {results[currentKey] && (
              <button style={nextBtn} onClick={nextTurn}>
                Continue
              </button>
            )}
          </>
        )}

        {/* RESULTS */}
        {finishedRef.current && (
          <div style={{ marginTop: 20 }}>
            <h2>Results</h2>
            {Object.entries(results)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([key, r], i) => (
                <div key={key}>
                  #{i + 1} — {r.total}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* styles */
const wrap = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
  padding: 20,
};

const card = {
  width: 420,
  background: "#1a4a2e",
  color: "#f0e8d0",
  padding: 20,
  borderRadius: 16,
  textAlign: "center",
};

const title = {
  fontSize: 28,
  marginBottom: 6,
};

const sub = {
  fontSize: 12,
  opacity: 0.8,
};

const scoreboard = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  marginTop: 15,
};

const scoreBox = {
  padding: 10,
  borderRadius: 10,
  background: "rgba(0,0,0,0.2)",
};

const rollBtn = {
  marginTop: 15,
  padding: "12px 24px",
  fontSize: 16,
  borderRadius: 10,
  border: "none",
  background: "#f5d76e",
  cursor: "pointer",
};

const nextBtn = {
  marginTop: 10,
  padding: "10px 18px",
  borderRadius: 8,
  border: "none",
  background: "#2ecc71",
  color: "white",
  cursor: "pointer",
};