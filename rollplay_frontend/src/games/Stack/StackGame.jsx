export default function StackGame({
  players = [],
  isHost = true,
  onRoundComplete,
}) {
  return (
    <div style={wrap}>
      <div style={card}>
        <h1>▲ Stack ▲</h1>
        <p>Functional React conversion needed next.</p>
        <p style={small}>
          This game should be converted from the HTML canvas version into React
          state/effects so it can report the tallest tower back to RollPay.
        </p>
      </div>
    </div>
  );
}