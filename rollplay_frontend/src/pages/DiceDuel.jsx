import { useState, useEffect } from "react";

export default function DiceDuel() {
  const [num1, setNum1] = useState(null);
  const [num2, setNum2] = useState(null);
  const [display1, setDisplay1] = useState(0);
  const [display2, setDisplay2] = useState(0);
  const [rolling1, setRolling1] = useState(true);
  const [rolling2, setRolling2] = useState(true);

  // Simulate rolling effect for dice 1
  useEffect(() => {
    if (!rolling1) return;
    const interval = setInterval(() => {
      setDisplay1(Math.floor(Math.random() * 6) + 1);
    }, 100);
    return () => clearInterval(interval);
  }, [rolling1]);

  // Rolling effect for dice 2
  useEffect(() => {
    if (!rolling2) return;
    const interval = setInterval(() => {
      setDisplay2(Math.floor(Math.random() * 6) + 1);
    }, 100);
    return () => clearInterval(interval);
  }, [rolling2]);

  // Determine winner
  const getResult = () => {
    if (num1 === null || num2 === null) return "";
    if (num1 > num2) return "Player 1 wins!";
    if (num2 > num1) return "Player 2 wins!";
    return "It's a draw! Try again.";
  };

  const reset = () => {
    setNum1(null);
    setNum2(null);
    setRolling1(true);
    setRolling2(true);
  };

  return (
    <div className="w-full h-screen flex flex-col items-center justify-start p-6" style={{
      background: "linear-gradient(#effbf6, #8ce3bf, #3dd092)",
    }}>
      <h1 className="text-4xl font-bold mb-4 text-center">Dice Duel</h1>

      <p>Player 1:</p>
      <p>Player 2:</p>

      <p className="text-2xl">{display1}</p>
      <p className="text-2xl">{display2}</p>

      <div className="flex gap-4 mt-4">
        <button
          onClick={() => {
            setNum1(display1);
            setRolling1(false);
          }}
          disabled={num1 !== null}
          className="px-4 py-2 bg-white rounded-xl shadow"
        >
          roll1
        </button>

        <button
          onClick={() => {
            setNum2(display2);
            setRolling2(false);
          }}
          disabled={num2 !== null}
          className="px-4 py-2 bg-white rounded-xl shadow"
        >
          roll2
        </button>

        <button
          onClick={reset}
          className="px-4 py-2 bg-white rounded-xl shadow"
        >
          reset
        </button>
      </div>

      <p className="mt-4 text-xl">{getResult()}</p>
    </div>
  );
}
