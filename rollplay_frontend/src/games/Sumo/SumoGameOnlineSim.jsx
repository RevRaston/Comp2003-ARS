// src/games/Sumo/SumoGameOnlineSim.jsx
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Local "online" simulation using BroadcastChannel.
 * - Each TAB controls ONE player (localUserId)
 * - HOST tab runs physics and broadcasts world state
 * - Other tabs send input only, render host state
 *
 * Controls: WASD or Arrow keys (either works)
 */
export default function SumoGameOnlineSim({
  sessionCode,
  localUserId,
  players = [], // array of players from lobby (should include user_id)
  isHost = false,
}) {
  const canvasRef = useRef(null);

  // channel name stable per session
  const channelName = useMemo(
    () => `rollplay-sumo-${sessionCode || "local"}`,
    [sessionCode]
  );

  const bcRef = useRef(null);

  // authoritative world state (host sets it, clients receive it)
  const [world, setWorld] = useState(null);

  // host keeps input states for each player
  const inputsRef = useRef(new Map()); // userId -> {ax, ay}

  // local key tracking
  const keysRef = useRef(new Set());

  const simRef = useRef({
    lastTs: performance.now(),
    running: false,
    players: new Map(), // userId -> body
  });

  // Build list of userIds (max 4)
  const userIds = useMemo(() => {
    const ids = players
      .map((p) => p.user_id || p.id)
      .filter(Boolean);

    // unique + cap 4
    return Array.from(new Set(ids)).slice(0, 4);
  }, [players]);

  // Colors: local is blue, others red-ish (you can expand later)
  function colorFor(id) {
    return id === localUserId ? "#4DD0FF" : "#FF5C86";
  }

  // ---------------- BroadcastChannel setup ----------------
  useEffect(() => {
    const bc = new BroadcastChannel(channelName);
    bcRef.current = bc;

    bc.onmessage = (evt) => {
      const msg = evt.data;
      if (!msg?.type) return;

      if (msg.type === "sumo:state") {
        // host -> clients
        setWorld(msg.payload);
      }

      if (msg.type === "sumo:input" && isHost) {
        // clients -> host
        const { userId, ax, ay } = msg.payload || {};
        if (!userId) return;
        inputsRef.current.set(userId, { ax, ay });
      }

      if (msg.type === "sumo:hello" && isHost) {
        // if a client joins, ensure they have a default input entry
        const { userId } = msg.payload || {};
        if (!userId) return;
        if (!inputsRef.current.has(userId)) {
          inputsRef.current.set(userId, { ax: 0, ay: 0 });
        }
      }
    };

    // announce ourselves
    bc.postMessage({ type: "sumo:hello", payload: { userId: localUserId } });

    return () => {
      bc.close();
      bcRef.current = null;
    };
  }, [channelName, isHost, localUserId]);

  // ---------------- Key input (local tab) ----------------
  useEffect(() => {
    function onKeyDown(e) {
      keysRef.current.add(e.key);
    }
    function onKeyUp(e) {
      keysRef.current.delete(e.key);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Send input to host at ~30hz (good enough)
  useEffect(() => {
    const bc = bcRef.current;
    if (!bc) return;

    const tick = setInterval(() => {
      const keys = keysRef.current;

      // allow either WASD or arrows for everyone
      let ax = 0, ay = 0;
      if (keys.has("w") || keys.has("W") || keys.has("ArrowUp")) ay -= 1;
      if (keys.has("s") || keys.has("S") || keys.has("ArrowDown")) ay += 1;
      if (keys.has("a") || keys.has("A") || keys.has("ArrowLeft")) ax -= 1;
      if (keys.has("d") || keys.has("D") || keys.has("ArrowRight")) ax += 1;

      // normalize diagonal
      const mag = Math.hypot(ax, ay);
      if (mag > 0) {
        ax /= mag;
        ay /= mag;
      }

      bc.postMessage({
        type: "sumo:input",
        payload: { userId: localUserId, ax, ay },
      });
    }, 33);

    return () => clearInterval(tick);
  }, [localUserId]);

  // ---------------- Host physics simulation ----------------
  useEffect(() => {
    if (!isHost) return;

    const W = 640;
    const H = 420;

    const arena = {
      x: W / 2,
      y: H / 2,
      radius: Math.min(W, H) * 0.40,
    };

    const R = 18;

    // init bodies
    const bodies = new Map();
    const spawn = [
      { dx: -70, dy: 0 },
      { dx: 70, dy: 0 },
      { dx: 0, dy: -70 },
      { dx: 0, dy: 70 },
    ];

    userIds.forEach((id, i) => {
      const s = spawn[i] || spawn[0];
      bodies.set(id, {
        id,
        x: arena.x + s.dx,
        y: arena.y + s.dy,
        vx: 0,
        vy: 0,
        r: R,
      });

      if (!inputsRef.current.has(id)) {
        inputsRef.current.set(id, { ax: 0, ay: 0 });
      }
    });

    simRef.current.players = bodies;
    simRef.current.running = true;

    // physics params
    const ACCEL = 0.6;
    const MAX_SPEED = 6.2;
    const FRICTION = 0.88;
    const BOUNCE = 0.35;
    const PUSH = 0.95;

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const norm = (x, y) => {
      const d = Math.hypot(x, y) || 1;
      return [x / d, y / d];
    };

    function keepInside(p) {
      const dx = p.x - arena.x;
      const dy = p.y - arena.y;
      const dist = Math.hypot(dx, dy);
      const maxDist = arena.radius - p.r;
      if (dist > maxDist) {
        const [nx, ny] = norm(dx, dy);
        p.x = arena.x + nx * maxDist;
        p.y = arena.y + ny * maxDist;

        const vDotN = p.vx * nx + p.vy * ny;
        if (vDotN > 0) {
          p.vx = p.vx - (1 + BOUNCE) * vDotN * nx;
          p.vy = p.vy - (1 + BOUNCE) * vDotN * ny;
        }
      }
    }

    function resolveAllCollisions(arr) {
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i], b = arr[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 1;
          const minDist = a.r + b.r;

          if (dist < minDist) {
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            // separate equally
            a.x -= nx * (overlap / 2);
            a.y -= ny * (overlap / 2);
            b.x += nx * (overlap / 2);
            b.y += ny * (overlap / 2);

            // impulse
            const rvx = b.vx - a.vx;
            const rvy = b.vy - a.vy;
            const velAlong = rvx * nx + rvy * ny;

            if (velAlong < 0) {
              const jimp = (-velAlong) * PUSH;
              const ix = jimp * nx;
              const iy = jimp * ny;

              a.vx -= ix;
              a.vy -= iy;
              b.vx += ix;
              b.vy += iy;
            }
          }
        }
      }
    }

    function step() {
      if (!simRef.current.running) return;

      const arr = Array.from(bodies.values());

      // apply input -> accel
      for (const p of arr) {
        const inp = inputsRef.current.get(p.id) || { ax: 0, ay: 0 };
        p.vx += inp.ax * ACCEL;
        p.vy += inp.ay * ACCEL;

        const sp = Math.hypot(p.vx, p.vy);
        if (sp > MAX_SPEED) {
          const [nx, ny] = norm(p.vx, p.vy);
          p.vx = nx * MAX_SPEED;
          p.vy = ny * MAX_SPEED;
        }
      }

      // integrate + friction
      for (const p of arr) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= FRICTION;
        p.vy *= FRICTION;
      }

      // collisions
      resolveAllCollisions(arr);

      // arena clamp
      for (const p of arr) keepInside(p);

      // broadcast state
      const payload = {
        W,
        H,
        arena,
        players: arr.map((p) => ({ id: p.id, x: p.x, y: p.y, r: p.r })),
      };

      setWorld(payload);
      bcRef.current?.postMessage({ type: "sumo:state", payload });

      requestAnimationFrame(step);
    }

    requestAnimationFrame(step);

    return () => {
      simRef.current.running = false;
    };
  }, [isHost, userIds]);

  // ---------------- Render ----------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const W = world?.W || 640;
    const H = world?.H || 420;
    canvas.width = W;
    canvas.height = H;

    function draw() {
      ctx.clearRect(0, 0, W, H);

      const arena = world?.arena || { x: W / 2, y: H / 2, radius: Math.min(W, H) * 0.40 };

      // arena
      const grd = ctx.createRadialGradient(arena.x, arena.y, 10, arena.x, arena.y, arena.radius);
      grd.addColorStop(0, "rgba(255,255,255,0.06)");
      grd.addColorStop(1, "rgba(0,0,0,0.65)");
      ctx.beginPath();
      ctx.arc(arena.x, arena.y, arena.radius, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(arena.x, arena.y, arena.radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 6;
      ctx.stroke();

      // players
      const list = world?.players || [];
      for (const p of list) {
        const color = colorFor(p.id);

        // shadow
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + p.r + 6, p.r * 1.1, p.r * 0.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fill();

        // body
        const g = ctx.createRadialGradient(p.x - p.r * 0.4, p.y - p.r * 0.4, 4, p.x, p.y, p.r);
        g.addColorStop(0, "rgba(255,255,255,0.55)");
        g.addColorStop(1, color);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // HUD
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "13px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText(isHost ? "HOST (authoritative)" : "CLIENT", 14, 20);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText("Controls: WASD or Arrow keys", 14, 40);
      ctx.fillText(`You are: ${localUserId === userIds[0] ? "P1" : "Player"}`, 14, 60);
    }

    draw();
  }, [world, isHost, localUserId, userIds]);

  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          maxWidth: 720,
          height: "auto",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(0,0,0,0.18)",
        }}
      />
    </div>
  );
}
