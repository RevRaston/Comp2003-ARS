import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [screen, setScreen] = useState("splash"); // splash, menu, gameSelect, countdown, results
  const [selectedGame, setSelectedGame] = useState(null);
  const [count, setCount] = useState(3);

  // Countdown logic
  useEffect(() => {
    if (screen !== "countdown") return;

    setCount(3); // reset
    const timer = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // TODO: later go to actual game screen.
          setScreen("results");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [screen]);

  const handlePlayClick = () => {
    setScreen("menu");
  };

  const handleChooseGame = (difficulty) => {
    setSelectedGame(difficulty);
    setScreen("countdown");
  };

  const handlePlayAgain = () => {
    setSelectedGame(null);
    setScreen("gameSelect");
  };

  // --- Screens ---

  const SplashScreen = () => (
    <div className="screen splash-screen">
      <div className="overlay-card">
        <h1 className="logo-text">Rollpay</h1>
        <button className="primary-btn" onClick={handlePlayClick}>
          Play
        </button>
      </div>
    </div>
  );

  const MainMenu = () => (
    <div className="screen blue-screen">
      <div className="card">
        <h2>Welcome To Rollpay</h2>
        <button className="primary-btn" onClick={() => setScreen("gameSelect")}>
          Join
        </button>
        <button className="primary-btn" onClick={() => setScreen("gameSelect")}>
          Host
        </button>
      </div>
    </div>
  );

  const GameSelect = () => (
    <div className="screen blue-screen">
      <div className="card">
        <h2>Choose a Game</h2>
        <button className="primary-btn" onClick={() => handleChooseGame("Easy")}>
          Easy
        </button>
        <button
          className="primary-btn"
          onClick={() => handleChooseGame("Medium")}
        >
          Medium
        </button>
        <button className="primary-btn" onClick={() => handleChooseGame("Tough")}>
          Tough
        </button>
      </div>
    </div>
  );

  const Countdown = () => (
    <div className="screen blue-screen">
      <div className="card">
        <h2>Great Choice!</h2>
        <p className="subtitle">
          {selectedGame ? `${selectedGame} game selected` : "Game selected"}
        </p>
        <p className="countdown-text">Game Will Start In</p>
        <p className="countdown-number">{count}</p>
      </div>
    </div>
  );

  const Results = () => (
    <div className="screen blue-screen">
      <div className="card">
        <h2>What A Match!</h2>
        <ul className="results-list">
          <li>1st .............. Player 1</li>
          <li>2nd .............. Player 2</li>
          <li>3rd .............. Player 3</li>
          <li>4th .............. Player 4</li>
        </ul>
        <button className="primary-btn" onClick={handlePlayAgain}>
          Play Again
        </button>
      </div>
    </div>
  );

  return (
    <div className="app">
      {screen === "splash" && <SplashScreen />}
      {screen === "menu" && <MainMenu />}
      {screen === "gameSelect" && <GameSelect />}
      {screen === "countdown" && <Countdown />}
      {screen === "results" && <Results />}
    </div>
  );
}

export default App;
