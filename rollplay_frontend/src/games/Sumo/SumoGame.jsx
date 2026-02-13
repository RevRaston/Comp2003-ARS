// src/games/Sumo/SumoGame.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabase";

/**
 * Sumo (MVP) — Supabase Realtime multiplayer simulation (hardened)
 *
 * Host-authoritative:
 *  - Host runs physics and broadcasts "state" (~25hz)
 *  - Clients send only "input" (~20hz)
 *  - Clients render mirrored state
 *
 * Additions:
 *  - Rate limiting (prevents channel overload / freeze)
 *  - Connection status + error logging
 *  - Host heartbeat monitor (clients detect stalled host)
 */
export default function SumoGame({
  sessionCode,
  isHost,
  players,
  myUserId,
  mySeatIndex,
}) {
  const canvasRef = useRef(null);

  const [statusLine, setStatusLine] = useState("");
  const [connLine, setConnLine] = useState("connecting…");

  // Keep channel + runtime refs stable without re-subscribing on every render
  const channelRef = useRef(null);
  const runningRef = useRef(false);

  function getUserKey(p) {
    if (!p) return "";
    const k =
      p.user_id ??
      p.userId ??
      p.auth_user_id ??
      p.profile_id ??
      p.profileId ??
      p.owner_id ??
      p.ownerId ??
      p.id;
    return k ? String(k) : "";
  }

  const code = sessionCode || localStorage.getItem("session_code") || "local";
  const channelName = useMemo(() => `sumo:${code}`, [code]);

  const active = useMemo(() => {
    const list = Array.isArray(players) ? players : [];
    const p1 = list[0] || null;
    const p2 = list[1] || null;

    const p1Key = getUserKey(p1);
    const p2Key = getUserKey(p2);

    return { p1, p2, p1Key, p2Key, hasTwo: Boolean(p1Key && p2Key) };
  }, [players]);

  const myId = myUserId ? String(myUserId) : "";

  const myControlIndex = useMemo(() => {
    if (!active.hasTwo) return -1;

    if (myId && myId === active.p1Key) return 0;
    if (myId && myId === active.p2Key) return 1;

    if (mySeatIndex === 0) return 0;
    if (mySeatIndex === 1) return 1;

    return -1;
  }, [active.hasTwo, active.p1Key, active.p2Key, myId, mySeatIndex]);

  useEffect(() => {
    if (!active.hasTwo) return;

    // Prevent double-start if React strict mode mounts twice (dev)
    if (runningRef.current) return;
    runningRef.current = true;

    let raf = 0;
    let channel = null;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // Fixed internal sim size
    const W = 680;
    const H = 420;
    canvas.width = W;
    canvas.height = H;

    const arena = { x: W / 2, y: H / 2, radius: Math.min(W, H) * 0.40 };
    const P_RADIUS = 18;

    // World (authoritative on host)
    const worldRef = {
      tick: 0,
      players: [
        { key: active.p1Key, x: arena.x - 70, y: arena.y, r: P_RADIUS, vx: 0, vy: 0 },
        { key: active.p2Key, x: arena.x + 70, y: arena.y, r: P_RADIUS, vx: 0, vy: 0 },
      ],
    };

    // Inputs stored on host
    const inputByKey = new Map();

    // Latest state time (clients use to detect stall)
    let lastHostStateAt = performance.now();

    // Local input
    const keys = new Set();
    const localAxes = { ax: 0, ay: 0 };

    function computeAxes() {
      let ax = 0;
      let ay = 0;
      if (keys.has("w") || keys.has("W") || keys.has("ArrowUp")) ay -= 1;
      if (keys.has("s") || keys.has("S") || keys.has("ArrowDown")) ay += 1;
      if (keys.has("a") || keys.has("A") || keys.has("ArrowLeft")) ax -= 1;
      if (keys.has("d") || keys.has("D") || keys.has("ArrowRight")) ax += 1;

      const d = Math.hypot(ax, ay) || 1;
      if (ax !== 0 || ay !== 0) {
        ax /= d;
        ay /= d;
      }
      return { ax, ay };
    }

    function onKeyDown(e) {
      keys.add(e.key);
    }
    function onKeyUp(e) {
      keys.delete(e.key);
    }

    function onCanvasPointerDown() {
      canvas.focus?.();
      window.focus();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onCanvasPointerDown);

    // Physics
    const ACCEL = 0.55;
    const MAX_SPEED = 6.2;
    const FRICTION = 0.88;
    const BOUNCE = 0.35;
    const PUSH = 0.9;

    function normalize(x, y) {
      const d = Math.hypot(x, y) || 1;
      return [x / d, y / d];
    }

    function applyInput(p, ax, ay) {
      p.vx += ax * ACCEL;
      p.vy += ay * ACCEL;

      const sp = Math.hypot(p.vx, p.vy);
      if (sp > MAX_SPEED) {
        const [nx, ny] = normalize(p.vx, p.vy);
        p.vx = nx * MAX_SPEED;
        p.vy = ny * MAX_SPEED;
      }
    }

    function integrate(p) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= FRICTION;
      p.vy *= FRICTION;
      if (Math.abs(p.vx) < 0.01) p.vx = 0;
      if (Math.abs(p.vy) < 0.01) p.vy = 0;
    }

    function keepInsideArena(p) {
      const dx = p.x - arena.x;
      const dy = p.y - arena.y;
      const dist = Math.hypot(dx, dy);
      const maxDist = arena.radius - p.r;

      if (dist > maxDist) {
        const [nx, ny] = normalize(dx, dy);
        p.x = arena.x + nx * maxDist;
        p.y = arena.y + ny * maxDist;

        const vDotN = p.vx * nx + p.vy * ny;
        if (vDotN > 0) {
          p.vx = p.vx - (1 + BOUNCE) * vDotN * nx;
          p.vy = p.vy - (1 + BOUNCE) * vDotN * ny;
        }
      }
    }

    function resolveCollision(a, b) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const minDist = a.r + b.r;

      if (dist < minDist) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;

        a.x -= nx * (overlap / 2);
        a.y -= ny * (overlap / 2);
        b.x += nx * (overlap / 2);
        b.y += ny * (overlap / 2);

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const velAlongNormal = rvx * nx + rvy * ny;

        if (velAlongNormal < 0) {
          const j = (-velAlongNormal) * PUSH;
          const ix = j * nx;
          const iy = j * ny;
          a.vx -= ix;
          a.vy -= iy;
          b.vx += ix;
          b.vy += iy;
        }
      }
    }

    // Drawing
    function drawArena() {
      ctx.clearRect(0, 0, W, H);

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
    }

    function drawPlayer(p, color) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + p.r + 6, p.r * 1.1, p.r * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fill();

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

    function drawHUD(lines) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "13px system-ui, -apple-system, Segoe UI, sans-serif";
      let y = 18;
      for (const line of lines) {
        ctx.fillText(line, 14, y);
        y += 18;
      }
    }

    function drawFrame() {
      drawArena();

      const w = worldRef.players;

      // "you are blue on your screen"
      const blueIndex = myControlIndex === 1 ? 1 : 0;
      const redIndex = blueIndex === 0 ? 1 : 0;

      drawPlayer(w[blueIndex], "#4DD0FF");
      drawPlayer(w[redIndex], "#FF5C86");

      const stalled = !isHost && performance.now() - lastHostStateAt > 1200;

      drawHUD([
        "Click the game, then move (WASD or Arrow Keys).",
        myControlIndex === -1 ? "Spectating (not P1/P2)." : `You control P${myControlIndex + 1} (BLUE).`,
        stalled ? "⚠ Host state stalled (no updates)." : "No win condition yet — just push!",
      ]);
    }

    // Realtime
    function sendBroadcast(event, payload) {
      channel?.send({ type: "broadcast", event, payload });
    }

    function applyStateFromHost(payload) {
      if (!payload?.players || payload.players.length < 2) return;

      lastHostStateAt = performance.now();
      worldRef.tick = payload.tick ?? worldRef.tick;

      for (let i = 0; i < 2; i++) {
        const s = payload.players[i];
        const p = worldRef.players[i];
        if (!s || !p) continue;

        p.key = s.key ?? p.key;
        p.x = s.x ?? p.x;
        p.y = s.y ?? p.y;
        p.vx = s.vx ?? p.vx;
        p.vy = s.vy ?? p.vy;
        p.r = s.r ?? p.r;
      }
    }

    // --- IMPORTANT RATE LIMITS ---
    const INPUT_HZ = 20;   // clients -> host
    const STATE_HZ = 25;   // host -> clients
    const INPUT_MS = 1000 / INPUT_HZ;
    const STATE_MS = 1000 / STATE_HZ;

    let lastInputSend = 0;
    let lastStateSend = 0;

    // Subscribe
    channel = supabase.channel(channelName, { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    channel.on("broadcast", { event: "input" }, ({ payload }) => {
      if (!isHost) return;
      const k = payload?.key ? String(payload.key) : "";
      if (!k) return;

      inputByKey.set(k, {
        ax: Number(payload.ax) || 0,
        ay: Number(payload.ay) || 0,
        t: Number(payload.t) || 0,
      });
    });

    channel.on("broadcast", { event: "state" }, ({ payload }) => {
      if (isHost) return;
      applyStateFromHost(payload);
    });

    channel.subscribe((s) => {
      setConnLine(String(s));
      if (s === "SUBSCRIBED") {
        setConnLine("SUBSCRIBED ✅");
      }
      if (s === "CHANNEL_ERROR") {
        console.error("Sumo channel error:", channelName);
      }
      if (s === "TIMED_OUT") {
        console.warn("Sumo channel timed out:", channelName);
      }
      if (s === "CLOSED") {
        console.warn("Sumo channel closed:", channelName);
      }
    });

    setStatusLine(
      `Sumo realtime: ${isHost ? "HOST" : "CLIENT"} — ${channelName} — ` +
        `P1=${active.p1Key} P2=${active.p2Key} you=${myId || "?"} control=${myControlIndex}`
    );

    // Loop
    let lastNow = performance.now();
    const STEP = 1000 / 60;
    let acc = 0;

    const hostControlIndex = isHost && myControlIndex !== -1 ? myControlIndex : 0;

    function tick(now) {
      const dt = now - lastNow;
      lastNow = now;
      acc += dt;

      // Local axes (from keyboard)
      const axes = computeAxes();
      localAxes.ax = axes.ax;
      localAxes.ay = axes.ay;

      // CLIENT: send input at ~20Hz only (prevents spam freeze)
      if (!isHost && myControlIndex !== -1 && now - lastInputSend >= INPUT_MS) {
        lastInputSend = now;
        const myKey = myControlIndex === 0 ? active.p1Key : active.p2Key;
        if (myKey) {
          sendBroadcast("input", { key: String(myKey), ax: localAxes.ax, ay: localAxes.ay, t: now });
        }
      }

      while (acc >= STEP) {
        if (isHost) {
          const w = worldRef.players;

          for (let idx = 0; idx < 2; idx++) {
            let ax = 0;
            let ay = 0;

            if (idx === hostControlIndex) {
              ax = localAxes.ax;
              ay = localAxes.ay;
            } else {
              const otherKey = idx === 0 ? active.p1Key : active.p2Key;
              const inp = otherKey ? inputByKey.get(String(otherKey)) : null;
              ax = inp?.ax || 0;
              ay = inp?.ay || 0;
            }

            if (ax !== 0 || ay !== 0) applyInput(w[idx], ax, ay);
          }

          integrate(w[0]);
          integrate(w[1]);

          resolveCollision(w[0], w[1]);
          keepInsideArena(w[0]);
          keepInsideArena(w[1]);

          worldRef.tick += 1;
        }

        acc -= STEP;
      }

      drawFrame();

      // HOST: broadcast state at ~25Hz only (prevents spam freeze)
      if (isHost && now - lastStateSend >= STATE_MS) {
        lastStateSend = now;
        sendBroadcast("state", {
          tick: worldRef.tick,
          players: worldRef.players.map((p) => ({
            key: p.key,
            x: p.x,
            y: p.y,
            vx: p.vx,
            vy: p.vy,
            r: p.r,
          })),
        });
      }

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onCanvasPointerDown);

      if (channel) supabase.removeChannel(channel);
      channelRef.current = null;
      runningRef.current = false;
    };
  }, [
    active.hasTwo,
    active.p1Key,
    active.p2Key,
    channelName,
    isHost,
    myControlIndex,
    myId,
  ]);

  if (!active.hasTwo) {
    return (
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          margin: "0 auto",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(0,0,0,0.18)",
          padding: 14,
          textAlign: "center",
          fontSize: 13,
          opacity: 0.85,
        }}
      >
        Waiting for 2 players (P1 + P2) to start Sumo…
      </div>
    );
  }

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.75, textAlign: "center" }}>
        {statusLine}
        <div style={{ opacity: 0.7, marginTop: 4 }}>{connLine}</div>
      </div>

      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <canvas
          ref={canvasRef}
          tabIndex={0}
          style={{
            width: "100%",
            maxWidth: 720,
            height: "auto",
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(0,0,0,0.18)",
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}
