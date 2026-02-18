import { Link } from "react-router-dom";


export default function ChooseGame() {
  return (
    <div style={{ paddingTop: 80 }}>
      <h1>Choose Game</h1>
      <p>This is a placeholder screen for selecting a game mode.</p>

      <Link to="/dice-duel">Dice Duel</Link>
      <br />
      <Link to="/quick-draw">Quick Draw</Link>
      <br />
      <Link to="/tip-toss">Tip Toss</Link>
      <br />
      <Link to="/top-race">Top Race</Link>
      <br />
      <Link to="/guessing-card">guessing-card</Link>
      <br />

    </div>
  );
}
