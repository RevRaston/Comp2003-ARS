// src/games/Sumo/SumoGameOnlineSim.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";

const ROUND_TIME = 20; // seconds
const INPUT_HZ = 20;
const STATE_HZ = 25;

/**
 * Helper to consistently extract a user key from session players.
 */
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

export default function SumoGameOnlineSim({
  sessionCode,
  localUserId,
  players = [],
  isHost,
}) {
  const canvasRef = useRef(null);

  const [debugLine, setDebugLine] = useState("");
  const [hudRole, setHudRole] = useState("");
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [winnerInfo, setWinnerInfo] = useState(null);

  const bcRef = useRef(null);
  const worldRef = useRef(null); // host-only world
  const lastStateFromHostRef = useRef(null); // latest state snapshot for clients
  const inputByUserRef = useRef(new Map());
  const runningRef = useRef(false);

  const lastHostStateAtRef = useRef(0);

  const sendInputTimerRef = useRef(0);
  const sendStateTimerRef = useRef(0);

  const roomId = sessionCode || "local";
  const myKey = localUserId ? String(localUserId) : "local";

  // First two session players are our P1/P2
  const active = useMemo(() => {
    const list = Array.isArray(players) ? players : [];
    const p1 = list[0] || null;
    const p2 = list[1] || null;

    const p1Key = getUserKey(p1);
    const p2Key = getUserKey(p2);

    return { p1, p2, p1Key, p2Key, hasTwo: Boolean(p1Key && p2Key) };
  }, [players]);

  // Which slot does THIS user control? (0,1 or -1 spectator)
  const myControlIndex = useMemo(() => {
    if (!active.hasTwo) return -1;
    if (myKey === active.p1Key) return 0;
    if (myKey === active.p2Key) return 1;
    return -1;
  }, [active.hasTwo, active.p1Key, active.p2Key, myKey]);

  // --- BroadcastChannel setup ------------------------------------------------
  useEffect(() => {
    const name = `sumo-room-${roomId}`;
    const bc = new BroadcastChannel(name);
    bcRef.current = bc;

    setHudRole(isHost ? "HOST (authoritative)" : "CLIENT");

    bc.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || msg.roomId !== roomId) return;

      if (msg.type === "input" && isHost) {
        const { userKey, ax, ay, t } = msg;
        if (!userKey) return;
        inputByUserRef.current.set(userKey, {
          ax: Number(ax) || 0,
          ay: Number(ay) || 0,
          t: Number(t) || 0,
        });
      }

      if (msg.type === "state" && !isHost) {
        lastHostStateAtRef.current = performance.now();
        lastStateFromHostRef.current = msg.payload;
      }
    };

    return () => {
      bc.close();
      bcRef.current = null;
    };
  }, [roomId, isHost]);

  // --- Main simulation & rendering -------------------------------------------
  useEffect(() => {
    if (!active.hasTwo) return;
    if (runningRef.current) return;
    runningRef.current = true;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const W = 680;
    const H = 420;
    canvas.width = W;
    canvas.height = H;

    const arena = { x: W / 2, y: H / 2, radius: Math.min(W, H) * 0.4 };
    const P_RADIUS = 18;

    // World state (host only)
    worldRef.current = {
      tick: 0,
      timeLeft: ROUND_TIME,
      roundOver: false,
      winnerKey: null,
      players: [
        {
          slot: 0,
          key: active.p1Key,
          x: arena.x - 70,
          y: arena.y,
          r: P_RADIUS,
          vx: 0,
          vy: 0,
          alive: true,
        },
        {
          slot: 1,
          key: active.p2Key,
          x: arena.x + 70,
          y: arena.y,
          r: P_RADIUS,
          vx: 0,
          vy: 0,
          alive: true,
        },
      ],
    };

    setTimeLeft(ROUND_TIME);
    setWinnerInfo(null);
    lastStateFromHostRef.current = null;
    lastHostStateAtRef.current = performance.now();
    inputByUserRef.current.clear();
    sendInputTimerRef.current = 0;
    sendStateTimerRef.current = 0;

    function onCanvasPointerDown() {
      canvas.focus?.();
      window.focus();
    }
    canvas.addEventListener("pointerdown", onCanvasPointerDown);

    // keyboard input
    const heldKeys = new Set();
    function onKeyDown(e) {
      heldKeys.add(e.key);
    }
    function onKeyUp(e) {
      heldKeys.delete(e.key);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    function computeAxes() {
      let ax = 0;
      let ay = 0;

      if (heldKeys.has("w") || heldKeys.has("W") || heldKeys.has("ArrowUp")) ay -= 1;
      if (heldKeys.has("s") || heldKeys.has("S") || heldKeys.has("ArrowDown")) ay += 1;
      if (heldKeys.has("a") || heldKeys.has("A") || heldKeys.has("ArrowLeft")) ax -= 1;
      if (heldKeys.has("d") || heldKeys.has("D") || heldKeys.has("ArrowRight")) ax += 1;

      const d = Math.hypot(ax, ay) || 1;
      if (ax !== 0 || ay !== 0) {
        ax /= d;
        ay /= d;
      }
      return { ax, ay };
    }

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
      if (!p.alive) return;
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
      if (!p.alive) return;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= FRICTION;
      p.vy *= FRICTION;
      if (Math.abs(p.vx) < 0.01) p.vx = 0;
      if (Math.abs(p.vy) < 0.01) p.vy = 0;
    }

    function keepInsideArena(p) {
      if (!p.alive) return;
      const dx = p.x - arena.x;
      const dy = p.y - arena.y;
      const dist = Math.hypot(dx, dy);
      const maxDist = arena.radius - p.r;

      if (dist > maxDist) {
        // consider this a ring-out
        p.alive = false;
      }
    }

    function resolveCollision(a, b) {
      if (!a.alive || !b.alive) return;

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
          const j = -velAlongNormal * PUSH;
          const ix = j * nx;
          const iy = j * ny;
          a.vx -= ix;
          a.vy -= iy;
          b.vx += ix;
          b.vy += iy;
        }
      }
    }

    function drawArena() {
      ctx.clearRect(0, 0, W, H);

      const grd = ctx.createRadialGradient(
        arena.x,
        arena.y,
        10,
        arena.x,
        arena.y,
        arena.radius
      );
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
      if (!p.alive) return;

      ctx.beginPath();
      ctx.ellipse(
        p.x,
        p.y + p.r + 6,
        p.r * 1.1,
        p.r * 0.5,
        0,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fill();

      const g = ctx.createRadialGradient(
        p.x - p.r * 0.4,
        p.y - p.r * 0.4,
        4,
        p.x,
        p.y,
        p.r
      );
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

    function drawHUD(localState) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "13px system-ui, -apple-system, Segoe UI, sans-serif";

      let y = 24;
      ctx.fillText(hudRole, 24, y);
      y += 18;

      const controlText =
        myControlIndex === -1
          ? "Controls: spectator (no dot)."
          : "Controls: WASD or Arrow keys";
      ctx.fillText(controlText, 24, y);
      y += 18;

      const youText =
        myControlIndex === -1
          ? "You are: spectator"
          : `You are: P${myControlIndex + 1}`;
      ctx.fillText(youText, 24, y);

      // top-centre: timer / winner
      ctx.textAlign = "center";
      const cx = W / 2;
      const topY = 24;

      if (localState.roundOver) {
        const winnerSlot =
          localState.winnerKey === active.p1Key
            ? 1
            : localState.winnerKey === active.p2Key
            ? 2
            : null;

        const label = winnerSlot ? `Winner: P${winnerSlot}` : "No winner";
        ctx.fillText("Round Over!", cx, topY);
        ctx.fillText(label, cx, topY + 18);
      } else {
        ctx.fillText(`Time: ${Math.ceil(localState.timeLeft)}`, cx, topY);
      }

      ctx.textAlign = "left";
    }

    // Game loop
    let lastNow = performance.now();
    const STEP = 1000 / 60;

    function frame(now) {
      const dt = now - lastNow;
      lastNow = now;

      const bc = bcRef.current;

      // --- local input → broadcast to host (host & client both send) ----
      sendInputTimerRef.current += dt;
      if (sendInputTimerRef.current >= 1000 / INPUT_HZ) {
        sendInputTimerRef.current = 0;
        if (bc && myControlIndex !== -1) {
          const { ax, ay } = computeAxes();
          bc.postMessage({
            type: "input",
            roomId,
            userKey: myKey,
            ax,
            ay,
            t: now,
          });
        }
      }

      // --- HOST: simulate and broadcast state ---------------------------
      if (isHost && worldRef.current) {
        const world = worldRef.current;

        if (!world.roundOver) {
          // integrate timer
          world.timeLeft -= dt / 1000;
          if (world.timeLeft < 0) world.timeLeft = 0;

          // apply input to each player
          for (const p of world.players) {
            const inp = inputByUserRef.current.get(p.key) || { ax: 0, ay: 0 };
            applyInput(p, inp.ax, inp.ay);
          }

          // integrate
          world.players.forEach(integrate);

          // collisions & ring-out
          if (world.players.length >= 2) {
            resolveCollision(world.players[0], world.players[1]);
          }
          world.players.forEach(keepInsideArena);

          // check ring-out winner
          const alivePlayers = world.players.filter((p) => p.alive);
          if (alivePlayers.length === 1) {
            world.roundOver = true;
            world.winnerKey = alivePlayers[0].key;
          } else if (alivePlayers.length === 0) {
            world.roundOver = true;
            world.winnerKey = null;
          }

          // timer-based winner
          if (!world.roundOver && world.timeLeft <= 0) {
            world.roundOver = true;

            // closest to centre wins (if both alive)
            let best = null;
            let bestDist = Infinity;

            for (const p of world.players) {
              if (!p.alive) continue;
              const d = Math.hypot(p.x - arena.x, p.y - arena.y);
              if (d < bestDist) {
                bestDist = d;
                best = p;
              }
            }

            world.winnerKey = best ? best.key : null;
          }

          world.tick += 1;
        }

        // send state
        sendStateTimerRef.current += dt;
        if (bc && sendStateTimerRef.current >= 1000 / STATE_HZ) {
          sendStateTimerRef.current = 0;
          const payload = {
            tick: world.tick,
            timeLeft: world.timeLeft,
            roundOver: world.roundOver,
            winnerKey: world.winnerKey,
            players: world.players.map((p) => ({
              key: p.key,
              x: p.x,
              y: p.y,
              r: p.r,
              alive: p.alive,
            })),
          };

          bc.postMessage({
            type: "state",
            roomId,
            payload,
          });

          // host also uses this for rendering the HUD (keeps it in same shape)
          lastStateFromHostRef.current = payload;
        }
      }

      // --- RENDER -------------------------------------------------------
      drawArena();

      const stateForRender =
        lastStateFromHostRef.current || worldRef.current || {
          timeLeft: ROUND_TIME,
          roundOver: false,
          winnerKey: null,
          players: [],
        };

      // figure out which slot is "blue" on this client
      const blueSlot = myControlIndex === 1 ? 1 : 0;
      const redSlot = blueSlot === 0 ? 1 : 0;

      const pBlue = stateForRender.players[blueSlot];
      const pRed = stateForRender.players[redSlot];

      if (pBlue) drawPlayer(pBlue, "#4DD0FF");
      if (pRed) drawPlayer(pRed, "#FF5C86");

      drawHUD(stateForRender);

      // update local React state for top text (for extra UI if needed)
      setTimeLeft(stateForRender.timeLeft);
      if (stateForRender.roundOver) {
        setWinnerInfo({
          winnerKey: stateForRender.winnerKey,
        });
      }

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);

    return () => {
      runningRef.current = false;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onCanvasPointerDown);
    };
  }, [active.hasTwo, active.p1Key, active.p2Key, roomId, myKey, myControlIndex, isHost, hudRole]);

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
      <div style={{ fontSize: 12, opacity: 0.78, textAlign: "left" }}>
        {debugLine}
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

      {/* Tiny text line below canvas if we ever want to use timeLeft / winnerInfo */}
      <div style={{ fontSize: 12, opacity: 0.72, textAlign: "center", minHeight: 18 }}>
        {winnerInfo && winnerInfo.winnerKey
          ? `Round over – winner decided.`
          : null}
      </div>
    </div>
  );
}