import { useEffect, useState } from "react";

export default function TipToss() {
    const [playerName, setPlayerName] = useState("");
    const [finalName, setFinalName] = useState("");

    const [power, setPower] = useState(0);
    const [increasing, setIncreasing] = useState(true);
    const [running, setRunning] = useState(false);

    const [powerVisible, setPowerVisible] = useState(false);
    const [result, setResult] = useState("");

    const [startEnabled, setStartEnabled] = useState(false);
    const [resetEnabled, setResetEnabled] = useState(false);

    const [startLabel, setStartLabel] = useState("starts");
    const [tossMode, setTossMode] = useState(false);

    //  Coin flip state
    const [flipping, setFlipping] = useState(false);

    const coinimg = "/coin.png";
    const coinGoodSound = new Audio("/good-coin.mp3");
    const coinBadSound = new Audio("/bad-coin.mp3");
    const coinRingingSound = new Audio("/coin-ringing.mp3");

    // Optional: adjust volume
    coinGoodSound.volume = 1;
    coinBadSound.volume = 0.7;
    coinRingingSound.volume = 0.7;


    // Animate the power bar
    useEffect(() => {
        if (!running) return;

        const id = setInterval(() => {
            setPower((prev) => {
                if (increasing) {
                    if (prev >= 100) {
                        setIncreasing(false);
                        return 100;
                    }
                    return prev + 2;
                } else {
                    if (prev <= 0) {
                        setIncreasing(true);
                        return 0;
                    }
                    return prev - 2;
                }
            });
        }, 10);

        return () => clearInterval(id);
    }, [running, increasing]);

    // Submit name
    const handleNameSubmit = () => {
        if (playerName.trim() === "") {
            alert("Enter a name first!");
            return;
        }
        setFinalName(playerName + ":");
        setStartEnabled(true);
        setResetEnabled(true);
    };

    // Start
    const handleStart = () => {
        setStartLabel("toss");
        setPowerVisible(true);
        setRunning(true);
        setTossMode(true);
        setFlipping(true);
        coinRingingSound.play();
    };

    // Toss
    const handleToss = () => {
        setRunning(false);
        setFlipping(false);

        if (power < 30) {
            setResult("Weak Toss!");
            coinBadSound.currentTime = 0;
            coinBadSound.play();
        }
        else if (power < 70) {
            setResult("Nice Toss!");
            coinGoodSound.volume = 0.5;
            coinBadSound.volume = 0.2;
            coinBadSound.currentTime = 0;
            coinGoodSound.currentTime = 0;
            coinBadSound.play();
            coinGoodSound.play();
        }
        else {
            setResult("Perfect Toss!");
            coinGoodSound.currentTime = 0;
            coinGoodSound.play();
        }

        setStartEnabled(false);
    };

    const reset = () => {
        window.location.reload();
    };

    return (
        <div style={{ textAlign: "center", minHeight: "100vh", padding: "20px" }}>
            <h1>Tip Toss</h1>

            <div className="myDiv">
                {finalName && <p>{finalName}</p>}

                {!finalName && (
                    <>
                        <input
                            type="text"
                            placeholder="Please enter your name"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                        />
                        <button onClick={handleNameSubmit}>hello</button>
                    </>
                )}

                {/*  Coin */}
                {powerVisible && (
                    <div className={`coin ${flipping ? "flip" : ""}`}>
                        <img src={coinimg} alt="coin" style={{ width: "100%", height: "100%" }} />
                    </div>
                )}

                {/* ✅ BUTTONS ON NEW LINES */}
                <div style={{ marginTop: "15px" }}>
                    <button
                        onClick={tossMode ? handleToss : handleStart}
                        disabled={!startEnabled}
                        style={{ display: "block", margin: "10px auto" }}
                    >
                        start
                    </button>

                    <button
                        onClick={reset}
                        disabled={!resetEnabled}
                        style={{ display: "block", margin: "10px auto" }}
                    >
                        reset
                    </button>
                </div>
            </div>

            {/* POWER BAR */}
            {powerVisible && (
                <div
                    style={{
                        width: "60px",
                        height: "300px",
                        border: "3px solid #333",
                        margin: "20px auto",
                        borderRadius: "5px",
                        overflow: "hidden",
                        background: "linear-gradient(to top, red, yellow, green)",
                        position: "relative"
                    }}
                >
                    <div
                        style={{
                            width: "100%",
                            height: `${power}%`,
                            background: "rgba(0,0,0,0.4)",
                            position: "absolute",
                            bottom: 0,
                            transition: "height 0.05s"
                        }}
                    />
                </div>
            )}

            <h2>{result}</h2>

            {/* Coin CSS */}
            <style>{`
                .coin {
                    font-size: 60px;
                    margin: 20px auto;
                    width: 60px;
                    height: 60px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transform-style: preserve-3d;
                }

                .flip {
                    animation: coinFlip 0.4s linear infinite;
                }

                @keyframes coinFlip {
                    0% { transform: rotateY(0deg); }
                    100% { transform: rotateY(360deg); }
                }
            `}</style>
        </div>
    );
}
