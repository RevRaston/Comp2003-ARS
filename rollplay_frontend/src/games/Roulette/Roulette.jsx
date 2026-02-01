import { useEffect, useRef } from "react";

export default function Roulette({ onComplete }) {
  const containerRef = useRef(null);

  useEffect(() => {
    let playerName = "";
    let remainingNames = [];
    let currentRotation = 0;

    const container = containerRef.current;

    function debugCheckState() {
      console.assert(
        new Set(remainingNames).size === remainingNames.length,
        "Names should be unique",
        remainingNames
      );
    }

    /* ------------ SCREEN 1: ENTER NAME ------------- */
    function showNameScreen() {
      currentRotation = 0;
      remainingNames = [];

      container.innerHTML = `
        <h1>Roulette</h1>
        <p>Place your name:</p>
        <input id="nameInput" style="font-size:20px;padding:5px;width:80%;" />
        <br><br>
        <button id="enterBtn" disabled>Enter</button>
      `;

      const input = container.querySelector("#nameInput");
      const btn = container.querySelector("#enterBtn");

      input.oninput = () => {
        btn.disabled = input.value.trim().length === 0;
      };

      btn.onclick = () => {
        playerName = input.value.trim();
        startNewRoulette();
      };
    }

    /* ------------ SET UP A NEW ROULETTE ROUND ------------ */
    function startNewRoulette() {
      const baseNames = [
        "Alex", "Jordan", "Sam", "Riley", "Chris",
        "Taylor", "Morgan", "Jamie", "Pat", "Cameron"
      ];

      const randomNames = baseNames
        .filter((n) => n !== playerName)
        .sort(() => Math.random() - 0.5);

      remainingNames = [
        playerName,
        randomNames[0],
        randomNames[1],
        randomNames[2],
        randomNames[3],
      ].sort(() => Math.random() - 0.5);

      currentRotation = 0;
      debugCheckState();
      showRouletteScreen();
    }

    /* ------------ SCREEN 2: SPIN WHEEL ------------- */
    function showRouletteScreen() {
      container.innerHTML = `
        <canvas id="wheelCanvas" width="300" height="300"></canvas>
        <br/>
        <button id="spinBtn">SPIN</button>
      `;

      drawWheel();
      container.querySelector("#spinBtn").onclick = spinWheel;
    }

    /* ------------ DRAW WHEEL ------------- */
    function drawWheel() {
      const wheel = container.querySelector("#wheelCanvas");
      const ctx = wheel.getContext("2d");

      ctx.clearRect(0, 0, 300, 300);

      const sliceAngle = (2 * Math.PI) / remainingNames.length;
      const colors = ["#ff9999", "#ffcc99", "#ffff99", "#ccff99", "#99ccff"];

      remainingNames.forEach((name, i) => {
        const start = currentRotation + i * sliceAngle;
        const end = start + sliceAngle;

        ctx.beginPath();
        ctx.moveTo(150, 150);
        ctx.arc(150, 150, 150, start, end);
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.translate(150, 150);
        ctx.rotate(start + sliceAngle / 2);
        ctx.textAlign = "right";
        ctx.font = "18px Arial";
        ctx.fillStyle = "black";
        ctx.fillText(name, 140, 10);
        ctx.restore();
      });

      // Arrow
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.moveTo(150, 5);
      ctx.lineTo(140, 25);
      ctx.lineTo(160, 25);
      ctx.closePath();
      ctx.fill();
    }

    /* ------------ SPIN ANIMATION ------------- */
    function spinWheel() {
      const spinBtn = container.querySelector("#spinBtn");
      spinBtn.disabled = true;

      const spinAmount = Math.random() * 4 + 4;
      const targetRotation = currentRotation + spinAmount * Math.PI * 2;
      const duration = 3500;
      const startTime = performance.now();
      const startRotation = currentRotation;

      function animate(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);

        currentRotation =
          startRotation + (targetRotation - startRotation) * easeOut;

        drawWheel();

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          currentRotation = targetRotation;
          determineWinner();
        }
      }

      requestAnimationFrame(animate);
    }

    /* ------------ DETERMINE WINNER ------------- */
    function determineWinner() {
      const sliceAngle = (2 * Math.PI) / remainingNames.length;
      const pointerAngle = -Math.PI / 2;

      let relativeAngle = pointerAngle - currentRotation;
      relativeAngle =
        (relativeAngle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

      const index = Math.floor(relativeAngle / sliceAngle);
      const landedName = remainingNames[index];

      if (landedName === playerName) {
        onComplete?.({ result: "player_lost" });
        showEndScreen("Bad Luck!");
      } else {
        onComplete?.({ result: "player_safe", loser: landedName });
        showEndScreen(`${landedName} Pays!`);
      }
    }

    function showEndScreen(text) {
      container.innerHTML = `<h1>${text}</h1>`;
      setTimeout(showNameScreen, 4000);
    }

    /* ------------ START GAME ------------ */
    showNameScreen();

    return () => {
      container.innerHTML = "";
    };
  }, [onComplete]);

  return (
    <div
      ref={containerRef}
      style={{
        background: "white",
        padding: "30px",
        width: "420px",
        borderRadius: "15px",
        boxShadow: "0px 4px 12px rgba(0,0,0,0.25)",
        textAlign: "center",
        margin: "0 auto",
      }}
    />
  );
}
