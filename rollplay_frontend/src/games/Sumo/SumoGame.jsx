// src/games/Sumo/SumoGame.jsx
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Sumo — WebSocket multiplayer simulation with win conditions.
 * Desktop: keyboard controls
 * Phone: on-screen touch controls
 */

const defaultWsBase =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "ws://localhost:3000/ws"
    : "wss://comp2003-ars.onrender.com/ws";

const WS_URL = (
  import.meta.env.VITE_WS_URL ||
  import.meta.env.VITE_BACKEND_WS_URL ||
  defaultWsBase
).replace(/\/$/, "");

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
  const rafRef = useRef(0);

  const [statusLine, setStatusLine] = useState("");
  const [connLine, setConnLine] = useState("disconnected");
  const [summaryLine, setSummaryLine] = useState("");
  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );
  const [mobilePress, setMobilePress] = useState({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  const wsRef = useRef(null);
  const runningRef = useRef(false);
  const isUnmountingRef = useRef(false);

  const inputByKeyRef = useRef(new Map());
  const lastHostStateRef = useRef(null);
  const lastHostStateAtRef = useRef(0);
  const announcedRef = useRef(false);
  const onRoundCompleteRef = useRef(onRoundComplete);

  const mobileInputRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  useEffect(() => {
    onRoundCompleteRef.current = onRoundComplete;
  }, [onRoundComplete]);

  useEffect(() => {
    function handleResize() {
      setScreenWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function wsSend(obj) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
  }

  const code = sessionCode || localStorage.getItem("session_code") || "local";

  const isPhoneLike =
    typeof window !== "undefined" &&
    screenWidth <= 820 &&
    (navigator.maxTouchPoints > 0 || "ontouchstart" in window);

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

  const myRoleLabel =
    myControlIndex === -1 ? "Spectating" : `You are P${myControlIndex + 1}`;

  function setTouchDir(dir, pressed) {
    mobileInputRef.current = {
      ...mobileInputRef.current,
      [dir]: pressed,
    };

    setMobilePress((prev) => ({
      ...prev,
      [dir]: pressed,
    }));
  }

  function clearTouchDirs() {
    mobileInputRef.current = {
      up: false,
      down: false,
      left: false,
      right: false,
    };

    setMobilePress({
      up: false,
      down: false,
      left: false,
      right: false,
    });
  }

  function bindTouchButton(dir) {
    return {
      onTouchStart: (e) => {
        e.preventDefault();
        setTouchDir(dir, true);
      },
      onTouchEnd: (e) => {
        e.preventDefault();
        setTouchDir(dir, false);
      },
      onTouchCancel: (e) => {
        e.preventDefault();
        setTouchDir(dir, false);
      },
      onMouseDown: (e) => {
        e.preventDefault();
        setTouchDir(dir, true);
      },
      onMouseUp: (e) => {
        e.preventDefault();
        setTouchDir(dir, false);
      },
      onMouseLeave: () => {
        setTouchDir(dir, false);
      },
    };
  }

  useEffect(() => {
    function handleGlobalRelease() {
      clearTouchDirs();
    }

    window.addEventListener("mouseup", handleGlobalRelease);
    window.addEventListener("touchend", handleGlobalRelease);
    window.addEventListener("touchcancel", handleGlobalRelease);
    window.addEventListener("blur", handleGlobalRelease);

    return () => {
      window.removeEventListener("mouseup", handleGlobalRelease);
      window.removeEventListener("touchend", handleGlobalRelease);
      window.removeEventListener("touchcancel", handleGlobalRelease);
      window.removeEventListener("blur", handleGlobalRelease);
    };
  }, []);

  useEffect(() => {
    if (!active.hasTwo) return;
    if (runningRef.current) return;

    isUnmountingRef.current = false;
    runningRef.current = true;
    announcedRef.current = false;
    inputByKeyRef.current = new Map();
    lastHostStateRef.current = null;
    lastHostStateAtRef.current = 0;

    const canvas = canvasRef.current;
    if (!canvas) {
      runningRef.current = false;
      return;
    }

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

      if (mobileInputRef.current.up) ay -= 1;
      if (mobileInputRef.current.down) ay += 1;
      if (mobileInputRef.current.left) ax -= 1;
      if (mobileInputRef.current.right) ax += 1;

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

      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#1b1f2a");
      bg.addColorStop(1, "#0d1018");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const ringGlow = ctx.createRadialGradient(
        arena.x,
        arena.y,
        10,
        arena.x,
        arena.y,
        arena.radius + 40
      );
      ringGlow.addColorStop(0, "rgba(244,196,49,0.10)");
      ringGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(arena.x, arena.y, arena.radius + 26, 0, Math.PI * 2);
      ctx.fillStyle = ringGlow;
      ctx.fill();

      const grd = ctx.createRadialGradient(
        arena.x,
        arena.y,
        10,
        arena.x,
        arena.y,
        arena.radius
      );
      grd.addColorStop(0, "rgba(255,255,255,0.08)");
      grd.addColorStop(1, "rgba(0,0,0,0.72)");

      ctx.beginPath();
      ctx.arc(arena.x, arena.y, arena.radius, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(arena.x, arena.y, arena.radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(244,196,49,0.35)";
      ctx.lineWidth = 7;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(arena.x, arena.y, arena.radius - 20, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(arena.x, arena.y, 18, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(244,196,49,0.16)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(arena.x, arena.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fill();
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
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fill();

      const g = ctx.createRadialGradient(
        p.x - p.r * 0.45,
        p.y - p.r * 0.45,
        4,
        p.x,
        p.y,
        p.r
      );
      g.addColorStop(0, "rgba(255,255,255,0.6)");
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
      const leftCardX = 16;
      const leftCardY = 14;
      const leftCardW = 184;
      const leftCardH = 52;

      ctx.fillStyle = "rgba(0,0,0,0.44)";
      ctx.fillRect(leftCardX, leftCardY, leftCardW, leftCardH);

      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.font = "bold 13px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText(isHost ? "HOST VIEW" : "PLAYER VIEW", leftCardX + 12, leftCardY + 18);

      ctx.fillStyle = "rgba(255,255,255,0.74)";
      ctx.font = "12px system-ui, -apple-system, Segoe UI, sans-serif";
      const roleLine =
        myControlIndex === -1 ? "Spectating this round" : `Control: P${myControlIndex + 1}`;
      ctx.fillText(roleLine, leftCardX + 12, leftCardY + 36);

      const timerW = 148;
      const timerX = W / 2 - timerW / 2;
      const timerY = 14;

      ctx.fillStyle = "rgba(0,0,0,0.48)";
      ctx.fillRect(timerX, timerY, timerW, 50);

      ctx.textAlign = "center";
      ctx.fillStyle = state.roundOver
        ? "rgba(255,220,120,0.96)"
        : "rgba(255,255,255,0.96)";
      ctx.font = "bold 23px system-ui, -apple-system, Segoe UI, sans-serif";

      const timerText = state.roundOver ? "ROUND OVER" : `${Math.ceil(state.timeLeft)}`;
      ctx.fillText(timerText, W / 2, timerY + 31);
      ctx.textAlign = "left";
    }

    function drawBottomHint(state) {
      const hintW = 448;
      const hintH = 42;
      const hintX = W / 2 - hintW / 2;
      const hintY = H - 58;

      ctx.fillStyle = "rgba(0,0,0,0.40)";
      ctx.fillRect(hintX, hintY, hintW, hintH);

      ctx.textAlign = "center";
      ctx.font = "13px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.88)";

      let line = "Push your opponent out of the ring.";
      if (!state.roundOver) {
        line += " Closest to centre wins on timeout.";
      } else {
        line = "Round complete — waiting for session progress.";
      }

      ctx.fillText(line, W / 2, hintY + 25);
      ctx.textAlign = "left";
    }

    function drawWinnerPanel(state) {
      if (!state.roundOver) return;

      const panelW = 300;
      const panelH = 92;
      const panelX = W / 2 - panelW / 2;
      const panelY = H / 2 - panelH / 2;

      ctx.fillStyle = "rgba(10,10,16,0.78)";
      ctx.fillRect(panelX, panelY, panelW, panelH);

      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "bold 20px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText("Round Complete", W / 2, panelY + 30);

      let label = "No winner";
      if (state.winnerKey === active.p1Key) label = "Winner: P1";
      if (state.winnerKey === active.p2Key) label = "Winner: P2";

      ctx.font = "14px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.fillText(label, W / 2, panelY + 56);
      ctx.fillText("Loading next game soon...", W / 2, panelY + 76);
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

        if (
          !announcedRef.current &&
          typeof onRoundCompleteRef.current === "function"
        ) {
          announcedRef.current = true;
          onRoundCompleteRef.current({
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
      if (isUnmountingRef.current) return;

      setConnLine("connected");
      wsSend({
        type: "join",
        sessionCode: code,
        userId: myId || null,
      });

      setStatusLine(
        `room=${code} • ${isHost ? "host" : "client"} • ` +
          `P1=${active.p1Key} • P2=${active.p2Key}`
      );
    };

    ws.onclose = () => {
      if (isUnmountingRef.current) return;
      setConnLine("disconnected");
    };

    ws.onerror = (e) => {
      if (isUnmountingRef.current) return;
      console.warn("[SUMO] WS warning", e);
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
                const inp = inputByKeyRef.current.get(k) || { ax: 0, ay: 0 };
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
        const stalled = performance.now() - lastHostStateAtRef.current > 1500;
        if (stalled) {
          setConnLine("waiting for host state…");
        } else if (wsRef.current?.readyState === WebSocket.OPEN) {
          setConnLine("connected");
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
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      isUnmountingRef.current = true;
      runningRef.current = false;

      clearTouchDirs();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onCanvasPointerDown);

      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      const wsNow = wsRef.current;
      wsRef.current = null;

      if (
        wsNow &&
        (wsNow.readyState === WebSocket.OPEN ||
          wsNow.readyState === WebSocket.CONNECTING)
      ) {
        try {
          wsNow.close(1000, "component cleanup");
        } catch (_) {}
      }

      rafRef.current = 0;
    };
  }, [
    active.hasTwo,
    active.p1Key,
    active.p2Key,
    code,
    isHost,
    myControlIndex,
    myId,
  ]);

  if (!active.hasTwo) {
    return (
      <div style={waitingCard}>
        Waiting for 2 players (P1 + P2) to start Sumo…
      </div>
    );
  }

  return (
    <div style={shell}>
      <div style={topInfoCard}>
        <div style={infoBlock}>
          <div style={infoLabel}>Game</div>
          <div style={infoValue}>Sumo Showdown</div>
        </div>

        <div style={infoBlock}>
          <div style={infoLabel}>Role</div>
          <div style={infoValue}>{myRoleLabel}</div>
        </div>

        <div style={infoBlock}>
          <div style={infoLabel}>Connection</div>
          <div style={infoValue}>{connLine}</div>
        </div>
      </div>

      <p style={instructionText}>
        Push your opponent out of the ring. If the timer reaches zero, the
        wrestler closest to the centre wins.
      </p>

      <div style={statusText}>{statusLine}</div>

      <div style={canvasWrap}>
        <canvas
          ref={canvasRef}
          tabIndex={0}
          style={canvasStyle}
        />
      </div>

      {isPhoneLike && myControlIndex !== -1 && (
        <div style={mobileControlsWrap}>
          <div style={mobileHint}>Touch controls</div>

          <button
            type="button"
            style={{
              ...mobileButton,
              ...(mobilePress.up ? mobileButtonActive : {}),
            }}
            {...bindTouchButton("up")}
          >
            ↑
          </button>

          <div style={mobileMiddleRow}>
            <button
              type="button"
              style={{
                ...mobileButton,
                ...(mobilePress.left ? mobileButtonActive : {}),
              }}
              {...bindTouchButton("left")}
            >
              ←
            </button>

            <button
              type="button"
              style={{
                ...mobileButton,
                ...(mobilePress.down ? mobileButtonActive : {}),
              }}
              {...bindTouchButton("down")}
            >
              ↓
            </button>

            <button
              type="button"
              style={{
                ...mobileButton,
                ...(mobilePress.right ? mobileButtonActive : {}),
              }}
              {...bindTouchButton("right")}
            >
              →
            </button>
          </div>

          <div style={mobileHelpText}>
            Hold a direction to move your wrestler.
          </div>
        </div>
      )}

      <div style={summaryText}>{summaryLine}</div>
    </div>
  );
}

/* ---------- shared style direction for future games ---------- */

const shell = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const topInfoCard = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  padding: "12px 14px",
  borderRadius: 18,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const infoBlock = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minWidth: 100,
};

const infoLabel = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 1,
  opacity: 0.7,
};

const infoValue = {
  fontSize: 14,
  fontWeight: 700,
};

const instructionText = {
  fontSize: 14,
  textAlign: "center",
  maxWidth: 640,
  margin: "0 auto",
  opacity: 0.9,
  lineHeight: 1.6,
};

const statusText = {
  fontSize: 12,
  opacity: 0.72,
  textAlign: "center",
  minHeight: 18,
};

const canvasWrap = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
};

const canvasStyle = {
  width: "100%",
  maxWidth: 720,
  height: "auto",
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.18)",
  outline: "none",
  touchAction: "none",
  boxShadow: "0 16px 40px rgba(0,0,0,0.24)",
};

const summaryText = {
  fontSize: 14,
  textAlign: "center",
  minHeight: 20,
  opacity: 0.92,
};

const waitingCard = {
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
};

const mobileControlsWrap = {
  marginTop: 6,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
};

const mobileHint = {
  fontSize: 12,
  opacity: 0.78,
  textTransform: "uppercase",
  letterSpacing: 1,
};

const mobileMiddleRow = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  justifyContent: "center",
};

const mobileButton = {
  width: 66,
  height: 66,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.14)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
  color: "#fff",
  fontSize: 28,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  userSelect: "none",
  WebkitUserSelect: "none",
  touchAction: "none",
  WebkitTapHighlightColor: "transparent",
  boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
};

const mobileButtonActive = {
  background: "rgba(244,196,49,0.22)",
  border: "1px solid rgba(244,196,49,0.36)",
  transform: "scale(0.98)",
};

const mobileHelpText = {
  fontSize: 12,
  opacity: 0.74,
};
