export default function PokerGame() {
  return (
    <div style={wrap}>
      <div style={card}>
        <h1>♠ Poker ♠</h1>
        <p>5-Card Draw Poker is currently in development.</p>
        <p style={small}>
          This game is listed in the picker but should stay locked until the full
          betting, draw, and showdown flow is integrated.
        </p>
      </div>
    </div>
  );
}

const wrap = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
  padding: 20,
};

const card = {
  width: "100%",
  maxWidth: 520,
  background: "#1a4a2e",
  color: "#f0e8d0",
  padding: 24,
  borderRadius: 16,
  textAlign: "center",
};

const small = {
  opacity: 0.75,
  fontSize: 14,
  lineHeight: 1.5,
};