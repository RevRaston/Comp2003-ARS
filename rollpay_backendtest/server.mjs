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

// ⭐ SESSION LEVELS ROUTES
import sessionLevelsRoutes from "./routes/sessionLevels.mjs";

// ✅ WebSocket attach
import { attachWs } from "./wsServer.mjs";

// ✅ Receipt scan route
import scanReceiptRoutes from "./routes/scanReceipt.mjs";

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
   HELPERS
----------------------------------------- */
function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getPlayerName(player, fallbackIndex = 0) {
  return (
    player?.name ||
    player?.display_name ||
    player?.displayName ||
    `Player ${fallbackIndex + 1}`
  );
}

function normalizeRoundEntry(entry, fallbackRound = 1) {
  return {
    round: Number(entry?.round || fallbackRound),
    gameId: String(entry?.gameId || entry?.game_id || "unknown"),
    winnerKey:
      entry?.winnerKey === undefined || entry?.winnerKey === null
        ? null
        : String(entry.winnerKey),
    winnerName: entry?.winnerName || null,
    scores: safeArray(entry?.scores),
    createdAt: entry?.createdAt || new Date().toISOString(),
  };
}

function buildFinalResults(sessionPlayers = [], roundResults = []) {
  const players = safeArray(sessionPlayers);

  const standings = players.map((player, index) => ({
    key: String(
      player?.user_id ??
        player?.userId ??
        player?.id ??
        player?.profile_id ??
        player?.profileId ??
        `player-${index + 1}`
    ),
    name: getPlayerName(player, index),
    wins: 0,
    score: 0,
    roundsPlayed: 0,
  }));

  const byKey = new Map(standings.map((p) => [p.key, p]));

  for (const result of safeArray(roundResults)) {
    const winnerKey =
      result?.winnerKey === undefined || result?.winnerKey === null
        ? null
        : String(result.winnerKey);

    if (winnerKey && byKey.has(winnerKey)) {
      byKey.get(winnerKey).wins += 1;
    }

    const scores = safeArray(result?.scores);
    if (scores.length > 0) {
      for (const scoreEntry of scores) {
        const candidateKeyRaw =
          scoreEntry?.winnerKey ??
          scoreEntry?.playerKey ??
          scoreEntry?.user_id ??
          scoreEntry?.userId ??
          scoreEntry?.id ??
          null;

        const candidateKey =
          candidateKeyRaw === null || candidateKeyRaw === undefined
            ? null
            : String(candidateKeyRaw);

        const candidateName =
          scoreEntry?.playerName || scoreEntry?.name || null;

        const numericScore = Number(scoreEntry?.score || 0);

        let row = candidateKey ? byKey.get(candidateKey) : null;

        if (!row && candidateName) {
          row = standings.find((p) => p.name === candidateName) || null;
        }

        if (row) {
          row.score += numericScore;
          row.roundsPlayed += 1;
        }
      }
    } else {
      for (const row of standings) {
        row.roundsPlayed += 1;
      }
    }
  }

  standings.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });

  return standings.map((player, index) => ({
    rank: index + 1,
    key: player.key,
    name: player.name,
    wins: player.wins,
    totalScore: player.score,
    roundsPlayed: player.roundsPlayed,
    recommended: 0,
  }));
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

// ✅ Receipt routes
app.use("/", scanReceiptRoutes);

// Regular backend client
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ✅ Admin/service-role backend client
export const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
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

  shuffled.forEach((p, i) => {
    p.rank = i + 1;
  });

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

  const { total_cost, rule, host_name } = req.body;
  const total = Number(total_cost);

  if (Number.isNaN(total) || total <= 0) {
    return res.status(400).json({ error: "Invalid cost" });
  }

  let code;
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
        current_round: null,
        round_results: [],
        final_results: [],
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

// Host starts session
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

// Host starts a specific round
app.post("/sessions/:code/start-round", async (req, res) => {
  const { code } = req.params;
  const { round_number } = req.body || {};

  const supa = adminSupabase;
  const roundNum = Number(round_number) || 1;

  try {
    const { data: session, error: sessionErr } = await supa
      .from("sessions")
      .select("*")
      .eq("code", code)
      .single();

    if (sessionErr || !session) {
      console.error("[start-round] session lookup error:", sessionErr);
      return res.status(404).json({ error: "Session not found" });
    }

    const { data: updated, error: updateErr } = await supa
      .from("sessions")
      .update({ current_round: roundNum })
      .eq("id", session.id)
      .select("id, code, current_round")
      .single();

    if (updateErr) {
      console.error("[start-round] updateErr:", updateErr);
      return res.status(500).json({
        error: "Failed to update current_round",
        detail: updateErr.message,
      });
    }

    return res.json({
      ok: true,
      session: updated,
    });
  } catch (err) {
    console.error("[start-round] unexpected error:", err);
    return res.status(500).json({
      error: "Failed to update current_round",
      detail: String(err),
    });
  }
});

// Save one round result
app.post("/sessions/:code/round-result", async (req, res) => {
  const { code } = req.params;
  const { roundResult } = req.body || {};
  const supa = adminSupabase;

  try {
    const { data: session, error: sessionErr } = await supa
      .from("sessions")
      .select("id, code, round_results, current_round")
      .eq("code", code)
      .single();

    if (sessionErr || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (!roundResult || typeof roundResult !== "object") {
      return res.status(400).json({ error: "Missing roundResult payload" });
    }

    const currentResults = safeArray(session.round_results);
    const normalizedIncoming = normalizeRoundEntry(
      roundResult,
      Number(session.current_round || 1)
    );

    const nextResults = currentResults.filter(
      (entry) =>
        !(
          Number(entry?.round || 0) === normalizedIncoming.round &&
          String(entry?.gameId || "unknown") === normalizedIncoming.gameId
        )
    );

    nextResults.push(normalizedIncoming);
    nextResults.sort((a, b) => Number(a.round || 0) - Number(b.round || 0));

    const { data: updated, error: updateErr } = await supa
      .from("sessions")
      .update({
        round_results: nextResults,
      })
      .eq("id", session.id)
      .select("id, code, round_results")
      .single();

    if (updateErr) {
      console.error("[round-result] update error:", updateErr);
      return res.status(500).json({
        error: "Failed to save round result",
        detail: updateErr.message,
      });
    }

    return res.json({
      ok: true,
      roundResults: updated.round_results || [],
    });
  } catch (err) {
    console.error("[round-result] unexpected error:", err);
    return res.status(500).json({
      error: "Failed to save round result",
      detail: String(err),
    });
  }
});

// Get round results
app.get("/sessions/:code/round-results", async (req, res) => {
  const { code } = req.params;
  const supa = adminSupabase;

  try {
    const { data: session, error } = await supa
      .from("sessions")
      .select("id, code, round_results")
      .eq("code", code)
      .single();

    if (error || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.json({
      ok: true,
      roundResults: session.round_results || [],
    });
  } catch (err) {
    console.error("[get round-results] unexpected error:", err);
    return res.status(500).json({
      error: "Failed to fetch round results",
      detail: String(err),
    });
  }
});

// Host advances to next round
app.post("/sessions/:code/advance-round", async (req, res) => {
  const { code } = req.params;
  const supa = adminSupabase;

  try {
    const { data: session, error: sessionErr } = await supa
      .from("sessions")
      .select("id, code, current_round")
      .eq("code", code)
      .single();

    if (sessionErr || !session) {
      console.error("[advance-round] session lookup error:", sessionErr);
      return res.status(404).json({ error: "Session not found" });
    }

    const currentRound = Number(session.current_round || 1);
    const nextRound = currentRound + 1;

    const { data: updated, error: updateErr } = await supa
      .from("sessions")
      .update({ current_round: nextRound })
      .eq("id", session.id)
      .select("id, code, current_round")
      .single();

    if (updateErr) {
      console.error("[advance-round] update error:", updateErr);
      return res.status(500).json({
        error: "Failed to advance round",
        detail: updateErr.message,
      });
    }

    return res.json({
      ok: true,
      session: updated,
    });
  } catch (err) {
    console.error("[advance-round] unexpected error:", err);
    return res.status(500).json({
      error: "Failed to advance round",
      detail: String(err),
    });
  }
});

// Host finishes session and computes final results
app.post("/sessions/:code/finish", async (req, res) => {
  const { code } = req.params;
  const supa = adminSupabase;

  try {
    const { data: session, error: sessionErr } = await supa
      .from("sessions")
      .select("id, code, status, total_cost, rule, round_results")
      .eq("code", code)
      .single();

    if (sessionErr || !session) {
      console.error("[finish-session] session lookup error:", sessionErr);
      return res.status(404).json({ error: "Session not found" });
    }

    const { data: players, error: playersErr } = await supa
      .from("session_players")
      .select("*")
      .eq("session_id", session.id)
      .order("is_host", { ascending: false });

    if (playersErr) {
      console.error("[finish-session] players lookup error:", playersErr);
      return res.status(500).json({
        error: "Failed to load players for final results",
        detail: playersErr.message,
      });
    }

    let finalResults = buildFinalResults(players || [], session.round_results || []);

    const totalCost = Number(session.total_cost || 0);
    const rule = session.rule || "winner_free";

    if (finalResults.length > 0) {
      if (rule === "even_split") {
        const share = finalResults.length > 0 ? totalCost / finalResults.length : 0;
        finalResults = finalResults.map((player) => ({
          ...player,
          recommended: Number(share.toFixed(2)),
        }));
      } else {
        const loserCount = Math.max(finalResults.length - 1, 0);
        const loserShare = loserCount > 0 ? totalCost / loserCount : 0;

        finalResults = finalResults.map((player, index) => ({
          ...player,
          recommended: Number((index === 0 ? 0 : loserShare).toFixed(2)),
        }));
      }
    }

    const { data: updated, error: updateErr } = await supa
      .from("sessions")
      .update({
        status: "finished",
        final_results: finalResults,
      })
      .eq("id", session.id)
      .select("id, code, status, final_results")
      .single();

    if (updateErr) {
      console.error("[finish-session] update error:", updateErr);
      return res.status(500).json({
        error: "Failed to finish session",
        detail: updateErr.message,
      });
    }

    return res.json({
      ok: true,
      session: updated,
      finalResults: updated.final_results || [],
    });
  } catch (err) {
    console.error("[finish-session] unexpected error:", err);
    return res.status(500).json({
      error: "Failed to finish session",
      detail: String(err),
    });
  }
});

// Shared session state
app.get("/sessions/:code", async (req, res) => {
  const { code } = req.params;
  const supa = adminSupabase;

  let current_user_id = null;
  try {
    const authed = supaForRequest(req);
    const {
      data: { user },
    } = await authed.auth.getUser();
    current_user_id = user ? user.id : null;
  } catch {
    current_user_id = null;
  }

  const { data: session, error } = await supa
    .from("sessions")
    .select("*")
    .eq("code", code)
    .single();

  if (error || !session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const { data: players, error: playersErr } = await supa
    .from("session_players")
    .select("*")
    .eq("session_id", session.id)
    .order("is_host", { ascending: false });

  if (playersErr) {
    return res.status(500).json({ error: playersErr.message });
  }

  res.json({
    session,
    players: players || [],
    roundResults: session.round_results || [],
    finalResults: session.final_results || [],
    current_user_id,
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
   CONFIRMED SPLIT ROUTES
----------------------------------------- */

// Save confirmed split
app.post("/sessions/:code/confirmed-split", async (req, res) => {
  const { code } = req.params;
  const { confirmedSplit } = req.body || {};
  const supa = adminSupabase;

  try {
    const { data: session, error: sessionErr } = await supa
      .from("sessions")
      .select("id, code")
      .eq("code", code)
      .single();

    if (sessionErr || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (!confirmedSplit || typeof confirmedSplit !== "object") {
      return res.status(400).json({ error: "Missing confirmedSplit payload" });
    }

    const payload = {
      ...confirmedSplit,
      saved_at: new Date().toISOString(),
    };

    const { data: updated, error: updateErr } = await supa
      .from("sessions")
      .update({
        confirmed_split: payload,
        split_confirmed_at: new Date().toISOString(),
      })
      .eq("id", session.id)
      .select("id, code, confirmed_split, split_confirmed_at")
      .single();

    if (updateErr) {
      console.error("[confirmed-split] update error:", updateErr);
      return res.status(500).json({
        error: "Failed to save confirmed split",
        detail: updateErr.message,
      });
    }

    return res.json({
      ok: true,
      session: updated,
    });
  } catch (err) {
    console.error("[confirmed-split] unexpected error:", err);
    return res.status(500).json({
      error: "Failed to save confirmed split",
      detail: String(err),
    });
  }
});

// Get confirmed split
app.get("/sessions/:code/confirmed-split", async (req, res) => {
  const { code } = req.params;
  const supa = adminSupabase;

  try {
    const { data: session, error } = await supa
      .from("sessions")
      .select("id, code, confirmed_split, split_confirmed_at")
      .eq("code", code)
      .single();

    if (error || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.json({
      ok: true,
      confirmedSplit: session.confirmed_split || null,
      splitConfirmedAt: session.split_confirmed_at || null,
    });
  } catch (err) {
    console.error("[get confirmed-split] unexpected error:", err);
    return res.status(500).json({
      error: "Failed to fetch confirmed split",
      detail: String(err),
    });
  }
});

// Clear confirmed split
app.delete("/sessions/:code/confirmed-split", async (req, res) => {
  const { code } = req.params;
  const supa = adminSupabase;

  try {
    const { data: session, error: sessionErr } = await supa
      .from("sessions")
      .select("id, code")
      .eq("code", code)
      .single();

    if (sessionErr || !session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const { data: updated, error: updateErr } = await supa
      .from("sessions")
      .update({
        confirmed_split: null,
        split_confirmed_at: null,
      })
      .eq("id", session.id)
      .select("id, code, confirmed_split, split_confirmed_at")
      .single();

    if (updateErr) {
      console.error("[clear confirmed-split] update error:", updateErr);
      return res.status(500).json({
        error: "Failed to clear confirmed split",
        detail: updateErr.message,
      });
    }

    return res.json({
      ok: true,
      session: updated,
    });
  } catch (err) {
    console.error("[clear confirmed-split] unexpected error:", err);
    return res.status(500).json({
      error: "Failed to clear confirmed split",
      detail: String(err),
    });
  }
});

/* ---------------------------------------
   SESSION LEVEL ROUTES
----------------------------------------- */
app.use("/sessions", sessionLevelsRoutes);

/* ---------------------------------------
   START SERVER (HTTP + WS)
----------------------------------------- */
const PORT = Number(process.env.PORT) || 3000;
const server = http.createServer(app);

// Attach WebSocket server at /ws
attachWs(server, { path: "/ws" });

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`🧠 WS running at ws://localhost:${PORT}/ws`);
});