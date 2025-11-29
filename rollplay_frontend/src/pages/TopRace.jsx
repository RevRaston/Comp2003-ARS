import { useState, useEffect } from "react";

export default function TopRace() {
    const [playerName, setPlayerName] = useState("");
    const [finalName, setFinalName] = useState("");
    const [counter, setCounter] = useState(0);
    const [time, setTime] = useState("");
    const [tapEnabled, setTapEnabled] = useState(false);
    const [resetEnabled, setResetEnabled] = useState(false);

    // First countdown
    const startFirstCountdown = () => {
        let timeLeft = 4;
        setTime(`${timeLeft} Seconds`);

        const interval1 = setInterval(() => {
            timeLeft--;
            if (timeLeft <= -1) {
                clearInterval(interval1);
                setTime("Go!");
                setTapEnabled(true);
                setResetEnabled(true);
                startSecondCountdown();
            } else {
                setTime(`${timeLeft} Seconds`);
            }
        }, 1000);
    };

    // Second countdown (game timer)
    const startSecondCountdown = () => {
        let timeLeft = 11;

        const interval2 = setInterval(() => {
            timeLeft--;
            if (timeLeft <= -1) {
                clearInterval(interval2);
                setTapEnabled(false);
                setTime("");
            } else {
                setTime(`You have ${timeLeft} Seconds`);
            }
        }, 1000);
    };

    const handleSubmitName = () => {
        if (playerName.trim() === "") {
            alert("Enter a name first!");
            return;
        }
        setFinalName(playerName + ":");
        startFirstCountdown();
    };

    const resetGame = () => {
        window.location.reload();
    };

    return (
        <div
            style={{
                textAlign: "center",
                padding: "20px",
                height: "100vh"
            }}
        >
            <h1>TopRace</h1>
            <p>Mash the button as quickly as you can!</p>

            {!finalName && (
                <>
                    <input
                        type="text"
                        placeholder="Please enter your name"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                    />
                    <button onClick={handleSubmitName}>playerName</button>
                </>
            )}

            {finalName && <p>{finalName}</p>}

            <p id="output">{counter}</p>

            <div className="myDiv">
                <button disabled={!tapEnabled} onClick={() => setCounter(counter + 1)}>
                    Tap
                </button>

                <button disabled={!resetEnabled} onClick={resetGame}>
                    Reset
                </button>
            </div>

            <p>{time}</p>
        </div>
    );
}
