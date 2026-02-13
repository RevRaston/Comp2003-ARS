// server.mjs
console.log("🔥 RUNNING SERVER:");
console.log("🔥 PATH:", import.meta.url);

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";

// ⭐ SESSION LEVELS ROUTES (only /:sessionCode/levels)
import sessionLevelsRoutes from "./routes/sessionLevels.mjs";

// ✅ WebSockets
import { attachWs } from "./wsServer.mjs";

dotenv.config();

/* ---------------------------------------
   SESSION CODE GENERATOR
----------------------------------------- */
function generateSessionCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/* ---------------------------------------
   LOCAL GAME STATE (OLD MINI MVP MODE)
----------------------------------------- */
let currentGame = {
  players: [],
  total_cost: 0,
  rule: "winner_free",
};

/* ---------------------------------------
   EXPRESS + SUPABASE SETUP
----------------------------------------- */
const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// helper for authed Supabase instance
function supaForRequest(req) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
    global: { headers: { Authorization: req.headers.authorization || "" } },
  });
}

/* ---------------------------------------
   BASIC TEST ROUTE
----------------------------------------- */
app.get("/", (req, res) => {
  res.send("✅ RollPay backend is running!");
});

/* ---------------------------------------
   AUTH — SIGNUP
----------------------------------------- */
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: "User created!", data });
});

/* ---------------------------------------
   AUTH — SIGNIN
----------------------------------------- */
app.post("/signin", async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: "Signed in!", data });
});

/* ---------------------------------------
   CARDS
----------------------------------------- */
app.get("/cards", async (req, res) => {
  const supa = supaForRequest(req);

  const {
    data: { user },
    error: userErr,
  } = await supa.auth.getUser();

  if (userErr || !user) return res.status(401).json({ error: "Unauthorized" });

  const { data, error } = await supa
    .from("cards")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return res.status(400).json({ error: error.message });

  res.json({ cards: data });
});

app.post("/cards", async (req, res) => {
  const supa = supaForRequest(req);

  const {
    data: { user },
    error: userErr,
  } = await supa.auth.getUser();

  if (userErr || !user) return res.status(401).json({ error: "Unauthorized" });

  const { card_holder, card_number, expiry_month, expiry_year, cvv } = req.body;

  const { data, error } = await supa
    .from("cards")
    .insert([
      {
        user_id: user.id,
        card_holder,
        card_number,
        expiry_month,
        expiry_year,
        cvv,
      },
    ])
    .select();

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: "Card added!", data });
});

app.delete("/cards/:id", async (req, res) => {
  const supa = supaForRequest(req);

  const userInfo = await supa.auth.getUser();

  if (userInfo.error || !userInfo.data.user) {
    return res.status(401).json({
      error: "Token invalid",
      detail: userInfo.error,
    });
  }

  const user = userInfo.data.user;

  const { error } = await supa
    .from("cards")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", user.id);

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: "Card deleted!" });
});

/* ---------------------------------------
   MINI-MVP GAME LOGIC (LOCAL ONLY)
----------------------------------------- */
app.post("/game/players", (req, res) => {
  const { players, total_cost, rule } = req.body;

  if (!Array.isArray(players) || players.length < 2) {
    return res.status(400).json({ error: "Provide at least 2 players." });
  }

  const cleanPlayers = players.map((p) => ({ name: String(p).trim() }));
  const total = Number(total_cost);

  if (Number.isNaN(total) || total <= 0) {
    return res.status(400).json({ error: "Invalid total_cost" });
  }

  currentGame = {
    players: cleanPlayers,
    total_cost: total,
    rule: rule === "even_split" ? "even_split" : "winner_free",
  };

  res.json({ message: "Game created.", game: currentGame });
});

app.post("/game/start", (req, res) => {
  if (!currentGame.players || currentGame.players.length < 2) {
    return res.status(400).json({ error: "No game set." });
  }

  const { players, total_cost, rule } = currentGame;

  const shuffled = [...players].sort(() => Math.random() - 0.5);
  shuffled.forEach((p, i) => (p.rank = i + 1));

  let results;
  if (rule === "even_split") {
    const share = total_cost / players.length;
    results = shuffled.map((p) => ({
      ...p,
      recommended: Number(share.toFixed(2)),
    }));
  } else {
    const losers = shuffled.slice(1);
    const loserShare = total_cost / losers.length;

    results = shuffled.map((p, i) => ({
      ...p,
      recommended: i === 0 ? 0 : Number(loserShare.toFixed(2)),
    }));
  }

  currentGame.players = results;

  res.json({ players: results, rule, total_cost });
});

/* ---------------------------------------
   SESSION HOSTING (NEW SYSTEM)
----------------------------------------- */

// Host creates session
app.post("/sessions", async (req, res) => {
  const supa = supaForRequest(req);

  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) return res.status(401).json({ error: "Unauthorized" });

  let { total_cost, rule, host_name } = req.body;

  const total = Number(total_cost);
  if (Number.isNaN(total) || total <= 0) {
    return res.status(400).json({ error: "Invalid cost" });
  }

  let code;
  // generate unique code
  for (let i = 0; i < 10; i++) {
    const test = generateSessionCode();
    const { data: exists } = await supa
      .from("sessions")
      .select("id")
      .eq("code", test)
      .maybeSingle();

    if (!exists) {
      code = test;
      break;
    }
  }

  const { data: session, error } = await supa
    .from("sessions")
    .insert([
      {
        code,
        host_id: user.id,
        total_cost: total,
        rule,
        status: "waiting",
      },
    ])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  if (host_name) {
    await supa.from("session_players").insert([
      {
        session_id: session.id,
        user_id: user.id,
        name: host_name,
        is_host: true,
      },
    ]);
  }

  res.json({
    session_id: session.id,
    code: session.code,
    total_cost: session.total_cost,
    rule: session.rule,
  });
});

// Host starts the session
app.post("/sessions/:code/start", async (req, res) => {
  const { code } = req.params;
  const supa = supaForRequest(req);

  const { data: session, error: sessionErr } = await supa
    .from("sessions")
    .select("*")
    .eq("code", code)
    .single();

  if (sessionErr || !session) {
    return res.status(404).json({ error: "Session not found" });
  }

  if (session.status !== "waiting") {
    return res.status(400).json({ error: "Session already started" });
  }

  const { error: updateErr } = await supa
    .from("sessions")
    .update({ status: "in_progress" })
    .eq("id", session.id);

  if (updateErr) {
    return res.status(400).json({ error: updateErr.message });
  }

  res.json({
    success: true,
    message: "Session started!",
    session_id: session.id,
  });
});

// Lobby state
app.get("/sessions/:code", async (req, res) => {
  const supa = supaForRequest(req);
  const { code } = req.params;

  const {
    data: { user },
  } = await supa.auth.getUser();

  const { data: session, error } = await supa
    .from("sessions")
    .select("*")
    .eq("code", code)
    .single();

  if (error || !session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const { data: players } = await supa
    .from("session_players")
    .select("*")
    .eq("session_id", session.id);

  res.json({
    session,
    players,
    current_user_id: user ? user.id : null,
  });
});

// Join session
app.post("/sessions/:code/join", async (req, res) => {
  const { code } = req.params;
  const { name } = req.body;

  const supa = supaForRequest(req);

  const {
    data: { user },
  } = await supa.auth.getUser();

  const { data: session, error } = await supa
    .from("sessions")
    .select("*")
    .eq("code", code)
    .single();

  if (error || !session) {
    return res.status(404).json({ error: "Session not found" });
  }

  if (session.status !== "waiting") {
    return res.status(400).json({ error: "Session already started" });
  }

  const { data: row, error: joinErr } = await supa
    .from("session_players")
    .insert([
      {
        session_id: session.id,
        user_id: user?.id || null,
        name,
        is_host: false,
      },
    ])
    .select()
    .single();

  if (joinErr) return res.status(400).json({ error: joinErr.message });

  res.json({
    session_id: session.id,
    player_id: row.id,
    name: row.name,
  });
});

/* ---------------------------------------
   ⭐ SESSION LEVEL ROUTES (MOUNTED LAST)
----------------------------------------- */

// These handle only /sessions/:sessionCode/levels
app.use("/sessions", sessionLevelsRoutes);

/* ---------------------------------------
   START SERVER (HTTP + WS)
----------------------------------------- */
const PORT = Number(process.env.PORT) || 3000;

// Create a real HTTP server so ws can attach
const server = http.createServer(app);

// Attach WebSocket server
attachWs(server);

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`🧠 WS running at ws://localhost:${PORT}`);
});