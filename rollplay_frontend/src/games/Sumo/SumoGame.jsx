// src/games/Sumo/SumoGame.jsx
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Sumo — WebSocket multiplayer simulation with win conditions.
 *
 * Host:
 *  - Runs physics + timer + win logic
 *  - Broadcasts state regularly
 *
 * Clients:
 *  - Send input to host
 *  - Render host state
 *
 * Win:
 *  1) If a player is pushed out of the ring → other player wins.
 *  2) If 20s timer expires → whoever is closest to centre wins.
 */

const WS_URL =
  (import.meta.env.VITE_WS_URL &&
    import.meta.env.VITE_WS_URL.replace(/\/$/, "")) ||
  "ws://localhost:3000/ws";

const ROUND_TIME = 20;

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

export default function SumoGame({
  sessionCode,
  isHost,
  players,
  myUserId,
  mySeatIndex,
  onRoundComplete,
}) {
  const canvasRef = useRef(null);

  const [statusLine, setStatusLine] = useState("");
  const [connLine, setConnLine] = useState("disconnected");
  const [summaryLine, setSummaryLine] = useState("");

  const wsRef = useRef(null);
  const runningRef = useRef(false);

  const inputByKeyRef = useRef(new Map());
  const lastHostStateRef = useRef(null);
  const lastHostStateAtRef = useRef(0);
  const announcedRef = useRef(false);

  function wsSend(obj) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
  }

  const code = sessionCode || localStorage.getItem("session_code") || "local";

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
    if (runningRef.current) return;
    runningRef.current = true;
    announcedRef.current = false;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const W = 680;
    const H = 420;
    canvas.width = W;
    canvas.height = H;

    function onCanvasPointerDown() {
      canvas.focus?.();
      window.focus();
    }
    canvas.addEventListener("pointerdown", onCanvasPointerDown);

    const arena = { x: W / 2, y: H / 2, radius: Math.min(W, H) * 0.4 };
    const P_RADIUS = 18;

    const worldRef = {
      tick: 0,
      timeLeft: ROUND_TIME,
      roundOver: false,
      winnerKey: null,
      players: [
        {
          key: active.p1Key,
          x: arena.x - 70,
          y: arena.y,
          r: P_RADIUS,
          vx: 0,
          vy: 0,
          alive: true,
        },
        {
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

    const keys = new Set();

    function onKeyDown(e) {
      keys.add(e.key);
    }
    function onKeyUp(e) {
      keys.delete(e.key);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

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

    function checkRingOut(p) {
      if (!p.alive) return;
      const dx = p.x - arena.x;
      const dy = p.y - arena.y;
      const dist = Math.hypot(dx, dy);
      const limit = arena.radius - p.r * 0.1;

      if (dist > limit) {
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

    function drawTopBar(state) {
      const barX = 18;
      const barY = 16;
      const barW = 160;
      const barH = 42;

      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(barX, barY, barW, barH);

      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "13px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText(isHost ? "HOST" : "CLIENT", barX + 12, barY + 16);

      const roleLine =
        myControlIndex === -1
          ? "Spectating"
          : `You are P${myControlIndex + 1}`;
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillText(roleLine, barX + 12, barY + 33);

      // Timer panel
      const timerW = 140;
      const timerX = W / 2 - timerW / 2;
      const timerY = 14;

      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(timerX, timerY, timerW, 46);

      ctx.textAlign = "center";
      ctx.fillStyle = state.roundOver
        ? "rgba(255,220,120,0.95)"
        : "rgba(255,255,255,0.95)";
      ctx.font = "bold 22px system-ui, -apple-system, Segoe UI, sans-serif";

      const timerText = state.roundOver
        ? "ROUND OVER"
        : `${Math.ceil(state.timeLeft)}`;
      ctx.fillText(timerText, W / 2, timerY + 30);
      ctx.textAlign = "left";
    }

    function drawBottomHint(state) {
      const hintW = 420;
      const hintH = 40;
      const hintX = W / 2 - hintW / 2;
      const hintY = H - 54;

      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(hintX, hintY, hintW, hintH);

      ctx.textAlign = "center";
      ctx.font = "13px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.88)";

      let line = "Push your opponent out of the ring.";
      if (!state.roundOver) {
        line += " If time runs out, closest to centre wins.";
      } else {
        line = "Waiting for the next game...";
      }

      ctx.fillText(line, W / 2, hintY + 24);
      ctx.textAlign = "left";
    }

    function drawWinnerPanel(state) {
      if (!state.roundOver) return;

      const panelW = 280;
      const panelH = 84;
      const panelX = W / 2 - panelW / 2;
      const panelY = H / 2 - panelH / 2;

      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fillRect(panelX, panelY, panelW, panelH);

      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "bold 20px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText("Round Complete", W / 2, panelY + 28);

      let label = "No winner";
      if (state.winnerKey === active.p1Key) label = "Winner: P1";
      if (state.winnerKey === active.p2Key) label = "Winner: P2";

      ctx.font = "14px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.fillText(label, W / 2, panelY + 54);
      ctx.fillText("Loading next game soon...", W / 2, panelY + 72);
      ctx.textAlign = "left";
    }

    function drawFrame() {
      const state = lastHostStateRef.current || worldRef;

      drawArena();

      const blueIndex = myControlIndex === 1 ? 1 : 0;
      const redIndex = blueIndex === 0 ? 1 : 0;

      const pBlue = state.players[blueIndex];
      const pRed = state.players[redIndex];

      if (pBlue) drawPlayer(pBlue, "#4DD0FF");
      if (pRed) drawPlayer(pRed, "#FF5C86");

      drawTopBar(state);
      drawBottomHint(state);
      drawWinnerPanel(state);

      if (state.roundOver) {
        if (state.winnerKey === active.p1Key) {
          setSummaryLine("Round over — winner: P1.");
        } else if (state.winnerKey === active.p2Key) {
          setSummaryLine("Round over — winner: P2.");
        } else {
          setSummaryLine("Round over — no winner.");
        }

        if (!announcedRef.current && typeof onRoundComplete === "function") {
          announcedRef.current = true;
          onRoundComplete({
            winnerKey: state.winnerKey,
            timeLeft: state.timeLeft,
          });
        }
      } else {
        setSummaryLine("");
      }
    }

    setConnLine("connecting…");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnLine("connected ✅");
      wsSend({
        type: "join",
        sessionCode: code,
        userId: myId || null,
      });

      setStatusLine(
        `Sumo WS: ${isHost ? "HOST" : "CLIENT"} — room=${code} — ` +
          `P1=${active.p1Key} P2=${active.p2Key} you=${myId || "?"}`
      );
    };

    ws.onclose = () => {
      setConnLine("disconnected");
    };

    ws.onerror = (e) => {
      console.error("[SUMO] WS error", e);
      setConnLine("error");
    };

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (!msg || msg.sessionCode !== code) return;

      if (msg.type === "input" && isHost) {
        const payload = msg.payload || {};
        const k = payload.key ? String(payload.key) : "";
        if (!k) return;
        inputByKeyRef.current.set(k, {
          ax: Number(payload.ax) || 0,
          ay: Number(payload.ay) || 0,
          t: Number(payload.t) || 0,
        });
      }

      if (msg.type === "state" && !isHost) {
        const payload = msg.payload;
        if (!payload || !payload.players) return;
        lastHostStateRef.current = payload;
        lastHostStateAtRef.current = performance.now();
      }
    };

    const INPUT_MS = 1000 / 20;
    const STATE_MS = 1000 / 25;

    let lastInputSend = 0;
    let lastStateSend = 0;

    let lastNow = performance.now();
    const STEP = 1000 / 60;
    let acc = 0;

    const hostControlIndex =
      isHost && myControlIndex !== -1 ? myControlIndex : 0;

    function tick(now) {
      const dt = now - lastNow;
      lastNow = now;
      acc += dt;

      const { ax: localAx, ay: localAy } = computeAxes();

      if (!isHost && myControlIndex !== -1 && now - lastInputSend >= INPUT_MS) {
        lastInputSend = now;
        const myKey = myControlIndex === 0 ? active.p1Key : active.p2Key;
        if (myKey) {
          wsSend({
            type: "input",
            sessionCode: code,
            payload: {
              key: String(myKey),
              ax: localAx,
              ay: localAy,
              t: now,
            },
          });
        }
      }

      while (acc >= STEP) {
        if (isHost) {
          const w = worldRef;
          if (!w.roundOver) {
            w.timeLeft -= STEP / 1000;
            if (w.timeLeft < 0) w.timeLeft = 0;

            for (let i = 0; i < w.players.length; i++) {
              const p = w.players[i];

              let ax = 0;
              let ay = 0;

              if (i === hostControlIndex) {
                ax = localAx;
                ay = localAy;
              } else {
                const k = p.key ? String(p.key) : "";
                const inp = inputByKeyRef.current.get(k) || {
                  ax: 0,
                  ay: 0,
                };
                ax = inp.ax;
                ay = inp.ay;
              }

              applyInput(p, ax, ay);
            }

            w.players.forEach(integrate);
            if (w.players.length >= 2) {
              resolveCollision(w.players[0], w.players[1]);
            }
            w.players.forEach(checkRingOut);

            const alive = w.players.filter((p) => p.alive);
            if (alive.length === 1) {
              w.roundOver = true;
              w.winnerKey = alive[0].key;
            } else if (alive.length === 0 && !w.roundOver) {
              w.roundOver = true;
              w.winnerKey = null;
            }

            if (!w.roundOver && w.timeLeft <= 0) {
              w.roundOver = true;

              let best = null;
              let bestDist = Infinity;
              for (const p of w.players) {
                if (!p.alive) continue;
                const d = Math.hypot(p.x - arena.x, p.y - arena.y);
                if (d < bestDist) {
                  bestDist = d;
                  best = p;
                }
              }
              w.winnerKey = best ? best.key : null;
            }

            w.tick += 1;
          }
        }

        acc -= STEP;
      }

      if (!isHost) {
        const stalled =
          performance.now() - lastHostStateAtRef.current > 1500;
        if (stalled) {
          setConnLine("waiting for host state…");
        } else if (wsRef.current?.readyState === WebSocket.OPEN) {
          setConnLine("connected ✅");
        }
      }

      if (isHost && now - lastStateSend >= STATE_MS) {
        lastStateSend = now;
        const w = worldRef;
        const payload = {
          tick: w.tick,
          timeLeft: w.timeLeft,
          roundOver: w.roundOver,
          winnerKey: w.winnerKey,
          players: w.players.map((p) => ({
            key: p.key,
            x: p.x,
            y: p.y,
            r: p.r,
            alive: p.alive,
          })),
        };
        wsSend({
          type: "state",
          sessionCode: code,
          payload,
        });
        lastHostStateRef.current = JSON.parse(JSON.stringify(payload));
      }

      drawFrame();
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);

    return () => {
      runningRef.current = false;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onCanvasPointerDown);
      try {
        wsRef.current?.close();
      } catch (_) {}
      wsRef.current = null;
    };
  }, [
    active.hasTwo,
    active.p1Key,
    active.p2Key,
    code,
    isHost,
    myControlIndex,
    myId,
    onRoundComplete,
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
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <p
        style={{
          fontSize: 14,
          textAlign: "center",
          maxWidth: 640,
          margin: "0 auto 6px",
          opacity: 0.88,
        }}
      >
        Push your opponent out of the ring. If the timer reaches zero, the
        wrestler closest to the centre wins.
      </p>

      <div style={{ fontSize: 12, opacity: 0.75, textAlign: "center" }}>
        {statusLine}
        <div style={{ opacity: 0.7, marginTop: 4 }}>{connLine}</div>
      </div>

      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
        }}
      >
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

      <div
        style={{
          fontSize: 14,
          textAlign: "center",
          minHeight: 20,
          opacity: 0.92,
        }}
      >
        {summaryLine}
      </div>
    </div>
  );
}