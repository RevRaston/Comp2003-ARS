console.log("🔥 RUNNING SERVER:");
console.log("🔥 PATH:", import.meta.url);

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

/* ---------------------------------------
   SESSION CODE GENERATOR
----------------------------------------- */
function generateSessionCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoids similar chars
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/* ---------------------------------------
   MINI-MVP GAME STATE (LOCAL ONLY)
----------------------------------------- */
let currentGame = {
  players: [],
  total_cost: 0,
  rule: "winner_free"
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

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function supaForRequest(req) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
    global: { headers: { Authorization: req.headers.authorization || "" } }
  });
}

/* ---------------------------------------
   ROOT ROUTE
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
    password
  });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: "Signed in!", data });
});

/* ---------------------------------------
   GET /cards
----------------------------------------- */
console.log("🔧 REGISTERING GET /cards ROUTE");

app.get("/cards", async (req, res) => {
  const supa = supaForRequest(req);

  const { data: { user }, error: userErr } = await supa.auth.getUser();
  if (userErr || !user) return res.status(401).json({ error: "Unauthorized" });

  const { data, error } = await supa
    .from("cards")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return res.status(400).json({ error: error.message });

  res.json({ cards: data });
});

/* ---------------------------------------
   POST /cards
----------------------------------------- */
console.log("🔧 REGISTERING POST /cards ROUTE");

app.post("/cards", async (req, res) => {
  console.log("AUTH HEADER:", req.headers.authorization);

  const supa = supaForRequest(req);

  const { data: { user }, error: userErr } = await supa.auth.getUser();
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
        cvv
      }
    ])
    .select();

  if (error) return res.status(400).json({ error: error.message });

  res.json({ message: "Card added!", data });
});

/* ---------------------------------------
   DELETE /cards/:id
----------------------------------------- */
console.log("🔧 REGISTERING DELETE /cards/:id ROUTE");

app.delete("/cards/:id", async (req, res) => {
  console.log("🔥 DELETE ROUTE HIT");
  console.log("🔥 AUTH HEADER:", req.headers.authorization);

  const supa = supaForRequest(req);
  const userInfo = await supa.auth.getUser();

  console.log("🔥 SUPABASE getUser() RESULT:", JSON.stringify(userInfo, null, 2));

  if (userInfo.error || !userInfo.data.user) {
    return res.status(401).json({
      error: "Token invalid",
      detail: userInfo.error
    });
  }

  const user = userInfo.data.user;
  const cardId = req.params.id;

  const { error } = await supa
    .from("cards")
    .delete()
    .eq("id", cardId)
    .eq("user_id", user.id);

  if (error) {
    console.log("🔥 SUPABASE DELETE ERROR:", error);
    return res.status(400).json({ error: error.message });
  }

  res.json({ message: "Card deleted!" });
});

/* ---------------------------------------
   🎮 MINI-MVP GAME LOGIC
----------------------------------------- */
app.post("/game/players", (req, res) => {
  const { players, total_cost, rule } = req.body;

  if (!Array.isArray(players) || players.length < 2) {
    return res.status(400).json({ error: "Provide at least 2 players." });
  }

  const cleanPlayers = players
    .map((p) => String(p).trim())
    .filter((p) => p.length > 0);
  if (cleanPlayers.length < 2) {
    return res.status(400).json({ error: "Player names cannot be empty." });
  }

  const total = Number(total_cost);
  if (Number.isNaN(total) || total <= 0) {
    return res.status(400).json({ error: "total_cost must be positive." });
  }

  const ruleToUse = rule === "even_split" ? "even_split" : "winner_free";

  currentGame = {
    players: cleanPlayers.map((name) => ({ name })),
    total_cost: total,
    rule: ruleToUse
  };

  console.log("🎮 NEW GAME SET:", currentGame);

  res.json({
    message: "Game created in memory.",
    game: currentGame
  });
});

app.post("/game/start", (req, res) => {
  if (!currentGame.players || currentGame.players.length < 2) {
    return res
      .status(400)
      .json({ error: "No game set. Call /game/players first." });
  }

  const { players, total_cost, rule } = currentGame;
  const n = players.length;

  const shuffled = [...players].sort(() => Math.random() - 0.5);

  shuffled.forEach((p, idx) => (p.rank = idx + 1));

  let results;

  if (rule === "even_split") {
    const share = total_cost / n;
    results = shuffled.map((p) => ({
      name: p.name,
      rank: p.rank,
      recommended: Number(share.toFixed(2))
    }));
  } else {
    const losers = shuffled.slice(1);
    const loserShare = total_cost / losers.length;

    results = shuffled.map((p, idx) => ({
      name: p.name,
      rank: p.rank,
      recommended: idx === 0 ? 0 : Number(loserShare.toFixed(2))
    }));
  }

  currentGame.players = results;

  console.log("🎮 GAME RESULT:", { rule, total_cost, players: results });

  res.json({
    rule,
    total_cost,
    players: results
  });
});

/* ---------------------------------------
   ⭐ SESSION HOSTING — NEW ROUTES
----------------------------------------- */

/* -----------------------
   POST /sessions (host)
------------------------- */
app.post("/sessions", async (req, res) => {
  const supa = supaForRequest(req);

  const { data: { user }, error: userErr } = await supa.auth.getUser();
  if (userErr || !user)
    return res.status(401).json({ error: "Unauthorized" });

  let { total_cost, rule, host_name } = req.body;

  const total = Number(total_cost);
  if (Number.isNaN(total) || total <= 0) {
    return res.status(400).json({ error: "total_cost must be > 0" });
  }

  if (!["winner_free", "even_split"].includes(rule)) {
    rule = "winner_free";
  }

  // generate unique session code
  let code;
  let attempts = 0;
  while (!code && attempts < 10) {
    const candidate = generateSessionCode();
    const { data: existing } = await supa
      .from("sessions")
      .select("id")
      .eq("code", candidate)
      .maybeSingle();

    if (!existing) code = candidate;
    attempts++;
  }

  if (!code) {
    return res
      .status(500)
      .json({ error: "Could not generate session code" });
  }

  const { data: session, error } = await supa
    .from("sessions")
    .insert([
      {
        code,
        host_id: user.id,
        total_cost: total,
        rule,
        status: "waiting"
      }
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
        is_host: true
      }
    ]);
  }

  res.json({
    session_id: session.id,
    code: session.code,
    status: session.status,
    rule: session.rule,
    total_cost: session.total_cost
  });
});

/* -----------------------
   GET /sessions/:code
   (lobby state)
------------------------- */
app.get("/sessions/:code", async (req, res) => {
  const { code } = req.params;
  const supa = supaForRequest(req);

  const { data: { user } } = await supa.auth.getUser();

  const { data: session, error: sessionErr } = await supa
    .from("sessions")
    .select("*")
    .eq("code", code)
    .single();

  if (sessionErr || !session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const { data: players, error: playersErr } = await supa
    .from("session_players")
    .select("*")
    .eq("session_id", session.id);

  if (playersErr) {
    return res.status(400).json({ error: playersErr.message });
  }

  res.json({
    session,
    players,
    current_user_id: user ? user.id : null
  });
});

/* ----------------------------
   POST /sessions/:code/join
----------------------------- */
app.post("/sessions/:code/join", async (req, res) => {
  const { code } = req.params;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Name is required." });
  }

  const supa = supaForRequest(req);
  const { data: { user } } = await supa.auth.getUser();

  const { data: session, error: sessionErr } = await supa
    .from("sessions")
    .select("*")
    .eq("code", code)
    .single();

  if (sessionErr || !session) {
    return res.status(404).json({ error: "Session not found." });
  }

  if (session.status !== "waiting") {
    return res.status(400).json({ error: "Session is not joinable." });
  }

  const { data: player, error: joinErr } = await supa
    .from("session_players")
    .insert([
      {
        session_id: session.id,
        user_id: user ? user.id : null,
        name: name.trim(),
        is_host: false
      }
    ])
    .select()
    .single();

  if (joinErr) return res.status(400).json({ error: joinErr.message });

  res.json({
    session_id: session.id,
    player_id: player.id,
    name: player.name
  });
});

/* ----------------------------
   POST /sessions/:code/start
----------------------------- */
app.post("/sessions/:code/start", async (req, res) => {
  const { code } = req.params;
  const supa = supaForRequest(req);

  const { data: { user }, error: userErr } = await supa.auth.getUser();
  if (userErr || !user)
    return res.status(401).json({ error: "Unauthorized" });

  const { data: session, error } = await supa
    .from("sessions")
    .select("*")
    .eq("code", code)
    .single();

  if (error || !session) {
    return res.status(404).json({ error: "Session not found" });
  }

  if (session.host_id !== user.id) {
    return res.status(403).json({ error: "Only host can start the game." });
  }

  const { error: updErr } = await supa
    .from("sessions")
    .update({ status: "in_progress" })
    .eq("id", session.id);

  if (updErr) return res.status(400).json({ error: updErr.message });

  res.json({ message: "Game started." });
});

/* ---------------------------------------
   START SERVER
----------------------------------------- */
app.listen(process.env.PORT, () => {
  console.log(`✅ Server running on http://localhost:${process.env.PORT}`);
});
