import { useEffect, useRef } from "react";

export default function StackAttack({ onComplete }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    /* ---------------- ARENA ---------------- */
    const arena = { x: W / 2, y: H / 2, radius: 250 };

    /* ---------------- PLAYER ---------------- */
    const player = {
      x: W / 2,
      y: H / 2,
      radius: 20,
      speed: 4,
      vx: 0,
      vy: 0,
    };

    let mouse = { x: player.x, y: player.y };

    /* ---------------- ENEMIES ---------------- */
    const enemies = [];
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      enemies.push({
        x: arena.x + Math.cos(angle) * 150,
        y: arena.y + Math.sin(angle) * 150,
        radius: 20,
        vx: 0,
        vy: 0,
        alive: true,
      });
    }

    /* ---------------- INPUT ---------------- */
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    canvas.addEventListener("mousemove", handleMouseMove);

    /* ---------------- DRAWING ---------------- */
    function drawArena() {
      const grd = ctx.createRadialGradient(
        arena.x,
        arena.y,
        50,
        arena.x,
        arena.y,
        arena.radius
      );
      grd.addColorStop(0, "#444");
      grd.addColorStop(1, "#000");

      ctx.beginPath();
      ctx.arc(arena.x, arena.y, arena.radius, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    }

    function drawPlayer() {
      const grd = ctx.createRadialGradient(
        player.x,
        player.y,
        5,
        player.x,
        player.y,
        player.radius
      );
      grd.addColorStop(0, "#88ddff");
      grd.addColorStop(1, "#1a5c88");

      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    }

    function drawEnemies() {
      enemies.forEach((e) => {
        if (!e.alive) return;

        const grd = ctx.createRadialGradient(
          e.x,
          e.y,
          5,
          e.x,
          e.y,
          e.radius
        );
        grd.addColorStop(0, "#ffaaaa");
        grd.addColorStop(1, "#aa0000");

        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      });
    }

    function drawHUD() {
      ctx.fillStyle = "white";
      ctx.font = "18px Arial";
      ctx.fillText(
        `Enemies remaining: ${enemies.filter((e) => e.alive).length}`,
        20,
        30
      );

      ctx.font = "16px Arial";
      ctx.fillText(
        "Move your mouse to push enemies out of the arena",
        20,
        H - 20
      );
    }

    /* ---------------- LOGIC ---------------- */
    function movePlayer() {
      const dx = mouse.x - player.x;
      const dy = mouse.y - player.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 5) {
        player.vx = (dx / dist) * player.speed;
        player.vy = (dy / dist) * player.speed;
      } else {
        player.vx = 0;
        player.vy = 0;
      }

      player.x += player.vx;
      player.y += player.vy;

      const distFromCenter = Math.hypot(
        player.x - arena.x,
        player.y - arena.y
      );
      if (distFromCenter > arena.radius - player.radius) {
        const angle = Math.atan2(
          player.y - arena.y,
          player.x - arena.x
        );
        player.x =
          arena.x + Math.cos(angle) * (arena.radius - player.radius);
        player.y =
          arena.y + Math.sin(angle) * (arena.radius - player.radius);
      }
    }

    function moveEnemies() {
      enemies.forEach((e) => {
        if (!e.alive) return;

        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const dist = Math.hypot(dx, dy) || 1;

        e.vx = (dx / dist) * 2;
        e.vy = (dy / dist) * 2;
        e.x += e.vx;
        e.y += e.vy;

        const distToCenter = Math.hypot(
          e.x - arena.x,
          e.y - arena.y
        );
        if (distToCenter > arena.radius - e.radius) {
          e.alive = false;
        }
      });
    }

    function checkWin() {
      if (enemies.every((e) => !e.alive)) {
        onComplete?.({ winner: "player" });
      }
    }

    /* ---------------- LOOP ---------------- */
    let animationId;

    function loop() {
      ctx.clearRect(0, 0, W, H);
      drawArena();
      movePlayer();
      moveEnemies();
      drawPlayer();
      drawEnemies();
      drawHUD();
      checkWin();
      animationId = requestAnimationFrame(loop);
    }

    loop();

    return () => {
      cancelAnimationFrame(animationId);
      canvas.removeEventListener("mousemove", handleMouseMove);
    };
  }, [onComplete]);

  return (
    <div style={{ textAlign: "center" }}>
      <h1 style={{ color: "white" }}>Stack Attack</h1>
      <p style={{ color: "#ccc" }}>
        Push all enemies out of the arena to win
      </p>
      <canvas
        ref={canvasRef}
        width={600}
        height={600}
        style={{
          border: "4px solid #555",
          borderRadius: "10px",
          background: "#222",
        }}
      />
    </div>
  );
}
